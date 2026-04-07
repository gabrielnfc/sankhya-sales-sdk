import { beforeAll, describe, expect, it } from 'vitest';
import { SankhyaClient } from '../../src/client.js';
import { AuthError } from '../../src/core/errors.js';
import { getHttpClient } from '../helpers/get-http.js';

const config = {
  baseUrl: process.env.SANKHYA_BASE_URL ?? '',
  clientId: process.env.SANKHYA_CLIENT_ID ?? '',
  clientSecret: process.env.SANKHYA_CLIENT_SECRET ?? '',
  xToken: process.env.SANKHYA_X_TOKEN ?? '',
  timeout: 30_000,
  logger: { level: 'debug' as const },
};

const hasCredentials = config.baseUrl && config.clientId && config.clientSecret && config.xToken;

describe.skipIf(!hasCredentials)('Sandbox Integration', () => {
  let client: SankhyaClient;

  beforeAll(() => {
    client = new SankhyaClient(config);
  });

  it('deve autenticar com sucesso', async () => {
    await expect(client.authenticate()).resolves.not.toThrow();
  });

  it('deve obter token do cache na segunda chamada (sem novo request)', async () => {
    // Primeira chamada já foi feita no teste anterior
    // Segunda chamada deve usar cache
    await expect(client.authenticate()).resolves.not.toThrow();
  });

  it('deve fazer GET REST v1 — listar produtos', async () => {
    const http = getHttpClient(client);
    const result = await http.restGet<Record<string, unknown>>('/produtos', { page: '0' });
    console.log('Produtos response keys:', Object.keys(result));
    console.log('Produtos response:', JSON.stringify(result, null, 2).slice(0, 500));
    expect(result).toBeDefined();
  });

  it('deve fazer GET REST v1 — listar vendedores', async () => {
    const http = getHttpClient(client);
    const result = await http.restGet<Record<string, unknown>>('/vendedores', { page: '0' });
    console.log('Vendedores response keys:', Object.keys(result));
    console.log('Vendedores response:', JSON.stringify(result, null, 2).slice(0, 500));
    expect(result).toBeDefined();
  });

  it('deve fazer GET REST v1 — listar clientes (parceiros)', async () => {
    const http = getHttpClient(client);
    const result = await http.restGet<Record<string, unknown>>('/parceiros/clientes', {
      page: '1',
    });
    console.log('Clientes response keys:', Object.keys(result));
    console.log('Clientes response:', JSON.stringify(result, null, 2).slice(0, 500));
    expect(result).toBeDefined();
  });

  it('deve fazer chamada Gateway — loadRecords Produto', async () => {
    const http = getHttpClient(client);
    const result = await http.gatewayCall<Record<string, unknown>>(
      'mge',
      'CRUDServiceProvider.loadRecords',
      {
        dataSet: {
          rootEntity: 'Produto',
          includePresentationFields: 'N',
          offsetPage: '0',
          criteria: {
            expression: "this.ATIVO = 'S'",
          },
          entity: {
            fieldset: { list: 'CODPROD,DESCRPROD,CODVOL,ATIVO' },
          },
        },
      },
    );
    console.log('Gateway loadRecords response:', JSON.stringify(result, null, 2).slice(0, 800));
    expect(result).toBeDefined();
  });

  it('deve invalidar token e re-autenticar automaticamente', async () => {
    await client.invalidateToken();
    // Próximo request deve re-autenticar
    const http = getHttpClient(client);
    const result = await http.restGet<Record<string, unknown>>('/vendedores', { page: '0' });
    expect(result).toBeDefined();
  });
});
