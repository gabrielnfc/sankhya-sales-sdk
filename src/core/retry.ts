import { AuthError, GatewayError } from './errors.js';

export interface RetryOptions {
  maxRetries?: number;
  baseDelay?: number;
  /** HTTP method hint — POST/PUT/PATCH/DELETE skip retry by default */
  method?: string;
  /** Force retry even for unsafe methods (consumer explicitly opts in) */
  forceRetry?: boolean;
}

const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_BASE_DELAY = 1000;

const RETRYABLE_STATUS_CODES = new Set([429, 500, 502, 503, 504]);
const RETRYABLE_ERROR_CODES = new Set(['ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND', 'UND_ERR_SOCKET']);
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

function isRetryable(error: unknown): boolean {
  if (error instanceof AuthError || error instanceof GatewayError) {
    return false;
  }

  if (error && typeof error === 'object') {
    if ('statusCode' in error && typeof error.statusCode === 'number') {
      return RETRYABLE_STATUS_CODES.has(error.statusCode);
    }
    if ('code' in error && typeof error.code === 'string') {
      if (error.code === 'TIMEOUT_ERROR') return true;
      return RETRYABLE_ERROR_CODES.has(error.code);
    }
    if (
      'cause' in error &&
      error.cause &&
      typeof error.cause === 'object' &&
      'code' in error.cause
    ) {
      return RETRYABLE_ERROR_CODES.has(String(error.cause.code));
    }
  }

  return false;
}

export async function withRetry<T>(fn: () => Promise<T>, options?: RetryOptions): Promise<T> {
  const method = options?.method?.toUpperCase();
  const effectiveMaxRetries =
    method && !SAFE_METHODS.has(method) && !options?.forceRetry
      ? 0
      : (options?.maxRetries ?? DEFAULT_MAX_RETRIES);
  const baseDelay = options?.baseDelay ?? DEFAULT_BASE_DELAY;

  let lastError: unknown;

  for (let attempt = 0; attempt <= effectiveMaxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      if (attempt >= effectiveMaxRetries || !isRetryable(error)) {
        throw error;
      }

      const delay = Math.random() * baseDelay * 2 ** attempt;
      await sleep(delay);
    }
  }

  throw lastError;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
