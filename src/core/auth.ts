import type { AuthResponse, TokenData } from '../types/auth.js';
import type {
  AuthRetryConfig,
  CircuitBreakerConfig,
  Logger,
  TokenCacheProvider,
} from '../types/config.js';
import { AuthError, CircuitOpenError } from './errors.js';

const TOKEN_CACHE_KEY = 'sankhya_sdk_token';
const SAFETY_MARGIN_SECONDS = 60;
const MINIMUM_TTL_SECONDS = 10;
const DEFAULT_AUTH_TIMEOUT_MS = 30_000;

/**
 * Status HTTP transientes do OAuth — elegiveis a retry. Os demais
 * (notadamente 400/401/403 = credencial/request invalida) falham
 * imediatamente para evitar lockout por retentativa de credencial errada.
 */
const RETRYABLE_AUTH_STATUS = new Set([408, 429, 500, 502, 503, 504]);

/**
 * Codigos de erro de rede (Node/undici) que marcam uma excecao de fetch como
 * transiente. TypeError SEM um destes codigos e erro permanente de
 * programacao/config (URL invalida, header com caractere invalido) — retry
 * seria futil.
 */
const NETWORK_ERROR_CODES = new Set([
  'ECONNREFUSED',
  'ECONNRESET',
  'ENOTFOUND',
  'EAI_AGAIN',
  'ETIMEDOUT',
  'EPIPE',
  'UND_ERR_CONNECT_TIMEOUT',
  'UND_ERR_SOCKET',
]);

interface ResolvedAuthRetry {
  maxRetries: number;
  baseDelayMs: number;
  factor: number;
  jitterRatio: number;
}

interface ResolvedCircuitBreaker {
  threshold: number;
  resetTimeoutMs: number;
  jitterRatio: number;
}

/** Opcoes de resiliencia da autenticacao. @internal */
export interface AuthManagerOptions {
  /** Timeout por tentativa de autenticacao em ms (default: 30000). */
  timeout?: number | undefined;
  authRetry?: AuthRetryConfig | undefined;
  circuitBreaker?: CircuitBreakerConfig | undefined;
}

/**
 * Falha transiente interna da autenticacao — sinaliza elegibilidade a retry.
 * Nunca carrega corpo de resposta nem credenciais (apenas a razao/status).
 */
class TransientAuthFailure extends Error {
  constructor(readonly reason: string) {
    super(reason);
    this.name = 'TransientAuthFailure';
  }
}

export class AuthManager {
  private readonly baseUrl: string;
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly xToken: string;
  private readonly logger: Logger;
  private readonly cacheProvider: TokenCacheProvider | undefined;
  private readonly timeout: number;
  private readonly authRetry: ResolvedAuthRetry;
  private readonly circuitBreaker: ResolvedCircuitBreaker;

  private memoryCache: TokenData | null = null;
  private refreshPromise: Promise<string> | null = null;
  private consecutiveFailures = 0;
  private circuitOpenUntil = 0;

  constructor(
    baseUrl: string,
    clientId: string,
    clientSecret: string,
    xToken: string,
    logger: Logger,
    cacheProvider?: TokenCacheProvider,
    options?: AuthManagerOptions,
  ) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.clientId = clientId;
    this.clientSecret = clientSecret;
    this.xToken = xToken;
    this.logger = logger;
    this.cacheProvider = cacheProvider;
    this.timeout = options?.timeout ?? DEFAULT_AUTH_TIMEOUT_MS;
    this.authRetry = {
      maxRetries: options?.authRetry?.maxRetries ?? 3,
      baseDelayMs: options?.authRetry?.baseDelayMs ?? 500,
      factor: options?.authRetry?.factor ?? 2,
      jitterRatio: options?.authRetry?.jitterRatio ?? 0.5,
    };
    this.circuitBreaker = {
      threshold: options?.circuitBreaker?.threshold ?? 3,
      resetTimeoutMs: options?.circuitBreaker?.resetTimeoutMs ?? 30_000,
      jitterRatio: options?.circuitBreaker?.jitterRatio ?? 0.2,
    };
  }

  /**
   * Obtem um token valido (do cache ou autenticando).
   *
   * Nota sobre o circuit breaker: uma falha de autenticacao propaga e encerra
   * a chamada de negocio (a cascata de 401 so recursa apos refresh com
   * SUCESSO), entao cada chamada de negocio conta no maximo UMA falha.
   */
  async getToken(): Promise<string> {
    if (this.refreshPromise) {
      this.logger.debug('Aguardando refresh em andamento');
      return this.refreshPromise;
    }
    this.refreshPromise = this._doGetToken();
    try {
      return await this.refreshPromise;
    } finally {
      this.refreshPromise = null;
    }
  }

  private async _doGetToken(): Promise<string> {
    // Circuit breaker: fast-fail local sem contatar o servidor.
    if (
      this.consecutiveFailures >= this.circuitBreaker.threshold &&
      Date.now() < this.circuitOpenUntil
    ) {
      const retryAfterMs = this.circuitOpenUntil - Date.now();
      throw new CircuitOpenError(
        `Circuit breaker de autenticacao aberto (${this.consecutiveFailures} falhas consecutivas). Nova tentativa em ${Math.ceil(retryAfterMs / 1000)}s`,
        retryAfterMs,
      );
    }

    const cached = await this.getCachedToken();
    if (cached) return cached;

    try {
      const token = await this.authenticate();
      this.consecutiveFailures = 0;
      return token;
    } catch (error) {
      this.recordFailure();
      throw error;
    }
  }

  /** Contabiliza uma falha e abre o breaker no threshold. */
  private recordFailure(): void {
    this.consecutiveFailures++;

    if (this.consecutiveFailures >= this.circuitBreaker.threshold) {
      const jitter = Math.floor(
        Math.random() * this.circuitBreaker.resetTimeoutMs * this.circuitBreaker.jitterRatio,
      );
      this.circuitOpenUntil = Date.now() + this.circuitBreaker.resetTimeoutMs + jitter;
      this.logger.warn(
        `Circuit breaker aberto apos ${this.consecutiveFailures} falhas. Proxima tentativa em ~${Math.ceil((this.circuitBreaker.resetTimeoutMs + jitter) / 1000)}s.`,
      );
    }
  }

  async invalidateToken(): Promise<void> {
    this.memoryCache = null;
    if (this.cacheProvider) {
      await this.cacheProvider.del(TOKEN_CACHE_KEY);
    }
    this.logger.debug('Token invalidado');
  }

  private async getCachedToken(): Promise<string | null> {
    if (this.cacheProvider) {
      const cached = await this.cacheProvider.get(TOKEN_CACHE_KEY);
      if (cached) {
        try {
          const data: TokenData = JSON.parse(cached);
          if (typeof data.accessToken !== 'string' || typeof data.expiresAt !== 'number') {
            this.logger.warn('Token em cache com formato invalido, ignorando');
            await this.cacheProvider.del(TOKEN_CACHE_KEY);
            return null;
          }
          if (data.expiresAt > Date.now()) {
            return data.accessToken;
          }
        } catch {
          await this.cacheProvider.del(TOKEN_CACHE_KEY);
        }
      }
      return null;
    }

    if (this.memoryCache && this.memoryCache.expiresAt > Date.now()) {
      return this.memoryCache.accessToken;
    }

    this.memoryCache = null;
    return null;
  }

  /**
   * Autentica com retry: backoff exponencial + jitter para falhas transientes
   * (timeout, 5xx, 429, erro de rede). Credencial/request invalida (400/401/403)
   * falha imediatamente. Nenhuma credencial ou token aparece em log/erro.
   */
  private async authenticate(): Promise<string> {
    const { maxRetries, baseDelayMs, factor, jitterRatio } = this.authRetry;
    let lastReason = 'desconhecida';

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await this.attemptAuthenticate();
      } catch (error) {
        if (!(error instanceof TransientAuthFailure)) {
          // Erro definitivo (credencial/request invalida) — propaga sem retry.
          throw error;
        }
        lastReason = error.reason;
        if (attempt >= maxRetries) break;

        const base = baseDelayMs * factor ** attempt;
        const jitter = base * jitterRatio * (Math.random() * 2 - 1);
        const delay = Math.max(0, Math.round(base + jitter));
        this.logger.warn(
          `Autenticacao: tentativa ${attempt + 1} falhou (${lastReason}), retentando em ${delay}ms`,
        );
        await sleep(delay);
      }
    }

    throw new AuthError(`Falha na autenticacao apos ${maxRetries + 1} tentativa(s): ${lastReason}`);
  }

  /**
   * Uma unica tentativa de autenticacao.
   * @returns token em caso de sucesso.
   * @throws {TransientAuthFailure} em falha transiente (retry elegivel).
   * @throws {AuthError} em falha definitiva (credencial/request invalida).
   */
  private async attemptAuthenticate(): Promise<string> {
    this.logger.debug('Autenticando...');

    const url = `${this.baseUrl}/authenticate`;
    const body = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: this.clientId,
      client_secret: this.clientSecret,
    });

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    let response: Response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'X-Token': this.xToken,
        },
        body: body.toString(),
        signal: controller.signal,
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        throw new TransientAuthFailure(`timeout apos ${this.timeout}ms`);
      }
      if (error instanceof Error && error.name === 'AbortError') {
        throw new TransientAuthFailure(`timeout apos ${this.timeout}ms`);
      }
      // Identificadores seguros (name + cause.code) — NUNCA valores de header/env.
      const causeCode = extractCauseCode(error);
      const label = `${error instanceof Error ? error.name : 'Error'}${
        causeCode ? `: ${causeCode}` : ''
      }`;
      if (error instanceof TypeError && (!causeCode || !NETWORK_ERROR_CODES.has(causeCode))) {
        throw new AuthError(`Falha permanente na autenticacao (${label})`, undefined, error);
      }
      throw new TransientAuthFailure(`erro de conexao (${label})`);
    } finally {
      clearTimeout(timeoutId);
    }

    if (!response.ok) {
      // Corpo da resposta NAO e incluido no erro (pode ecoar token/credencial).
      if (RETRYABLE_AUTH_STATUS.has(response.status)) {
        throw new TransientAuthFailure(`HTTP ${response.status}`);
      }
      throw new AuthError(`Autenticacao falhou: HTTP ${response.status}`, response.status);
    }

    const data: AuthResponse = await response.json();
    const ttlSeconds = Math.max(data.expires_in - SAFETY_MARGIN_SECONDS, MINIMUM_TTL_SECONDS);
    const tokenData: TokenData = {
      accessToken: data.access_token,
      expiresAt: Date.now() + ttlSeconds * 1000,
    };

    if (this.cacheProvider) {
      await this.cacheProvider.set(TOKEN_CACHE_KEY, JSON.stringify(tokenData), ttlSeconds);
    } else {
      this.memoryCache = tokenData;
    }

    this.logger.info('Autenticado com sucesso');
    return data.access_token;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Extrai `cause.code` (string) de um erro, se presente. */
function extractCauseCode(error: unknown): string | undefined {
  if (
    error instanceof Error &&
    error.cause &&
    typeof error.cause === 'object' &&
    'code' in error.cause &&
    typeof (error.cause as { code?: unknown }).code === 'string'
  ) {
    return (error.cause as { code: string }).code;
  }
  return undefined;
}
