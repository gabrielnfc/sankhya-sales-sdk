export interface SankhyaConfig {
  baseUrl: string;
  clientId: string;
  clientSecret: string;
  xToken: string;
  timeout?: number;
  retries?: number;
  tokenCacheProvider?: TokenCacheProvider;
  logger?: LoggerOptions;
}

export interface TokenCacheProvider {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttlSeconds: number): Promise<void>;
  del(key: string): Promise<void>;
}

export interface LoggerOptions {
  level?: LogLevel;
  custom?: Logger;
}

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'silent';

export interface Logger {
  debug(message: string, ...args: unknown[]): void;
  info(message: string, ...args: unknown[]): void;
  warn(message: string, ...args: unknown[]): void;
  error(message: string, ...args: unknown[]): void;
}

/** Per-request options for overriding client defaults */
export interface RequestOptions {
  /** Override default timeout for this request (ms) */
  timeout?: number;
  /** External AbortSignal for cancellation */
  signal?: AbortSignal;
  /** Idempotency key for mutation safety (forwarded as X-Idempotency-Key header) */
  idempotencyKey?: string;
}
