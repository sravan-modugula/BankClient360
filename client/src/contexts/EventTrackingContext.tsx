import React, { createContext, useContext, useEffect, useRef } from 'react';
import { eventTracker } from '@/lib/eventTracker';
import { useAuth } from './AuthContext';
import { AuditEventType } from '@shared/auditEvents';

const EventTrackingContext = createContext<typeof eventTracker>(eventTracker);

export function EventTrackingProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const initializedRef = useRef(false);

  useEffect(() => {
    // Initialize tracker with user context
    eventTracker.init({
      correlationId: crypto.randomUUID(),
      employeeId: user?.employeeId,
    });
    initializedRef.current = true;

    // Flush on page unload
    const handleBeforeUnload = () => {
      eventTracker.flush();
    };

    // Global error handler
    const handleError = (event: ErrorEvent) => {
      eventTracker.track(AuditEventType.ERR_UNHANDLED, {
        action: `Unhandled error: ${event.message}`,
        outcome: 'error',
        metadata: {
          message: event.message,
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno,
        },
        module: 'global',
      });
    };

    // Unhandled promise rejection handler
    const handleRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason instanceof Error
        ? event.reason.message
        : String(event.reason);

      eventTracker.track(AuditEventType.ERR_UNHANDLED, {
        action: `Unhandled rejection: ${reason}`,
        outcome: 'error',
        metadata: { reason },
        module: 'global',
      });
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleRejection);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleRejection);
      eventTracker.destroy();
    };
  }, [user?.employeeId]);

  return (
    <EventTrackingContext.Provider value={eventTracker}>
      {children}
    </EventTrackingContext.Provider>
  );
}

export function useEventTracker() {
  return useContext(EventTrackingContext);
}
