/**
 * Enterprise Audit Event System - Shared Contract
 * Defines all audit event types, categories, and interfaces used by both server and client.
 */

// ==================================================================================
// ENUMS
// ==================================================================================

export enum AuditCategory {
  AUTHENTICATION = 'authentication',
  AUTHORIZATION = 'authorization',
  PII_ACCESS = 'pii_access',
  FINANCIAL_DATA = 'financial_data',
  DATA_MODIFICATION = 'data_modification',
  ADMIN_ACTION = 'admin_action',
  NAVIGATION = 'navigation',
  SEARCH = 'search',
  ERROR = 'error',
}

export enum AuditSeverity {
  CRITICAL = 'critical',
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low',
}

export enum AuditEventType {
  // Authentication events
  AUTH_LOGIN_SUCCESS = 'auth.login.success',
  AUTH_LOGIN_FAILED = 'auth.login.failed',
  AUTH_LOGOUT = 'auth.logout',
  AUTH_SESSION_EXPIRED = 'auth.session.expired',
  AUTH_SESSION_CREATED = 'auth.session.created',

  // Authorization events
  AUTHZ_PERMISSION_GRANTED = 'authz.permission.granted',
  AUTHZ_PERMISSION_DENIED = 'authz.permission.denied',
  AUTHZ_ROLE_ASSIGNED = 'authz.role.assigned',
  AUTHZ_ROLE_REMOVED = 'authz.role.removed',
  AUTHZ_ROLE_TEST_START = 'authz.role.test.start',
  AUTHZ_ROLE_TEST_END = 'authz.role.test.end',

  // PII access events
  PII_CUSTOMER_VIEWED = 'pii.customer.viewed',
  PII_CONTACT_ACCESSED = 'pii.contact.accessed',
  PII_SSN_ACCESSED = 'pii.ssn.accessed',
  PII_DOB_ACCESSED = 'pii.dob.accessed',
  PII_GOV_ID_ACCESSED = 'pii.govid.accessed',

  // Financial data events
  FIN_ACCOUNT_VIEWED = 'fin.account.viewed',
  FIN_TRANSACTIONS_VIEWED = 'fin.transactions.viewed',
  FIN_CARD_DETAILS_VIEWED = 'fin.card.details.viewed',
  FIN_BALANCE_VIEWED = 'fin.balance.viewed',
  FIN_HOUSEHOLD_VIEWED = 'fin.household.viewed',

  // Data modification events
  DATA_NOTE_CREATED = 'data.note.created',
  DATA_NOTE_UPDATED = 'data.note.updated',
  DATA_NOTE_DELETED = 'data.note.deleted',
  DATA_CUSTOMER_UPDATED = 'data.customer.updated',
  DATA_ACCOUNT_UPDATED = 'data.account.updated',
  DATA_CONTACT_UPDATED = 'data.contact.updated',
  DATA_ADDRESS_UPDATED = 'data.address.updated',
  DATA_HOUSEHOLD_CREATED = 'data.household.created',
  DATA_HOUSEHOLD_UPDATED = 'data.household.updated',
  DATA_HOUSEHOLD_MEMBER_ADDED = 'data.household.member.added',
  DATA_HOUSEHOLD_MEMBER_REMOVED = 'data.household.member.removed',

  // Admin action events
  ADMIN_USER_CREATED = 'admin.user.created',
  ADMIN_USER_UPDATED = 'admin.user.updated',
  ADMIN_USER_DEACTIVATED = 'admin.user.deactivated',
  ADMIN_ROLE_MAPPING_UPDATED = 'admin.role.mapping.updated',

  // Navigation events
  NAV_PAGE_CHANGED = 'nav.page.changed',
  NAV_CUSTOMER_VIEWED = 'nav.customer.viewed',
  NAV_ACCOUNT_VIEWED = 'nav.account.viewed',

  // Search events
  SEARCH_CUSTOMER = 'search.customer',
  SEARCH_UNIFIED = 'search.unified',

  // Error events
  ERR_SERVER = 'err.server',
  ERR_CLIENT = 'err.client',
  ERR_API = 'err.api',
  ERR_UNHANDLED = 'err.unhandled',
}

export type AuditOutcome = 'success' | 'failure' | 'denied' | 'error';
export type AuditSource = 'server' | 'client';

// ==================================================================================
// INTERFACES
// ==================================================================================

export interface AuditActor {
  employeeId?: number;
  ipAddress?: string;
  userAgent?: string;
  sessionId?: string;
}

export interface AuditResource {
  type?: string;
  id?: string | number;
  name?: string;
}

export interface AuditEvent {
  eventType: AuditEventType;
  category: AuditCategory;
  severity: AuditSeverity;
  timestamp: string;
  correlationId?: string;
  actor: AuditActor;
  action: string;
  outcome: AuditOutcome;
  resource?: AuditResource;
  metadata?: Record<string, unknown>;
  source: AuditSource;
  module?: string;
}

/** Minimal event shape the client sends — server enriches with actor/correlation data */
export interface ClientAuditEvent {
  eventType: AuditEventType;
  action: string;
  outcome?: AuditOutcome;
  resource?: AuditResource;
  metadata?: Record<string, unknown>;
  module?: string;
  timestamp?: string;
}

// ==================================================================================
// EVENT CLASSIFICATION MAP
// ==================================================================================

interface EventClassification {
  category: AuditCategory;
  severity: AuditSeverity;
}

export const EVENT_CLASSIFICATION: Record<AuditEventType, EventClassification> = {
  // Authentication
  [AuditEventType.AUTH_LOGIN_SUCCESS]: { category: AuditCategory.AUTHENTICATION, severity: AuditSeverity.HIGH },
  [AuditEventType.AUTH_LOGIN_FAILED]: { category: AuditCategory.AUTHENTICATION, severity: AuditSeverity.HIGH },
  [AuditEventType.AUTH_LOGOUT]: { category: AuditCategory.AUTHENTICATION, severity: AuditSeverity.MEDIUM },
  [AuditEventType.AUTH_SESSION_EXPIRED]: { category: AuditCategory.AUTHENTICATION, severity: AuditSeverity.MEDIUM },
  [AuditEventType.AUTH_SESSION_CREATED]: { category: AuditCategory.AUTHENTICATION, severity: AuditSeverity.MEDIUM },

  // Authorization
  [AuditEventType.AUTHZ_PERMISSION_GRANTED]: { category: AuditCategory.AUTHORIZATION, severity: AuditSeverity.LOW },
  [AuditEventType.AUTHZ_PERMISSION_DENIED]: { category: AuditCategory.AUTHORIZATION, severity: AuditSeverity.HIGH },
  [AuditEventType.AUTHZ_ROLE_ASSIGNED]: { category: AuditCategory.AUTHORIZATION, severity: AuditSeverity.HIGH },
  [AuditEventType.AUTHZ_ROLE_REMOVED]: { category: AuditCategory.AUTHORIZATION, severity: AuditSeverity.HIGH },
  [AuditEventType.AUTHZ_ROLE_TEST_START]: { category: AuditCategory.AUTHORIZATION, severity: AuditSeverity.MEDIUM },
  [AuditEventType.AUTHZ_ROLE_TEST_END]: { category: AuditCategory.AUTHORIZATION, severity: AuditSeverity.MEDIUM },

  // PII access
  [AuditEventType.PII_CUSTOMER_VIEWED]: { category: AuditCategory.PII_ACCESS, severity: AuditSeverity.MEDIUM },
  [AuditEventType.PII_CONTACT_ACCESSED]: { category: AuditCategory.PII_ACCESS, severity: AuditSeverity.MEDIUM },
  [AuditEventType.PII_SSN_ACCESSED]: { category: AuditCategory.PII_ACCESS, severity: AuditSeverity.CRITICAL },
  [AuditEventType.PII_DOB_ACCESSED]: { category: AuditCategory.PII_ACCESS, severity: AuditSeverity.HIGH },
  [AuditEventType.PII_GOV_ID_ACCESSED]: { category: AuditCategory.PII_ACCESS, severity: AuditSeverity.CRITICAL },

  // Financial data
  [AuditEventType.FIN_ACCOUNT_VIEWED]: { category: AuditCategory.FINANCIAL_DATA, severity: AuditSeverity.MEDIUM },
  [AuditEventType.FIN_TRANSACTIONS_VIEWED]: { category: AuditCategory.FINANCIAL_DATA, severity: AuditSeverity.MEDIUM },
  [AuditEventType.FIN_CARD_DETAILS_VIEWED]: { category: AuditCategory.FINANCIAL_DATA, severity: AuditSeverity.CRITICAL },
  [AuditEventType.FIN_BALANCE_VIEWED]: { category: AuditCategory.FINANCIAL_DATA, severity: AuditSeverity.MEDIUM },
  [AuditEventType.FIN_HOUSEHOLD_VIEWED]: { category: AuditCategory.FINANCIAL_DATA, severity: AuditSeverity.MEDIUM },

  // Data modification
  [AuditEventType.DATA_NOTE_CREATED]: { category: AuditCategory.DATA_MODIFICATION, severity: AuditSeverity.MEDIUM },
  [AuditEventType.DATA_NOTE_UPDATED]: { category: AuditCategory.DATA_MODIFICATION, severity: AuditSeverity.MEDIUM },
  [AuditEventType.DATA_NOTE_DELETED]: { category: AuditCategory.DATA_MODIFICATION, severity: AuditSeverity.HIGH },
  [AuditEventType.DATA_CUSTOMER_UPDATED]: { category: AuditCategory.DATA_MODIFICATION, severity: AuditSeverity.HIGH },
  [AuditEventType.DATA_ACCOUNT_UPDATED]: { category: AuditCategory.DATA_MODIFICATION, severity: AuditSeverity.HIGH },
  [AuditEventType.DATA_CONTACT_UPDATED]: { category: AuditCategory.DATA_MODIFICATION, severity: AuditSeverity.HIGH },
  [AuditEventType.DATA_ADDRESS_UPDATED]: { category: AuditCategory.DATA_MODIFICATION, severity: AuditSeverity.HIGH },
  [AuditEventType.DATA_HOUSEHOLD_CREATED]: { category: AuditCategory.DATA_MODIFICATION, severity: AuditSeverity.MEDIUM },
  [AuditEventType.DATA_HOUSEHOLD_UPDATED]: { category: AuditCategory.DATA_MODIFICATION, severity: AuditSeverity.MEDIUM },
  [AuditEventType.DATA_HOUSEHOLD_MEMBER_ADDED]: { category: AuditCategory.DATA_MODIFICATION, severity: AuditSeverity.MEDIUM },
  [AuditEventType.DATA_HOUSEHOLD_MEMBER_REMOVED]: { category: AuditCategory.DATA_MODIFICATION, severity: AuditSeverity.MEDIUM },

  // Admin actions
  [AuditEventType.ADMIN_USER_CREATED]: { category: AuditCategory.ADMIN_ACTION, severity: AuditSeverity.HIGH },
  [AuditEventType.ADMIN_USER_UPDATED]: { category: AuditCategory.ADMIN_ACTION, severity: AuditSeverity.HIGH },
  [AuditEventType.ADMIN_USER_DEACTIVATED]: { category: AuditCategory.ADMIN_ACTION, severity: AuditSeverity.CRITICAL },
  [AuditEventType.ADMIN_ROLE_MAPPING_UPDATED]: { category: AuditCategory.ADMIN_ACTION, severity: AuditSeverity.CRITICAL },

  // Navigation
  [AuditEventType.NAV_PAGE_CHANGED]: { category: AuditCategory.NAVIGATION, severity: AuditSeverity.LOW },
  [AuditEventType.NAV_CUSTOMER_VIEWED]: { category: AuditCategory.NAVIGATION, severity: AuditSeverity.LOW },
  [AuditEventType.NAV_ACCOUNT_VIEWED]: { category: AuditCategory.NAVIGATION, severity: AuditSeverity.LOW },

  // Search
  [AuditEventType.SEARCH_CUSTOMER]: { category: AuditCategory.SEARCH, severity: AuditSeverity.LOW },
  [AuditEventType.SEARCH_UNIFIED]: { category: AuditCategory.SEARCH, severity: AuditSeverity.LOW },

  // Errors
  [AuditEventType.ERR_SERVER]: { category: AuditCategory.ERROR, severity: AuditSeverity.HIGH },
  [AuditEventType.ERR_CLIENT]: { category: AuditCategory.ERROR, severity: AuditSeverity.MEDIUM },
  [AuditEventType.ERR_API]: { category: AuditCategory.ERROR, severity: AuditSeverity.MEDIUM },
  [AuditEventType.ERR_UNHANDLED]: { category: AuditCategory.ERROR, severity: AuditSeverity.CRITICAL },
};
