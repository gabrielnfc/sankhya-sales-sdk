import { describe, expect, it, vi } from 'vitest';
import type { HttpClient } from '../../src/core/http.js';
import { GatewayResource } from '../../src/resources/gateway.js';

function createMockHttp(): HttpClient {
  return {
    restGet: vi.fn(),
    restPost: vi.fn(),
    restPut: vi.fn(),
    restDelete: vi.fn(),
    gatewayCall: vi.fn().mockResolvedValue({
      entities: {
        total: '0',
        hasMoreResult: 'false',
        offsetPage: '0',
        metadata: { fields: { field: [{ name: 'CODPARC' }] } },
        entity: [],
      },
    }),
  } as unknown as HttpClient;
}

describe('Security: Injection and Prototype Pollution', () => {
  it('rejects SQL injection in PK field names', async () => {
    const gw = new GatewayResource(createMockHttp());

    await expect(
      gw.loadRecord({
        entity: 'Parceiro',
        fields: 'CODPARC',
        primaryKey: { "CODPARC' OR '1'='1": '123' },
      }),
    ).rejects.toThrow(/invalido/);
  });

  it('rejects prototype pollution key __proto__', async () => {
    const gw = new GatewayResource(createMockHttp());
    // Object literal { __proto__: '1' } is absorbed by JS engine.
    // Use Object.create(null) to actually set the key.
    const pk = Object.create(null) as Record<string, string>;
    // biome-ignore lint/complexity/useLiteralKeys: testing __proto__ injection requires bracket access
    pk['__proto__'] = '1';

    await expect(
      gw.loadRecord({
        entity: 'Parceiro',
        fields: 'CODPARC',
        primaryKey: pk,
      }),
    ).rejects.toThrow(/invalido/);
  });

  it('rejects prototype pollution key constructor', async () => {
    const gw = new GatewayResource(createMockHttp());

    await expect(
      gw.loadRecord({
        entity: 'Parceiro',
        fields: 'CODPARC',
        primaryKey: { constructor: '1' },
      }),
    ).rejects.toThrow(/invalido/);
  });

  it('rejects field name with semicolon', async () => {
    const gw = new GatewayResource(createMockHttp());

    await expect(
      gw.loadRecord({
        entity: 'Parceiro',
        fields: 'CODPARC',
        primaryKey: { 'FIELD;DROP': '1' },
      }),
    ).rejects.toThrow(/invalido/);
  });

  it('rejects field name with spaces', async () => {
    const gw = new GatewayResource(createMockHttp());

    await expect(
      gw.loadRecord({
        entity: 'Parceiro',
        fields: 'CODPARC',
        primaryKey: { 'FIELD NAME': '1' },
      }),
    ).rejects.toThrow(/invalido/);
  });

  it('rejects field name with dashes', async () => {
    const gw = new GatewayResource(createMockHttp());

    await expect(
      gw.loadRecord({
        entity: 'Parceiro',
        fields: 'CODPARC',
        primaryKey: { 'FIELD-NAME': '1' },
      }),
    ).rejects.toThrow(/invalido/);
  });

  it('rejects field name starting with number', async () => {
    const gw = new GatewayResource(createMockHttp());

    await expect(
      gw.loadRecord({
        entity: 'Parceiro',
        fields: 'CODPARC',
        primaryKey: { '0FIELD': '1' },
      }),
    ).rejects.toThrow(/invalido/);
  });

  it('accepts valid Sankhya field names', async () => {
    const gw = new GatewayResource(createMockHttp());

    await expect(
      gw.loadRecord({
        entity: 'Parceiro',
        fields: 'CODPARC',
        primaryKey: { CODPARC: '123' },
      }),
    ).resolves.toBeNull();
  });

  it('accepts field with underscore', async () => {
    const gw = new GatewayResource(createMockHttp());

    await expect(
      gw.loadRecord({
        entity: 'Parceiro',
        fields: 'CODPARC',
        primaryKey: { COD_PARC: '123' },
      }),
    ).resolves.toBeNull();
  });

  it('error body is sanitized and truncated', async () => {
    const { ApiError } = await import('../../src/core/errors.js');
    const { HttpClient } = await import('../../src/core/http.js');

    const longBody = `Error details here\n${'at Object.run (/path/file.js:10:5)\n'.repeat(30)}${'x'.repeat(1000)}`;

    const mockAuth = {
      getToken: vi.fn().mockResolvedValue('test-token'),
      invalidateToken: vi.fn().mockResolvedValue(undefined),
    };

    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      statusText: 'Bad Request',
      text: () => Promise.resolve(longBody),
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

      const err = await client.restGet('/test').catch((e: unknown) => e);
      expect(err).toBeInstanceOf(ApiError);

      const apiErr = err as InstanceType<typeof ApiError>;
      const details = String(apiErr.details);
      // Sanitized body should be truncated and stack traces stripped
      expect(details.length).toBeLessThanOrEqual(520);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
