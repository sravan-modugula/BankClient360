/**
 * Client-side Date Formatting Utilities
 * React hooks and utilities for consistent PST date/time display
 */

import { DateFormatter } from '@shared/utils/timezone';
import { CURRENCY_CONFIG } from '@shared/constants';

/**
 * React hook for date formatting utilities
 * Provides consistent date/time formatters for use in components
 */
export const useDateFormatter = () => {
  return {
    // Date formatters
    formatDate: DateFormatter.formatDate,
    formatDateLong: DateFormatter.formatDateLong,
    formatTime: DateFormatter.formatTime,
    formatDateTime: DateFormatter.formatDateTime,
    formatDateTimeWithTZ: DateFormatter.formatDateTimeWithTZ,
    formatTransactionDate: DateFormatter.formatTransactionDate,
    formatStatementDate: DateFormatter.formatStatementDate,
    formatMonthYear: DateFormatter.formatMonthYear,
    getRelativeTime: DateFormatter.getRelativeTime,
    
    // Utility functions
    isToday: DateFormatter.isToday,
    nowPST: DateFormatter.nowPST,
    
    // Currency formatter
    formatCurrency: (amount: number | string, options?: Partial<typeof CURRENCY_CONFIG>) => {
      const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
      if (isNaN(numAmount)) return '$0.00';
      
      return new Intl.NumberFormat('en-US', {
        ...CURRENCY_CONFIG,
        ...options
      }).format(numAmount);
    },
    
    // Format currency compact (e.g., $1.5M, $250K)
    formatCurrencyCompact: (amount: number | string) => {
      const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
      if (isNaN(numAmount)) return '$0';
      
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        notation: 'compact',
        maximumFractionDigits: 1
      }).format(numAmount);
    },
    
    // Format percentage
    formatPercentage: (value: number | string, decimals: number = 2) => {
      const numValue = typeof value === 'string' ? parseFloat(value) : value;
      if (isNaN(numValue)) return '0%';
      return `${numValue.toFixed(decimals)}%`;
    }
  };
};

/**
 * Non-hook version for use outside of React components
 */
export const dateFormatters = {
  formatDate: DateFormatter.formatDate,
  formatDateLong: DateFormatter.formatDateLong,
  formatTime: DateFormatter.formatTime,
  formatDateTime: DateFormatter.formatDateTime,
  formatDateTimeWithTZ: DateFormatter.formatDateTimeWithTZ,
  formatTransactionDate: DateFormatter.formatTransactionDate,
  formatStatementDate: DateFormatter.formatStatementDate,
  formatMonthYear: DateFormatter.formatMonthYear,
  getRelativeTime: DateFormatter.getRelativeTime,
  isToday: DateFormatter.isToday,
  nowPST: DateFormatter.nowPST
};

// Export DateFormatter class for direct access if needed
export { DateFormatter } from '@shared/utils/timezone';