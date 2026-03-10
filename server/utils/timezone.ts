/**
 * Server-side Timezone Configuration
 * Sets up PST timezone for the Node.js server process
 */

import { DateFormatter } from '@shared/utils/timezone';
import logger from '../services/logger';

const fileLogger = logger.child({ module: 'timezone' });

// Set the default timezone for the Node.js process
// This affects all date operations on the server
process.env.TZ = 'America/Los_Angeles';

/**
 * Initialize server timezone on startup
 * Call this once when the server starts
 */
export function initializeServerTimezone(): void {
  process.env.TZ = 'America/Los_Angeles';
  
  // Log the timezone setting for debugging
  fileLogger.debug({ tz: process.env.TZ }, 'Server timezone set');
  fileLogger.debug({ pstTime: DateFormatter.formatDateTimeWithTZ(new Date()) }, 'Current PST time');
}

// Re-export DateFormatter for use in server routes
export { DateFormatter };

/**
 * Utility functions for server-side date handling
 */
export const serverDateUtils = {
  /**
   * Get current timestamp for API responses (always UTC)
   */
  getCurrentTimestamp(): string {
    return new Date().toISOString();
  },

  /**
   * Format date for server logs (PST)
   */
  formatLogDate(date?: Date): string {
    return DateFormatter.formatDateTimeWithTZ(date || new Date());
  },

  /**
   * Parse client date input and convert to UTC for storage
   */
  parseClientDate(dateString: string): Date | null {
    try {
      const parsed = new Date(dateString);
      return isNaN(parsed.getTime()) ? null : parsed;
    } catch {
      return null;
    }
  },

  /**
   * Prepare date for JSON response (ISO string in UTC)
   */
  toJSONResponse(date: Date | string | null): string | null {
    if (!date) return null;
    try {
      const parsed = typeof date === 'string' ? new Date(date) : date;
      return isNaN(parsed.getTime()) ? null : parsed.toISOString();
    } catch {
      return null;
    }
  }
};