import { beforeAll, describe, expect, it } from 'vitest';
import { SankhyaClient } from '../../src/client.js';
import { deserializeRows } from '../../src/core/gateway-serializer.js';
import { extractRestData, normalizePagination } from '../../src/core/pagination.js';
import type { ResourceDescriptor } from '../../src/types/pagination-contracts.js';
import { getHttpClient } from '../helpers/get-http.js';

const config = {
  baseUrl: process.env.SANKHYA_BASE_URL ?? '',
  clientId: process.env.SANKHYA_CLIENT_ID ?? '',
  clientSecret: process.env.SANKHYA_CLIENT_SECRET ?? '',
  xToken: process.env.SANKHYA_X_TOKEN ?? '',
  timeout: 30_000,
  logger: { level: 'silent' as const },
};

const has = config.baseUrl && config.clientId && config.clientSecret && config.xToken;

describe.skipIf(!has)('Curadoria v2 — Validação com novos formatos', () => {
  let client: SankhyaClient;

  beforeAll(async () => {
    client = new SankhyaClient(config);
    await client.authenticate();
  });

  // =====================================================
  // REST v1 — Testar extractRestData + normalizeRestPagination
  // =====================================================

  const restEndpoints: {
    path: string;
    name: string;
    params?: Record<string, string>;
    descritor: ResourceDescriptor;
  }[] = [
    {
      path: '/produtos',
      name: 'Produtos',
      descritor: { resourceKey: 'produtos', contract: 'rest', expectPagination: true },
    },
    {
      path: '/grupos-produto',
      name: 'Grupos Produto',
      descritor: { resourceKey: 'grupos', contract: 'rest', expectPagination: true },
    },
    {
      path: '/parceiros/clientes',
      name: 'Clientes',
      params: { page: '1' },
      descritor: { resourceKey: 'clientes', contract: 'rest', expectPagination: true },
    },
    {
      path: '/vendedores',
      name: 'Vendedores',
      descritor: { resourceKey: 'vendedores', contract: 'rest', expectPagination: true },
    },
    {
      path: '/estoque/locais',
      name: 'Locais Estoque',
      descritor: { resourceKey: 'locais', contract: 'rest', expectPagination: true },
    },
    {
      path: '/financeiros/tipos-pagamento',
      name: 'Tipos Pagamento',
      descritor: { resourceKey: 'data', contract: 'rest', expectPagination: true },
    },
    {
      path: '/financeiros/moedas',
      name: 'Moedas',
      descritor: { resourceKey: 'data', contract: 'rest', expectPagination: true },
    },
    {
      path: '/tipos-operacao',
      name: 'Tipos Operação',
      descritor: { resourceKey: 'data', contract: 'rest', expectPagination: true },
    },
    {
      path: '/naturezas',
      name: 'Naturezas',
      descritor: { resourceKey: 'data', contract: 'rest', expectPagination: true },
    },
    {
      path: '/projetos',
      name: 'Projetos',
      descritor: { resourceKey: 'data', contract: 'rest', expectPagination: true },
    },
    {
      path: '/centros-resultado',
      name: 'Centros Resultado',
      descritor: { resourceKey: 'data', contract: 'rest', expectPagination: true },
    },
    {
      path: '/empresas',
      name: 'Empresas',
      descritor: { resourceKey: 'empresas', contract: 'rest', expectPagination: true },
    },
    {
      // Contrato financeiro e 1-based (medido). page=0 funciona e devolve a
      // pagina 1, mas pedimos '1' explicitamente para nao depender disso.
      path: '/financeiros/receitas',
      name: 'Financeiros Receitas',
      params: { page: '1' },
      descritor: { resourceKey: 'financeiros', contract: 'financeiro', expectPagination: true },
    },
    {
      path: '/financeiros/despesas',
      name: 'Financeiros Despesas',
      params: { page: '1' },
      descritor: { resourceKey: 'financeiros', contract: 'financeiro', expectPagination: true },
    },
  ];

  for (const { path, name, params, descritor } of restEndpoints) {
    it(`REST: extractRestData + normalizePagination — ${name}`, async () => {
      const http = getHttpClient(client);
      const rawResponse = await http.restGet<Record<string, unknown>>(
        path,
        params ?? { page: '0' },
      );

      // extractRestData deve encontrar o array de dados a partir da chave declarada
      // (ou do fallback de primeiro array, nesta task, quando a chave nao bate)
      const { data, degraded } = extractRestData(rawResponse, descritor);

      // Deve ter encontrado dados (array) — mesmo /projetos com 1 registro, que
      // chega como objeto e cai no fallback de primeiro array (=> []) nesta task.
      expect(Array.isArray(data)).toBe(true);

      // A chave declarada no descritor precisa bater com a resposta real —
      // sem isto, uma chave errada produz data: [] (que passa no
      // Array.isArray acima) sem que o teste perceba o defeito.
      expect(degraded).toBe(false);

      // normalizePagination deve funcionar
      const paginated = normalizePagination(data, rawResponse, descritor, degraded);
      expect(paginated.data).toBe(data);
      expect(typeof paginated.page).toBe('number');
      expect(typeof paginated.hasMore).toBe('boolean');

      console.log(
        `✅ ${name}: ${data.length} registros, page=${paginated.page}, hasMore=${paginated.hasMore}, total=${paginated.totalRecords}`,
      );
    });
  }

  // =====================================================
  // Gateway — Testar deserializeRows
  // =====================================================

  it('Gateway: deserializeRows com loadRecords Produto', async () => {
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

    const deserialized = deserializeRows(result);

    expect(deserialized.rows.length).toBeGreaterThan(0);
    expect(typeof deserialized.hasMore).toBe('boolean');
    expect(typeof deserialized.page).toBe('number');

    // Verificar que os campos foram mapeados corretamente (não f0, f1)
    const firstRow = deserialized.rows[0];
    expect(firstRow).toBeDefined();
    expect(firstRow?.CODPROD).toBeDefined();
    expect(firstRow?.DESCRPROD).toBeDefined();
    expect(firstRow?.CODVOL).toBeDefined();
    expect(firstRow?.ATIVO).toBeDefined();

    // NÃO deve ter chaves f0, f1, f2, f3
    expect(firstRow?.f0).toBeUndefined();
    expect(firstRow?.f1).toBeUndefined();

    console.log(
      `✅ Gateway Produto: ${deserialized.rows.length} rows, hasMore=${deserialized.hasMore}, total=${deserialized.totalRecords}`,
    );
    console.log('Primeira row:', JSON.stringify(firstRow));
  });

  it('Gateway: deserializeRows com TipoNegociacao', async () => {
    const http = getHttpClient(client);
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

    const deserialized = deserializeRows(result);

    expect(deserialized.rows.length).toBeGreaterThan(0);

    const firstRow = deserialized.rows[0];
    expect(firstRow?.CODTIPVENDA).toBeDefined();
    expect(firstRow?.DESCRTIPVENDA).toBeDefined();

    console.log(
      `✅ Gateway TipoNegociacao: ${deserialized.rows.length} rows, hasMore=${deserialized.hasMore}`,
    );
    console.log('Primeira row:', JSON.stringify(firstRow));
  });

  it('Gateway: deserializeRows com paginação (offsetPage diferente)', async () => {
    const http = getHttpClient(client);

    // Buscar página 1 (segunda página) para validar paginação Gateway
    const result = await http.gatewayCall<Record<string, unknown>>(
      'mge',
      'CRUDServiceProvider.loadRecords',
      {
        dataSet: {
          rootEntity: 'Produto',
          includePresentationFields: 'N',
          offsetPage: '1',
          criteria: {
            expression: "this.ATIVO = 'S'",
          },
          entity: {
            fieldset: { list: 'CODPROD,DESCRPROD' },
          },
        },
      },
    );

    const deserialized = deserializeRows(result);
    expect(deserialized.rows.length).toBeGreaterThan(0);
    expect(deserialized.page).toBe(1);

    // Verificar que os campos estão mapeados
    expect(deserialized.rows[0]?.CODPROD).toBeDefined();
    expect(deserialized.rows[0]?.DESCRPROD).toBeDefined();

    console.log(
      `✅ Gateway offsetPage=1: ${deserialized.rows.length} rows, page=${deserialized.page}, hasMore=${deserialized.hasMore}`,
    );
  });
});
