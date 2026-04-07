import type { AuthResponse, TokenData } from '../types/auth.js';
import type { Logger, TokenCacheProvider } from '../types/config.js';
import { AuthError } from './errors.js';

const TOKEN_CACHE_KEY = 'sankhya_sdk_token';
const SAFETY_MARGIN_SECONDS = 60;
const MINIMUM_TTL_SECONDS = 10;

export class AuthManager {
  private readonly baseUrl: string;
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly xToken: string;
  private readonly logger: Logger;
  private readonly cacheProvider: TokenCacheProvider | undefined;

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
  ) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.clientId = clientId;
    this.clientSecret = clientSecret;
    this.xToken = xToken;
    this.logger = logger;
    this.cacheProvider = cacheProvider;
  }

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
    // Circuit breaker: fast-fail if auth is repeatedly failing
    if (this.consecutiveFailures >= 3 && Date.now() < this.circuitOpenUntil) {
      throw new AuthError(
        `Circuit breaker aberto: ${this.consecutiveFailures} falhas consecutivas de autenticacao. Tentando novamente em ${Math.ceil((this.circuitOpenUntil - Date.now()) / 1000)}s`,
      );
    }

    const cached = await this.getCachedToken();
    if (cached) return cached;

    try {
      const token = await this.authenticate();
      this.consecutiveFailures = 0;
      return token;
    } catch (error) {
      this.consecutiveFailures++;
      // Open circuit for 30s after 3 consecutive failures
      if (this.consecutiveFailures >= 3) {
        this.circuitOpenUntil = Date.now() + 30_000;
        this.logger.warn(
          `Circuit breaker aberto apos ${this.consecutiveFailures} falhas. Proxima tentativa em 30s.`,
        );
      }
      throw error;
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

  private async authenticate(): Promise<string> {
    this.logger.debug('Autenticando...');

    const url = `${this.baseUrl}/authenticate`;
    const body = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: this.clientId,
      client_secret: this.clientSecret,
    });

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30_000);

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
      clearTimeout(timeoutId);
      if (error instanceof DOMException && error.name === 'AbortError') {
        throw new AuthError('Timeout na autenticacao apos 30s');
      }
      throw new AuthError(
        `Falha na conexao com servidor de autenticacao: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
    clearTimeout(timeoutId);

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new AuthError(
        `Autenticação falhou: HTTP ${response.status} — ${text || response.statusText}`,
        response.status,
        text,
      );
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
