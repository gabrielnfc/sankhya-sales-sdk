import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthManager } from '../../src/core/auth.js';
import { ApiError, GatewayError, TimeoutError } from '../../src/core/errors.js';
import { HttpClient } from '../../src/core/http.js';
import type { Logger } from '../../src/types/config.js';

const mockLogger: Logger = {
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
};

function createMockAuth() {
  return {
    getToken: vi.fn().mockResolvedValue('test-token'),
    invalidateToken: vi.fn().mockResolvedValue(undefined),
  } as unknown as AuthManager;
}

function createHttpClient(auth?: AuthManager, timeout = 30000) {
  return new HttpClient(
    'https://api.sankhya.com.br',
    'x-token',
    timeout,
    mockLogger,
    auth ?? createMockAuth(),
  );
}

describe('HttpClient', () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
    vi.clearAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  describe('restGet', () => {
    it('deve fazer GET com token e headers corretos', async () => {
      const responseData = { codigo: 0, tipo: 'S', mensagem: 'OK', clientes: [] };
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(responseData),
      });

      const client = createHttpClient();
      const result = await client.restGet('/clientes');

      expect(result).toEqual(responseData);
      const call = vi.mocked(globalThis.fetch).mock.calls[0];
      expect(call[0]).toContain('/v1/clientes');
      expect(call[1]?.headers).toEqual(
        expect.objectContaining({
          Authorization: 'Bearer test-token',
          'X-Token': 'x-token',
        }),
      );
    });

    it('deve incluir query params', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({}),
      });

      const client = createHttpClient();
      await client.restGet('/produtos', { page: '0' });

      const call = vi.mocked(globalThis.fetch).mock.calls[0];
      expect(call[0]).toContain('page=0');
    });
  });

  describe('restPost', () => {
    it('deve fazer POST com body JSON', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ codigo: 0, tipo: 'S', mensagem: 'Criado' }),
      });

      const client = createHttpClient();
      const body = { nome: 'Teste' };
      await client.restPost('/clientes', body);

      const call = vi.mocked(globalThis.fetch).mock.calls[0];
      expect(call[1]?.method).toBe('POST');
      expect(call[1]?.body).toBe(JSON.stringify(body));
      expect(call[1]?.headers).toEqual(
        expect.objectContaining({ 'Content-Type': 'application/json' }),
      );
    });
  });

  describe('restPut', () => {
    it('deve fazer PUT com body JSON', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ codigo: 0 }),
      });

      const client = createHttpClient();
      await client.restPut('/clientes/123', { nome: 'Atualizado' });

      const call = vi.mocked(globalThis.fetch).mock.calls[0];
      expect(call[1]?.method).toBe('PUT');
    });
  });

  describe('gatewayCall', () => {
    it('deve chamar gateway e retornar responseBody quando status=1', async () => {
      const gatewayResp = {
        serviceName: 'CRUDServiceProvider.loadRecords',
        status: '1',
        statusMessage: 'OK',
        responseBody: { records: [] },
      };

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(gatewayResp),
      });

      const client = createHttpClient();
      const result = await client.gatewayCall('mge', 'CRUDServiceProvider.loadRecords', {});

      expect(result).toEqual({ records: [] });
    });

    it('deve lançar GatewayError quando status=0', async () => {
      const gatewayResp = {
        serviceName: 'CRUDServiceProvider.loadRecord',
        status: '0',
        statusMessage: 'Registro não encontrado',
        tsError: { tsErrorCode: 'TS001', tsErrorLevel: 'ERROR' },
      };

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(gatewayResp),
      });

      const client = createHttpClient();

      await expect(client.gatewayCall('mge', 'CRUDServiceProvider.loadRecord', {})).rejects.toThrow(
        GatewayError,
      );
    });
  });

  describe('401 retry', () => {
    it('deve invalidar token e retentar em 401', async () => {
      const auth = createMockAuth();
      let callCount = 0;

      globalThis.fetch = vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve({
            ok: false,
            status: 401,
            statusText: 'Unauthorized',
            text: () => Promise.resolve(''),
          });
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ data: 'ok' }),
        });
      });

      const client = createHttpClient(auth);
      const result = await client.restGet('/test');

      expect(auth.invalidateToken).toHaveBeenCalledOnce();
      expect(result).toEqual({ data: 'ok' });
      expect(globalThis.fetch).toHaveBeenCalledTimes(2);
    });

    it('deve lançar ApiError se retry também falha com 401', async () => {
      const auth = createMockAuth();
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        text: () => Promise.resolve('Invalid'),
      });

      const client = createHttpClient(auth);

      await expect(client.restGet('/test')).rejects.toThrow(ApiError);
      expect(globalThis.fetch).toHaveBeenCalledTimes(2);
    });
  });

  describe('timeout', () => {
    it('deve lançar TimeoutError quando request excede timeout', async () => {
      globalThis.fetch = vi.fn().mockImplementation(
        (_url: string, init?: RequestInit) =>
          new Promise((_resolve, reject) => {
            init?.signal?.addEventListener('abort', () => {
              reject(new DOMException('The operation was aborted.', 'AbortError'));
            });
          }),
      );

      const client = createHttpClient(undefined, 10);

      await expect(client.restGet('/slow')).rejects.toThrow(TimeoutError);
    });
  });

  describe('erros HTTP', () => {
    it('deve lançar ApiError para 500', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        text: () => Promise.resolve('Server error'),
      });

      const client = createHttpClient();

      const err = await client.restGet('/test').catch((e) => e);
      expect(err).toBeInstanceOf(ApiError);
      expect(err.statusCode).toBe(500);
      expect(err.endpoint).toBe('/test');
      expect(err.method).toBe('GET');
    });
  });
});
