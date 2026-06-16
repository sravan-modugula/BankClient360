import { Request, Response, NextFunction } from 'express';
import logger from '../services/logger';

const gateLogger = logger.child({ module: 'auth-gate' });

const isSamlEnabled = () => process.env.SAML_ENABLED === 'true';
const isDev = () => process.env.NODE_ENV === 'development';

const ALWAYS_ALLOWED_PREFIXES = [
  '/api/auth/',
  '/saml/',
  '/assets/',
  '/IdPServlet',
];

const ALWAYS_ALLOWED_EXACT = new Set(['/health', '/favicon.ico']);

const DEV_ASSET_PREFIXES = ['/@vite', '/@react-refresh', '/@id', '/src/', '/node_modules/'];

function isAllowlisted(path: string): boolean {
  if (ALWAYS_ALLOWED_EXACT.has(path)) return true;
  if (ALWAYS_ALLOWED_PREFIXES.some((p) => path.startsWith(p))) return true;
  if (isDev() && DEV_ASSET_PREFIXES.some((p) => path.startsWith(p))) return true;
  return false;
}

function looksLikeApiCall(req: Request): boolean {
  if (req.method !== 'GET') return true;
  if (req.xhr) return true;
  const accept = req.headers.accept || '';
  if (accept.includes('application/json') && !accept.includes('text/html')) return true;
  if (req.path.startsWith('/api/')) return true;
  return false;
}

export function authGate(req: Request, res: Response, next: NextFunction) {
  if (!isSamlEnabled()) return next();

  if (isAllowlisted(req.path)) return next();

  const sessionEmployeeId = req.session?.employeeId;
  const userEmployeeId = (req.user as any)?.employeeId;
  const sessionEmail = req.session?.email;
  const isAuthenticated = !!sessionEmployeeId || !!userEmployeeId || !!sessionEmail || !!req.user;

  if (isAuthenticated) return next();

  if (looksLikeApiCall(req)) {
    return res.status(401).json({ error: 'unauthenticated' });
  }

  gateLogger.info({ path: req.path }, 'Unauthenticated navigation — redirecting to SSO');
  return res.redirect('/api/auth/login');
}
