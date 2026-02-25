import { Router } from 'express';
import passport from 'passport';
import { db } from '../db';
import { employeeRole, role } from '../../shared/schema';
import { eq, and } from 'drizzle-orm';
import { permissionService } from '../services/permissionService';

// Check if SAML is enabled via environment variable
const isSamlEnabled = () => {
  return process.env.SAML_ENABLED === 'true' && 
         process.env.SAML_IDP_LOGIN_URL && 
         process.env.SAML_ENTRYPOINT;
};

export function createAuthRoutes() {
  const router = Router();
  
  /**
   * Login endpoint - Redirects to IdP or returns info for development
   * In production with SAML enabled: redirects to SAML_IDP_LOGIN_URL
   * In development: returns a message indicating dev mode
   */
  router.get('/login', (req, res) => {
    if (isSamlEnabled() && process.env.SAML_IDP_LOGIN_URL) {
      console.log('[Auth] Redirecting to SAML IdP:', process.env.SAML_IDP_LOGIN_URL);
      return res.redirect(process.env.SAML_IDP_LOGIN_URL);
    }
    
    // Development mode - no SAML configured
    console.log('[Auth] SAML not configured, returning dev mode response');
    return res.status(200).json({
      message: 'Development mode - SAML not configured',
      samlEnabled: false,
      hint: 'Set SAML_ENABLED=true and configure SAML_IDP_LOGIN_URL for production SSO'
    });
  });
  
  /**
   * Logout endpoint - Destroys session and redirects to home
   */
  router.post('/logout', (req, res) => {
    const employeeId = req.session?.employeeId;
    console.log('[Auth] Logout requested for employee:', employeeId);
    
    req.session.destroy((err) => {
      if (err) {
        console.error('[Auth] Session destruction error:', err);
        return res.status(500).json({ error: 'Failed to logout' });
      }
      
      // Clear session cookie
      res.clearCookie('connect.sid');
      
      console.log('[Auth] Session destroyed successfully');
      return res.json({ success: true, message: 'Logged out successfully' });
    });
  });
  
  /**
   * Get current authentication status
   */
  router.get('/status', (req, res) => {
    const isAuthenticated = !!req.session?.employeeId;
    
    res.json({
      isAuthenticated,
      employeeId: req.session?.employeeId || null,
      samlEnabled: isSamlEnabled()
    });
  });
  
  /**
   * SAML Login - Initiate SSO
   * Redirects user to RSA IdP for authentication
   */
  router.get('/saml/login', 
    passport.authenticate('saml', { 
      failureRedirect: '/login-error',
      session: false 
    })
  );
  
  /**
   * Assertion Consumer Service (ACS) - Receive SAML Response
   * This endpoint receives the SAML response from RSA IdP after authentication
   */
  router.post('/saml/acs',
    passport.authenticate('saml', { 
      failureRedirect: '/login-error',
      session: false 
    }),
    async (req, res) => {
      try {
        console.log('[SAML ACS] Processing authentication callback for employee:', req.user?.employeeId);

        if (!req.user) {
          console.error('[SAML ACS] No user object in request');
          return res.redirect('/login-error');
        }

        // Store user info in session
        req.session.employeeId = req.user.employeeId;
        req.session.employeeNumber = req.user.employeeNumber;
        req.session.firstName = req.user.firstName;
        req.session.lastName = req.user.lastName;
        req.session.email = req.user.email;
        req.session.department = req.user.department;
        req.session.samlRoleKey = req.user.samlRoleKey;
        req.session.lastActivity = new Date();
        
        // Fetch user roles
        const userRoles = await db
          .select({
            roleName: role.roleName
          })
          .from(employeeRole)
          .innerJoin(role, eq(employeeRole.roleId, role.roleId))
          .where(
            and(
              eq(employeeRole.employeeId, req.user.employeeId),
              eq(employeeRole.isActive, true)
            )
          );
        
        req.session.roles = userRoles.map(r => r.roleName);
        
        // Fetch user permissions
        const userPermissions = await permissionService.getUserPermissions(req.user.employeeId);
        req.session.permissions = userPermissions.permissions.map((p: any) => p.permissionKey);
        
        console.log('[SAML ACS] Session created:', {
          employeeId: req.user.employeeId,
          roles: req.session.roles,
          permissionCount: req.session.permissions?.length || 0
        });
        
        // Regenerate session ID for security
        req.session.regenerate((err) => {
          if (err) {
            console.error('[SAML ACS] Session regeneration error:', err);
          }
          
          console.log('[SAML ACS] Redirecting to application home');
          res.redirect('/');
        });
        
      } catch (error) {
        console.error('[SAML ACS] Error processing authentication callback:', error);
        res.redirect('/login-error');
      }
    }
  );
  
  /**
   * SAML Metadata - Expose SP metadata for IdP configuration
   * Share this URL with your RSA SAML administrator
   */
  router.get('/saml/metadata', (req, res) => {
    try {
      const strategy = (passport as any)._strategy('saml');
      
      if (!strategy || typeof strategy.generateServiceProviderMetadata !== 'function') {
        console.error('[SAML Metadata] Strategy not configured properly');
        return res.status(500).send('SAML strategy not configured');
      }
      
      const metadata = strategy.generateServiceProviderMetadata();
      
      console.log('[SAML Metadata] Generated metadata:', {
        length: metadata.length,
        preview: metadata.substring(0, 100)
      });
      
      res.type('application/xml');
      res.send(metadata);
    } catch (error) {
      console.error('[SAML Metadata] Error generating metadata:', error);
      res.status(500).send('Error generating metadata');
    }
  });
  
  /**
   * SAML Logout - SP-initiated logout
   * Destroys session and redirects to IdP logout
   */
  router.get('/saml/logout', (req, res) => {
    const employeeId = req.session?.employeeId;
    console.log('[SAML Logout] Initiating logout for employee:', employeeId);
    
    try {
      const strategy = (passport as any)._strategy('saml');
      
      if (!strategy || typeof strategy.logout !== 'function') {
        console.warn('[SAML Logout] Strategy does not support logout, destroying session only');
        
        // Destroy session
        req.session.destroy((err) => {
          if (err) {
            console.error('[SAML Logout] Session destruction error:', err);
          }
          res.redirect('/logged-out');
        });
        return;
      }
      
      strategy.logout(req, (err: any, requestUrl: string) => {
        if (err) {
          console.error('[SAML Logout] Error generating logout request:', err);
          
          // Destroy session anyway
          req.session.destroy((destroyErr) => {
            if (destroyErr) {
              console.error('[SAML Logout] Session destruction error:', destroyErr);
            }
            res.redirect('/logged-out');
          });
          return;
        }
        
        // Destroy session
        req.session.destroy((destroyErr) => {
          if (destroyErr) {
            console.error('[SAML Logout] Session destruction error:', destroyErr);
          }
          
          console.log('[SAML Logout] Redirecting to IdP logout:', requestUrl);
          // Redirect to IdP logout
          res.redirect(requestUrl);
        });
      });
    } catch (error) {
      console.error('[SAML Logout] Unexpected error:', error);
      
      // Destroy session
      req.session.destroy((err) => {
        if (err) {
          console.error('[SAML Logout] Session destruction error:', err);
        }
        res.redirect('/logged-out');
      });
    }
  });
  
  /**
   * Logout callback - IdP redirects here after logout
   */
  router.get('/saml/logout/callback', (req, res) => {
    console.log('[SAML Logout Callback] IdP logout completed');
    res.redirect('/logged-out');
  });
  
  /**
   * Login error page
   */
  router.get('/login-error', (req, res) => {
    res.status(401).json({
      error: 'Authentication failed',
      message: 'Unable to authenticate with SAML. Please contact your administrator.'
    });
  });
  
  /**
   * Logged out page
   */
  router.get('/logged-out', (req, res) => {
    res.json({
      message: 'You have been logged out successfully'
    });
  });
  
  return router;
}
