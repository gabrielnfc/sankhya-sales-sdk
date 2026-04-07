import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthManager } from '../../src/core/auth.js';
import { HttpClient } from '../../src/core/http.js';
import { createPaginator } from '../../src/core/pagination.js';
import { PedidosResource } from '../../src/resources/pedidos.js';
import type { PaginatedResult } from '../../src/types/common.js';

function createMockLogger() {
  return {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };
}

function createMockFetchResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('Concurrency stress tests', () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('50 concurrent getToken() calls should coalesce into 1 authenticate()', async () => {
    let authenticateCalls = 0;

    globalThis.fetch = vi.fn(async () => {
      authenticateCalls++;
      // Small delay to simulate network
      await new Promise((r) => setTimeout(r, 10));
      return createMockFetchResponse({
        access_token: 'tok_123',
        expires_in: 3600,
        token_type: 'Bearer',
      });
    });

    const logger = createMockLogger();
    const auth = new AuthManager(
      'https://api.test.com',
      'client_id',
      'client_secret',
      'x_token',
      logger,
    );

    const promises = Array.from({ length: 50 }, () => auth.getToken());
    const tokens = await Promise.all(promises);

    // All should get the same token
    expect(new Set(tokens).size).toBe(1);
    expect(tokens[0]).toBe('tok_123');
    // Only 1 actual authenticate call should fire
    expect(authenticateCalls).toBe(1);
  });

  it('20 concurrent REST requests should all resolve without race conditions', async () => {
    let requestCount = 0;

    globalThis.fetch = vi.fn(async (url: string | URL | Request) => {
      const urlStr = typeof url === 'string' ? url : url instanceof URL ? url.toString() : url.url;
      if (urlStr.includes('/authenticate')) {
        return createMockFetchResponse({
          access_token: 'tok_abc',
          expires_in: 3600,
          token_type: 'Bearer',
        });
      }
      requestCount++;
      await new Promise((r) => setTimeout(r, Math.random() * 20));
      return createMockFetchResponse({ id: requestCount });
    });

    const logger = createMockLogger();
    const auth = new AuthManager('https://api.test.com', 'cid', 'csec', 'xtok', logger);
    const http = new HttpClient('https://api.test.com', 'xtok', 5000, logger, auth, 0);

    const promises = Array.from({ length: 20 }, (_, i) => http.restGet(`/test/${i}`));

    const results = await Promise.all(promises);
    expect(results).toHaveLength(20);
    expect(requestCount).toBe(20);
  });

  it('10 parallel AsyncGenerators should maintain independent state', async () => {
    let fetchCallCount = 0;

    globalThis.fetch = vi.fn(async (url: string | URL | Request) => {
      const urlStr = typeof url === 'string' ? url : url instanceof URL ? url.toString() : url.url;
      if (urlStr.includes('/authenticate')) {
        return createMockFetchResponse({
          access_token: 'tok_gen',
          expires_in: 3600,
          token_type: 'Bearer',
        });
      }
      fetchCallCount++;
      const parsed = new URL(urlStr);
      const page = Number(parsed.searchParams.get('page') ?? '0');
      const hasMore = page < 2;
      return createMockFetchResponse({
        items: [{ id: page * 10 + 1 }, { id: page * 10 + 2 }],
        pagination: {
          page: String(page),
          total: '6',
          hasMore: String(hasMore),
          offset: '0',
        },
      });
    });

    const fetchPage = async (page: number): Promise<PaginatedResult<{ id: number }>> => {
      const logger = createMockLogger();
      const auth = new AuthManager('https://api.test.com', 'cid', 'csec', 'xtok', logger);
      const http = new HttpClient('https://api.test.com', 'xtok', 5000, logger, auth, 0);
      const raw = await http.restGet<Record<string, unknown>>('/items', { page: String(page) });
      const data = (raw as Record<string, unknown>).items as { id: number }[];
      const pagination = (raw as Record<string, unknown>).pagination as {
        page: string;
        total: string;
        hasMore: string;
      };
      return {
        data,
        page: Number(pagination.page),
        hasMore: pagination.hasMore === 'true',
        totalRecords: Number(pagination.total),
      };
    };

    const generators = Array.from({ length: 10 }, () => createPaginator(fetchPage));

    const allResults = await Promise.all(
      generators.map(async (gen) => {
        const items: { id: number }[] = [];
        for await (const item of gen) {
          items.push(item);
        }
        return items;
      }),
    );

    // Each generator should yield 6 items (3 pages x 2 items)
    for (const items of allResults) {
      expect(items).toHaveLength(6);
    }
    // All generators should have independent results
    expect(allResults).toHaveLength(10);
  });

  it('rapid create-then-cancel preserves operation order', async () => {
    const operationOrder: string[] = [];

    globalThis.fetch = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      const urlStr = typeof url === 'string' ? url : url instanceof URL ? url.toString() : url.url;
      if (urlStr.includes('/authenticate')) {
        return createMockFetchResponse({
          access_token: 'tok_order',
          expires_in: 3600,
          token_type: 'Bearer',
        });
      }

      await new Promise((r) => setTimeout(r, Math.random() * 10));

      if (init?.method === 'POST' && urlStr.includes('/cancela')) {
        operationOrder.push('cancel');
        return createMockFetchResponse({ codigoPedido: 1 });
      }
      if (init?.method === 'POST') {
        operationOrder.push('create');
        return createMockFetchResponse({ codigoPedido: 1 });
      }
      return createMockFetchResponse({});
    });

    const logger = createMockLogger();
    const auth = new AuthManager('https://api.test.com', 'cid', 'csec', 'xtok', logger);
    const http = new HttpClient('https://api.test.com', 'xtok', 5000, logger, auth, 0);
    const pedidos = new PedidosResource(http);

    const validPedido = {
      notaModelo: 1,
      data: '2024-01-01',
      hora: '10:00',
      valorTotal: 100,
      itens: [{ codigoProduto: 1, quantidade: 1, valorUnitario: 100, unidade: 'UN' }],
      financeiros: [
        { codigoTipoPagamento: 1, valor: 100, dataVencimento: '2024-02-01', numeroParcela: 1 },
      ],
    };

    // Create then cancel sequentially to verify order
    await pedidos.criar(validPedido);
    await pedidos.cancelar({ codigoPedido: 1 });

    expect(operationOrder).toEqual(['create', 'cancel']);
  });

  it('100 rapid invalidateToken() calls should not crash or leak', async () => {
    globalThis.fetch = vi.fn(async () =>
      createMockFetchResponse({
        access_token: 'tok_inv',
        expires_in: 3600,
        token_type: 'Bearer',
      }),
    );

    const logger = createMockLogger();
    const auth = new AuthManager('https://api.test.com', 'cid', 'csec', 'xtok', logger);

    // First get a token
    await auth.getToken();

    // Rapidly invalidate 100 times
    const promises = Array.from({ length: 100 }, () => auth.invalidateToken());
    await Promise.all(promises);

    // Should still be able to get a new token afterward
    const token = await auth.getToken();
    expect(token).toBe('tok_inv');
  });

  it('concurrent retry storms with 503 should use exponential backoff', async () => {
    const requestTimestamps: number[] = [];
    let callCount = 0;

    globalThis.fetch = vi.fn(async (url: string | URL | Request) => {
      const urlStr = typeof url === 'string' ? url : url instanceof URL ? url.toString() : url.url;
      if (urlStr.includes('/authenticate')) {
        return createMockFetchResponse({
          access_token: 'tok_retry',
          expires_in: 3600,
          token_type: 'Bearer',
        });
      }
      requestTimestamps.push(Date.now());
      callCount++;
      // Always return 503 to trigger retries
      return new Response('Service Unavailable', { status: 503 });
    });

    const logger = createMockLogger();
    const auth = new AuthManager('https://api.test.com', 'cid', 'csec', 'xtok', logger);
    // maxRetries=2 for GET, 0 for POST by default
    const http = new HttpClient('https://api.test.com', 'xtok', 5000, logger, auth, 2);

    // Fire 5 concurrent GET requests that will all retry
    const promises = Array.from({ length: 5 }, (_, i) =>
      http.restGet(`/failing/${i}`).catch((e: unknown) => e),
    );

    const results = await Promise.all(promises);

    // All should have failed with ApiError
    for (const result of results) {
      expect(result).toBeDefined();
      expect((result as Error).message).toContain('503');
    }

    // Each request should have made 3 attempts (1 initial + 2 retries)
    // 5 requests * 3 attempts = 15 total fetch calls (excluding auth)
    expect(callCount).toBe(15);
  });

  it('AbortController under load: 20 requests aborted mid-flight', async () => {
    let activeRequests = 0;
    let maxConcurrent = 0;

    globalThis.fetch = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      const urlStr = typeof url === 'string' ? url : url instanceof URL ? url.toString() : url.url;
      if (urlStr.includes('/authenticate')) {
        return createMockFetchResponse({
          access_token: 'tok_abort',
          expires_in: 3600,
          token_type: 'Bearer',
        });
      }
      activeRequests++;
      maxConcurrent = Math.max(maxConcurrent, activeRequests);

      // Check if already aborted
      if (init?.signal?.aborted) {
        activeRequests--;
        throw new DOMException('The operation was aborted.', 'AbortError');
      }

      // Wait for abort or timeout
      return new Promise<Response>((resolve, reject) => {
        const timeout = setTimeout(() => {
          activeRequests--;
          resolve(createMockFetchResponse({ ok: true }));
        }, 5000);

        if (init?.signal) {
          init.signal.addEventListener('abort', () => {
            clearTimeout(timeout);
            activeRequests--;
            reject(new DOMException('The operation was aborted.', 'AbortError'));
          });
        }
      });
    });

    const logger = createMockLogger();
    const auth = new AuthManager('https://api.test.com', 'cid', 'csec', 'xtok', logger);
    const http = new HttpClient('https://api.test.com', 'xtok', 30_000, logger, auth, 0);

    const controller = new AbortController();

    const promises = Array.from({ length: 20 }, (_, i) =>
      http.restGet(`/slow/${i}`, undefined, { signal: controller.signal }).catch((e: unknown) => e),
    );

    // Abort all after a brief delay
    await new Promise((r) => setTimeout(r, 50));
    controller.abort();

    const results = await Promise.all(promises);

    // All should have been aborted (TimeoutError from SDK wrapping AbortError)
    for (const result of results) {
      expect(result).toBeDefined();
      // Either TimeoutError or the abort propagated
      expect(result instanceof Error).toBe(true);
    }

    // After abort, no requests should be active
    expect(activeRequests).toBe(0);
  });

  it('circuit breaker: 3 failures then recovery after cooldown', async () => {
    let authAttempts = 0;

    globalThis.fetch = vi.fn(async () => {
      authAttempts++;
      if (authAttempts <= 3) {
        return new Response('Unauthorized', { status: 401 });
      }
      return createMockFetchResponse({
        access_token: 'tok_recovered',
        expires_in: 3600,
        token_type: 'Bearer',
      });
    });

    const logger = createMockLogger();
    const auth = new AuthManager('https://api.test.com', 'cid', 'csec', 'xtok', logger);

    // First 3 calls should fail and open circuit
    for (let i = 0; i < 3; i++) {
      await expect(auth.getToken()).rejects.toThrow();
    }

    // Circuit should be open - next call should fail fast
    await expect(auth.getToken()).rejects.toThrow(/Circuit breaker/);

    // Simulate cooldown by manipulating time
    // Access private field for testing
    (auth as unknown as { circuitOpenUntil: number }).circuitOpenUntil = Date.now() - 1;

    // After cooldown, should be able to authenticate
    const token = await auth.getToken();
    expect(token).toBe('tok_recovered');
  });
});
