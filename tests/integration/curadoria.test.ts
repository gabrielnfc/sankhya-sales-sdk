import { describe, it, expect, beforeAll } from 'vitest';
import { SankhyaClient } from '../../src/client.js';

const config = {
  baseUrl: process.env.SANKHYA_BASE_URL ?? '',
  clientId: process.env.SANKHYA_CLIENT_ID ?? '',
  clientSecret: process.env.SANKHYA_CLIENT_SECRET ?? '',
  xToken: process.env.SANKHYA_X_TOKEN ?? '',
  timeout: 30_000,
  logger: { level: 'debug' as const },
};

const hasCredentials = config.baseUrl && config.clientId && config.clientSecret && config.xToken;

describe.skipIf(!hasCredentials)('Curadoria — Formatos de Resposta Reais', () => {
  let client: SankhyaClient;

  beforeAll(async () => {
    client = new SankhyaClient(config);
    await client.authenticate();
  });

  // =====================================================
  // REST v1 — Analisar estrutura exata das respostas
  // =====================================================

  it('REST: estrutura da resposta de produtos', async () => {
    const http = client.getHttpClient();
    const result = await http.restGet<Record<string, unknown>>('/produtos', { page: '0' });
    console.log('\n=== PRODUTOS — KEYS ===');
    console.log('Top-level keys:', Object.keys(result));
    console.log('Pagination:', JSON.stringify(result.pagination, null, 2));
    if (Array.isArray(result.produtos)) {
      console.log('Primeiro produto keys:', Object.keys(result.produtos[0] ?? {}));
      console.log('Primeiro produto:', JSON.stringify(result.produtos[0], null, 2));
    }
    expect(result).toBeDefined();
  });

  it('REST: estrutura da resposta de vendedores', async () => {
    const http = client.getHttpClient();
    const result = await http.restGet<Record<string, unknown>>('/vendedores', { page: '0' });
    console.log('\n=== VENDEDORES — KEYS ===');
    console.log('Top-level keys:', Object.keys(result));
    console.log('Pagination:', JSON.stringify(result.pagination, null, 2));
    if (Array.isArray(result.vendedores)) {
      console.log('Primeiro vendedor keys:', Object.keys(result.vendedores[0] ?? {}));
      console.log('Primeiro vendedor:', JSON.stringify(result.vendedores[0], null, 2));
    }
    expect(result).toBeDefined();
  });

  it('REST: estrutura da resposta de clientes', async () => {
    const http = client.getHttpClient();
    const result = await http.restGet<Record<string, unknown>>('/parceiros/clientes', {
      page: '1',
    });
    console.log('\n=== CLIENTES — KEYS ===');
    console.log('Top-level keys:', Object.keys(result));
    console.log('Pagination:', JSON.stringify(result.pagination, null, 2));
    if (Array.isArray(result.clientes)) {
      console.log('Primeiro cliente keys:', Object.keys(result.clientes[0] ?? {}));
      console.log('Primeiro cliente:', JSON.stringify(result.clientes[0], null, 2));
    }
    expect(result).toBeDefined();
  });

  it('REST: estrutura da resposta de estoque', async () => {
    const http = client.getHttpClient();
    try {
      const result = await http.restGet<Record<string, unknown>>('/estoques', { page: '0' });
      console.log('\n=== ESTOQUE — KEYS ===');
      console.log('Top-level keys:', Object.keys(result));
      console.log('Response (500 chars):', JSON.stringify(result, null, 2).slice(0, 500));
    } catch (e) {
      console.log('\n=== ESTOQUE — ERRO ===');
      console.log(e);
    }
  });

  it('REST: estrutura da resposta de financeiros/receitas', async () => {
    const http = client.getHttpClient();
    try {
      const result = await http.restGet<Record<string, unknown>>('/financeiros/receitas', {
        page: '0',
      });
      console.log('\n=== RECEITAS — KEYS ===');
      console.log('Top-level keys:', Object.keys(result));
      console.log('Response (500 chars):', JSON.stringify(result, null, 2).slice(0, 500));
    } catch (e) {
      console.log('\n=== RECEITAS — ERRO ===');
      console.log(e);
    }
  });

  it('REST: estrutura da resposta de tipos de operação', async () => {
    const http = client.getHttpClient();
    try {
      const result = await http.restGet<Record<string, unknown>>(
        '/cadastros/tiposDeOperacao',
        { page: '0' },
      );
      console.log('\n=== TIPOS OPERAÇÃO — KEYS ===');
      console.log('Top-level keys:', Object.keys(result));
      console.log('Response (500 chars):', JSON.stringify(result, null, 2).slice(0, 500));
    } catch (e) {
      console.log('\n=== TIPOS OPERAÇÃO — ERRO ===');
      console.log(e);
    }
  });

  it('REST: estrutura da resposta de preços por tabela', async () => {
    const http = client.getHttpClient();
    try {
      const result = await http.restGet<Record<string, unknown>>(
        '/precos/porTabela/1',
        { pagina: '1' },
      );
      console.log('\n=== PREÇOS POR TABELA — KEYS ===');
      console.log('Top-level keys:', Object.keys(result));
      console.log('Response (500 chars):', JSON.stringify(result, null, 2).slice(0, 500));
    } catch (e) {
      console.log('\n=== PREÇOS POR TABELA — ERRO ===');
      console.log(e);
    }
  });

  it('REST: estrutura da resposta de tipos de pagamento', async () => {
    const http = client.getHttpClient();
    try {
      const result = await http.restGet<Record<string, unknown>>('/financeiros/tiposPagamento');
      console.log('\n=== TIPOS PAGAMENTO — KEYS ===');
      console.log('Top-level keys:', Object.keys(result));
      console.log('Response (500 chars):', JSON.stringify(result, null, 2).slice(0, 500));
    } catch (e) {
      console.log('\n=== TIPOS PAGAMENTO — ERRO ===');
      console.log(e);
    }
  });

  it('REST: estrutura da resposta de naturezas', async () => {
    const http = client.getHttpClient();
    try {
      const result = await http.restGet<Record<string, unknown>>('/cadastros/naturezas', {
        page: '0',
      });
      console.log('\n=== NATUREZAS — KEYS ===');
      console.log('Top-level keys:', Object.keys(result));
      console.log('Response (500 chars):', JSON.stringify(result, null, 2).slice(0, 500));
    } catch (e) {
      console.log('\n=== NATUREZAS — ERRO ===');
      console.log(e);
    }
  });

  it('REST: estrutura da resposta de empresas', async () => {
    const http = client.getHttpClient();
    try {
      const result = await http.restGet<Record<string, unknown>>('/cadastros/empresas');
      console.log('\n=== EMPRESAS — KEYS ===');
      console.log('Top-level keys:', Object.keys(result));
      console.log('Response (500 chars):', JSON.stringify(result, null, 2).slice(0, 500));
    } catch (e) {
      console.log('\n=== EMPRESAS — ERRO ===');
      console.log(e);
    }
  });

  // =====================================================
  // Gateway — Analisar estrutura exata
  // =====================================================

  it('Gateway: estrutura COMPLETA do loadRecords', async () => {
    const http = client.getHttpClient();
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
    console.log('\n=== GATEWAY loadRecords — FULL STRUCTURE ===');
    console.log('Top-level keys:', Object.keys(result));
    const entities = result.entities as Record<string, unknown> | undefined;
    if (entities) {
      console.log('entities keys:', Object.keys(entities));
      console.log('entities.total:', entities.total);
      console.log('entities.hasMoreResult:', entities.hasMoreResult);
      console.log('entities.offsetPage:', entities.offsetPage);
      const metadata = entities.metadata as Record<string, unknown> | undefined;
      if (metadata) {
        console.log('metadata:', JSON.stringify(metadata, null, 2));
      }
      const entityArr = entities.entity;
      if (Array.isArray(entityArr) && entityArr.length > 0) {
        console.log('Primeiro entity keys:', Object.keys(entityArr[0]));
        console.log('Primeiro entity:', JSON.stringify(entityArr[0], null, 2));
        if (entityArr.length > 1) {
          console.log('Segundo entity:', JSON.stringify(entityArr[1], null, 2));
        }
      }
    }
    expect(result).toBeDefined();
  });

  it('Gateway: loadRecords com TipoNegociacao (sem REST v1)', async () => {
    const http = client.getHttpClient();
    try {
      const result = await http.gatewayCall<Record<string, unknown>>(
        'mge',
        'CRUDServiceProvider.loadRecords',
        {
          dataSet: {
            rootEntity: 'TipoNegociacao',
            includePresentationFields: 'N',
            offsetPage: '0',
            criteria: {
              expression: "this.ATIVO = 'S'",
            },
            entity: {
              fieldset: { list: 'CODTIPVENDA,DESCRTIPVENDA,TAXAJURO,ATIVO' },
            },
          },
        },
      );
      console.log('\n=== GATEWAY TipoNegociacao ===');
      console.log('Full response:', JSON.stringify(result, null, 2).slice(0, 800));
    } catch (e) {
      console.log('\n=== GATEWAY TipoNegociacao — ERRO ===');
      console.log(e);
    }
  });

  it('Gateway: loadRecord (registro único)', async () => {
    const http = client.getHttpClient();
    try {
      const result = await http.gatewayCall<Record<string, unknown>>(
        'mge',
        'CRUDServiceProvider.loadRecord',
        {
          dataSet: {
            rootEntity: 'Produto',
            includePresentationFields: 'N',
            entity: {
              fieldset: { list: 'CODPROD,DESCRPROD,CODVOL,ATIVO' },
            },
            criteria: {
              expression: 'this.CODPROD = 10398',
            },
          },
        },
      );
      console.log('\n=== GATEWAY loadRecord ÚNICO ===');
      console.log('Full response:', JSON.stringify(result, null, 2).slice(0, 800));
    } catch (e) {
      console.log('\n=== GATEWAY loadRecord — ERRO ===');
      console.log(e);
    }
  });
});
