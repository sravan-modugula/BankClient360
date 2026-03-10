/**
 * Client-Side Event Tracker
 * Batches events and sends them to the server via sendBeacon (survives page unload) or fetch fallback.
 */

import type { AuditEventType, ClientAuditEvent, AuditOutcome, AuditResource } from '@shared/auditEvents';

const FLUSH_INTERVAL_MS = 10_000;
const FLUSH_THRESHOLD = 20;
const MAX_BUFFER_SIZE = 200;
const BATCH_ENDPOINT = '/api/events/batch';

class EventTracker {
  private buffer: ClientAuditEvent[] = [];
  private flushTimer: ReturnType<typeof setInterval> | null = null;
  private correlationId: string | null = null;
  private employeeId: number | null = null;

  /**
   * Initialize with user context from auth.
   */
  init(params: { correlationId?: string; employeeId?: number }) {
    this.correlationId = params.correlationId || crypto.randomUUID();
    this.employeeId = params.employeeId || null;

    if (!this.flushTimer) {
      this.flushTimer = setInterval(() => this.flush(), FLUSH_INTERVAL_MS);
    }
  }

  /**
   * Track an audit event.
   */
  track(
    eventType: AuditEventType,
    data: {
      action: string;
      outcome?: AuditOutcome;
      resource?: AuditResource;
      metadata?: Record<string, unknown>;
      module?: string;
    }
  ) {
    if (this.buffer.length >= MAX_BUFFER_SIZE) {
      // Drop oldest events to prevent memory leak
      this.buffer.shift();
    }

    this.buffer.push({
      eventType,
      action: data.action,
      outcome: data.outcome || 'success',
      resource: data.resource,
      metadata: data.metadata,
      module: data.module,
      timestamp: new Date().toISOString(),
    });

    if (this.buffer.length >= FLUSH_THRESHOLD) {
      this.flush();
    }
  }

  /**
   * Flush buffered events to the server.
   */
  flush() {
    if (this.buffer.length === 0) return;

    const events = this.buffer.splice(0, this.buffer.length);
    const body = JSON.stringify(events);

    // Prefer sendBeacon for reliability during page unload
    if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
      const sent = navigator.sendBeacon(
        BATCH_ENDPOINT,
        new Blob([body], { type: 'application/json' })
      );
      if (sent) return;
    }

    // Fallback to fetch
    fetch(BATCH_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      credentials: 'include',
      keepalive: true,
    }).catch(() => {
      // Silent failure — events were best-effort
    });
  }

  /**
   * Clean up timers.
   */
  destroy() {
    this.flush();
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
  }
}

// Singleton instance
export const eventTracker = new EventTracker();
