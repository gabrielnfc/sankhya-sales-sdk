import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthManager } from '../../src/core/auth.js';
import { AuthError, CircuitOpenError } from '../../src/core/errors.js';
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

    // maxRetries: 0 — falha de rede e transiente (retentavel); sem isso o
    // teste esperaria o backoff real (~3.5s) antes de exaurir as tentativas.
    const auth = createAuthManagerWithOpts({ authRetry: { maxRetries: 0 } });

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

// --- Resilience helpers (v1.3.0): auth retry/backoff + circuit breaker ---

type AuthOpts = Parameters<typeof AuthManager>[6];

function createAuthManagerWithOpts(
  options: AuthOpts,
  cacheProvider?: Parameters<typeof AuthManager>[5],
) {
  return new AuthManager(
    'https://api.sankhya.com.br',
    'client-id',
    'client-secret',
    'x-token',
    mockLogger,
    cacheProvider,
    options,
  );
}

function okResponse(token = 'access-token-123', expiresIn = 1800) {
  return {
    ok: true,
    status: 200,
    json: () =>
      Promise.resolve({
        access_token: token,
        expires_in: expiresIn,
        refresh_expires_in: 0,
        token_type: 'Bearer',
        'not-before-policy': 0,
        scope: '',
      }),
  } as unknown as Response;
}

function errorResponse(status: number, body = '') {
  return {
    ok: false,
    status,
    statusText: `HTTP ${status}`,
    text: () => Promise.resolve(body),
  } as unknown as Response;
}

describe('AUTH-RETRY: backoff exponencial + jitter em falhas transientes', () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
    vi.clearAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('deve recuperar de 502 transiente (502 -> 502 -> 200)', async () => {
    vi.useFakeTimers();
    globalThis.fetch = vi
      .fn()
      .mockResolvedValueOnce(errorResponse(502))
      .mockResolvedValueOnce(errorResponse(502))
      .mockResolvedValueOnce(okResponse('recovered-token'));

    const auth = createAuthManagerWithOpts({ authRetry: { maxRetries: 3, baseDelayMs: 500 } });

    const p = auth.getToken();
    await vi.runAllTimersAsync();
    const token = await p;

    expect(token).toBe('recovered-token');
    expect(globalThis.fetch).toHaveBeenCalledTimes(3);
  });

  it('deve aplicar backoff exponencial base*factor^attempt com jitter +-ratio', async () => {
    vi.useFakeTimers();
    vi.spyOn(Math, 'random').mockReturnValue(0.5); // jitter zero
    const setTimeoutSpy = vi.spyOn(globalThis, 'setTimeout');

    globalThis.fetch = vi
      .fn()
      .mockResolvedValueOnce(errorResponse(503))
      .mockResolvedValueOnce(errorResponse(503))
      .mockResolvedValueOnce(okResponse());

    const auth = createAuthManagerWithOpts({
      authRetry: { maxRetries: 3, baseDelayMs: 500, factor: 2, jitterRatio: 0.5 },
    });

    const p = auth.getToken();
    await vi.runAllTimersAsync();
    await p;

    // backoff delays (exclui timers de timeout de 30000)
    const backoffDelays = setTimeoutSpy.mock.calls
      .map((c) => c[1])
      .filter((ms): ms is number => typeof ms === 'number' && ms > 0 && ms < 30_000);
    expect(backoffDelays).toEqual([500, 1000]);
  });

  it('deve exaurir retries transientes e lancar AuthError', async () => {
    vi.useFakeTimers();
    globalThis.fetch = vi.fn().mockResolvedValue(errorResponse(504));

    const auth = createAuthManagerWithOpts({ authRetry: { maxRetries: 2, baseDelayMs: 1 } });

    const p = auth.getToken();
    const assertion = expect(p).rejects.toBeInstanceOf(AuthError);
    await vi.runAllTimersAsync();
    await assertion;
    expect(globalThis.fetch).toHaveBeenCalledTimes(3); // 1 + 2 retries
  });
});

describe('AUTH-RETRY: credencial invalida NAO retenta (evita lockout)', () => {
  let originalFetch: typeof globalThis.fetch;
  beforeEach(() => {
    originalFetch = globalThis.fetch;
    vi.clearAllMocks();
  });
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('HTTP 400 do OAuth falha imediatamente sem retry', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(errorResponse(400, 'invalid_request'));
    const auth = createAuthManagerWithOpts({ authRetry: { maxRetries: 3, baseDelayMs: 1 } });

    await expect(auth.getToken()).rejects.toBeInstanceOf(AuthError);
    expect(globalThis.fetch).toHaveBeenCalledOnce();
  });

  it('HTTP 401 do OAuth falha imediatamente sem retry', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(errorResponse(401, 'invalid_client'));
    const auth = createAuthManagerWithOpts({ authRetry: { maxRetries: 3, baseDelayMs: 1 } });

    await expect(auth.getToken()).rejects.toBeInstanceOf(AuthError);
    expect(globalThis.fetch).toHaveBeenCalledOnce();
  });

  it('HTTP 403 do OAuth falha imediatamente sem retry', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(errorResponse(403, 'forbidden'));
    const auth = createAuthManagerWithOpts({ authRetry: { maxRetries: 3, baseDelayMs: 1 } });

    await expect(auth.getToken()).rejects.toBeInstanceOf(AuthError);
    expect(globalThis.fetch).toHaveBeenCalledOnce();
  });
});

describe('AUTH-SECURITY: token/credencial nunca vaza em mensagem de erro', () => {
  let originalFetch: typeof globalThis.fetch;
  beforeEach(() => {
    originalFetch = globalThis.fetch;
    vi.clearAllMocks();
  });
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  const SENTINEL = 'LEAKED_TOKEN_SENTINEL_ab12cd34';

  it('corpo da resposta com sentinela NAO aparece no erro (400)', async () => {
    globalThis.fetch = vi
      .fn()
      .mockResolvedValue(errorResponse(400, `{"error":"invalid_client","token":"${SENTINEL}"}`));
    const auth = createAuthManagerWithOpts({ authRetry: { maxRetries: 0 } });

    let caught: unknown;
    try {
      await auth.getToken();
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(AuthError);
    const err = caught as AuthError;
    const haystack = `${err.message}|${err.stack ?? ''}|${JSON.stringify(err.details ?? '')}`;
    expect(haystack).not.toContain(SENTINEL);
  });
});

describe('AUTH-TIMEOUT: timeout de auth configuravel (default 30s)', () => {
  let originalFetch: typeof globalThis.fetch;
  beforeEach(() => {
    originalFetch = globalThis.fetch;
    vi.clearAllMocks();
  });
  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('deve usar o timeout configurado (5000ms) e nao o hardcoded 30000', async () => {
    vi.useFakeTimers();
    const setTimeoutSpy = vi.spyOn(globalThis, 'setTimeout');
    // fetch respeita o abort signal
    globalThis.fetch = vi.fn().mockImplementation(
      (_url: string, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            reject(Object.assign(new Error('aborted'), { name: 'AbortError' }));
          });
        }),
    );

    const auth = createAuthManagerWithOpts({
      timeout: 5000,
      authRetry: { maxRetries: 0, baseDelayMs: 1 },
    });

    const p = auth.getToken();
    const assertion = expect(p).rejects.toBeInstanceOf(AuthError);
    await vi.runAllTimersAsync();
    await assertion;

    const timeoutValues = setTimeoutSpy.mock.calls.map((c) => c[1]);
    expect(timeoutValues).toContain(5000);
    expect(timeoutValues).not.toContain(30_000);
  });
});

describe('CIRCUIT-BREAKER: contagem por fluxo, CircuitOpenError, jitter', () => {
  let originalFetch: typeof globalThis.fetch;
  beforeEach(() => {
    originalFetch = globalThis.fetch;
    vi.clearAllMocks();
  });
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('abre apos threshold falhas de fluxos distintos e lanca CircuitOpenError', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(errorResponse(500));
    const auth = createAuthManagerWithOpts({
      authRetry: { maxRetries: 0, baseDelayMs: 1 },
      circuitBreaker: { threshold: 3, resetTimeoutMs: 30_000 },
    });

    // 3 falhas de fluxos distintos (sem flowId) => armam o breaker
    for (let i = 0; i < 3; i++) {
      const err = await auth.getToken().catch((e) => e);
      expect(err).toBeInstanceOf(AuthError);
      expect(err).not.toBeInstanceOf(CircuitOpenError);
    }

    // 4a chamada: breaker aberto => CircuitOpenError, sem tocar o servidor
    const fetchCallsBefore = vi.mocked(globalThis.fetch).mock.calls.length;
    const err = await auth.getToken().catch((e) => e);
    expect(err).toBeInstanceOf(CircuitOpenError);
    expect((err as CircuitOpenError).retryAfterMs).toBeGreaterThan(0);
    expect(vi.mocked(globalThis.fetch).mock.calls.length).toBe(fetchCallsBefore); // nao chamou fetch
  });

  it('falhas encadeadas no MESMO fluxo (401 cascade) contam como 1', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(errorResponse(500));
    const auth = createAuthManagerWithOpts({
      authRetry: { maxRetries: 0, baseDelayMs: 1 },
      circuitBreaker: { threshold: 3, resetTimeoutMs: 30_000 },
    });

    const flow = Symbol('business-call');
    // 5 falhas encadeadas no mesmo fluxo => conta como 1 => breaker NUNCA abre
    for (let i = 0; i < 5; i++) {
      const err = await auth.getToken(flow).catch((e) => e);
      expect(err).toBeInstanceOf(AuthError);
      expect(err).not.toBeInstanceOf(CircuitOpenError);
    }
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
