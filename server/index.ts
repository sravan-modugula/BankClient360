import express, { type Request, Response, NextFunction } from "express";
import passport from "passport";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { initializeServerTimezone } from "./utils/timezone";
import { samlRoleMappingService } from "./services/samlRoleMappingService";
import logger from "./services/logger";
import { correlationIdMiddleware } from "./middleware/correlationId";
import { requestLoggerMiddleware } from "./middleware/requestLogger";
import { createSessionMiddleware, createSamlStrategy } from "./auth";

const app = express();

// Correlation ID must be first — all downstream middleware/routes use it
app.use(correlationIdMiddleware);

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

const samlEnabled = process.env.SAML_ENABLED === 'true';

if (samlEnabled) {
  logger.info({ module: 'auth' }, 'SAML SSO enabled — mounting session, passport, and SAML strategy');

  app.use(createSessionMiddleware());
  // Cast to any: @types/passport's Strategy interface is narrower than the
  // actual passport-saml Strategy class — known type-package gap.
  passport.use(createSamlStrategy() as any);

  // Round-trip the entire user object through the session — Option B
  // (no employee-record upsert), so there's no DB row to deserialize against.
  passport.serializeUser((user: any, done) => done(null, user));
  passport.deserializeUser((user: any, done) => done(null, user));

  app.use(passport.initialize());
  app.use(passport.session());

  // Bridge: legacy route handlers read req.employeeId. The ACS handler
  // populates session.employeeId with the resolved DB employee id; this
  // middleware copies it onto req for downstream consumers.
  app.use((req, _res, next) => {
    const sessionEmployeeId = (req as any).session?.employeeId;
    const userEmployeeId = (req.user as any)?.employeeId;
    const employeeId = sessionEmployeeId || userEmployeeId;
    if (employeeId) {
      req.employeeId = employeeId;
    }
    next();
  });
} else if (process.env.NODE_ENV === 'development') {
  logger.info({ module: 'auth' }, 'Using mock authentication (development mode)');
  app.use(async (req, _res, next) => {
    req.employeeId = 1; // Sarah Johnson, System Admin
    next();
  });
} else {
  logger.warn({ module: 'auth' }, 'No authentication configured (SAML_ENABLED=false in non-development env)');
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
