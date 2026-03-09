/**
 * Structured Logger Service
 * Zero-dependency ConsoleLogger with automatic PII masking.
 * Drop-in replacement for pino — same API surface used by all consumers.
 */

import { isDev, LOG_LEVEL } from './loggerConfig';

// ── PII Masking (unchanged) ────────────────────────────────────────────

const SENSITIVE_KEYS = new Set([
  'taxidentifier', 'ssn', 'socialsecuritynumber',
  'accountnumber', 'cardnumber', 'lastfourdigits',
  'dateofbirth', 'dob',
  'email',
  'governmentid', 'govid',
  'password', 'token', 'secret', 'authorization',
]);

function maskValue(key: string, value: unknown): unknown {
  if (typeof value !== 'string' || value.length === 0) return '***';
  const lowerKey = key.toLowerCase();

  if (lowerKey.includes('ssn') || lowerKey.includes('taxidentifier') || lowerKey.includes('socialsecurity')) {
    return value.length >= 4 ? `***-**-${value.slice(-4)}` : '***';
  }

  if (lowerKey.includes('cardnumber') || lowerKey.includes('accountnumber')) {
    return value.length >= 4 ? `****${value.slice(-4)}` : '****';
  }

  if (lowerKey === 'email') {
    const atIdx = value.indexOf('@');
    if (atIdx > 0) return `***@${value.slice(atIdx + 1)}`;
    return '***';
  }

  return '***';
}

function maskPII(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (SENSITIVE_KEYS.has(key.toLowerCase())) {
      result[key] = maskValue(key, value);
    } else if (value && typeof value === 'object' && !Array.isArray(value)) {
      result[key] = maskPII(value as Record<string, unknown>);
    } else {
      result[key] = value;
    }
  }
  return result;
}

// ── ConsoleLogger ──────────────────────────────────────────────────────

const LEVELS: Record<string, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
  fatal: 50,
};

const LEVEL_LABELS: Record<number, string> = {
  10: 'DEBUG',
  20: 'INFO ',
  30: 'WARN ',
  40: 'ERROR',
  50: 'FATAL',
};

function serializeError(err: Error): Record<string, unknown> {
  return { type: err.constructor.name, message: err.message, stack: err.stack };
}

function formatTime(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
}

function flattenKV(obj: Record<string, unknown>): string {
  const parts: string[] = [];
  for (const [k, v] of Object.entries(obj)) {
    if (k === 'module' || k === 'service' || k === 'environment') continue;
    if (v instanceof Error) {
      parts.push(`err.message="${v.message}"`);
    } else if (typeof v === 'object' && v !== null) {
      parts.push(`${k}=${JSON.stringify(v)}`);
    } else {
      parts.push(`${k}=${JSON.stringify(v)}`);
    }
  }
  return parts.length > 0 ? '  ' + parts.join(' ') : '';
}

class ConsoleLogger {
  private threshold: number;
  private context: Record<string, unknown>;

  constructor(context: Record<string, unknown> = {}, level?: string) {
    this.context = context;
    this.threshold = LEVELS[level || LOG_LEVEL] ?? LEVELS.info;
  }

  child(bindings: Record<string, unknown>): ConsoleLogger {
    return new ConsoleLogger({ ...this.context, ...bindings });
  }

  debug(objOrMsg: unknown, msg?: string): void { this.log(10, objOrMsg, msg); }
  info(objOrMsg: unknown, msg?: string): void { this.log(20, objOrMsg, msg); }
  warn(objOrMsg: unknown, msg?: string): void { this.log(30, objOrMsg, msg); }
  error(objOrMsg: unknown, msg?: string): void { this.log(40, objOrMsg, msg); }
  fatal(objOrMsg: unknown, msg?: string): void { this.log(50, objOrMsg, msg); }

  private log(level: number, objOrMsg: unknown, msg?: string): void {
    if (level < this.threshold) return;

    let data: Record<string, unknown> = {};
    let message: string;

    if (typeof objOrMsg === 'string') {
      message = objOrMsg;
    } else if (objOrMsg && typeof objOrMsg === 'object') {
      data = maskPII({ ...(objOrMsg as Record<string, unknown>) });
      if (data.err instanceof Error) {
        data.err = serializeError(data.err);
      }
      message = msg || '';
    } else {
      message = String(objOrMsg);
    }

    const merged = { ...this.context, ...data };
    const module = merged.module as string | undefined;

    if (isDev) {
      this.writeDev(level, module, message, merged);
    } else {
      this.writeProd(level, message, merged);
    }
  }

  private writeDev(level: number, module: string | undefined, message: string, data: Record<string, unknown>): void {
    const time = formatTime();
    const levelTag = LEVEL_LABELS[level] || 'INFO ';
    const modTag = module ? `[${module}] ` : '';
    const kv = flattenKV(data);
    const line = `${time} [${levelTag}] ${modTag}${message}${kv}`;

    if (level >= 40) {
      console.error(line);
    } else if (level >= 30) {
      console.warn(line);
    } else {
      console.log(line);
    }
  }

  private writeProd(level: number, message: string, data: Record<string, unknown>): void {
    const levelName = Object.entries(LEVELS).find(([, v]) => v === level)?.[0] || 'info';
    const entry = {
      level: levelName,
      time: new Date().toISOString(),
      ...data,
      msg: message,
    };
    const line = JSON.stringify(entry);

    if (level >= 40) {
      console.error(line);
    } else {
      console.log(line);
    }
  }
}

// ── Exports (same shape as before) ────────────────────────────────────

const logger = new ConsoleLogger({
  service: 'bankclient360',
  environment: process.env.NODE_ENV || 'development',
});

export function createChildLogger(context: {
  correlationId?: string;
  employeeId?: number;
  module?: string;
  [key: string]: unknown;
}) {
  return logger.child(context);
}

export default logger;
