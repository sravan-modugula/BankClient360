import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { initializeServerTimezone } from "./utils/timezone";
import { samlRoleMappingService } from "./services/samlRoleMappingService";
import logger from "./services/logger";
import { correlationIdMiddleware } from "./middleware/correlationId";
import { requestLoggerMiddleware } from "./middleware/requestLogger";

const app = express();

// Correlation ID must be first — all downstream middleware/routes use it
app.use(correlationIdMiddleware);

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// DEVELOPMENT ONLY: Mock user session
// Only active when NODE_ENV=development and SAML is not enabled
if (process.env.NODE_ENV === 'development' && process.env.SAML_ENABLED !== 'true') {
  logger.info({ module: 'auth' }, 'Using mock authentication (development mode)');

  app.use(async (req, res, next) => {
    // Mock authenticated user for development testing
    req.employeeId = 1; // Sarah Johnson, System Admin
    next();
  });
} else {
  logger.info({ module: 'auth' }, 'Mock authentication disabled - using real authentication');
}

// Structured request logging (replaces old custom logger)
app.use(requestLoggerMiddleware);

(async () => {
  // Initialize server timezone to PST
  initializeServerTimezone();

  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    logger.error({ err, status, module: 'error-handler' }, message);
    res.status(status).json({ message });
  });

  // API 404 handler moved to routes.ts to ensure it comes after all route definitions

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || '5000', 10);
  server.listen({
    port,
    host: "0.0.0.0",
  }, () => {
    log(`serving on port ${port}`);
  });
})();
