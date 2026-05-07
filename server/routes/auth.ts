import { Router } from 'express';
import passport from 'passport';
import { permissionService } from '../services/permissionService';
import logger from '../services/logger';
import { emitAuditEvent } from '../services/auditService';
import { AuditEventType } from '../../shared/auditEvents';

const authLogger = logger.child({ module: 'auth' });

// SAML is enabled when both the flag and the IdP entry point are set.
const isSamlEnabled = () => {
  return process.env.SAML_ENABLED === 'true' &&
         !!process.env.SAML_ENTRYPOINT;
};

/**
 * /api/auth/* — login/logout/status shell. SAML SP routes live at top level
 * (see createSamlRoutes) to match the IdP-side ACS URL convention used by
 * the F&M Bank RSA IdP (proven working with TimeTracker).
 */
export function createAuthRoutes() {
  const router = Router();

  router.get('/login', (req, res) => {
    // Prefer IdP-initiated SSO when SAML_IDP_INITIATED_URL is configured.
    // For RSA SecurID Access, this is the IdP portal launch URL of the form
    // https://portal.<host>/IdPServlet?idp_id=<id>. Sidesteps SP-initiated
    // SAMLRequest construction entirely.
    const idpInitiatedUrl = process.env.SAML_IDP_INITIATED_URL;
    if (idpInitiatedUrl) {
      authLogger.info({ idpInitiatedUrl }, 'Redirecting to IdP-initiated SSO');
      emitAuditEvent({
        eventType: AuditEventType.AUTH_LOGIN_SUCCESS,
        action: 'IdP-initiated SSO redirect',
        outcome: 'success',
        actor: { ipAddress: req.ip, userAgent: req.headers['user-agent'] },
        correlationId: req.correlationId,
        module: 'auth',
      });
      return res.redirect(idpInitiatedUrl);
    }

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
      return res.redirect('/saml/login');
    }

    authLogger.info('SAML not configured, returning dev mode response');
    return res.status(200).json({
      message: 'Development mode - SAML not configured',
      samlEnabled: false,
      hint: 'Set SAML_ENABLED=true and configure SAML_ENTRYPOINT (plus SAML_CALLBACK_URL, SAML_CERT, SAML_ISSUER) for production SSO. Optionally set SAML_IDP_INITIATED_URL to skip SP-initiated and use the IdP portal launch URL instead.',
    });
  });

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

    req.logout?.((logoutErr: any) => {
      if (logoutErr) {
        authLogger.warn({ err: logoutErr }, 'passport.logout error');
      }
      req.session.destroy((err) => {
        if (err) {
          authLogger.error({ err }, 'Session destruction error');
          return res.status(500).json({ error: 'Failed to logout' });
        }
        res.clearCookie('clientiq.sid');
        authLogger.info({ employeeId }, 'Session destroyed successfully');
        return res.json({ success: true, message: 'Logged out successfully' });
      });
    });
  });

  router.get('/status', (req, res) => {
    const sessionEmployeeId = req.session?.employeeId;
    const userEmployeeId = (req.user as any)?.employeeId;
    const employeeId = sessionEmployeeId || userEmployeeId || null;

    res.json({
      isAuthenticated: !!employeeId,
      employeeId,
      samlEnabled: isSamlEnabled(),
    });
  });

  router.get('/login-error', (_req, res) => {
    res.status(401).json({
      error: 'Authentication failed',
      message: 'Unable to authenticate with SAML. Please contact your administrator.',
    });
  });

  router.get('/logged-out', (_req, res) => {
    res.json({ message: 'You have been logged out successfully' });
  });

  return router;
}

/**
 * Top-level SAML SP endpoints. Mounted at "/" so the IdP can POST to
 * /saml/acs (matching the F&M Bank RSA IdP convention).
 */
export function createSamlRoutes() {
  const router = Router();

  // SP-initiated SSO entry point.
  router.get('/saml/login', (req, res, next) => {
    authLogger.info({ ip: req.ip }, 'SAML SP-initiated login');
    passport.authenticate('saml', {
      failureRedirect: '/api/auth/login-error',
    })(req, res, next);
  });

  // ACS — IdP POSTs the SAMLResponse here.
  router.post('/saml/acs', (req, res, next) => {
    authLogger.info({ ip: req.ip, hasBody: !!req.body }, 'SAML ACS callback received');

    passport.authenticate('saml', (err: any, user: any, info: any) => {
      if (err) {
        authLogger.error({ err, info }, 'SAML authentication error in ACS');
        emitAuditEvent({
          eventType: AuditEventType.AUTH_LOGIN_FAILED,
          action: 'SAML ACS authentication error',
          outcome: 'failure',
          actor: { ipAddress: req.ip, userAgent: req.headers['user-agent'] },
          correlationId: req.correlationId,
          metadata: { error: err.message },
          module: 'auth',
        });
        return res.redirect('/api/auth/login-error?reason=auth_error');
      }

      if (!user) {
        authLogger.warn({ info }, 'SAML authentication: no user');
        emitAuditEvent({
          eventType: AuditEventType.AUTH_LOGIN_FAILED,
          action: 'SAML ACS: no user object',
          outcome: 'failure',
          actor: { ipAddress: req.ip, userAgent: req.headers['user-agent'] },
          correlationId: req.correlationId,
          module: 'auth',
        });
        return res.redirect('/api/auth/login-error?reason=no_user');
      }

      // Regenerate session ID before logging in (prevents session fixation).
      req.session.regenerate((regenErr) => {
        if (regenErr) {
          authLogger.error({ err: regenErr }, 'Session regeneration failed');
          return res.redirect('/api/auth/login-error');
        }

        req.logIn(user, async (loginErr) => {
          if (loginErr) {
            authLogger.error({ err: loginErr }, 'req.logIn failed after SAML validation');
            return res.redirect('/api/auth/login-error');
          }

          try {
            // Mirror legacy session shape so existing route handlers work.
            req.session.employeeId = user.employeeId;
            req.session.employeeNumber = user.employeeNumber;
            req.session.firstName = user.firstName;
            req.session.lastName = user.lastName;
            req.session.email = user.email;
            req.session.department = user.department;
            req.session.samlRoleKey = user.samlRoleKey;
            req.session.lastActivity = new Date();

            // permissionService -> getRoleManagementStore is dialect-aware
            // (works on SQL Server). Returns roles as Role[] and permissions
            // as string[] of codes.
            const userPermissions = await permissionService.getUserPermissions(user.employeeId);
            req.session.roles = userPermissions.roles.map((r: any) => r.roleName);
            req.session.permissions = userPermissions.permissions;

            authLogger.info({
              employeeId: user.employeeId,
              roles: req.session.roles,
              permissionCount: req.session.permissions?.length || 0,
            }, 'SAML ACS session established');

            emitAuditEvent({
              eventType: AuditEventType.AUTH_LOGIN_SUCCESS,
              action: 'SAML login success',
              outcome: 'success',
              actor: {
                employeeId: user.employeeId,
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
          } catch (permErr) {
            // Don't block login if permissions can't be loaded — admin can fix later.
            authLogger.error({ err: permErr }, 'Failed to load permissions during ACS');
          }

          req.session.save((saveErr) => {
            if (saveErr) {
              authLogger.error({ err: saveErr }, 'Session save error after ACS');
            }
            res.redirect('/');
          });
        });
      });
    })(req, res, next);
  });

  // SP metadata for the IdP team.
  router.get('/saml/metadata', (_req, res) => {
    try {
      const strategy = (passport as any)._strategy('saml');
      if (!strategy || typeof strategy.generateServiceProviderMetadata !== 'function') {
        authLogger.error('SAML strategy not configured properly');
        return res.status(500).send('SAML strategy not configured');
      }
      const metadata = strategy.generateServiceProviderMetadata(null);
      res.type('application/xml');
      res.send(metadata);
    } catch (error) {
      authLogger.error({ err: error }, 'Error generating SAML metadata');
      res.status(500).send('Error generating metadata');
    }
  });

  // SP-initiated logout.
  router.get('/saml/logout', (req, res) => {
    const employeeId = req.session?.employeeId;
    authLogger.info({ employeeId }, 'SAML logout initiated');

    emitAuditEvent({
      eventType: AuditEventType.AUTH_LOGOUT,
      action: 'SAML logout initiated',
      outcome: 'success',
      actor: { employeeId, ipAddress: req.ip, userAgent: req.headers['user-agent'] },
      correlationId: req.correlationId,
      module: 'auth',
    });

    const strategy = (passport as any)._strategy('saml');
    if (!strategy || typeof strategy.logout !== 'function') {
      req.session.destroy(() => res.redirect('/api/auth/logged-out'));
      return;
    }

    strategy.logout(req, (err: any, requestUrl: string) => {
      if (err) {
        authLogger.error({ err }, 'Error generating SAML logout request');
        req.session.destroy(() => res.redirect('/api/auth/logged-out'));
        return;
      }
      req.session.destroy(() => res.redirect(requestUrl));
    });
  });

  router.get('/saml/logout/callback', (_req, res) => {
    authLogger.info('IdP logout completed');
    res.redirect('/api/auth/logged-out');
  });

  return router;
}
