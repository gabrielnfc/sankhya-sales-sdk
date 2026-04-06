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

describe.skipIf(!has)('Resources — Validação contra Sandbox', () => {
  let sankhya: SankhyaClient;

  beforeAll(async () => {
    sankhya = new SankhyaClient(config);
    await sankhya.authenticate();
  });

  // --- Clientes ---
  it('clientes.listar()', async () => {
    const result = await sankhya.clientes.listar({ page: 1 });
    expect(result.data.length).toBeGreaterThan(0);

    const cliente = result.data[0]!;
    expect(cliente).toHaveProperty('codigoCliente');
    expect(cliente).toHaveProperty('nome');
    expect(typeof cliente.nome).toBe('string');
    expect(cliente).toHaveProperty('tipo');
    expect(['F', 'J']).toContain(cliente.tipo);
    expect(cliente).toHaveProperty('cnpjCpf');
    expect(typeof cliente.cnpjCpf).toBe('string');
    expect(cliente).toHaveProperty('endereco');
    expect(typeof cliente.endereco).toBe('object');
    expect(typeof result.hasMore).toBe('boolean');
    expect(typeof result.page).toBe('number');

    console.log(`clientes: ${result.data.length} items, hasMore=${result.hasMore}`);
  });

  // --- Vendedores ---
  it('vendedores.listar()', async () => {
    const result = await sankhya.vendedores.listar();
    expect(result.data.length).toBeGreaterThan(0);

    const vendedor = result.data[0]!;
    expect(vendedor).toHaveProperty('codigoVendedor');
    expect(typeof vendedor.codigoVendedor).toBe('number');
    expect(vendedor).toHaveProperty('nome');
    expect(typeof vendedor.nome).toBe('string');
    expect(vendedor).toHaveProperty('ativo');
    expect(typeof vendedor.ativo).toBe('boolean');
    expect(vendedor).toHaveProperty('tipo');

    console.log(`vendedores: ${result.data.length} items, hasMore=${result.hasMore}`);
  });

  it('vendedores.buscar()', async () => {
    const list = await sankhya.vendedores.listar();
    const code = list.data[0]!.codigoVendedor;
    const vendedor = await sankhya.vendedores.buscar(code);
    expect(vendedor.codigoVendedor).toBe(code);
    expect(typeof vendedor.nome).toBe('string');
    expect(vendedor).toHaveProperty('ativo');
    console.log(`vendedores.buscar(${code}): ${vendedor.nome}`);
  });

  // --- Produtos ---
  it('produtos.listar()', async () => {
    const result = await sankhya.produtos.listar();
    expect(result.data.length).toBeGreaterThan(0);

    const produto = result.data[0]!;
    expect(produto).toHaveProperty('codigoProduto');
    expect(typeof produto.codigoProduto).toBe('number');
    expect(produto).toHaveProperty('nome');
    expect(typeof produto.nome).toBe('string');
    expect(produto).toHaveProperty('volume');
    expect(typeof produto.volume).toBe('string');
    expect(produto).toHaveProperty('ativo');
    expect(typeof produto.ativo).toBe('boolean');

    console.log(`produtos: ${result.data.length} items, hasMore=${result.hasMore}`);
  });

  it('produtos.buscar()', async () => {
    const list = await sankhya.produtos.listar();
    const code = list.data[0]!.codigoProduto;
    const produto = await sankhya.produtos.buscar(code);
    expect(produto.codigoProduto).toBe(code);
    expect(typeof produto.nome).toBe('string');
    expect(produto).toHaveProperty('ativo');
    expect(produto).toHaveProperty('volume');
    console.log(`produtos.buscar(${code}): ${produto.nome}`);
  });

  it('produtos.listarGrupos()', async () => {
    const result = await sankhya.produtos.listarGrupos();
    expect(result.data.length).toBeGreaterThan(0);

    const grupo = result.data[0]!;
    expect(grupo).toHaveProperty('codigoGrupoProduto');
    expect(typeof grupo.codigoGrupoProduto).toBe('number');
    expect(grupo).toHaveProperty('nome');
    expect(typeof grupo.nome).toBe('string');
    expect(grupo).toHaveProperty('analitico');
    expect(typeof grupo.analitico).toBe('boolean');
    expect(grupo).toHaveProperty('ativo');
    expect(typeof grupo.ativo).toBe('boolean');

    console.log(`grupos-produto: ${result.data.length} items`);
  });

  // --- Preços ---
  it('precos.porTabela()', async () => {
    try {
      const result = await sankhya.precos.porTabela({ codigoTabela: 1 });
      expect(result.data).toBeDefined();
      console.log(`precos tabela 1: ${result.data.length} items`);
    } catch (e: unknown) {
      // Tabela 1 pode não existir no sandbox — 404 é esperado
      const err = e as { statusCode?: number };
      expect(err.statusCode).toBe(404);
      console.log('precos tabela 1: 404 (tabela não existe no sandbox — OK)');
    }
  });

  // --- Estoque ---
  it('estoque.listarLocais()', async () => {
    const result = await sankhya.estoque.listarLocais();
    expect(result.data.length).toBeGreaterThan(0);
    console.log(`estoque locais: ${result.data.length} items`);
  });

  // --- Financeiros ---
  it('financeiros.listarTiposPagamento()', async () => {
    const result = await sankhya.financeiros.listarTiposPagamento();
    expect(result.data.length).toBeGreaterThan(0);
    console.log(`tipos pagamento: ${result.data.length} items`);
  });

  it('financeiros.listarMoedas()', async () => {
    const result = await sankhya.financeiros.listarMoedas();
    expect(result.data.length).toBeGreaterThan(0);
    console.log(`moedas: ${result.data.length} items`);
  });

  it('financeiros.listarContasBancarias()', async () => {
    const result = await sankhya.financeiros.listarContasBancarias();
    expect(Array.isArray(result)).toBe(true);
    console.log(`contas bancárias: ${result.length} items`);
  });

  // --- Cadastros ---
  it('cadastros.listarTiposOperacao()', async () => {
    const result = await sankhya.cadastros.listarTiposOperacao();
    expect(result.data.length).toBeGreaterThan(0);
    console.log(`tipos operação: ${result.data.length} items`);
  });

  it('cadastros.listarNaturezas()', async () => {
    const result = await sankhya.cadastros.listarNaturezas();
    expect(result.data.length).toBeGreaterThan(0);
    console.log(`naturezas: ${result.data.length} items`);
  });

  it('cadastros.listarEmpresas()', async () => {
    const result = await sankhya.cadastros.listarEmpresas();
    expect(result.data.length).toBeGreaterThan(0);
    console.log(`empresas: ${result.data.length} items`);
  });

  it('cadastros.listarUsuarios()', async () => {
    const result = await sankhya.cadastros.listarUsuarios();
    expect(Array.isArray(result)).toBe(true);
    console.log(`usuarios: ${result.length} items`);
  });

  it('cadastros.listarCentrosResultado()', async () => {
    const result = await sankhya.cadastros.listarCentrosResultado();
    expect(result.data.length).toBeGreaterThan(0);
    console.log(`centros resultado: ${result.data.length} items`);
  });

  // --- Gateway CRUD ---
  it('gateway.loadRecords()', async () => {
    const rows = await sankhya.gateway.loadRecords({
      entity: 'Produto',
      fields: 'CODPROD,DESCRPROD,CODVOL,ATIVO',
      criteria: "this.ATIVO = 'S'",
      page: 0,
    });
    expect(rows.length).toBeGreaterThan(0);
    expect(rows[0]?.CODPROD).toBeDefined();
    expect(rows[0]?.DESCRPROD).toBeDefined();
    console.log(`gateway loadRecords: ${rows.length} rows, first=${rows[0]?.DESCRPROD}`);
  });

  // --- Gateway: Tipos de Negociação (sem REST v1) ---
  it('cadastros.listarTiposNegociacao()', async () => {
    const result = await sankhya.cadastros.listarTiposNegociacao();
    expect(result.length).toBeGreaterThan(0);
    expect(result[0]?.codigoTipoNegociacao).toBeDefined();
    console.log(`tipos negociação: ${result.length} items, first=${result[0]?.descricao}`);
  });

  // --- Paginator (async iterator) ---
  it('vendedores.listarTodos() — async iterator', async () => {
    let count = 0;
    for await (const vendedor of sankhya.vendedores.listarTodos()) {
      count++;
      if (count >= 55) break; // Pegar mais de 1 página (50/page)
    }
    expect(count).toBe(55);
    console.log(`vendedores listarTodos: ${count} iterados (2+ páginas)`);
  });
});
