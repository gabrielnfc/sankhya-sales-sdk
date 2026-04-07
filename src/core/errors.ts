/**
 * Erro base do SDK Sankhya.
 *
 * Todos os erros do SDK estendem esta classe, permitindo
 * captura unificada com `catch (e) { if (isSankhyaError(e)) ... }`.
 */
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

/**
 * Erro de autenticacao OAuth 2.0.
 *
 * Lancado quando o token nao pode ser obtido ou renovado
 * (credenciais invalidas, servidor indisponivel, etc.).
 *
 * `code = 'AUTH_ERROR'`
 */
export class AuthError extends SankhyaError {
  override readonly code = 'AUTH_ERROR' as const;

  constructor(message: string, statusCode?: number, details?: unknown) {
    super(message, 'AUTH_ERROR', statusCode, details);
    this.name = 'AuthError';
  }
}

/**
 * Erro de resposta HTTP da API REST v1.
 *
 * Lancado em respostas 4xx/5xx. Inclui `endpoint` e `method`
 * para identificar a chamada que falhou.
 *
 * `code = 'API_ERROR'`
 */
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

/**
 * Erro de negocio do Gateway Sankhya.
 *
 * Lancado quando o Gateway retorna HTTP 200 mas com status de erro
 * no corpo da resposta (campo `tsError`). Inclui `serviceName`,
 * `tsErrorCode` e `tsErrorLevel` do Sankhya.
 *
 * `code = 'GATEWAY_ERROR'`
 */
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

/**
 * Erro de timeout de requisicao.
 *
 * Lancado quando uma requisicao excede o tempo limite configurado
 * (via `AbortController`).
 *
 * `code = 'TIMEOUT_ERROR'`
 */
export class TimeoutError extends SankhyaError {
  override readonly code = 'TIMEOUT_ERROR' as const;

  constructor(message: string, details?: unknown) {
    super(message, 'TIMEOUT_ERROR', undefined, details);
    this.name = 'TimeoutError';
  }
}

/**
 * Uniao de todos os codigos de erro do SDK.
 *
 * Util para switch/case exaustivo em tratamento de erros.
 */
export type SankhyaErrorCode = 'AUTH_ERROR' | 'API_ERROR' | 'GATEWAY_ERROR' | 'TIMEOUT_ERROR';

/**
 * Verifica se o erro e uma instancia de SankhyaError.
 *
 * @param err - Erro a verificar.
 * @returns `true` se o erro e um SankhyaError.
 */
export function isSankhyaError(err: unknown): err is SankhyaError {
  return err instanceof SankhyaError;
}

/**
 * Verifica se o erro e uma instancia de AuthError.
 *
 * @param err - Erro a verificar.
 * @returns `true` se o erro e um AuthError.
 */
export function isAuthError(err: unknown): err is AuthError {
  return err instanceof AuthError;
}

/**
 * Verifica se o erro e uma instancia de ApiError.
 *
 * @param err - Erro a verificar.
 * @returns `true` se o erro e um ApiError.
 */
export function isApiError(err: unknown): err is ApiError {
  return err instanceof ApiError;
}

/**
 * Verifica se o erro e uma instancia de GatewayError.
 *
 * @param err - Erro a verificar.
 * @returns `true` se o erro e um GatewayError.
 */
export function isGatewayError(err: unknown): err is GatewayError {
  return err instanceof GatewayError;
}

/**
 * Verifica se o erro e uma instancia de TimeoutError.
 *
 * @param err - Erro a verificar.
 * @returns `true` se o erro e um TimeoutError.
 */
export function isTimeoutError(err: unknown): err is TimeoutError {
  return err instanceof TimeoutError;
}
