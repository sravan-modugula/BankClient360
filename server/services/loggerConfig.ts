/**
 * Logger Configuration
 * Zero-dependency config constants for the ConsoleLogger.
 */

export const isDev = process.env.NODE_ENV !== 'production';
export const LOG_LEVEL = process.env.LOG_LEVEL || (isDev ? 'debug' : 'info');
