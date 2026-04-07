import { describe, expect, it, vi } from 'vitest';
import { createPaginator } from '../../src/core/pagination.js';
import type { PaginatedResult } from '../../src/types/common.js';

describe('Security: Atomic Operations', () => {
  it('two parallel AsyncGenerators maintain independent page state', async () => {
    const fetchFn = async (page: number): Promise<PaginatedResult<string>> => {
      if (page === 0) {
        return { data: ['a', 'b'], page: 0, hasMore: true, totalRecords: 4 };
      }
      return { data: ['c', 'd'], page: 1, hasMore: false, totalRecords: 4 };
    };

    const gen1 = createPaginator(fetchFn);
    const gen2 = createPaginator(fetchFn);

    // Advance gen1 one item
    const g1r1 = await gen1.next();
    expect(g1r1.value).toBe('a');

    // Advance gen2 two items
    const g2r1 = await gen2.next();
    expect(g2r1.value).toBe('a');
    const g2r2 = await gen2.next();
    expect(g2r2.value).toBe('b');

    // Advance gen1 again -- should get 'b', not skip
    const g1r2 = await gen1.next();
    expect(g1r2.value).toBe('b');
  });

  it('generator yields all items before mutating page state', async () => {
    const fetchFn = async (page: number): Promise<PaginatedResult<number>> => {
      if (page === 0) {
        return { data: [0, 1, 2], page: 0, hasMore: true, totalRecords: 5 };
      }
      return { data: [3, 4], page: 1, hasMore: false, totalRecords: 5 };
    };

    const items: number[] = [];
    for await (const item of createPaginator(fetchFn)) {
      items.push(item);
    }

    expect(items).toEqual([0, 1, 2, 3, 4]);
  });

  it('generator stops when hasMore is false', async () => {
    const fetchFn = async (_page: number): Promise<PaginatedResult<string>> => ({
      data: ['only'],
      page: 0,
      hasMore: false,
      totalRecords: 1,
    });

    const items: string[] = [];
    for await (const item of createPaginator(fetchFn)) {
      items.push(item);
    }

    expect(items).toEqual(['only']);
  });

  it('generator stops when data is empty', async () => {
    const fetchFn = async (_page: number): Promise<PaginatedResult<string>> => ({
      data: [],
      page: 0,
      hasMore: true,
      totalRecords: 0,
    });

    const items: string[] = [];
    for await (const item of createPaginator(fetchFn)) {
      items.push(item);
    }

    expect(items).toEqual([]);
  });

  it('AbortController timeout is cleared after successful request', async () => {
    const clearTimeoutSpy = vi.spyOn(globalThis, 'clearTimeout');
    const { HttpClient } = await import('../../src/core/http.js');

    const mockAuth = {
      getToken: vi.fn().mockResolvedValue('test-token'),
      invalidateToken: vi.fn().mockResolvedValue(undefined),
    };

    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: 'ok' }),
    });

    try {
      const client = new HttpClient(
        'https://api.test.com',
        'x-token',
        30000,
        { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
        mockAuth as Parameters<typeof HttpClient>[4],
        0,
      );

      await client.restGet('/test');

      expect(clearTimeoutSpy).toHaveBeenCalled();
    } finally {
      globalThis.fetch = originalFetch;
      clearTimeoutSpy.mockRestore();
    }
  });

  it('AbortController abort propagates TimeoutError', async () => {
    const { HttpClient } = await import('../../src/core/http.js');
    const { TimeoutError } = await import('../../src/core/errors.js');

    const mockAuth = {
      getToken: vi.fn().mockResolvedValue('test-token'),
      invalidateToken: vi.fn().mockResolvedValue(undefined),
    };

    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockImplementation(
      (_url: string, init?: RequestInit) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            reject(new DOMException('The operation was aborted.', 'AbortError'));
          });
        }),
    );

    try {
      const client = new HttpClient(
        'https://api.test.com',
        'x-token',
        50,
        { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
        mockAuth as Parameters<typeof HttpClient>[4],
        0,
      );

      const err = await client.restGet('/slow').catch((e: unknown) => e);
      expect(err).toBeInstanceOf(TimeoutError);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
