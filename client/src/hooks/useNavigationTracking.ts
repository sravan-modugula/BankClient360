import { useEffect, useRef } from 'react';
import { useLocation } from 'wouter';
import { eventTracker } from '@/lib/eventTracker';
import { AuditEventType } from '@shared/auditEvents';

/**
 * Tracks route changes and emits NAV_PAGE_CHANGED events.
 */
export function useNavigationTracking() {
  const [location] = useLocation();
  const prevLocationRef = useRef<string | null>(null);

  useEffect(() => {
    const from = prevLocationRef.current;
    const to = location;

    if (from !== null && from !== to) {
      eventTracker.track(AuditEventType.NAV_PAGE_CHANGED, {
        action: `Navigation: ${from} → ${to}`,
        metadata: { from, to },
        module: 'navigation',
      });
    }

    prevLocationRef.current = to;
  }, [location]);
}
