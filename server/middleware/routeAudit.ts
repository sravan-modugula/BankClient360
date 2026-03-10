/**
 * Route Audit Middleware — declarative, zero route changes.
 * Maps route patterns to audit event types and emits events automatically.
 */

import { Request, Response, NextFunction } from 'express';
import { emitAuditEvent } from '../services/auditService';
import {
  AuditEventType,
  AuditOutcome,
  type AuditResource,
} from '../../shared/auditEvents';

// ==================================================================================
// ROUTE → AUDIT EVENT MAP
// ==================================================================================

interface RouteAuditConfig {
  eventType: AuditEventType;
  resourceType: string;
  /** Extract resource id from request params */
  resourceIdParam?: string;
  /** Extra metadata to extract */
  metadataExtractor?: (req: Request) => Record<string, unknown>;
}

/**
 * Declarative mapping of route patterns to audit events.
 * Key format: "METHOD /api/path/:param"
 */
const ROUTE_AUDIT_MAP: Record<string, RouteAuditConfig> = {
  // Customer / PII access
  'GET /api/customers/search': {
    eventType: AuditEventType.SEARCH_CUSTOMER,
    resourceType: 'customer',
    metadataExtractor: (req) => ({ query: req.query.q || req.query.query }),
  },
  'POST /api/customers/search': {
    eventType: AuditEventType.SEARCH_UNIFIED,
    resourceType: 'customer',
  },
  'GET /api/customers/:id': {
    eventType: AuditEventType.PII_CUSTOMER_VIEWED,
    resourceType: 'customer',
    resourceIdParam: 'id',
  },
  'GET /api/customers/:id/details': {
    eventType: AuditEventType.PII_CUSTOMER_VIEWED,
    resourceType: 'customer',
    resourceIdParam: 'id',
  },
  'GET /api/customers/:id/contacts': {
    eventType: AuditEventType.PII_CONTACT_ACCESSED,
    resourceType: 'customer',
    resourceIdParam: 'id',
  },
  'GET /api/customers/tax-id/:taxId': {
    eventType: AuditEventType.PII_SSN_ACCESSED,
    resourceType: 'customer',
  },
  'GET /api/customers/gov-id/:govId': {
    eventType: AuditEventType.PII_GOV_ID_ACCESSED,
    resourceType: 'customer',
  },
  'GET /api/customers/cif/:cifNumber': {
    eventType: AuditEventType.PII_CUSTOMER_VIEWED,
    resourceType: 'customer',
  },
  'POST /api/customers': {
    eventType: AuditEventType.DATA_CUSTOMER_UPDATED,
    resourceType: 'customer',
  },
  'PUT /api/customers/:id': {
    eventType: AuditEventType.DATA_CUSTOMER_UPDATED,
    resourceType: 'customer',
    resourceIdParam: 'id',
  },
  'POST /api/customers/:id/contacts': {
    eventType: AuditEventType.DATA_CONTACT_UPDATED,
    resourceType: 'customer',
    resourceIdParam: 'id',
  },
  'GET /api/customers/:id/addresses': {
    eventType: AuditEventType.PII_CONTACT_ACCESSED,
    resourceType: 'customer',
    resourceIdParam: 'id',
  },
  'POST /api/customers/:id/addresses': {
    eventType: AuditEventType.DATA_ADDRESS_UPDATED,
    resourceType: 'customer',
    resourceIdParam: 'id',
  },

  // Accounts / Financial
  'GET /api/customers/:id/accounts': {
    eventType: AuditEventType.FIN_ACCOUNT_VIEWED,
    resourceType: 'customer',
    resourceIdParam: 'id',
  },
  'GET /api/accounts/:id': {
    eventType: AuditEventType.FIN_ACCOUNT_VIEWED,
    resourceType: 'account',
    resourceIdParam: 'id',
  },
  'PUT /api/accounts/:id': {
    eventType: AuditEventType.DATA_ACCOUNT_UPDATED,
    resourceType: 'account',
    resourceIdParam: 'id',
  },
  'GET /api/accounts/:id/owners': {
    eventType: AuditEventType.FIN_ACCOUNT_VIEWED,
    resourceType: 'account',
    resourceIdParam: 'id',
  },
  'GET /api/accounts/:id/debit-cards': {
    eventType: AuditEventType.FIN_CARD_DETAILS_VIEWED,
    resourceType: 'account',
    resourceIdParam: 'id',
  },
  'GET /api/accounts/:accountId/transactions': {
    eventType: AuditEventType.FIN_TRANSACTIONS_VIEWED,
    resourceType: 'account',
    resourceIdParam: 'accountId',
  },
  'GET /api/customers/:customerId/transactions': {
    eventType: AuditEventType.FIN_TRANSACTIONS_VIEWED,
    resourceType: 'customer',
    resourceIdParam: 'customerId',
  },
  'GET /api/customers/:id/deposit-analytics': {
    eventType: AuditEventType.FIN_BALANCE_VIEWED,
    resourceType: 'customer',
    resourceIdParam: 'id',
  },

  // Households
  'POST /api/households': {
    eventType: AuditEventType.DATA_HOUSEHOLD_CREATED,
    resourceType: 'household',
  },
  'GET /api/households/:id': {
    eventType: AuditEventType.FIN_HOUSEHOLD_VIEWED,
    resourceType: 'household',
    resourceIdParam: 'id',
  },
  'GET /api/households/:id/members': {
    eventType: AuditEventType.FIN_HOUSEHOLD_VIEWED,
    resourceType: 'household',
    resourceIdParam: 'id',
  },
  'GET /api/households/:id/accounts': {
    eventType: AuditEventType.FIN_HOUSEHOLD_VIEWED,
    resourceType: 'household',
    resourceIdParam: 'id',
  },
  'POST /api/households/:id/members': {
    eventType: AuditEventType.DATA_HOUSEHOLD_MEMBER_ADDED,
    resourceType: 'household',
    resourceIdParam: 'id',
  },
  'GET /api/customers/:id/households': {
    eventType: AuditEventType.FIN_HOUSEHOLD_VIEWED,
    resourceType: 'customer',
    resourceIdParam: 'id',
  },

  // Notes
  'POST /api/notes': {
    eventType: AuditEventType.DATA_NOTE_CREATED,
    resourceType: 'note',
  },
  'PATCH /api/notes/:id': {
    eventType: AuditEventType.DATA_NOTE_UPDATED,
    resourceType: 'note',
    resourceIdParam: 'id',
  },
  'DELETE /api/notes/:id': {
    eventType: AuditEventType.DATA_NOTE_DELETED,
    resourceType: 'note',
    resourceIdParam: 'id',
  },

  // Auth
  'GET /api/auth/login': {
    eventType: AuditEventType.AUTH_LOGIN_SUCCESS,
    resourceType: 'session',
  },
  'POST /api/auth/logout': {
    eventType: AuditEventType.AUTH_LOGOUT,
    resourceType: 'session',
  },

  // Admin
  'POST /api/admin/users/:id/roles': {
    eventType: AuditEventType.AUTHZ_ROLE_ASSIGNED,
    resourceType: 'employee',
    resourceIdParam: 'id',
  },
  'DELETE /api/admin/users/:id/roles/:roleId': {
    eventType: AuditEventType.AUTHZ_ROLE_REMOVED,
    resourceType: 'employee',
    resourceIdParam: 'id',
  },
  'POST /api/admin/saml-mappings': {
    eventType: AuditEventType.ADMIN_ROLE_MAPPING_UPDATED,
    resourceType: 'saml_mapping',
  },
  'PATCH /api/admin/saml-mappings/:id': {
    eventType: AuditEventType.ADMIN_ROLE_MAPPING_UPDATED,
    resourceType: 'saml_mapping',
    resourceIdParam: 'id',
  },
  'DELETE /api/admin/saml-mappings/:id': {
    eventType: AuditEventType.ADMIN_ROLE_MAPPING_UPDATED,
    resourceType: 'saml_mapping',
    resourceIdParam: 'id',
  },
  'POST /api/admin/users/:id/roles/manual': {
    eventType: AuditEventType.AUTHZ_ROLE_ASSIGNED,
    resourceType: 'employee',
    resourceIdParam: 'id',
  },

  // Role testing
  'POST /api/auth/role-test/activate': {
    eventType: AuditEventType.AUTHZ_ROLE_TEST_START,
    resourceType: 'role_test',
  },
  'POST /api/auth/role-test/reset': {
    eventType: AuditEventType.AUTHZ_ROLE_TEST_END,
    resourceType: 'role_test',
  },
};

// ==================================================================================
// ROUTE MATCHING
// ==================================================================================

/**
 * Normalize a route path for matching.
 * Express route: "/api/customers/123/accounts" → "GET /api/customers/:id/accounts"
 * We match by comparing route segments, treating :param placeholders as wildcards.
 */
function normalizeRoutePath(path: string): string {
  // Remove query string and trailing slash
  return path.split('?')[0].replace(/\/$/, '') || '/';
}

function matchRoute(method: string, path: string): RouteAuditConfig | undefined {
  const normalizedPath = normalizeRoutePath(path);
  const segments = normalizedPath.split('/');

  for (const [pattern, config] of Object.entries(ROUTE_AUDIT_MAP)) {
    const [patternMethod, ...patternPathParts] = pattern.split(' ');
    const patternPath = patternPathParts.join(' ');

    if (method !== patternMethod) continue;

    const patternSegments = patternPath.split('/');
    if (segments.length !== patternSegments.length) continue;

    let match = true;
    for (let i = 0; i < patternSegments.length; i++) {
      if (patternSegments[i].startsWith(':')) continue; // wildcard
      if (patternSegments[i] !== segments[i]) {
        match = false;
        break;
      }
    }

    if (match) return config;
  }

  return undefined;
}

// ==================================================================================
// MIDDLEWARE
// ==================================================================================

function statusToOutcome(statusCode: number): AuditOutcome {
  if (statusCode < 400) return 'success';
  if (statusCode === 401 || statusCode === 403) return 'denied';
  if (statusCode >= 500) return 'error';
  return 'failure';
}

export function routeAuditMiddleware(req: Request, res: Response, next: NextFunction) {
  const config = matchRoute(req.method, req.path);
  if (!config) return next();

  // Intercept res.end to capture outcome
  const originalEnd = res.end;
  const startTime = Date.now();

  res.end = function (this: Response, ...args: any[]) {
    // Restore original
    res.end = originalEnd;

    const outcome = statusToOutcome(res.statusCode);
    const duration = Date.now() - startTime;

    const resource: AuditResource = {
      type: config.resourceType,
    };

    if (config.resourceIdParam && req.params[config.resourceIdParam]) {
      resource.id = req.params[config.resourceIdParam];
    }

    const metadata: Record<string, unknown> = {
      durationMs: duration,
      statusCode: res.statusCode,
    };

    if (config.metadataExtractor) {
      Object.assign(metadata, config.metadataExtractor(req));
    }

    emitAuditEvent({
      eventType: config.eventType,
      action: `${req.method} ${req.path}`,
      outcome,
      actor: {
        employeeId: req.employeeId,
        ipAddress: req.ip || req.socket?.remoteAddress,
        userAgent: req.headers['user-agent'],
        sessionId: (req as any).session?.id,
      },
      correlationId: req.correlationId,
      resource,
      metadata,
      source: 'server',
      module: 'route-audit',
    });

    return originalEnd.apply(this, args as any);
  } as any;

  next();
}
