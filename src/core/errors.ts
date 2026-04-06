export class SankhyaError extends Error {
  readonly code: string;
  readonly statusCode?: number;
  readonly details?: unknown;

  constructor(message: string, code: string, statusCode?: number, details?: unknown) {
    super(message);
    this.name = 'SankhyaError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }
}

export class AuthError extends SankhyaError {
  override readonly code = 'AUTH_ERROR' as const;

  constructor(message: string, statusCode?: number, details?: unknown) {
    super(message, 'AUTH_ERROR', statusCode, details);
    this.name = 'AuthError';
  }
}

export class ApiError extends SankhyaError {
  override readonly code = 'API_ERROR' as const;
  readonly endpoint: string;
  readonly method: string;

  constructor(
    message: string,
    endpoint: string,
    method: string,
    statusCode?: number,
    details?: unknown,
  ) {
    super(message, 'API_ERROR', statusCode, details);
    this.name = 'ApiError';
    this.endpoint = endpoint;
    this.method = method;
  }
}

export class GatewayError extends SankhyaError {
  override readonly code = 'GATEWAY_ERROR' as const;
  readonly serviceName: string;
  readonly tsErrorCode?: string;
  readonly tsErrorLevel?: string;

  constructor(
    message: string,
    serviceName: string,
    tsErrorCode?: string,
    tsErrorLevel?: string,
    details?: unknown,
  ) {
    super(message, 'GATEWAY_ERROR', undefined, details);
    this.name = 'GatewayError';
    this.serviceName = serviceName;
    this.tsErrorCode = tsErrorCode;
    this.tsErrorLevel = tsErrorLevel;
  }
}

export class TimeoutError extends SankhyaError {
  override readonly code = 'TIMEOUT_ERROR' as const;

  constructor(message: string, details?: unknown) {
    super(message, 'TIMEOUT_ERROR', undefined, details);
    this.name = 'TimeoutError';
  }
}

/** Union of all SDK error codes for exhaustive switch handling */
export type SankhyaErrorCode = 'AUTH_ERROR' | 'API_ERROR' | 'GATEWAY_ERROR' | 'TIMEOUT_ERROR';

/** Type guard: narrows unknown to SankhyaError */
export function isSankhyaError(err: unknown): err is SankhyaError {
  return err instanceof SankhyaError;
}

/** Type guard: narrows unknown to AuthError */
export function isAuthError(err: unknown): err is AuthError {
  return err instanceof AuthError;
}

/** Type guard: narrows unknown to ApiError */
export function isApiError(err: unknown): err is ApiError {
  return err instanceof ApiError;
}

/** Type guard: narrows unknown to GatewayError */
export function isGatewayError(err: unknown): err is GatewayError {
  return err instanceof GatewayError;
}

/** Type guard: narrows unknown to TimeoutError */
export function isTimeoutError(err: unknown): err is TimeoutError {
  return err instanceof TimeoutError;
}
