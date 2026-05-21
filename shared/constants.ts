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
// Maps transaction_category.group_code values (as stored in the on-prem
// transaction_category table) to dashboard activity keys.
export const GROUP_CODE_TO_ACTIVITY: Record<string, ActivityType> = {
  'ACH': 'ach',
  'Cash Withdrawal': 'cash_withdrawal',
  'Check Deposit': 'check_deposit',
  'Check Payment': 'check_payment',
  'Debit Card Payment': 'debit_card_payment',
  'Deposit': 'deposit',
  'Lockbox': 'lockbox',
  'Transfer': 'transfer',
  'Wire': 'wire',
  'Zelle': 'zelle'
};

export const ACTIVITY_KEYS = [
  'ach',
  'cash_withdrawal',
  'check_deposit',
  'check_payment',
  'debit_card_payment',
  'deposit',
  'lockbox',
  'transfer',
  'wire',
  'zelle'
] as const;

export type ActivityType = typeof ACTIVITY_KEYS[number];

/**
 * Creates a default activity object with all counts set to zero
 */
export function createDefaultActivity(): Record<ActivityType, number> {
  return {
    ach: 0,
    cash_withdrawal: 0,
    check_deposit: 0,
    check_payment: 0,
    debit_card_payment: 0,
    deposit: 0,
    lockbox: 0,
    transfer: 0,
    wire: 0,
    zelle: 0
  };
}

// Fallback patterns for when transaction_category.group_code is missing on-prem.
// Matched against financial_transaction.transaction_type / transaction_code
// (case-insensitive) in declared order, first match wins. Order matters: e.g.
// "Check Deposit" must beat "Check" so check-payment doesn't swallow deposits.
export const TRANSACTION_TYPE_PATTERNS: ReadonlyArray<{
  pattern: RegExp;
  activity: ActivityType;
}> = [
  { pattern: /\bach\b/i, activity: 'ach' },
  { pattern: /\bwire\b/i, activity: 'wire' },
  { pattern: /\bzelle\b/i, activity: 'zelle' },
  { pattern: /\b(pos|debit\s*card)\b/i, activity: 'debit_card_payment' },
  { pattern: /\b(atm|cash\s*withdrawal|withdrawal)\b/i, activity: 'cash_withdrawal' },
  { pattern: /\b(transfer|xfer)\b/i, activity: 'transfer' },
  { pattern: /\block\s*box\b/i, activity: 'lockbox' },
  { pattern: /\bcheck\b.*\bdeposit\b/i, activity: 'check_deposit' },
  { pattern: /\bcheck\b/i, activity: 'check_payment' },
  { pattern: /\bdeposit\b/i, activity: 'deposit' },
];

/**
 * Resolve an activity bucket from a raw transaction_type / transaction_code
 * string by pattern. Returns null when nothing matches so callers can log it.
 */
export function activityFromTransactionType(raw: string | null | undefined): ActivityType | null {
  if (!raw) return null;
  const s = raw.toString();
  for (const { pattern, activity } of TRANSACTION_TYPE_PATTERNS) {
    if (pattern.test(s)) return activity;
  }
  return null;
}