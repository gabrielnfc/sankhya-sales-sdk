import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthManager } from '../../src/core/auth.js';
import { ApiError } from '../../src/core/errors.js';
import { HttpClient } from '../../src/core/http.js';
import type { Logger } from '../../src/types/config.js';

const mockLogger: Logger = {
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
};

function createAuthManager(cacheProvider?: Parameters<typeof AuthManager>[5]) {
  return new AuthManager(
    'https://api.sankhya.com.br',
    'client-id',
    'client-secret',
    'x-token',
    mockLogger,
    cacheProvider,
  );
}

function mockFetchSuccess(token = 'access-token-123', expiresIn = 1800) {
  return vi.fn().mockResolvedValue({
    ok: true,
    json: () =>
      Promise.resolve({
        access_token: token,
        expires_in: expiresIn,
        refresh_expires_in: 0,
        token_type: 'Bearer',
        'not-before-policy': 0,
        scope: '',
      }),
  });
}

describe('Security: Race Conditions', () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
    vi.clearAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('10 concurrent getToken() calls produce only 1 authenticate()', async () => {
    globalThis.fetch = mockFetchSuccess();
    const auth = createAuthManager();

    await Promise.all(Array.from({ length: 10 }, () => auth.getToken()));

    expect(globalThis.fetch).toHaveBeenCalledOnce();
  });

  it('concurrent getToken() all receive same token', async () => {
    globalThis.fetch = mockFetchSuccess('shared-token');
    const auth = createAuthManager();

    const results = await Promise.all(Array.from({ length: 10 }, () => auth.getToken()));

    for (const token of results) {
      expect(token).toBe('shared-token');
    }
  });

  it('invalidateToken() during active getToken() does not crash', async () => {
    let resolveAuth: (value: Response) => void;
    globalThis.fetch = vi.fn().mockImplementation(
      () =>
        new Promise<Response>((resolve) => {
          resolveAuth = resolve;
        }),
    );

    const auth = createAuthManager();
    const tokenPromise = auth.getToken();

    // Invalidate immediately while getToken is in flight
    await auth.invalidateToken();

    // Resolve the auth
    resolveAuth?.({
      ok: true,
      json: () =>
        Promise.resolve({
          access_token: 'delayed-token',
          expires_in: 1800,
          refresh_expires_in: 0,
          token_type: 'Bearer',
          'not-before-policy': 0,
          scope: '',
        }),
    } as Response);

    const token = await tokenPromise;
    expect(token).toBe('delayed-token');
  });

  it('second batch after invalidate triggers new authenticate()', async () => {
    globalThis.fetch = mockFetchSuccess('first-token');
    const auth = createAuthManager();

    await auth.getToken();
    expect(globalThis.fetch).toHaveBeenCalledOnce();

    await auth.invalidateToken();

    globalThis.fetch = mockFetchSuccess('second-token');
    const token = await auth.getToken();

    expect(token).toBe('second-token');
  });

  it('token refresh covers cache check (no race window)', async () => {
    let cacheGetCount = 0;
    const cacheProvider = {
      get: vi.fn(async () => {
        cacheGetCount++;
        return null;
      }),
      set: vi.fn(async () => {}),
      del: vi.fn(async () => {}),
    };

    globalThis.fetch = mockFetchSuccess();
    const auth = createAuthManager(cacheProvider);

    // 5 concurrent calls should all coalesce into 1 refreshPromise
    await Promise.all(Array.from({ length: 5 }, () => auth.getToken()));

    // Cache check happens inside _doGetToken, called once via refreshPromise
    expect(cacheGetCount).toBe(1);
  });

  it('requestWithRetry stops at maxAuthRetries=2', async () => {
    let tokenCounter = 0;
    const mockAuth = {
      getToken: vi.fn().mockImplementation(async () => {
        tokenCounter++;
        return `token-${tokenCounter}`;
      }),
      invalidateToken: vi.fn().mockResolvedValue(undefined),
    };

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
      text: () => Promise.resolve('Unauthorized'),
    });

    const client = new HttpClient(
      'https://api.test.com',
      'x-token',
      30000,
      mockLogger,
      mockAuth as Parameters<typeof HttpClient>[4],
      0,
    );

    const err = await client.restGet('/test').catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);

    // depth 0: getToken + retry getToken = 2
    // depth 1: getToken + retry getToken = 2
    // depth 2: getToken (no retry, depth >= 2) = 1
    // Total: 5 getToken calls
    expect(mockAuth.getToken).toHaveBeenCalledTimes(5);
    // But only 2 invalidateToken calls (at depth 0 and 1)
    expect(mockAuth.invalidateToken).toHaveBeenCalledTimes(2);
  });
});
