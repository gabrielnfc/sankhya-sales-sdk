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
