import { AuthError, GatewayError } from './errors.js';

export interface RetryOptions {
  maxRetries?: number;
  baseDelay?: number;
  /** HTTP method hint — POST/PUT/PATCH/DELETE skip retry by default */
  method?: string;
  /** Force retry even for unsafe methods (consumer explicitly opts in) */
  forceRetry?: boolean;
  /**
   * Marca a operacao como idempotente (leitura) e elegivel a retry
   * independentemente do metodo HTTP do transporte. Reads do gateway
   * (loadRecords/loadRecord/executeQuery) sao POST no transporte mas
   * semanticamente seguras — usam esta flag. Escritas NAO a usam.
   */
  idempotent?: boolean;
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

export async function withRetry<T>(
  fn: () => Promise<T>,
  options?: RetryOptions & { signal?: AbortSignal | undefined },
): Promise<T> {
  const method = options?.method?.toUpperCase();
  // Retry eligibility follows OPERATION SEMANTICS, not the transport HTTP method:
  // safe methods, forceRetry, or an explicitly idempotent read are eligible.
  const retryEligible =
    method === undefined ||
    SAFE_METHODS.has(method) ||
    options?.forceRetry === true ||
    options?.idempotent === true;
  const effectiveMaxRetries = retryEligible ? (options?.maxRetries ?? DEFAULT_MAX_RETRIES) : 0;
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

      if (options?.signal?.aborted) throw lastError;
      // Honor server-provided Retry-After when present; else full jitter backoff.
      const retryAfterMs = getRetryAfterMs(error);
      const delay = retryAfterMs ?? Math.random() * baseDelay * 2 ** attempt;
      await sleep(delay);
    }
  }

  throw lastError;
}

/** Extrai Retry-After (em ms) de um erro, se presente. */
function getRetryAfterMs(error: unknown): number | undefined {
  if (
    error &&
    typeof error === 'object' &&
    'retryAfterMs' in error &&
    typeof (error as { retryAfterMs: unknown }).retryAfterMs === 'number'
  ) {
    const ms = (error as { retryAfterMs: number }).retryAfterMs;
    return ms > 0 ? ms : undefined;
  }
  return undefined;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
