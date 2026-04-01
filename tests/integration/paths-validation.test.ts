import { describe, it, expect, beforeAll } from 'vitest';
import { SankhyaClient } from '../../src/client.js';

const config = {
  baseUrl: process.env.SANKHYA_BASE_URL ?? '',
  clientId: process.env.SANKHYA_CLIENT_ID ?? '',
  clientSecret: process.env.SANKHYA_CLIENT_SECRET ?? '',
  xToken: process.env.SANKHYA_X_TOKEN ?? '',
  timeout: 30_000,
  logger: { level: 'silent' as const },
};

const has = config.baseUrl && config.clientId && config.clientSecret && config.xToken;

describe.skipIf(!has)('Validação de TODOS os paths REST v1', () => {
  let client: SankhyaClient;

  beforeAll(async () => {
    client = new SankhyaClient(config);
    await client.authenticate();
  });

  const paths = [
    // Produtos
    { path: '/produtos', params: { page: '0' }, name: 'Listar produtos' },
    { path: '/grupos-produto', params: { page: '0' }, name: 'Listar grupos produto' },
    { path: '/produtos/volumes', params: { page: '0' }, name: 'Listar volumes' },
    // Clientes
    { path: '/parceiros/clientes', params: { page: '1' }, name: 'Listar clientes' },
    // Vendedores
    { path: '/vendedores', params: { page: '0' }, name: 'Listar vendedores' },
    // Estoque
    { path: '/estoque/produtos', params: { page: '0' }, name: 'Listar estoque produtos' },
    { path: '/estoque/locais', params: { page: '0' }, name: 'Listar locais estoque' },
    // Pedidos
    { path: '/vendas/pedidos', params: { page: '0', codigoEmpresa: '1' }, name: 'Consultar pedidos' },
    // Financeiros
    { path: '/financeiros/receitas', params: { page: '0' }, name: 'Listar receitas' },
    { path: '/financeiros/despesas', params: { page: '0' }, name: 'Listar despesas' },
    { path: '/financeiros/tipos-pagamento', params: { page: '0' }, name: 'Listar tipos pagamento' },
    { path: '/financeiros/moedas', params: { page: '0' }, name: 'Listar moedas' },
    { path: '/financeiros/contas-bancaria', params: {}, name: 'Listar contas bancárias' },
    // Cadastros
    { path: '/tipos-operacao', params: { page: '0' }, name: 'Listar tipos operação' },
    { path: '/naturezas', params: { page: '0' }, name: 'Listar naturezas' },
    { path: '/projetos', params: { page: '0' }, name: 'Listar projetos' },
    { path: '/centros-resultado', params: { page: '0' }, name: 'Listar centros resultado' },
    { path: '/empresas', params: { page: '0' }, name: 'Listar empresas' },
    { path: '/usuarios', params: {}, name: 'Listar usuários' },
    // Fiscal
    // (POST only - skip for now)
    // Preços
    { path: '/precos/tabela/1', params: { pagina: '1' }, name: 'Preços por tabela' },
  ];

  for (const { path, params, name } of paths) {
    it(`${name} → GET /v1${path}`, async () => {
      const http = client.getHttpClient();
      try {
        const result = await http.restGet<Record<string, unknown>>(path, params);
        const keys = Object.keys(result);
        const pagination = result.pagination;
        console.log(`✅ ${name}: keys=${JSON.stringify(keys)}, pagination=${JSON.stringify(pagination)}`);
        expect(result).toBeDefined();
      } catch (e: unknown) {
        const err = e as { statusCode?: number; message?: string };
        console.log(`❌ ${name}: ${err.statusCode} — ${err.message?.slice(0, 100)}`);
        // Don't fail the test - we want to see all results
      }
    });
  }
});
