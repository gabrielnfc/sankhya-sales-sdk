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
    expect(typeof result.hasMore).toBe('boolean');
    console.log(`clientes: ${result.data.length} items, hasMore=${result.hasMore}`);
  });

  // --- Vendedores ---
  it('vendedores.listar()', async () => {
    const result = await sankhya.vendedores.listar();
    expect(result.data.length).toBeGreaterThan(0);
    console.log(`vendedores: ${result.data.length} items, hasMore=${result.hasMore}`);
  });

  // --- Produtos ---
  it('produtos.listar()', async () => {
    const result = await sankhya.produtos.listar();
    expect(result.data.length).toBeGreaterThan(0);
    console.log(`produtos: ${result.data.length} items, hasMore=${result.hasMore}`);
  });

  it('produtos.listarGrupos()', async () => {
    const result = await sankhya.produtos.listarGrupos();
    expect(result.data.length).toBeGreaterThan(0);
    console.log(`grupos-produto: ${result.data.length} items`);
  });

  // --- Preços ---
  it('precos.porTabela()', async () => {
    try {
      const result = await sankhya.precos.porTabela({ codigoTabela: 1 });
      expect(result.data).toBeDefined();
      if (result.data.length > 0) {
        const preco = result.data[0]!;
        expect(preco).toHaveProperty('codigoProduto');
        expect(typeof preco.codigoProduto).toBe('number');
        expect(preco).toHaveProperty('unidade');
        expect(typeof preco.unidade).toBe('string');
        expect(preco).toHaveProperty('codigoTabela');
        expect(typeof preco.codigoTabela).toBe('number');
        expect(preco).toHaveProperty('valor');
        expect(typeof preco.valor).toBe('number');
      }
      console.log(`precos tabela 1: ${result.data.length} items`);
    } catch (e: unknown) {
      // Tabela 1 pode não existir no sandbox — 404 é esperado
      const err = e as { statusCode?: number };
      expect(err.statusCode).toBe(404);
      console.log('precos tabela 1: 404 (tabela não existe no sandbox — OK)');
    }
  });

  it('precos.porProduto()', async () => {
    const produtos = await sankhya.produtos.listar();
    const code = produtos.data[0]!.codigoProduto;
    const result = await sankhya.precos.porProduto(code);
    expect(result.data).toBeDefined();
    if (result.data.length > 0) {
      const preco = result.data[0]!;
      expect(preco).toHaveProperty('codigoProduto');
      expect(preco.codigoProduto).toBe(code);
      expect(typeof preco.valor).toBe('number');
    }
    console.log(`precos produto ${code}: ${result.data.length} items`);
  });

  // --- Estoque ---
  it('estoque.listarLocais()', async () => {
    const result = await sankhya.estoque.listarLocais();
    expect(result.data.length).toBeGreaterThan(0);
    const local = result.data[0]!;
    expect(local).toHaveProperty('codigoLocal');
    expect(typeof local.codigoLocal).toBe('number');
    expect(local).toHaveProperty('nome');
    expect(typeof local.nome).toBe('string');
    expect(local).toHaveProperty('ativo');
    expect(typeof local.ativo).toBe('boolean');
    console.log(`estoque locais: ${result.data.length} items`);
  });

  it('estoque.porProduto()', async () => {
    const produtos = await sankhya.produtos.listar();
    const code = produtos.data[0]!.codigoProduto;
    const result = await sankhya.estoque.porProduto(code);
    // Empty array is valid (product may have zero stock)
    expect(Array.isArray(result)).toBe(true);
    if (result.length > 0) {
      const item = result[0]!;
      expect(item).toHaveProperty('codigoProduto');
      expect(typeof item.codigoProduto).toBe('number');
      expect(item).toHaveProperty('codigoEmpresa');
      expect(typeof item.estoque).toBe('number');
    }
    console.log(`estoque produto ${code}: ${result.length} locais`);
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
    const top = result.data[0]!;
    expect(top).toHaveProperty('codigoTipoOperacao');
    expect(typeof top.codigoTipoOperacao).toBe('number');
    expect(top).toHaveProperty('nome');
    expect(typeof top.nome).toBe('string');
    expect(top).toHaveProperty('ativo');
    expect(typeof top.ativo).toBe('boolean');
    console.log(`tipos operação: ${result.data.length} items`);
  });

  it('cadastros.listarNaturezas()', async () => {
    const result = await sankhya.cadastros.listarNaturezas();
    expect(result.data.length).toBeGreaterThan(0);
    const nat = result.data[0]!;
    expect(nat).toHaveProperty('codigoNatureza');
    expect(typeof nat.codigoNatureza).toBe('number');
    expect(nat).toHaveProperty('nome');
    expect(typeof nat.nome).toBe('string');
    console.log(`naturezas: ${result.data.length} items`);
  });

  it('cadastros.listarEmpresas()', async () => {
    const result = await sankhya.cadastros.listarEmpresas();
    expect(result.data.length).toBeGreaterThan(0);
    const emp = result.data[0]!;
    expect(emp).toHaveProperty('codigoEmpresa');
    expect(typeof emp.codigoEmpresa).toBe('number');
    expect(emp).toHaveProperty('nome');
    expect(typeof emp.nome).toBe('string');
    console.log(`empresas: ${result.data.length} items`);
  });

  it('cadastros.listarUsuarios()', async () => {
    const result = await sankhya.cadastros.listarUsuarios();
    expect(Array.isArray(result)).toBe(true);
    if (result.length > 0) {
      const usr = result[0]!;
      expect(usr).toHaveProperty('codigoUsuario');
      expect(typeof usr.codigoUsuario).toBe('number');
      expect(usr).toHaveProperty('nome');
      expect(typeof usr.nome).toBe('string');
    }
    console.log(`usuarios: ${result.length} items`);
  });

  it('cadastros.listarCentrosResultado()', async () => {
    const result = await sankhya.cadastros.listarCentrosResultado();
    expect(result.data.length).toBeGreaterThan(0);
    const cr = result.data[0]!;
    expect(cr).toHaveProperty('codigoCentroResultado');
    expect(typeof cr.codigoCentroResultado).toBe('number');
    expect(cr).toHaveProperty('nome');
    expect(typeof cr.nome).toBe('string');
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
    const tipNeg = result[0]!;
    expect(tipNeg).toHaveProperty('codigoTipoNegociacao');
    expect(typeof tipNeg.codigoTipoNegociacao).toBe('number');
    expect(tipNeg).toHaveProperty('descricao');
    expect(typeof tipNeg.descricao).toBe('string');
    expect(tipNeg).toHaveProperty('taxaJuro');
    expect(typeof tipNeg.taxaJuro).toBe('number');
    expect(tipNeg).toHaveProperty('ativo');
    expect(typeof tipNeg.ativo).toBe('boolean');
    console.log(`tipos negociação: ${result.length} items, first=${tipNeg.descricao}`);
  });

  // --- Gateway: Modelos de Nota ---
  it('cadastros.listarModelosNota()', async () => {
    const result = await sankhya.cadastros.listarModelosNota();
    expect(result.length).toBeGreaterThan(0);
    const modelo = result[0]!;
    expect(modelo).toHaveProperty('numeroModelo');
    expect(typeof modelo.numeroModelo).toBe('number');
    expect(modelo).toHaveProperty('descricao');
    expect(typeof modelo.descricao).toBe('string');
    expect(modelo).toHaveProperty('codigoTipoOperacao');
    expect(typeof modelo.codigoTipoOperacao).toBe('number');
    expect(modelo).toHaveProperty('codigoEmpresa');
    expect(typeof modelo.codigoEmpresa).toBe('number');
    console.log(`modelos nota: ${result.length} items, first=${modelo.descricao}`);
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
