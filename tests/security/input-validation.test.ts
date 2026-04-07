import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthManager } from '../../src/core/auth.js';
import { safeParseNumber } from '../../src/core/parse-utils.js';
import type { Logger } from '../../src/types/config.js';

describe('Security: Input Validation — safeParseNumber', () => {
  it('parses valid number string', () => {
    expect(safeParseNumber('42', 'test')).toBe(42);
  });

  it('parses zero', () => {
    expect(safeParseNumber('0', 'test')).toBe(0);
  });

  it('returns 0 for empty string', () => {
    expect(safeParseNumber('', 'test')).toBe(0);
  });

  it('returns 0 for null', () => {
    expect(safeParseNumber(null, 'test')).toBe(0);
  });

  it('returns 0 for undefined', () => {
    expect(safeParseNumber(undefined, 'test')).toBe(0);
  });

  it('throws for NaN', () => {
    expect(() => safeParseNumber('abc', 'CAMPO')).toThrow(/invalido.*CAMPO/);
  });

  it('throws for Infinity', () => {
    expect(() => safeParseNumber('Infinity', 'CAMPO')).toThrow(/invalido/);
  });

  it('throws for -Infinity', () => {
    expect(() => safeParseNumber('-Infinity', 'CAMPO')).toThrow(/invalido/);
  });

  it('parses negative numbers', () => {
    expect(safeParseNumber('-5', 'test')).toBe(-5);
  });

  it('parses decimal numbers', () => {
    expect(safeParseNumber('3.14', 'test')).toBe(3.14);
  });

  it('huge string field value throws', () => {
    expect(() => safeParseNumber('1'.repeat(1_000_000), 'test')).toThrow(/invalido/);
  });
});

describe('Security: Input Validation — TokenData cache', () => {
  let originalFetch: typeof globalThis.fetch;

  const mockLogger: Logger = {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };

  function mockFetchSuccess(token = 'fresh-token', expiresIn = 1800) {
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

  beforeEach(() => {
    originalFetch = globalThis.fetch;
    vi.clearAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('invalid TokenData from cache is rejected', async () => {
    const invalidCacheData = JSON.stringify({
      accessToken: 123,
      expiresAt: 'not-a-number',
    });

    const cacheProvider = {
      get: vi.fn(async () => invalidCacheData),
      set: vi.fn(async () => {}),
      del: vi.fn(async () => {}),
    };

    globalThis.fetch = mockFetchSuccess('fresh-token');

    const auth = new AuthManager(
      'https://api.sankhya.com.br',
      'client-id',
      'client-secret',
      'x-token',
      mockLogger,
      cacheProvider,
    );

    const token = await auth.getToken();

    // Should have fallen through to authenticate() instead of using invalid cache
    expect(token).toBe('fresh-token');
    expect(globalThis.fetch).toHaveBeenCalledOnce();
    expect(cacheProvider.del).toHaveBeenCalled();
    expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining('formato invalido'));
  });
});
