import { ApiError, AuthError, GatewayError, TimeoutError } from './errors.js';

/**
 * Classificacao de falha em 3 camadas (spec SeparaTrue v3 §4.3.4, REQ-INT / REQ-EXP-4).
 *
 * - `AUTH_FAIL`: credencial/breaker — o passo nao chegou a ser aceito, retry e seguro.
 * - `NEGOCIO`: o ERP entendeu e recusou — TERMINAL, nunca retry.
 * - `TIMEOUT`: desfecho desconhecido — decide por read-back, jamais por suposicao (R8).
 *
 * Falha que nao se sabe classificar entra em `TIMEOUT`: desconhecido nunca e terminal.
 */
export type SankhyaFailureKind = 'AUTH_FAIL' | 'NEGOCIO' | 'TIMEOUT';

const HTTP_UNAUTHORIZED = 401;
const HTTP_FORBIDDEN = 403;
const HTTP_REQUEST_TIMEOUT = 408;
const HTTP_TOO_MANY_REQUESTS = 429;
const HTTP_CLIENT_ERROR_MIN = 400;
const HTTP_SERVER_ERROR_MIN = 500;

/**
 * Classifica o status HTTP de um {@link ApiError}.
 *
 * 401/403 sao credencial; 408, 429 e 5xx sao indisponibilidade (desfecho desconhecido);
 * o restante do 4xx e recusa de negocio — 409 incluso: conflito e resposta do ERP,
 * nao ambiguidade de transporte. Status ausente cai em `TIMEOUT`.
 */
function classifyHttpStatus(statusCode: number | undefined): SankhyaFailureKind {
  if (statusCode === HTTP_UNAUTHORIZED || statusCode === HTTP_FORBIDDEN) return 'AUTH_FAIL';
  // 408 e ambiguidade de TRANSPORTE: o servidor pode ter executado. Nunca terminal (I11/R8).
  if (statusCode === HTTP_REQUEST_TIMEOUT || statusCode === HTTP_TOO_MANY_REQUESTS) {
    return 'TIMEOUT';
  }
  if (statusCode !== undefined && statusCode >= HTTP_SERVER_ERROR_MIN) return 'TIMEOUT';
  if (
    statusCode !== undefined &&
    statusCode >= HTTP_CLIENT_ERROR_MIN &&
    statusCode < HTTP_SERVER_ERROR_MIN
  ) {
    return 'NEGOCIO';
  }
  return 'TIMEOUT';
}

/**
 * Classifica uma falha do SDK em `AUTH_FAIL`, `NEGOCIO` ou `TIMEOUT`.
 *
 * Ordem: `AuthError` (e a subclasse `CircuitOpenError`) → `ApiError` por status →
 * `TimeoutError` → `GatewayError` → desconhecido.
 *
 * @param err - Erro capturado (qualquer valor, inclusive nao-Error).
 * @returns A camada da falha; `TIMEOUT` quando o desfecho e desconhecido.
 */
export function classifyFailure(err: unknown): SankhyaFailureKind {
  // CircuitOpenError estende AuthError — os dois sao credencial/breaker.
  if (err instanceof AuthError) return 'AUTH_FAIL';
  if (err instanceof ApiError) return classifyHttpStatus(err.statusCode);
  // Explicito por legibilidade: o fallback abaixo ja devolveria 'TIMEOUT' (mutante equivalente).
  if (err instanceof TimeoutError) return 'TIMEOUT';
  // Gateway respondeu HTTP 200 com erro no corpo: o ERP entendeu e recusou.
  if (err instanceof GatewayError) return 'NEGOCIO';
  return 'TIMEOUT';
}
