import { Request, Response, NextFunction } from 'express';

/**
 * Middleware to require authentication
 * Checks for valid session and redirects to SAML login if not authenticated
 */
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.session?.employeeId) {
    console.log('[Auth] Unauthorized access attempt:', {
      path: req.path,
      method: req.method,
      hasSession: !!req.session,
      sessionId: req.session?.id
    });
    
    return res.status(401).json({ 
      message: 'Authentication required',
      redirectTo: '/saml/login'
    });
  }
  
  // Set employeeId on request for backward compatibility with existing code
  req.employeeId = req.session.employeeId;
  
  next();
}

/**
 * Middleware to require specific permission
 * Use after requireAuth middleware
 */
export function requirePermission(permission: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.session?.permissions?.includes(permission)) {
      console.log('[Auth] Permission denied:', {
        employeeId: req.session?.employeeId,
        requiredPermission: permission,
        userPermissions: req.session?.permissions || []
      });
      
      return res.status(403).json({ 
        message: 'Insufficient permissions',
        required: permission
      });
    }
    next();
  };
}

/**
 * Middleware to require specific role
 * Use after requireAuth middleware
 */
export function requireRole(role: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.session?.roles?.includes(role)) {
      console.log('[Auth] Role check failed:', {
        employeeId: req.session?.employeeId,
        requiredRole: role,
        userRoles: req.session?.roles || []
      });
      
      return res.status(403).json({ 
        message: 'Insufficient role',
        required: role
      });
    }
    next();
  };
}
