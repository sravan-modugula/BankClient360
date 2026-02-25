import { useMemo, useSyncExternalStore } from 'react';

/**
 * Subscribe to URL changes for search parameters
 * This ensures the hook updates when history.pushState or popstate events occur
 */
function subscribeToURLChanges(callback: () => void) {
  window.addEventListener('popstate', callback);
  // Also listen to custom events triggered by our navigation helpers
  window.addEventListener('pushstate', callback);
  return () => {
    window.removeEventListener('popstate', callback);
    window.removeEventListener('pushstate', callback);
  };
}

/**
 * Get current search string from window.location
 */
function getSearchString() {
  return window.location.search;
}

/**
 * Custom hook to parse URL search parameters
 * Returns a URLSearchParams object for clean parameter access
 * Uses window.location.search directly to ensure it captures query params
 */
export function useSearchParams(): URLSearchParams {
  // Use useSyncExternalStore to subscribe to URL changes
  const search = useSyncExternalStore(subscribeToURLChanges, getSearchString, getSearchString);
  
  return useMemo(() => {
    return new URLSearchParams(search);
  }, [search]);
}

/**
 * Get a specific search parameter value
 * @param key - The parameter key to retrieve
 * @returns The parameter value or null if not found
 */
export function useSearchParam(key: string): string | null {
  const params = useSearchParams();
  return params.get(key);
}
