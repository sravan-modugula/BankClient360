/**
 * Navigation utilities for enterprise-grade routing
 * Provides type-safe, validated navigation helpers for the banking application
 */

/**
 * Validate and sanitize ID parameter
 * Accepts both numeric IDs (e.g., 123) and alphanumeric IDs (e.g., "CID123456")
 * Prevents injection attacks by encoding the ID
 */
function validateAndEncodeId(id: number | string): string {
  if (id === null || id === undefined || id === '') {
    throw new Error('ID cannot be null, undefined, or empty');
  }
  
  const stringId = String(id).trim();
  
  // Prevent injection by only allowing alphanumeric characters, hyphens, and underscores
  if (!/^[a-zA-Z0-9_-]+$/.test(stringId)) {
    throw new Error(`Invalid ID format: ${id}. Only alphanumeric characters, hyphens, and underscores are allowed.`);
  }
  
  return encodeURIComponent(stringId);
}

export function generateCustomerUrl(customerId: number | string, fromHouseholdId?: number | string) : string {
    const encodedId = validateAndEncodeId(customerId);
    let newUrl = `/ciq/client?customerId=${encodedId}`;
    
    // Add household ID if provided for back navigation
    if (fromHouseholdId) {
      const encodedHouseholdId = validateAndEncodeId(fromHouseholdId);
      newUrl += `&fromHouseholdId=${encodedHouseholdId}`;
    }

    return newUrl;
}

/**
 * Navigate to customer detail page using SPA routing
 * @param customerId - The customer ID to navigate to (supports both numeric and alphanumeric IDs)
 * @param fromHouseholdId - Optional household ID to enable "back to household" navigation
 * @throws Error if customerId is invalid or contains unsafe characters
 */
export function navigateToCustomer(customerId: number | string, fromHouseholdId?: number | string): void {
  try {
    const newUrl = generateCustomerUrl(customerId, fromHouseholdId);

    // Use history.pushState for SPA navigation without full page reload
    window.history.pushState({}, '', newUrl);
    // Trigger events so hooks detect the navigation
    window.dispatchEvent(new PopStateEvent('popstate'));
    window.dispatchEvent(new Event('pushstate'));
  } catch (error) {
    console.error('Navigation error:', error);
    throw error;
  }
}

/**
 * Navigate to household detail page using SPA routing
 * @param householdId - The household ID to navigate to (typically numeric)
 * @throws Error if householdId is invalid or contains unsafe characters
 */
export function navigateToHousehold(householdId: number | string): void {
  try {
    const encodedId = validateAndEncodeId(householdId);
    // Preserve any existing customerId query param so the dashboard tabs stay in sync
    const currentParams = new URLSearchParams(window.location.search);
    const targetParams = new URLSearchParams();
    targetParams.set('householdId', encodedId);
    const existingCustomerId = currentParams.get('customerId');
    if (existingCustomerId) {
      targetParams.set('customerId', existingCustomerId);
    }
    // Use history.pushState for SPA navigation without full page reload
    window.history.pushState({}, '', `/ciq/household?${targetParams.toString()}`);
    // Trigger events so hooks detect the navigation
    window.dispatchEvent(new PopStateEvent('popstate'));
    window.dispatchEvent(new Event('pushstate'));
  } catch (error) {
    console.error('Navigation error:', error);
    throw error;
  }
}

/*
* Navigate to a url and keep the current search parameters when calling the 
* going to the new url
*/
export function navigateWithMergedSearch(navigate : (url: string) => void, to : string) {
  // Get current search params from browser location
  const currentParams = new URLSearchParams(window.location.search);

  // Parse the target URL (supports relative paths)
  const url = new URL(to, window.location.origin);
  const targetParams = new URLSearchParams(url.search);

  // Merge: preserve existing target params, append missing ones from current
  for (const [key, value] of currentParams.entries()) {
    if (!targetParams.has(key)) {
      targetParams.append(key, value);
    }
  }

  // Reconstruct final URL
  url.search = targetParams.toString();

  // Navigate using pathname + search + hash (avoids origin issues)
  navigate(url.pathname + url.search + url.hash);
}