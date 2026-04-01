import { describe, it, expect, beforeAll } from 'vitest';
import { SankhyaClient } from '../../src/client.js';
import {
  extractRestData,
  normalizeRestPagination,
} from '../../src/core/pagination.js';
import { deserializeRows } from '../../src/core/gateway-serializer.js';

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

  const restEndpoints = [
    { path: '/produtos', name: 'Produtos' },
    { path: '/grupos-produto', name: 'Grupos Produto' },
    { path: '/parceiros/clientes', name: 'Clientes', params: { page: '1' } },
    { path: '/vendedores', name: 'Vendedores' },
    { path: '/estoque/locais', name: 'Locais Estoque' },
    { path: '/financeiros/tipos-pagamento', name: 'Tipos Pagamento' },
    { path: '/financeiros/moedas', name: 'Moedas' },
    { path: '/tipos-operacao', name: 'Tipos Operação' },
    { path: '/naturezas', name: 'Naturezas' },
    { path: '/projetos', name: 'Projetos' },
    { path: '/centros-resultado', name: 'Centros Resultado' },
    { path: '/empresas', name: 'Empresas' },
  ];

  for (const { path, name, params } of restEndpoints) {
    it(`REST: extractRestData + normalizeRestPagination — ${name}`, async () => {
      const http = client.getHttpClient();
      const rawResponse = await http.restGet<Record<string, unknown>>(
        path,
        params ?? { page: '0' },
      );

      // extractRestData deve encontrar o array de dados e o pagination
      const { data, pagination } = extractRestData(rawResponse);

      // Deve ter encontrado dados (array)
      expect(Array.isArray(data)).toBe(true);

      // normalizeRestPagination deve funcionar
      const paginated = normalizeRestPagination(data, pagination);
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
    const http = client.getHttpClient();
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
    const http = client.getHttpClient();

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
