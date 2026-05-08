import { Router } from 'express';
import passport from 'passport';
import { permissionService } from '../services/permissionService';
import logger from '../services/logger';
import { emitAuditEvent } from '../services/auditService';
import { AuditEventType } from '../../shared/auditEvents';
import { getMssqlPool } from '../db';
import {
  getEmployeeBySsoSubjectOrEmailSqlServer,
  upsertEmployeeFromSamlSqlServer,
  ensureEmployeeHasDefaultRoleSqlServer,
} from '../storage/sqlServerEmployee';

const authLogger = logger.child({ module: 'auth' });

const isSamlEnabled = () => {
  return process.env.SAML_ENABLED === 'true' &&
         !!process.env.SAML_ENTRYPOINT;
};

// Where the SPA shows the Login Required UI / surfaces auth errors. Failures
// in the SAML flow redirect here with ?login_error=<reason> so the user sees
// a friendly screen instead of a raw JSON 401 or the SPA's NotFound page.
const SPA_LOGIN_PATH = '/ciq/client';

function spaLoginErrorUrl(reason: string): string {
  return `${SPA_LOGIN_PATH}?login_error=${encodeURIComponent(reason)}`;
}

/**
 * /api/auth/* — login/logout/status shell. SAML SP routes live at top level
 * (see createSamlRoutes) to match the F&M Bank IdP's POST target.
 */
export function createAuthRoutes() {
  const router = Router();

  router.get('/login', (req, res) => {
    // Prefer IdP-initiated SSO when set (RSA's portal launcher, e.g.
    // https://portal.fmb.com/IdPServlet?idp_id=<id>). Sidesteps SP-initiated
    // SAMLRequest construction entirely. Accept either env var name.
    const idpInitiatedUrl = process.env.SAML_IDP_INITIATED_URL || process.env.SAML_IDP_INITIATED;
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
      hint: 'Set SAML_ENABLED=true and configure SAML_ENTRYPOINT (plus SAML_CALLBACK_URL, SAML_CERT, SAML_ISSUER) for production SSO. Optionally set SAML_IDP_INITIATED_URL for IdP-initiated flow.',
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
        return res.json({ success: true, message: 'Logged out successfully' });
      });
    });
  });

  router.get('/status', (req, res) => {
    // Authenticated = SAML ACS populated session identity (email or req.user).
    // Linked = the user has a DB employee row with at least one assigned role
    // — this is the gating check for "can use the app". Without roles, the
    // SPA shows an "awaiting role assignment" screen instead of an empty
    // app shell.
    const sessionEmployeeId = req.session?.employeeId;
    const userEmployeeId = (req.user as any)?.employeeId;
    const employeeId = sessionEmployeeId || userEmployeeId || null;
    const sessionEmail = req.session?.email;
    const sessionRoles = req.session?.roles ?? [];
    const isAuthenticated = !!employeeId || !!sessionEmail || !!req.user;
    const isLinked = !!employeeId && sessionRoles.length > 0;

    res.json({
      isAuthenticated,
      employeeId,
      email: sessionEmail || null,
      isLinked,
      samlEnabled: isSamlEnabled(),
    });
  });

  router.get('/login-error', (req, res) => {
    const reason = String(req.query.reason || 'unknown');
    res.redirect(spaLoginErrorUrl(reason));
  });

  router.get('/logged-out', (_req, res) => {
    res.redirect(SPA_LOGIN_PATH);
  });

  return router;
}

/**
 * Top-level SAML SP endpoints. Mounted at "/" so the IdP can POST to
 * /saml/acs (matching the F&M Bank RSA IdP convention).
 */
export function createSamlRoutes() {
  const router = Router();

  router.get('/saml/login', (req, res, next) => {
    authLogger.info({ ip: req.ip }, 'SAML SP-initiated login');
    passport.authenticate('saml', {
      failureRedirect: spaLoginErrorUrl('saml_login_failed'),
    })(req, res, next);
  });

  // ACS — IdP POSTs the SAMLResponse here.
  router.post('/saml/acs', (req, res, next) => {
    authLogger.info({ ip: req.ip, hasBody: !!req.body }, 'SAML ACS callback received');

    passport.authenticate('saml', (err: any, user: any, info: any) => {
      if (err) {
        const errMessage = err?.message || String(err);
        authLogger.error({ errMessage, errStack: err?.stack, errName: err?.name, info }, 'SAML authentication error in ACS');
        emitAuditEvent({
          eventType: AuditEventType.AUTH_LOGIN_FAILED,
          action: 'SAML ACS authentication error',
          outcome: 'failure',
          actor: { ipAddress: req.ip, userAgent: req.headers['user-agent'] },
          correlationId: req.correlationId,
          metadata: { error: errMessage },
          module: 'auth',
        });
        return res.redirect(spaLoginErrorUrl('auth_error'));
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
        return res.redirect(spaLoginErrorUrl('no_user'));
      }

      req.session.regenerate((regenErr) => {
        if (regenErr) {
          authLogger.error({ err: regenErr }, 'Session regeneration failed');
          return res.redirect(spaLoginErrorUrl('session_error'));
        }

        req.logIn(user, async (loginErr) => {
          if (loginErr) {
            authLogger.error({ err: loginErr }, 'req.logIn failed after SAML validation');
            return res.redirect(spaLoginErrorUrl('login_error'));
          }

          try {
            // Find or create the DB employee row for this SAML identity.
            // Existing rows have last_login_at and last_seen_saml_role
            // refreshed; missing rows are inserted from SAML attributes.
            // Auto-creation is safe because RSA already gates who can
            // authenticate — anyone reaching ACS has an admin-approved
            // identity in the IdP.
            let dbEmployeeId: number | null = null;
            try {
              const pool = await getMssqlPool();

              // Build safe defaults: SAML may omit firstName/lastName/etc.
              // employee_number is NOT NULL UNIQUE — use the SAML id if
              // available, otherwise fall back to an email-derived value.
              const employeeNumber = String(
                user.samlEmployeeNumber ??
                user.samlEmployeeId ??
                (user.email ? user.email.split('@')[0] : '') ?? '',
              ).slice(0, 20) || `SAML-${Date.now()}`.slice(0, 20);

              const emailLocal = (user.email || '').split('@')[0] || '';
              const [emailFirst, emailLast] = emailLocal.includes('.')
                ? emailLocal.split('.', 2)
                : [emailLocal, ''];
              const firstName = (user.firstName || emailFirst || 'Unknown').slice(0, 100);
              const lastName = (user.lastName || emailLast || 'User').slice(0, 100);

              const dbEmployee = await upsertEmployeeFromSamlSqlServer(pool, {
                employeeNumber,
                firstName,
                lastName,
                email: user.email,
                ssoSubject: user.ssoSubject || user.email,
                department: user.department ?? null,
                samlRoleKey: user.samlRoleKey ?? null,
              });

              if (dbEmployee) {
                dbEmployeeId = dbEmployee.employeeId;
                authLogger.info({
                  email: user.email,
                  resolvedEmployeeId: dbEmployeeId,
                }, 'Resolved/created DB employee for SAML user');

                // Auto-grant a default role if the user has none yet.
                // Configurable via SAML_DEFAULT_ROLE_NAME (defaults to
                // "Branch Manager" while the org figures out per-user
                // assignments). Set to empty string to disable.
                const defaultRoleName = process.env.SAML_DEFAULT_ROLE_NAME ?? 'Branch Manager';
                if (defaultRoleName) {
                  const assigned = await ensureEmployeeHasDefaultRoleSqlServer(
                    pool, dbEmployeeId, defaultRoleName,
                  );
                  if (assigned) {
                    authLogger.info({ dbEmployeeId, defaultRoleName: assigned }, 'Granted default role to new SAML user');
                  }
                }
              } else {
                authLogger.warn({
                  email: user.email,
                }, 'Could not create/resolve DB employee — session will have empty permissions');
              }
            } catch (lookupErr) {
              authLogger.error({ err: lookupErr }, 'Failed to upsert DB employee for SAML user');
            }

            req.session.employeeId = dbEmployeeId ?? undefined;
            req.session.employeeNumber = user.samlEmployeeNumber ?? user.samlEmployeeId ?? undefined;
            req.session.firstName = user.firstName;
            req.session.lastName = user.lastName;
            req.session.email = user.email;
            req.session.department = user.department;
            req.session.samlRoleKey = user.samlRoleKey;
            req.session.lastActivity = new Date();

            if (dbEmployeeId) {
              const userPermissions = await permissionService.getUserPermissions(dbEmployeeId);
              req.session.roles = userPermissions.roles.map((r: any) => r.roleName);
              req.session.permissions = userPermissions.permissions;
            } else {
              req.session.roles = [];
              req.session.permissions = [];
            }

            authLogger.info({
              dbEmployeeId,
              email: user.email,
              roles: req.session.roles,
              permissionCount: req.session.permissions?.length || 0,
            }, 'SAML ACS session established');

            emitAuditEvent({
              eventType: AuditEventType.AUTH_LOGIN_SUCCESS,
              action: 'SAML login success',
              outcome: 'success',
              actor: {
                employeeId: dbEmployeeId ?? undefined,
                ipAddress: req.ip,
                userAgent: req.headers['user-agent'],
              },
              correlationId: req.correlationId,
              metadata: {
                email: user.email,
                roles: req.session.roles,
                permissionCount: req.session.permissions?.length || 0,
              },
              module: 'auth',
            });
          } catch (permErr) {
            authLogger.error({ err: permErr }, 'Failed to load permissions during ACS');
          }

          req.session.save((saveErr) => {
            if (saveErr) {
              authLogger.error({ err: saveErr }, 'Session save error after ACS');
              return res.redirect(spaLoginErrorUrl('session_error'));
            }
            res.redirect('/');
          });
        });
      });
    })(req, res, next);
  });

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
      req.session.destroy(() => res.redirect(SPA_LOGIN_PATH));
      return;
    }

    strategy.logout(req, (err: any, requestUrl: string) => {
      if (err) {
        authLogger.error({ err }, 'Error generating SAML logout request');
        req.session.destroy(() => res.redirect(SPA_LOGIN_PATH));
        return;
      }
      req.session.destroy(() => res.redirect(requestUrl));
    });
  });

  router.get('/saml/logout/callback', (_req, res) => {
    res.redirect(SPA_LOGIN_PATH);
  });

  return router;
}
