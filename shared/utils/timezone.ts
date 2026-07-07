/**
 * Centralized Timezone Utilities
 * All date/time operations go through these utilities to ensure PST consistency
 */

import { formatInTimeZone, toZonedTime, fromZonedTime } from 'date-fns-tz';
import { parseISO, isValid } from 'date-fns';
import { APP_TIMEZONE, APP_LOCALE, DATE_FORMATS } from '../constants';

export class DateFormatter {
  /**
   * Parse a date string or Date object and ensure it's valid
   */
  private static parseDate(date: Date | string | null | undefined): Date | null {
    if (!date) return null;
    
    const parsed = typeof date === 'string' ? parseISO(date) : date;
    return isValid(parsed) ? parsed : null;
  }

  /**
   * Convert any date to PST/PDT timezone
   */
  static toPST(date: Date | string): Date {
    const parsed = DateFormatter.parseDate(date);
    if (!parsed) return new Date();
    return toZonedTime(parsed, APP_TIMEZONE);
  }

  /**
   * Convert PST date to UTC for database storage
   */
  static toUTC(date: Date | string): Date {
    const parsed = DateFormatter.parseDate(date);
    if (!parsed) return new Date();
    // fromZonedTime converts from timezone to UTC
    return fromZonedTime(parsed, APP_TIMEZONE);
  }

  /**
   * Format date for display (e.g., "Dec 30, 2024") - ALWAYS in PST
   */
  static formatDate(date: Date | string | null | undefined): string {
    const parsed = DateFormatter.parseDate(date);
    if (!parsed) return '';
    return formatInTimeZone(parsed, APP_TIMEZONE, DATE_FORMATS.DATE_SHORT);
  }

  /**
   * Format date long form (e.g., "December 30, 2024") - ALWAYS in PST
   */
  static formatDateLong(date: Date | string | null | undefined): string {
    const parsed = DateFormatter.parseDate(date);
    if (!parsed) return '';
    return formatInTimeZone(parsed, APP_TIMEZONE, DATE_FORMATS.DATE_LONG);
  }

  /**
   * Format time for display (e.g., "3:30 PM") - ALWAYS in PST
   */
  static formatTime(date: Date | string | null | undefined): string {
    const parsed = DateFormatter.parseDate(date);
    if (!parsed) return '';
    return formatInTimeZone(parsed, APP_TIMEZONE, DATE_FORMATS.TIME_SHORT);
  }

  /**
   * Format datetime for display (e.g., "Dec 30, 2024 3:30 PM") - ALWAYS in PST
   */
  static formatDateTime(date: Date | string | null | undefined): string {
    const parsed = DateFormatter.parseDate(date);
    if (!parsed) return '';
    return formatInTimeZone(parsed, APP_TIMEZONE, DATE_FORMATS.DATETIME_SHORT);
  }

  /**
   * Format datetime with timezone (e.g., "Dec 30, 2024 3:30 PM PST") - ALWAYS in PST
   */
  static formatDateTimeWithTZ(date: Date | string | null | undefined): string {
    const parsed = DateFormatter.parseDate(date);
    if (!parsed) return '';
    return formatInTimeZone(parsed, APP_TIMEZONE, DATE_FORMATS.DATETIME_LONG);
  }

  /**
   * Format as a machine-readable ISO-8601 string with numeric offset, in PST
   * (e.g., "2024-12-30T15:30:00-08:00"). Use for API response fields the client
   * re-parses with `new Date()`. Unlike formatDateTimeWithTZ, this never emits a
   * localized timezone name, so it stays parseable regardless of the server's
   * ICU build (Windows/IIS renders the `zzz` token as the unparseable long name
   * "Pacific Daylight Time", which breaks new Date() in the browser).
   */
  static formatISO(date: Date | string | null | undefined): string {
    const parsed = DateFormatter.parseDate(date);
    if (!parsed) return '';
    return formatInTimeZone(parsed, APP_TIMEZONE, "yyyy-MM-dd'T'HH:mm:ssXXX");
  }

  /**
   * Format for transaction display (e.g., "12/30/2024") - ALWAYS in PST
   */
  static formatTransactionDate(date: Date | string | null | undefined): string {
    const parsed = DateFormatter.parseDate(date);
    if (!parsed) return '';
    return formatInTimeZone(parsed, APP_TIMEZONE, DATE_FORMATS.TRANSACTION_DATE);
  }

  /**
   * Format month/year for statements (e.g., "December 2024") - ALWAYS in PST
   */
  static formatStatementDate(date: Date | string | null | undefined): string {
    const parsed = DateFormatter.parseDate(date);
    if (!parsed) return '';
    return formatInTimeZone(parsed, APP_TIMEZONE, DATE_FORMATS.STATEMENT_DATE);
  }

  /**
   * Format month/year short (e.g., "Dec 2024") - ALWAYS in PST
   */
  static formatMonthYear(date: Date | string | null | undefined): string {
    const parsed = DateFormatter.parseDate(date);
    if (!parsed) return '';
    return formatInTimeZone(parsed, APP_TIMEZONE, DATE_FORMATS.MONTH_YEAR);
  }

  /**
   * Get relative time description (e.g., "2 hours ago", "Yesterday")
   */
  static getRelativeTime(date: Date | string | null | undefined): string {
    const parsed = DateFormatter.parseDate(date);
    if (!parsed) return '';
    
    const pstDate = toZonedTime(parsed, APP_TIMEZONE);
    const now = toZonedTime(new Date(), APP_TIMEZONE);
    const diffMs = now.getTime() - pstDate.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffHours < 1) return 'Just now';
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} week${Math.floor(diffDays / 7) > 1 ? 's' : ''} ago`;
    
    return DateFormatter.formatDate(date);
  }

  /**
   * For API responses - always send as ISO string in UTC
   */
  static toAPIResponse(date: Date | string | null | undefined): string {
    const parsed = DateFormatter.parseDate(date);
    if (!parsed) return new Date().toISOString();
    return parsed.toISOString();
  }

  /**
   * Check if a date is today (in PST)
   */
  static isToday(date: Date | string): boolean {
    const parsed = DateFormatter.parseDate(date);
    if (!parsed) return false;
    
    const pstDate = toZonedTime(parsed, APP_TIMEZONE);
    const today = toZonedTime(new Date(), APP_TIMEZONE);
    
    return pstDate.getFullYear() === today.getFullYear() &&
           pstDate.getMonth() === today.getMonth() &&
           pstDate.getDate() === today.getDate();
  }

  /**
   * Get current time in PST
   */
  static nowPST(): Date {
    return toZonedTime(new Date(), APP_TIMEZONE);
  }
}