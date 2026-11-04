/**
 * Secure logging utility with token and credential redaction.
 * Ensures tokens, client secrets, and sensitive authentication headers
 * are NEVER printed in console output or log files.
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const SENSITIVE_PATTERNS = [
  /(Bearer\s+)[A-Za-z0-9_\-\.]+/gi,
  /(access_token["']?\s*[:=]\s*["']?)[A-Za-z0-9_\-\.]+/gi,
  /(refresh_token["']?\s*[:=]\s*["']?)[A-Za-z0-9_\-\.]+/gi,
  /(client_secret["']?\s*[:=]\s*["']?)[A-Za-z0-9_\-\.]+/gi,
  /(ENCRYPTION_KEY["']?\s*[:=]\s*["']?)[A-Za-z0-9_\-\.]+/gi,
  /(code_verifier["']?\s*[:=]\s*["']?)[A-Za-z0-9_\-\.]+/gi,
];

function sanitize(message: string): string {
  let sanitized = message;
  for (const pattern of SENSITIVE_PATTERNS) {
    sanitized = sanitized.replace(pattern, '$1[REDACTED]');
  }
  return sanitized;
}

function formatArg(arg: unknown): unknown {
  if (typeof arg === 'string') {
    return sanitize(arg);
  }
  if (arg instanceof Error) {
    return {
      message: sanitize(arg.message),
      name: arg.name,
      stack: arg.stack ? sanitize(arg.stack) : undefined,
    };
  }
  if (typeof arg === 'object' && arg !== null) {
    try {
      const json = JSON.stringify(arg);
      return JSON.parse(sanitize(json));
    } catch {
      return '[Unserializable Object]';
    }
  }
  return arg;
}

function log(level: LogLevel, message: string, ...args: unknown[]): void {
  const timestamp = new Date().toISOString();
  const safeMessage = sanitize(message);
  const safeArgs = args.map(formatArg);

  const prefix = `[${timestamp}] [${level.toUpperCase()}]`;

  switch (level) {
    case 'debug':
      if (process.env.NODE_ENV !== 'production') {
        console.debug(prefix, safeMessage, ...safeArgs);
      }
      break;
    case 'info':
      console.info(prefix, safeMessage, ...safeArgs);
      break;
    case 'warn':
      console.warn(prefix, safeMessage, ...safeArgs);
      break;
    case 'error':
      console.error(prefix, safeMessage, ...safeArgs);
      break;
  }
}

export const logger = {
  debug: (msg: string, ...args: unknown[]) => log('debug', msg, ...args),
  info: (msg: string, ...args: unknown[]) => log('info', msg, ...args),
  warn: (msg: string, ...args: unknown[]) => log('warn', msg, ...args),
  error: (msg: string, ...args: unknown[]) => log('error', msg, ...args),
  sanitize,
};

