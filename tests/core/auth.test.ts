import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthManager } from '../../src/core/auth.js';
import { AuthError } from '../../src/core/errors.js';
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

describe('AuthManager', () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
    vi.clearAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('deve autenticar e retornar token', async () => {
    globalThis.fetch = mockFetchSuccess();
    const auth = createAuthManager();

    const token = await auth.getToken();

    expect(token).toBe('access-token-123');
    expect(globalThis.fetch).toHaveBeenCalledOnce();

    const call = vi.mocked(globalThis.fetch).mock.calls[0];
    expect(call[0]).toBe('https://api.sankhya.com.br/authenticate');
    expect(call[1]?.method).toBe('POST');
    expect(call[1]?.headers).toEqual(
      expect.objectContaining({
        'Content-Type': 'application/x-www-form-urlencoded',
        'X-Token': 'x-token',
      }),
    );
  });

  it('deve retornar token do cache na segunda chamada', async () => {
    globalThis.fetch = mockFetchSuccess();
    const auth = createAuthManager();

    await auth.getToken();
    await auth.getToken();

    expect(globalThis.fetch).toHaveBeenCalledOnce();
  });

  it('deve invalidar token e re-autenticar', async () => {
    globalThis.fetch = mockFetchSuccess();
    const auth = createAuthManager();

    await auth.getToken();
    await auth.invalidateToken();

    globalThis.fetch = mockFetchSuccess('new-token');
    const token = await auth.getToken();

    expect(token).toBe('new-token');
  });

  it('deve lançar AuthError em caso de 401', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
      text: () => Promise.resolve('Invalid credentials'),
    });

    const auth = createAuthManager();

    await expect(auth.getToken()).rejects.toThrow(AuthError);
  });

  it('deve lançar AuthError em caso de falha de conexão', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('ECONNREFUSED'));

    const auth = createAuthManager();

    await expect(auth.getToken()).rejects.toThrow(AuthError);
  });

  it('deve usar mutex para requests simultâneos', async () => {
    let resolveAuth: (value: Response) => void;
    globalThis.fetch = vi.fn().mockReturnValue(
      new Promise<Response>((resolve) => {
        resolveAuth = resolve;
      }),
    );

    const auth = createAuthManager();

    const p1 = auth.getToken();
    const p2 = auth.getToken();
    const p3 = auth.getToken();

    resolveAuth?.({
      ok: true,
      json: () =>
        Promise.resolve({
          access_token: 'shared-token',
          expires_in: 1800,
          refresh_expires_in: 0,
          token_type: 'Bearer',
          'not-before-policy': 0,
          scope: '',
        }),
    } as Response);

    const [t1, t2, t3] = await Promise.all([p1, p2, p3]);

    expect(t1).toBe('shared-token');
    expect(t2).toBe('shared-token');
    expect(t3).toBe('shared-token');
    expect(globalThis.fetch).toHaveBeenCalledOnce();
  });

  it('deve usar cacheProvider customizado quando fornecido', async () => {
    const store = new Map<string, string>();
    const cacheProvider = {
      get: vi.fn(async (key: string) => store.get(key) ?? null),
      set: vi.fn(async (key: string, value: string, _ttl: number) => {
        store.set(key, value);
      }),
      del: vi.fn(async (key: string) => {
        store.delete(key);
      }),
    };

    globalThis.fetch = mockFetchSuccess();
    const auth = createAuthManager(cacheProvider);

    await auth.getToken();

    expect(cacheProvider.set).toHaveBeenCalledOnce();
    expect(store.size).toBe(1);

    // Segunda chamada deve usar cache
    const token = await auth.getToken();
    expect(token).toBe('access-token-123');
    expect(cacheProvider.get).toHaveBeenCalled();
    expect(globalThis.fetch).toHaveBeenCalledOnce(); // fetch chamado 1x apenas
  });
});

describe('CORE-04: TTL lower-bound guard', () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
    vi.clearAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('deve cachear token mesmo com expires_in menor que SAFETY_MARGIN (30s)', async () => {
    globalThis.fetch = mockFetchSuccess('token-short-ttl', 30);
    const auth = createAuthManager();

    const token1 = await auth.getToken();
    expect(token1).toBe('token-short-ttl');

    // Second call should use cache, not re-authenticate
    const token2 = await auth.getToken();
    expect(token2).toBe('token-short-ttl');
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });

  it('deve cachear token com expires_in=10 (muito curto)', async () => {
    globalThis.fetch = mockFetchSuccess('token-very-short', 10);
    const auth = createAuthManager();

    const token = await auth.getToken();
    expect(token).toBe('token-very-short');

    const token2 = await auth.getToken();
    expect(token2).toBe('token-very-short');
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });
});
