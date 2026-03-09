/**
 * Audit Service
 * Dual-write: always logs to pino, buffers CRITICAL/HIGH events for DB insert.
 * Graceful degradation — DB failures don't crash the app.
 */

import logger, { createChildLogger, FileWriter } from './logger';
import { isPostgreSQL } from '../dbConfig';
import {
  AuditEvent,
  AuditSeverity,
  AuditEventType,
  AuditCategory,
  AuditOutcome,
  AuditSource,
  EVENT_CLASSIFICATION,
  type AuditActor,
  type AuditResource,
} from '../../shared/auditEvents';

const auditLogger = createChildLogger({ module: 'audit' });
const auditFileWriter = new FileWriter('logs/audit.log');

// ==================================================================================
// BUFFERED DB WRITES
// ==================================================================================

const eventBuffer: AuditEvent[] = [];
const FLUSH_INTERVAL_MS = 5_000;
const FLUSH_THRESHOLD = 50;
let flushTimer: ReturnType<typeof setInterval> | null = null;

function startFlushTimer() {
  if (flushTimer) return;
  flushTimer = setInterval(() => {
    if (eventBuffer.length > 0) {
      flushToDatabase().catch((err) =>
        auditLogger.error({ err }, 'Periodic flush failed')
      );
    }
  }, FLUSH_INTERVAL_MS);
  // Don't prevent process exit
  if (flushTimer && typeof flushTimer === 'object' && 'unref' in flushTimer) {
    flushTimer.unref();
  }
}

async function flushToDatabase(): Promise<void> {
  if (eventBuffer.length === 0) return;

  const batch = eventBuffer.splice(0, eventBuffer.length);

  try {
    if (isPostgreSQL()) {
      await flushToPostgreSQL(batch);
    } else {
      await flushToSQLServer(batch);
    }
  } catch (err) {
    // Graceful degradation: events are already written to pino log output
    auditLogger.warn(
      { err, droppedCount: batch.length },
      'Failed to flush audit events to database — events preserved in log output'
    );
  }
}

async function flushToPostgreSQL(events: AuditEvent[]): Promise<void> {
  const { getPgDatabase } = await import('../db');
  const { auditEvent } = await import('../../shared/schema');
  const db = getPgDatabase();

  const rows = events.map(mapEventToRow);
  await db.insert(auditEvent).values(rows);
}

async function flushToSQLServer(events: AuditEvent[]): Promise<void> {
  const { getMssqlPool } = await import('../db');
  const pool = await getMssqlPool();

  // Batch insert via table-valued parameter or individual inserts
  for (const event of events) {
    const row = mapEventToRow(event);
    await pool.request()
      .input('event_type', row.eventType)
      .input('category', row.category)
      .input('severity', row.severity)
      .input('correlation_id', row.correlationId)
      .input('employee_id', row.employeeId)
      .input('session_id', row.sessionId)
      .input('ip_address', row.ipAddress)
      .input('user_agent', row.userAgent)
      .input('action', row.action)
      .input('outcome', row.outcome)
      .input('resource_type', row.resourceType)
      .input('resource_id', row.resourceId)
      .input('resource_name', row.resourceName)
      .input('metadata', row.metadata ? JSON.stringify(row.metadata) : null)
      .input('source', row.source)
      .input('module', row.module)
      .input('occurred_at', row.occurredAt)
      .query(`
        INSERT INTO audit_event (
          event_type, category, severity, correlation_id,
          employee_id, session_id, ip_address, user_agent,
          action, outcome,
          resource_type, resource_id, resource_name,
          metadata, source, module, occurred_at
        ) VALUES (
          @event_type, @category, @severity, @correlation_id,
          @employee_id, @session_id, @ip_address, @user_agent,
          @action, @outcome,
          @resource_type, @resource_id, @resource_name,
          @metadata, @source, @module, @occurred_at
        )
      `);
  }
}

function mapEventToRow(event: AuditEvent) {
  return {
    eventType: event.eventType,
    category: event.category,
    severity: event.severity,
    correlationId: event.correlationId || null,
    employeeId: event.actor.employeeId || null,
    sessionId: event.actor.sessionId || null,
    ipAddress: event.actor.ipAddress || null,
    userAgent: event.actor.userAgent ? event.actor.userAgent.slice(0, 500) : null,
    action: event.action.slice(0, 500),
    outcome: event.outcome,
    resourceType: event.resource?.type || null,
    resourceId: event.resource?.id?.toString() || null,
    resourceName: event.resource?.name || null,
    metadata: event.metadata || null,
    source: event.source,
    module: event.module || null,
    occurredAt: new Date(event.timestamp),
  };
}

// ==================================================================================
// PUBLIC API
// ==================================================================================

/**
 * Record an audit event — writes to structured log immediately,
 * and buffers CRITICAL/HIGH events for database persistence.
 */
export function recordEvent(event: AuditEvent): void {
  // Always write to structured log
  const logData = {
    audit: true,
    eventType: event.eventType,
    category: event.category,
    severity: event.severity,
    correlationId: event.correlationId,
    actor: event.actor,
    action: event.action,
    outcome: event.outcome,
    resource: event.resource,
    metadata: event.metadata,
    source: event.source,
    module: event.module,
  };

  // Use appropriate log level based on severity
  switch (event.severity) {
    case AuditSeverity.CRITICAL:
      auditLogger.fatal(logData, `[AUDIT] ${event.action}`);
      break;
    case AuditSeverity.HIGH:
      auditLogger.warn(logData, `[AUDIT] ${event.action}`);
      break;
    case AuditSeverity.MEDIUM:
      auditLogger.info(logData, `[AUDIT] ${event.action}`);
      break;
    case AuditSeverity.LOW:
      auditLogger.debug(logData, `[AUDIT] ${event.action}`);
      break;
  }

  // Write to dedicated audit log file
  auditFileWriter.write(JSON.stringify({
    timestamp: event.timestamp,
    severity: event.severity,
    action: event.action,
    outcome: event.outcome,
    actor: event.actor,
    resource: event.resource,
    metadata: event.metadata,
    correlationId: event.correlationId,
  }));

  // Buffer critical/high for DB persistence
  if (
    event.severity === AuditSeverity.CRITICAL ||
    event.severity === AuditSeverity.HIGH
  ) {
    eventBuffer.push(event);
    startFlushTimer();

    if (eventBuffer.length >= FLUSH_THRESHOLD) {
      flushToDatabase().catch((err) =>
        auditLogger.error({ err }, 'Threshold flush failed')
      );
    }
  }
}

/**
 * Helper to build and record an event with auto-classification.
 */
export function emitAuditEvent(params: {
  eventType: AuditEventType;
  action: string;
  outcome: AuditOutcome;
  actor: AuditActor;
  correlationId?: string;
  resource?: AuditResource;
  metadata?: Record<string, unknown>;
  source?: AuditSource;
  module?: string;
}): void {
  const classification = EVENT_CLASSIFICATION[params.eventType];

  const event: AuditEvent = {
    eventType: params.eventType,
    category: classification.category,
    severity: classification.severity,
    timestamp: new Date().toISOString(),
    correlationId: params.correlationId,
    actor: params.actor,
    action: params.action,
    outcome: params.outcome,
    resource: params.resource,
    metadata: params.metadata,
    source: params.source || 'server',
    module: params.module,
  };

  recordEvent(event);
}

/**
 * Graceful shutdown: flush remaining events.
 */
export async function shutdownAuditService(): Promise<void> {
  if (flushTimer) {
    clearInterval(flushTimer);
    flushTimer = null;
  }
  await flushToDatabase();
}

export const auditService = {
  recordEvent,
  emitAuditEvent,
  shutdown: shutdownAuditService,
};
