import { describe, expect, it, vi } from 'vitest';
import { ApiError, AuthError, GatewayError } from '../../src/core/errors.js';
import { MAX_RETRY_AFTER_MS, parseRetryAfterMs, withRetry } from '../../src/core/retry.js';

describe('withRetry', () => {
  it('deve retornar resultado na primeira tentativa sem retry', async () => {
    const fn = vi.fn().mockResolvedValue('ok');
    const result = await withRetry(fn, { maxRetries: 3, baseDelay: 1 });
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledOnce();
  });

  it('deve retentar em erro 429', async () => {
    const error = new ApiError('rate limit', '/test', 'GET', 429);
    const fn = vi.fn().mockRejectedValueOnce(error).mockResolvedValue('ok');

    const result = await withRetry(fn, { maxRetries: 3, baseDelay: 1 });
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('deve retentar em erro 500', async () => {
    const error = new ApiError('server error', '/test', 'GET', 500);
    const fn = vi
      .fn()
      .mockRejectedValueOnce(error)
      .mockRejectedValueOnce(error)
      .mockResolvedValue('ok');

    const result = await withRetry(fn, { maxRetries: 3, baseDelay: 1 });
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('deve retentar em TIMEOUT_ERROR', async () => {
    const error = { code: 'TIMEOUT_ERROR', message: 'timeout' };
    const fn = vi.fn().mockRejectedValueOnce(error).mockResolvedValue('ok');

    const result = await withRetry(fn, { maxRetries: 3, baseDelay: 1 });
    expect(result).toBe('ok');
  });

  it('deve falhar rápido em AuthError (sem retry)', async () => {
    const fn = vi.fn().mockRejectedValue(new AuthError('fail'));

    await expect(withRetry(fn, { maxRetries: 3, baseDelay: 1 })).rejects.toThrow(AuthError);
    expect(fn).toHaveBeenCalledOnce();
  });

  it('deve falhar rápido em GatewayError (sem retry)', async () => {
    const fn = vi.fn().mockRejectedValue(new GatewayError('fail', 'service'));

    await expect(withRetry(fn, { maxRetries: 3, baseDelay: 1 })).rejects.toThrow(GatewayError);
    expect(fn).toHaveBeenCalledOnce();
  });

  it('deve falhar rápido em erro 404 (sem retry)', async () => {
    const error = new ApiError('not found', '/test', 'GET', 404);
    const fn = vi.fn().mockRejectedValue(error);

    await expect(withRetry(fn, { maxRetries: 3, baseDelay: 1 })).rejects.toThrow(ApiError);
    expect(fn).toHaveBeenCalledOnce();
  });

  it('deve respeitar maxRetries', async () => {
    const error = new ApiError('server error', '/test', 'GET', 500);
    const fn = vi.fn().mockRejectedValue(error);

    await expect(withRetry(fn, { maxRetries: 2, baseDelay: 1 })).rejects.toThrow(ApiError);
    expect(fn).toHaveBeenCalledTimes(3); // 1 tentativa + 2 retries
  });

  it('deve retentar em ECONNRESET', async () => {
    const error = { code: 'ECONNRESET', message: 'connection reset' };
    const fn = vi.fn().mockRejectedValueOnce(error).mockResolvedValue('ok');

    const result = await withRetry(fn, { maxRetries: 3, baseDelay: 1 });
    expect(result).toBe('ok');
  });

  it('deve retentar quando cause tem código retentável', async () => {
    const error = new Error('fetch failed');
    (error as NodeJS.ErrnoException).cause = { code: 'ETIMEDOUT' };
    const fn = vi.fn().mockRejectedValueOnce(error).mockResolvedValue('ok');

    const result = await withRetry(fn, { maxRetries: 3, baseDelay: 1 });
    expect(result).toBe('ok');
  });
});

describe('CORE-05: jitter no backoff', () => {
  it('deve aplicar jitter ao delay (full jitter)', async () => {
    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const sleepCalls: number[] = [];
    const originalSetTimeout = globalThis.setTimeout;
    vi.spyOn(globalThis, 'setTimeout').mockImplementation((fn: () => void, ms?: number) => {
      if (ms !== undefined && ms > 0) sleepCalls.push(ms);
      return originalSetTimeout(fn, 0);
    });

    const error = new ApiError('server error', '/test', 'GET', 500);
    const fn = vi
      .fn()
      .mockRejectedValueOnce(error)
      .mockRejectedValueOnce(error)
      .mockResolvedValue('ok');

    await withRetry(fn, { maxRetries: 3, baseDelay: 100 });

    // Full jitter: Math.random() * baseDelay * 2^attempt
    // attempt 0: 0.5 * 100 * 1 = 50
    // attempt 1: 0.5 * 100 * 2 = 100
    expect(sleepCalls[0]).toBe(50);
    expect(sleepCalls[1]).toBe(100);

    randomSpy.mockRestore();
    vi.restoreAllMocks();
  });
});

describe('idempotent: retry por semantica de operacao (nao por metodo HTTP)', () => {
  it('deve retentar leitura idempotente em POST (ex.: gateway loadRecords) em 502', async () => {
    const error = new ApiError('bad gateway', '/gateway', 'POST', 502);
    const fn = vi.fn().mockRejectedValueOnce(error).mockResolvedValue('ok');

    const result = await withRetry(fn, {
      maxRetries: 3,
      baseDelay: 1,
      method: 'POST',
      idempotent: true,
    });
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('NAO deve retentar escrita (POST sem idempotent) em 502', async () => {
    const error = new ApiError('bad gateway', '/gateway', 'POST', 502);
    const fn = vi.fn().mockRejectedValue(error);

    await expect(withRetry(fn, { maxRetries: 3, baseDelay: 1, method: 'POST' })).rejects.toThrow(
      ApiError,
    );
    expect(fn).toHaveBeenCalledOnce();
  });

  it('deve honrar Retry-After (ms) do erro no delay', async () => {
    const originalSetTimeout = globalThis.setTimeout;
    const sleepCalls: number[] = [];
    vi.spyOn(globalThis, 'setTimeout').mockImplementation((fn: () => void, ms?: number) => {
      if (ms !== undefined && ms > 0) sleepCalls.push(ms);
      return originalSetTimeout(fn, 0);
    });

    const error = Object.assign(new ApiError('slow down', '/gateway', 'POST', 429), {
      retryAfterMs: 4321,
    });
    const fn = vi.fn().mockRejectedValueOnce(error).mockResolvedValue('ok');

    await withRetry(fn, { maxRetries: 3, baseDelay: 1, method: 'POST', idempotent: true });

    expect(sleepCalls[0]).toBe(4321);
    vi.restoreAllMocks();
  });
});

describe('parseRetryAfterMs: limites do header Retry-After', () => {
  it('null ou vazio => undefined', () => {
    expect(parseRetryAfterMs(null)).toBeUndefined();
    expect(parseRetryAfterMs('')).toBeUndefined();
  });

  it('segundos negativos => undefined (cai no backoff)', () => {
    expect(parseRetryAfterMs('-5')).toBeUndefined();
  });

  it('0 => undefined', () => {
    expect(parseRetryAfterMs('0')).toBeUndefined();
  });

  it('86400s e capado em MAX_RETRY_AFTER_MS (60s)', () => {
    expect(parseRetryAfterMs('86400')).toBe(MAX_RETRY_AFTER_MS);
  });

  it('HTTP-date no passado => undefined', () => {
    expect(parseRetryAfterMs('Wed, 22 Jul 2020 12:00:00 GMT')).toBeUndefined();
  });

  it('HTTP-date horas no futuro e capado em MAX_RETRY_AFTER_MS', () => {
    const far = new Date(Date.now() + 3_600_000).toUTCString();
    expect(parseRetryAfterMs(far)).toBe(MAX_RETRY_AFTER_MS);
  });

  it('lixo => undefined', () => {
    expect(parseRetryAfterMs('garbage')).toBeUndefined();
  });
});

describe('withRetry: bounds do delay de retryAfterMs no erro', () => {
  it('retryAfterMs enorme (10min) e capado em MAX_RETRY_AFTER_MS', async () => {
    const originalSetTimeout = globalThis.setTimeout;
    const sleepCalls: number[] = [];
    vi.spyOn(globalThis, 'setTimeout').mockImplementation((fn: () => void, ms?: number) => {
      if (ms !== undefined && ms > 0) sleepCalls.push(ms);
      return originalSetTimeout(fn, 0);
    });

    const error = Object.assign(new ApiError('slow down', '/g', 'GET', 429), {
      retryAfterMs: 600_000,
    });
    const fn = vi.fn().mockRejectedValueOnce(error).mockResolvedValue('ok');

    await withRetry(fn, { maxRetries: 3, baseDelay: 1 });

    expect(sleepCalls[0]).toBe(MAX_RETRY_AFTER_MS);
    vi.restoreAllMocks();
  });

  it('retryAfterMs negativo/NaN cai no backoff exponencial', async () => {
    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const originalSetTimeout = globalThis.setTimeout;
    const sleepCalls: number[] = [];
    vi.spyOn(globalThis, 'setTimeout').mockImplementation((fn: () => void, ms?: number) => {
      if (ms !== undefined && ms > 0) sleepCalls.push(ms);
      return originalSetTimeout(fn, 0);
    });

    const negErr = Object.assign(new ApiError('x', '/g', 'GET', 429), { retryAfterMs: -100 });
    const nanErr = Object.assign(new ApiError('x', '/g', 'GET', 429), { retryAfterMs: Number.NaN });
    const fn = vi
      .fn()
      .mockRejectedValueOnce(negErr)
      .mockRejectedValueOnce(nanErr)
      .mockResolvedValue('ok');

    await withRetry(fn, { maxRetries: 3, baseDelay: 100 });

    // full jitter com random=0.5: 50 (attempt 0) e 100 (attempt 1)
    expect(sleepCalls).toEqual([50, 100]);
    randomSpy.mockRestore();
    vi.restoreAllMocks();
  });
});

describe('CORE-07: method-aware retry', () => {
  it('nao deve retentar POST em erro 429', async () => {
    const error = new ApiError('rate limit', '/pedidos', 'POST', 429);
    const fn = vi.fn().mockRejectedValue(error);

    await expect(withRetry(fn, { maxRetries: 3, baseDelay: 1, method: 'POST' })).rejects.toThrow(
      ApiError,
    );
    expect(fn).toHaveBeenCalledOnce();
  });

  it('deve retentar GET em erro 429 (compatibilidade)', async () => {
    const error = new ApiError('rate limit', '/test', 'GET', 429);
    const fn = vi.fn().mockRejectedValueOnce(error).mockResolvedValue('ok');

    const result = await withRetry(fn, { maxRetries: 3, baseDelay: 1, method: 'GET' });
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('deve retentar POST com forceRetry=true', async () => {
    const error = new ApiError('rate limit', '/pedidos', 'POST', 429);
    const fn = vi.fn().mockRejectedValueOnce(error).mockResolvedValue('ok');

    const result = await withRetry(fn, {
      maxRetries: 3,
      baseDelay: 1,
      method: 'POST',
      forceRetry: true,
    });
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('deve retentar sem method especificado (compatibilidade)', async () => {
    const error = new ApiError('rate limit', '/test', 'GET', 429);
    const fn = vi.fn().mockRejectedValueOnce(error).mockResolvedValue('ok');

    const result = await withRetry(fn, { maxRetries: 3, baseDelay: 1 });
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
  });
});
