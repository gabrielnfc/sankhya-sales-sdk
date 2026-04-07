import type { GatewayResponse } from '../types/common.js';
import type { Logger, RequestOptions } from '../types/config.js';
import type { AuthManager } from './auth.js';
import { ApiError, GatewayError, TimeoutError } from './errors.js';
import { withRetry } from './retry.js';

export class HttpClient {
  private readonly baseUrl: string;
  private readonly xToken: string;
  private readonly timeout: number;
  private readonly logger: Logger;
  private readonly auth: AuthManager;
  private readonly retries: number;

  constructor(
    baseUrl: string,
    xToken: string,
    timeout: number,
    logger: Logger,
    auth: AuthManager,
    retries = 3,
  ) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.xToken = xToken;
    this.timeout = timeout;
    this.logger = logger;
    this.auth = auth;
    this.retries = retries;
  }

  async restGet<T>(
    path: string,
    params?: Record<string, string>,
    options?: RequestOptions,
  ): Promise<T> {
    const url = this.buildUrl(`/v1${path}`, params);
    return this.requestWithRetry<T>(url, 'GET', path, undefined, false, options);
  }

  async restPost<T>(path: string, body: unknown, options?: RequestOptions): Promise<T> {
    const url = this.buildUrl(`/v1${path}`);
    return this.requestWithRetry<T>(url, 'POST', path, body, false, options);
  }

  async restPut<T>(path: string, body: unknown, options?: RequestOptions): Promise<T> {
    const url = this.buildUrl(`/v1${path}`);
    return this.requestWithRetry<T>(url, 'PUT', path, body, false, options);
  }

  async restDelete<T>(path: string, options?: RequestOptions): Promise<T> {
    const url = this.buildUrl(`/v1${path}`);
    return this.requestWithRetry<T>(url, 'DELETE', path, undefined, false, options);
  }

  async gatewayCall<T>(
    modulo: string,
    serviceName: string,
    requestBody: Record<string, unknown>,
    options?: RequestOptions,
  ): Promise<T> {
    const path = `/gateway/v1/${modulo}/service.sbr`;
    const url = this.buildUrl(path, {
      serviceName,
      outputType: 'json',
    });

    this.logger.debug(`Gateway: ${serviceName}`);

    const result = await this.requestWithRetry<GatewayResponse<T>>(
      url,
      'POST',
      path,
      { requestBody },
      false,
      options,
    );

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
    options?: RequestOptions,
  ): Promise<T> {
    const token = await this.auth.getToken();
    const timeoutMs = options?.timeout ?? this.timeout;
    const internalController = new AbortController();
    const timeoutId = setTimeout(() => internalController.abort(), timeoutMs);

    const signals: AbortSignal[] = [internalController.signal];
    if (options?.signal) signals.push(options.signal);
    const combinedSignal = signals.length === 1 ? signals[0] : AbortSignal.any(signals);

    try {
      const headers: Record<string, string> = {
        Authorization: `Bearer ${token}`,
        'X-Token': this.xToken,
        Accept: 'application/json',
      };

      if (body !== undefined) {
        headers['Content-Type'] = 'application/json';
      }

      if (options?.idempotencyKey) {
        headers['X-Idempotency-Key'] = options.idempotencyKey;
      }

      this.logger.debug(`${method} ${url}`);

      let response: Response;
      try {
        response = await withRetry(
          async () => {
            const res = await fetch(url, {
              method,
              headers,
              ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
              ...(combinedSignal ? { signal: combinedSignal } : {}),
            });
            if (!res.ok && [429, 500, 502, 503, 504].includes(res.status)) {
              const err = new Error(`HTTP ${res.status}`) as Error & { statusCode: number };
              err.statusCode = res.status;
              throw err;
            }
            return res;
          },
          { maxRetries: this.retries, method },
        );
      } catch (retryErr) {
        if (
          retryErr &&
          typeof retryErr === 'object' &&
          'statusCode' in retryErr &&
          typeof (retryErr as { statusCode: unknown }).statusCode === 'number'
        ) {
          const status = (retryErr as { statusCode: number }).statusCode;
          throw new ApiError(
            `API error: HTTP ${status} — ${retryErr instanceof Error ? retryErr.message : ''}`,
            path,
            method,
            status,
            '',
          );
        }
        throw retryErr;
      }

      if (response.status === 401 && !isRetry) {
        this.logger.warn('Token expirado, renovando...');
        const failedToken = token;
        await this.auth.invalidateToken();
        const newToken = await this.auth.getToken();
        if (newToken === failedToken) {
          throw new ApiError(
            'API error: HTTP 401 — token refresh retornou o mesmo token',
            path,
            method,
            401,
            '',
          );
        }
        return this.requestWithRetry<T>(url, method, path, body, true, options);
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
        throw new TimeoutError(`Request timeout após ${timeoutMs}ms: ${method} ${path}`);
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }
}
