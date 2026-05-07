import { Router } from 'express';
import passport from 'passport';
import { permissionService } from '../services/permissionService';
import logger from '../services/logger';
import { emitAuditEvent } from '../services/auditService';
import { AuditEventType } from '../../shared/auditEvents';

const authLogger = logger.child({ module: 'auth' });

// Check if SAML is enabled via environment variable
const isSamlEnabled = () => {
  return process.env.SAML_ENABLED === 'true' &&
         !!process.env.SAML_ENTRYPOINT;
};

export function createAuthRoutes() {
  const router = Router();

  /**
   * Login endpoint - Redirects to IdP or returns info for development
   */
  router.get('/login', (req, res) => {
    if (isSamlEnabled()) {
      authLogger.info('Redirecting to SP-initiated SAML login');
      emitAuditEvent({
        eventType: AuditEventType.AUTH_LOGIN_SUCCESS,
        action: 'SAML login redirect initiated',
        outcome: 'success',
        actor: { ipAddress: req.ip, userAgent: req.headers['user-agent'] },
        correlationId: req.correlationId,
        module: 'auth',
      });
      return res.redirect('/api/auth/saml/login');
    }

    authLogger.info('SAML not configured, returning dev mode response');
    return res.status(200).json({
      message: 'Development mode - SAML not configured',
      samlEnabled: false,
      hint: 'Set SAML_ENABLED=true and configure SAML_ENTRYPOINT (plus SAML_CALLBACK_URL, SAML_CERT, SAML_ISSUER) for production SSO'
    });
  });

  /**
   * Logout endpoint - Destroys session and redirects to home
   */
  router.post('/logout', (req, res) => {
    const employeeId = req.session?.employeeId;
    authLogger.info({ employeeId }, 'Logout requested');

    emitAuditEvent({
      eventType: AuditEventType.AUTH_LOGOUT,
      action: 'User logout',
      outcome: 'success',
      actor: { employeeId, ipAddress: req.ip, userAgent: req.headers['user-agent'] },
      correlationId: req.correlationId,
      module: 'auth',
    });

    req.session.destroy((err) => {
      if (err) {
        authLogger.error({ err }, 'Session destruction error');
        return res.status(500).json({ error: 'Failed to logout' });
      }

      res.clearCookie('connect.sid');
      authLogger.info({ employeeId }, 'Session destroyed successfully');
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
   */
  router.get('/saml/login',
    passport.authenticate('saml', {
      failureRedirect: '/login-error',
      session: false
    })
  );

  /**
   * Assertion Consumer Service (ACS) - Receive SAML Response
   */
  router.post('/saml/acs',
    passport.authenticate('saml', {
      failureRedirect: '/login-error',
      session: false
    }),
    async (req, res) => {
      try {
        authLogger.info({ employeeId: req.user?.employeeId }, 'Processing SAML ACS callback');

        if (!req.user) {
          authLogger.error('No user object in SAML ACS request');
          emitAuditEvent({
            eventType: AuditEventType.AUTH_LOGIN_FAILED,
            action: 'SAML ACS: no user object',
            outcome: 'failure',
            actor: { ipAddress: req.ip, userAgent: req.headers['user-agent'] },
            correlationId: req.correlationId,
            module: 'auth',
          });
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

        // Load roles and permissions through permissionService (SQL Server-aware
        // via getRoleManagementStore). userPermissions.roles is Role[] from the
        // store; userPermissions.permissions is already string[] of codes.
        const userPermissions = await permissionService.getUserPermissions(req.user.employeeId);
        req.session.roles = userPermissions.roles.map(r => r.roleName);
        req.session.permissions = userPermissions.permissions;

        authLogger.info({
          employeeId: req.user.employeeId,
          roles: req.session.roles,
          permissionCount: req.session.permissions?.length || 0
        }, 'SAML ACS session created');

        emitAuditEvent({
          eventType: AuditEventType.AUTH_LOGIN_SUCCESS,
          action: 'SAML login success',
          outcome: 'success',
          actor: {
            employeeId: req.user.employeeId,
            ipAddress: req.ip,
            userAgent: req.headers['user-agent'],
          },
          correlationId: req.correlationId,
          metadata: {
            roles: req.session.roles,
            permissionCount: req.session.permissions?.length || 0,
          },
          module: 'auth',
        });

        // Regenerate session ID for security
        req.session.regenerate((err) => {
          if (err) {
            authLogger.error({ err }, 'SAML ACS session regeneration error');
          }

          authLogger.info('SAML ACS redirecting to application home');
          res.redirect('/');
        });

      } catch (error) {
        authLogger.error({ err: error }, 'Error processing SAML ACS callback');
        emitAuditEvent({
          eventType: AuditEventType.AUTH_LOGIN_FAILED,
          action: 'SAML ACS processing error',
          outcome: 'error',
          actor: { ipAddress: req.ip, userAgent: req.headers['user-agent'] },
          correlationId: req.correlationId,
          metadata: { error: (error as Error).message },
          module: 'auth',
        });
        res.redirect('/login-error');
      }
    }
  );

  /**
   * SAML Metadata - Expose SP metadata for IdP configuration
   */
  router.get('/saml/metadata', (req, res) => {
    try {
      const strategy = (passport as any)._strategy('saml');

      if (!strategy || typeof strategy.generateServiceProviderMetadata !== 'function') {
        authLogger.error('SAML strategy not configured properly');
        return res.status(500).send('SAML strategy not configured');
      }

      const metadata = strategy.generateServiceProviderMetadata(null);
      authLogger.debug({ metadataLength: metadata.length }, 'Generated SAML metadata');

      res.type('application/xml');
      res.send(metadata);
    } catch (error) {
      authLogger.error({ err: error }, 'Error generating SAML metadata');
      res.status(500).send('Error generating metadata');
    }
  });

  /**
   * SAML Logout - SP-initiated logout
   */
  router.get('/saml/logout', (req, res) => {
    const employeeId = req.session?.employeeId;
    authLogger.info({ employeeId }, 'Initiating SAML logout');

    emitAuditEvent({
      eventType: AuditEventType.AUTH_LOGOUT,
      action: 'SAML logout initiated',
      outcome: 'success',
      actor: { employeeId, ipAddress: req.ip, userAgent: req.headers['user-agent'] },
      correlationId: req.correlationId,
      module: 'auth',
    });

    try {
      const strategy = (passport as any)._strategy('saml');

      if (!strategy || typeof strategy.logout !== 'function') {
        authLogger.warn('SAML strategy does not support logout, destroying session only');

        req.session.destroy((err) => {
          if (err) {
            authLogger.error({ err }, 'SAML logout session destruction error');
          }
          res.redirect('/logged-out');
        });
        return;
      }

      strategy.logout(req, (err: any, requestUrl: string) => {
        if (err) {
          authLogger.error({ err }, 'Error generating SAML logout request');

          req.session.destroy((destroyErr) => {
            if (destroyErr) {
              authLogger.error({ err: destroyErr }, 'SAML logout session destruction error');
            }
            res.redirect('/logged-out');
          });
          return;
        }

        req.session.destroy((destroyErr) => {
          if (destroyErr) {
            authLogger.error({ err: destroyErr }, 'SAML logout session destruction error');
          }

          authLogger.info('Redirecting to IdP logout');
          res.redirect(requestUrl);
        });
      });
    } catch (error) {
      authLogger.error({ err: error }, 'SAML logout unexpected error');

      req.session.destroy((err) => {
        if (err) {
          authLogger.error({ err }, 'SAML logout session destruction error');
        }
        res.redirect('/logged-out');
      });
    }
  });

  /**
   * Logout callback - IdP redirects here after logout
   */
  router.get('/saml/logout/callback', (req, res) => {
    authLogger.info('IdP logout completed');
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
