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
  private readonly cacheProvider?: TokenCacheProvider;

  private memoryCache: TokenData | null = null;
  private refreshPromise: Promise<string> | null = null;

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
    const cached = await this.getCachedToken();
    if (cached) {
      return cached;
    }

    if (this.refreshPromise) {
      this.logger.debug('Aguardando refresh em andamento');
      return this.refreshPromise;
    }

    this.refreshPromise = this.authenticate();
    try {
      return await this.refreshPromise;
    } finally {
      this.refreshPromise = null;
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

    let response: Response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'X-Token': this.xToken,
        },
        body: body.toString(),
      });
    } catch (error) {
      throw new AuthError(
        `Falha na conexão com servidor de autenticação: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

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
