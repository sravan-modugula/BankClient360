/**
 * Global Application Constants
 * Centralized configuration for timezone and locale settings
 */

// Timezone configuration - PST/PDT (automatically handles daylight saving)
export const APP_TIMEZONE = 'America/Los_Angeles';

// Locale configuration for formatting
export const APP_LOCALE = 'en-US';

// Date/Time display formats
export const DATE_FORMATS = {
  DATE_SHORT: 'MMM d, yyyy',           // Dec 30, 2024
  DATE_LONG: 'MMMM d, yyyy',          // December 30, 2024
  TIME_SHORT: 'h:mm a',                // 3:30 PM
  TIME_LONG: 'h:mm:ss a',             // 3:30:45 PM
  DATETIME_SHORT: 'MMM d, yyyy h:mm a', // Dec 30, 2024 3:30 PM
  DATETIME_LONG: 'MMM d, yyyy h:mm a zzz', // Dec 30, 2024 3:30 PM PST
  ISO_DATE: "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", // For API responses
  MONTH_YEAR: 'MMM yyyy',             // Dec 2024
  TRANSACTION_DATE: 'MM/dd/yyyy',      // 12/30/2024
  STATEMENT_DATE: 'MMMM yyyy'          // December 2024
} as const;

// Currency formatting configuration
export const CURRENCY_CONFIG = {
  style: 'currency' as const,
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
} as const;

// Transaction Activity Type Mappings
// Maps transaction codes to dashboard activity categories
export const CODE_TO_ACTIVITY = {
  'DD': 'direct_deposit',
  'ATM': 'atm',
  'BILLPAY': 'billpay',
  'MOBDEP': 'mobile_check_deposit',
  'ZELLE': 'zelle',
  'WIRE': 'wire',
  'ACH': 'ach'
} as const;

export const ACTIVITY_KEYS = [
  'direct_deposit',
  'atm', 
  'billpay',
  'mobile_check_deposit',
  'zelle',
  'wire',
  'ach'
] as const;

export type ActivityType = typeof ACTIVITY_KEYS[number];
export type TransactionCode = keyof typeof CODE_TO_ACTIVITY;

/**
 * Creates a default activity object with all counts set to zero
 */
export function createDefaultActivity(): Record<ActivityType, number> {
  return {
    direct_deposit: 0,
    atm: 0,
    billpay: 0,
    mobile_check_deposit: 0,
    zelle: 0,
    wire: 0,
    ach: 0
  };
}