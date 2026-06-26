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
  syncEmployeeRolesFromAdGroupsSqlServer,
  ensureEmployeeHasDefaultRoleSqlServer,
} from '../storage/sqlServerEmployee';
import { mapAdGroupsToRoleNames } from '../auth/adGroupRoleMap';

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
 * Pick the URL we point users at from the sign-in page. Prefer an explicit
 * RSA_PORTAL_URL; otherwise derive the origin from SAML_ENTRYPOINT (the IdP
 * lives on the same host as the portal); otherwise fall back to the F&M
 * production portal landing URL.
 */
function resolveRsaPortalUrl(): string {
  const explicit = process.env.RSA_PORTAL_URL;
  if (explicit) {
    try {
      const u = new URL(explicit);
      if (u.protocol === 'https:') return u.toString();
    } catch { /* fall through */ }
  }
  try {
    const entrypoint = process.env.SAML_ENTRYPOINT || '';
    const u = new URL(entrypoint);
    if (u.protocol === 'https:') return `${u.origin}/WebPortal/`;
  } catch { /* fall through */ }
  return 'https://portal.fmb.com/WebPortal/';
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderSignInPage(portalUrl: string): string {
  const href = escapeHtml(portalUrl);
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Sign In · ClientIQ</title>
<style>
  *, *::before, *::after { box-sizing: border-box; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
    background: linear-gradient(135deg, #f5f7f5 0%, #e8efe9 100%);
    color: #1f2933;
    display: flex; align-items: center; justify-content: center;
    min-height: 100vh; margin: 0; padding: 1.5rem;
  }
  .card {
    background: #fff;
    padding: 2.5rem 3rem;
    border-radius: 12px;
    box-shadow: 0 4px 24px rgba(15, 35, 25, 0.08);
    max-width: 440px; width: 100%;
    text-align: center;
  }
  .brand { font-size: 1.75rem; font-weight: 700; color: #2c5f3f; margin: 0 0 0.25rem; letter-spacing: -0.01em; }
  .sub   { color: #6b7280; margin: 0 0 1.75rem; font-size: 0.95rem; }
  .btn {
    display: inline-block;
    background: #2c5f3f;
    color: #fff;
    padding: 0.85rem 1.75rem;
    border-radius: 6px;
    font-size: 1rem; font-weight: 600;
    text-decoration: none;
    transition: background 0.15s ease;
  }
  .btn:hover, .btn:focus { background: #244e34; outline: none; }
  .hint { margin-top: 1.5rem; font-size: 0.85rem; color: #9ca3af; line-height: 1.5; }
</style>
</head>
<body>
  <div class="card">
    <h1 class="brand">ClientIQ</h1>
    <p class="sub">Sign in via the F&amp;M Bank RSA portal to continue.</p>
    <a class="btn" href="${href}">Sign in via RSA Portal</a>
    <p class="hint">After signing in, click the <strong>ClientIQ</strong> tile in the portal to launch the application.</p>
  </div>
</body>
</html>`;
}

/**
 * /api/auth/* — login/logout/status shell. SAML SP routes live at top level
 * (see createSamlRoutes) to match the F&M Bank IdP's POST target.
 */
export function createAuthRoutes() {
  const router = Router();

  router.get('/login', (req, res) => {
    // Already authenticated — send to app root rather than re-prompting.
    if (req.session?.employeeId || req.user) {
      return res.redirect('/');
    }

    // Dev mode (no SAML): preserve the prior JSON contract.
    if (!isSamlEnabled()) {
      authLogger.info('SAML not configured, returning dev mode response');
      return res.status(200).json({
        message: 'Development mode - SAML not configured',
        samlEnabled: false,
        hint: 'Set SAML_ENABLED=true and configure SAML_ENTRYPOINT (plus SAML_CALLBACK_URL, SAML_CERT, SAML_ISSUER) for production SSO.',
      });
    }

    // Render a static sign-in page that links to the RSA portal landing URL.
    // Auto-redirecting straight to portal.fmb.com/IdPServlet?idp_id=... does
    // not actually initiate SSO — RSA only emits a SAMLResponse when the user
    // launches the app from the portal tile. So we just send them to the
    // portal and let them click ClientIQ from there.
    const portalUrl = resolveRsaPortalUrl();
    emitAuditEvent({
      eventType: AuditEventType.AUTH_LOGIN_SUCCESS,
      action: 'Sign-in page shown',
      outcome: 'success',
      actor: { ipAddress: req.ip, userAgent: req.headers['user-agent'] },
      correlationId: req.correlationId,
      module: 'auth',
    });
    res.type('html').send(renderSignInPage(portalUrl));
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
    // Authenticated identity sources, in priority order:
    //   - SAML ACS populated session.employeeId (post-login)
    //   - passport's req.user (post-login, before bridge runs)
    //   - req.employeeId (dev mock middleware, when SAML_ENABLED !== 'true'
    //     and NODE_ENV === 'development', or our bridge in index.ts)
    const sessionEmployeeId = req.session?.employeeId;
    const userEmployeeId = (req.user as any)?.employeeId;
    const reqEmployeeId = (req as any).employeeId;
    const employeeId = sessionEmployeeId || userEmployeeId || reqEmployeeId || null;
    const sessionEmail = req.session?.email;
    const sessionRoles = req.session?.roles ?? [];
    const samlEnabled = isSamlEnabled();

    const isAuthenticated = !!employeeId || !!sessionEmail || !!req.user;
    // isLinked = "can use the app". When SAML is enabled (production), gate
    // on an assigned role so the SPA can show "Awaiting Role Assignment".
    // When SAML is disabled (dev mock), trust the mock and treat any
    // employeeId as linked — the dev user (employee_id=1) is fully provisioned.
    const isLinked = samlEnabled
      ? !!employeeId && sessionRoles.length > 0
      : !!employeeId;

    // True only when the user is unlinked *because* the configured default
    // role doesn't exist in the role table — a system misconfiguration the
    // SPA surfaces distinctly from "awaiting role assignment".
    const defaultRoleMissing = !isLinked && !!req.session?.defaultRoleMissing;

    res.json({
      isAuthenticated,
      employeeId,
      email: sessionEmail || null,
      isLinked,
      samlEnabled,
      defaultRoleMissing,
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

  /*
  * This is middleware to prevent any responses from the SAML endpoints 
  * from being cached
  */
  router.use("/saml", (req, res, next) => {
    res.setHeader(
      "Cache-Control",
      "no-store, no-cache, must-revalidate, proxy-revalidate"
    );

    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");

    next();
  });

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

        req.logIn(user, { session: false }, async (loginErr) => {
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

                // Enforced role sync from the user's AD groups (carried in the
                // SAML role claim). Roles mirror current AD group membership on
                // every login; admin-assigned roles (assigned_by IS NOT NULL)
                // are preserved. When no AD group maps to a role, fall back to
                // SAML_DEFAULT_ROLE_NAME (defaults to "Branch Manager").
                const fallbackRoleName = process.env.SAML_DEFAULT_ROLE_NAME?.trim() || 'Branch Manager';
                // Scope AD-group role mapping to this deployment's environment.
                // One on-prem AD means every user carries the ClientIQ groups for
                // all environments; SAML_ROLE_ENV (DEV/TST/STG/PRD) makes preprod
                // honor only STG groups and prod only PRD groups.
                const roleEnv = process.env.SAML_ROLE_ENV?.trim() || null;
                const { roleNames: desiredRoleNames, unmatched, ignoredOtherEnv } =
                  mapAdGroupsToRoleNames(user.samlGroups ?? [], roleEnv);
                const sync = await syncEmployeeRolesFromAdGroupsSqlServer(
                  pool, dbEmployeeId, desiredRoleNames, fallbackRoleName,
                  (user.samlGroups ?? []).join(';') || null,
                );
                // (defaultRoleMissing is decided authoritatively below, after a
                // guaranteed Branch Manager fallback, so a transient sync error
                // never strands an authenticated user on "Awaiting Role".)
                authLogger.info({
                  dbEmployeeId,
                  roleEnv: roleEnv ?? '(unscoped)',
                  groupCount: (user.samlGroups ?? []).length,
                  desiredRoleNames,
                  assigned: sync.assigned,
                  revoked: sync.revoked,
                  usedFallback: sync.usedFallback,
                  unmatchedClientIqGroups: unmatched,
                  ignoredOtherEnvGroups: ignoredOtherEnv,
                  unresolvedRoleNames: sync.unresolved,
                }, 'Synced SAML user roles from AD groups');
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
            req.session.samlGroups = user.samlGroups;
            req.session.lastActivity = new Date();

            if (dbEmployeeId) {
              let userPermissions = await permissionService.getUserPermissions(dbEmployeeId);

              // Bulletproof fallback: an authenticated RSA user must never be
              // stranded on "Awaiting Role Assignment". If no role was realized
              // (AD groups matched nothing, the enforced sync errored, or the
              // nightly ETL wiped employee_role rows), grant Branch Manager via
              // the simple column-safe insert (no assigned_by dependency, so it
              // works even before the provenance migration is applied).
              if (userPermissions.roles.length === 0) {
                try {
                  const pool = await getMssqlPool();
                  const fb = await ensureEmployeeHasDefaultRoleSqlServer(
                    pool, dbEmployeeId, process.env.SAML_DEFAULT_ROLE_NAME?.trim() || 'Branch Manager',
                  );
                  authLogger.warn({ dbEmployeeId, fallbackOutcome: fb.status },
                    'No role realized from AD sync — applied Branch Manager fallback');
                  userPermissions = await permissionService.getUserPermissions(dbEmployeeId);
                } catch (fbErr) {
                  authLogger.error({ err: fbErr, dbEmployeeId }, 'Branch Manager fallback failed');
                }
              }

              req.session.roles = userPermissions.roles.map((r: any) => r.roleName);
              req.session.permissions = userPermissions.permissions;
              // Only flag misconfiguration if even Branch Manager couldn't be
              // applied (role absent from the role table) — the rare real case.
              req.session.defaultRoleMissing = userPermissions.roles.length === 0;
            } else {
              req.session.roles = [];
              req.session.permissions = [];
              req.session.defaultRoleMissing = false;
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
            return res.redirect(spaLoginErrorUrl('login_error'));
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
