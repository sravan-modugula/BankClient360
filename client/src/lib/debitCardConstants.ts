/**
 * Debit Card Constants - Material Design Theme
 * 
 * Centralized configuration for debit card display following enterprise standards:
 * - Primary Green: #1b4d20
 * - Secondary Gold: #936b06
 * - Material Design color system
 * - No hard-coded values in components
 */

// Card Status Colors - Material Design Palette
export const CARD_STATUS_COLORS = {
  active: {
    bg: '#e8f5e9',      // Light green
    text: '#1b4d20',    // Primary green
    border: '#1b4d20',   // Primary green
    chip: 'success' as const
  },
  inactive: {
    bg: '#fff3e0',      // Light orange
    text: '#e65100',    // Deep orange
    border: '#ff9800',   // Warning orange
    chip: 'warning' as const
  },
  blocked: {
    bg: '#ffebee',      // Light red
    text: '#c62828',    // Dark red
    border: '#f44336',   // Error red
    chip: 'error' as const
  },
  expired: {
    bg: '#f5f5f5',      // Light gray
    text: '#616161',    // Gray
    border: '#9e9e9e',   // Gray
    chip: 'default' as const
  }
} as const;

// Limit Usage Colors - Green to Red Gradient
export const LIMIT_USAGE_COLORS = {
  healthy: '#1b4d20',    // Primary green (0-50%)
  warning: '#ff9800',    // Warning orange (50-90%)
  critical: '#f44336',   // Error red (90-100%)
  exceeded: '#b71c1c'    // Dark red (>100%)
} as const;

// Card Type Badge Colors
export const CARD_TYPE_COLORS = {
  standard: {
    bg: '#e8f5e9',      // Light green
    text: '#1b4d20',    // Primary green
    label: 'Standard'
  },
  gold: {
    bg: '#fff8e1',      // Light gold
    text: '#936b06',    // Secondary gold
    label: 'Gold'
  },
  platinum: {
    bg: '#f5f5f5',      // Light gray (metallic)
    text: '#424242',    // Dark gray
    label: 'Platinum'
  },
  business: {
    bg: '#e8f5e9',      // Light green
    text: '#1b4d20',    // Primary green
    label: 'Business'
  }
} as const;

// Card Brand Configuration
export const CARD_BRANDS = {
  visa: {
    name: 'VISA',
    color: '#1b4d20'    // Primary green
  },
  mastercard: {
    name: 'Mastercard',
    color: '#EB001B'    // Mastercard red
  }
} as const;

/**
 * Calculate limit usage percentage
 */
export function calculateUsagePercentage(used: number, limit: number): number {
  if (limit === 0) return 0;
  return Math.min((used / limit) * 100, 100);
}

/**
 * Get limit usage color based on percentage
 */
export function getLimitUsageColor(percentage: number): string {
  if (percentage < 50) return LIMIT_USAGE_COLORS.healthy;
  if (percentage < 90) return LIMIT_USAGE_COLORS.warning;
  return LIMIT_USAGE_COLORS.critical;
}

/**
 * Get MUI progress bar color variant based on usage percentage
 */
export function getProgressBarColor(percentage: number): 'success' | 'warning' | 'error' {
  if (percentage < 50) return 'success';
  if (percentage < 90) return 'warning';
  return 'error';
}

/**
 * Format card number with bullets for PCI compliance
 * Always shows ****XXXX (only last 4 digits)
 */
export function formatCardNumber(lastFourDigits: string): string {
  return `****${lastFourDigits}`;
}

/**
 * Format card expiry date (MM/YY)
 */
export function formatCardExpiry(month: number, year: number): string {
  const monthStr = month.toString().padStart(2, '0');
  const yearStr = year.toString().slice(-2); // Last 2 digits
  return `${monthStr}/${yearStr}`;
}

/**
 * Get card status label
 */
export function getCardStatusLabel(status: string): string {
  return status.toUpperCase();
}

/**
 * Get card type configuration
 */
export function getCardTypeConfig(cardType: string) {
  const type = cardType.toLowerCase() as keyof typeof CARD_TYPE_COLORS;
  return CARD_TYPE_COLORS[type] || CARD_TYPE_COLORS.standard;
}

/**
 * Get card brand configuration
 */
export function getCardBrandConfig(cardBrand: string | null) {
  if (!cardBrand) return { name: 'CARD', color: '#616161' };
  const brand = cardBrand.toLowerCase() as keyof typeof CARD_BRANDS;
  return CARD_BRANDS[brand] || { name: cardBrand, color: '#616161' };
}
