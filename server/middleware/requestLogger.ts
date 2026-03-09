/**
 * Request Logger Middleware
 * Zero-dependency Express middleware for structured request logging.
 * Logs all /api/* requests with method, url, status, duration, correlationId.
 */

import { Request, Response, NextFunction } from 'express';
import logger from '../services/logger';

const httpLogger = logger.child({ module: 'http' });

export function requestLoggerMiddleware(req: Request, res: Response, next: NextFunction) {
  if (!req.url?.startsWith('/api') || req.url === '/api/health') return next();

  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    const data: Record<string, unknown> = {
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      duration,
      correlationId: (req as any).correlationId,
      employeeId: (req as any).employeeId,
    };
    const msg = `${req.method} ${req.url} ${res.statusCode} ${duration}ms`;

    if (res.statusCode >= 500) httpLogger.error(data, msg);
    else if (res.statusCode >= 400) httpLogger.warn(data, msg);
    else httpLogger.info(data, msg);
  });
  next();
}
