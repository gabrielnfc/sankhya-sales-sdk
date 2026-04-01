import type { GatewayResponse } from '../types/common.js';
import type { Logger } from '../types/config.js';
import type { AuthManager } from './auth.js';
import { ApiError, GatewayError, TimeoutError } from './errors.js';

export class HttpClient {
  private readonly baseUrl: string;
  private readonly xToken: string;
  private readonly timeout: number;
  private readonly logger: Logger;
  private readonly auth: AuthManager;

  constructor(baseUrl: string, xToken: string, timeout: number, logger: Logger, auth: AuthManager) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.xToken = xToken;
    this.timeout = timeout;
    this.logger = logger;
    this.auth = auth;
  }

  async restGet<T>(path: string, params?: Record<string, string>): Promise<T> {
    const url = this.buildUrl(`/v1${path}`, params);
    return this.requestWithRetry<T>(url, 'GET', path);
  }

  async restPost<T>(path: string, body: unknown): Promise<T> {
    const url = this.buildUrl(`/v1${path}`);
    return this.requestWithRetry<T>(url, 'POST', path, body);
  }

  async restPut<T>(path: string, body: unknown): Promise<T> {
    const url = this.buildUrl(`/v1${path}`);
    return this.requestWithRetry<T>(url, 'PUT', path, body);
  }

  async gatewayCall<T>(
    modulo: string,
    serviceName: string,
    requestBody: Record<string, unknown>,
  ): Promise<T> {
    const path = `/gateway/v1/${modulo}/service.sbr`;
    const url = this.buildUrl(path, {
      serviceName,
      outputType: 'json',
    });

    this.logger.debug(`Gateway: ${serviceName}`);

    const result = await this.requestWithRetry<GatewayResponse<T>>(url, 'POST', path, {
      requestBody,
    });

    if (result.status === '0') {
      throw new GatewayError(
        result.statusMessage || `Erro no serviço Gateway: ${serviceName}`,
        serviceName,
        result.tsError?.tsErrorCode,
        result.tsError?.tsErrorLevel,
        result,
      );
    }

    return result.responseBody as T;
  }

  private buildUrl(path: string, params?: Record<string, string>): string {
    const url = new URL(`${this.baseUrl}${path}`);
    if (params) {
      for (const [key, value] of Object.entries(params)) {
        if (value !== undefined && value !== null) {
          url.searchParams.set(key, value);
        }
      }
    }
    return url.toString();
  }

  private async requestWithRetry<T>(
    url: string,
    method: string,
    path: string,
    body?: unknown,
    isRetry = false,
  ): Promise<T> {
    const token = await this.auth.getToken();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const headers: Record<string, string> = {
        Authorization: `Bearer ${token}`,
        'X-Token': this.xToken,
        Accept: 'application/json',
      };

      if (body !== undefined) {
        headers['Content-Type'] = 'application/json';
      }

      this.logger.debug(`${method} ${url}`);

      const response = await fetch(url, {
        method,
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      if (response.status === 401 && !isRetry) {
        this.logger.warn('Token expirado, renovando...');
        await this.auth.invalidateToken();
        return this.requestWithRetry<T>(url, method, path, body, true);
      }

      if (!response.ok) {
        const text = await response.text().catch(() => '');
        throw new ApiError(
          `API error: HTTP ${response.status} — ${text || response.statusText}`,
          path,
          method,
          response.status,
          text,
        );
      }

      return (await response.json()) as T;
    } catch (error) {
      if (error instanceof ApiError || error instanceof GatewayError) {
        throw error;
      }
      if (error instanceof DOMException && error.name === 'AbortError') {
        throw new TimeoutError(`Request timeout após ${this.timeout}ms: ${method} ${path}`);
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }
}
