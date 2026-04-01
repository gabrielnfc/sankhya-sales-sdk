import type { LogLevel, Logger, LoggerOptions } from '../types/config.js';

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  silent: 4,
};

export function createLogger(options?: LoggerOptions): Logger {
  if (options?.custom) {
    return options.custom;
  }

  const level = options?.level ?? 'warn';
  const threshold = LOG_LEVELS[level];

  const noop = () => {};
  const prefix = '[sankhya-sdk]';

  return {
    debug:
      threshold <= LOG_LEVELS.debug
        ? (message: string, ...args: unknown[]) => console.debug(prefix, message, ...args)
        : noop,
    info:
      threshold <= LOG_LEVELS.info
        ? (message: string, ...args: unknown[]) => console.info(prefix, message, ...args)
        : noop,
    warn:
      threshold <= LOG_LEVELS.warn
        ? (message: string, ...args: unknown[]) => console.warn(prefix, message, ...args)
        : noop,
    error:
      threshold <= LOG_LEVELS.error
        ? (message: string, ...args: unknown[]) => console.error(prefix, message, ...args)
        : noop,
  };
}
