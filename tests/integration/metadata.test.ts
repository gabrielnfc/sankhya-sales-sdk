import { beforeAll, describe, expect, it } from 'vitest';
import { SankhyaClient } from '../../src/client.js';

const config = {
  baseUrl: process.env.SANKHYA_BASE_URL ?? '',
  clientId: process.env.SANKHYA_CLIENT_ID ?? '',
  clientSecret: process.env.SANKHYA_CLIENT_SECRET ?? '',
  xToken: process.env.SANKHYA_X_TOKEN ?? '',
  timeout: 30_000,
  logger: { level: 'silent' as const },
};

const hasCredentials = config.baseUrl && config.clientId && config.clientSecret && config.xToken;

describe.skipIf(!hasCredentials)('Metadata — listFields (live)', () => {
  let client: SankhyaClient;

  beforeAll(async () => {
    client = new SankhyaClient(config);
    await client.authenticate();
  });

  it('resolves CabecalhoNota to TGFCAB and lists its columns', async () => {
    const fields = await client.metadata.listFields('CabecalhoNota');

    expect(fields.length).toBeGreaterThan(100);
    const nunota = fields.find((f) => f.name === 'NUNOTA');
    expect(nunota).toBeDefined();
    expect(nunota?.type).toBe('NUMBER');
    expect(nunota?.custom).toBe(false);
  });

  it('returns only AD_ custom fields with customOnly', async () => {
    const custom = await client.metadata.listFields('CabecalhoNota', { customOnly: true });

    expect(custom.every((f) => f.custom)).toBe(true);
    expect(custom.every((f) => f.name.toUpperCase().startsWith('AD_'))).toBe(true);
  });

  it('accepts a physical table name via passthrough', async () => {
    const fields = await client.metadata.listFields('TGFPAR');

    expect(fields.length).toBeGreaterThan(100);
    expect(fields.find((f) => f.name === 'CODPARC')).toBeDefined();
  });

  it('throws for a non-existent table', async () => {
    await expect(client.metadata.listFields('TABELA_INEXISTENTE_XYZ')).rejects.toMatchObject({
      code: 'METADATA_EMPTY',
    });
  });
});
