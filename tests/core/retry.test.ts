import { describe, expect, it, vi } from 'vitest';
import { ApiError, AuthError, GatewayError } from '../../src/core/errors.js';
import { withRetry } from '../../src/core/retry.js';

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
    const fn = vi.fn()
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

describe('CORE-07: method-aware retry', () => {
  it('nao deve retentar POST em erro 429', async () => {
    const error = new ApiError('rate limit', '/pedidos', 'POST', 429);
    const fn = vi.fn().mockRejectedValue(error);

    await expect(
      withRetry(fn, { maxRetries: 3, baseDelay: 1, method: 'POST' }),
    ).rejects.toThrow(ApiError);
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
