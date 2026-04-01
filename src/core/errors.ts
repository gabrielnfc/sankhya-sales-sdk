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
