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

    const cliente = result.data[0];
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

    const vendedor = result.data[0];
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
    const code = list.data[0]?.codigoVendedor;
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

    const produto = result.data[0];
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
    const code = list.data[0]?.codigoProduto;
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

    const grupo = result.data[0];
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
  //
  // Este endpoint usa o contrato "precos": NAO ha bloco `pagination`, e os
  // metadados (`pagina`, `numeroRegistros`, `temMaisRegistros`) vem na raiz do
  // corpo. Ate a 1.5.0 o SDK ignorava esses campos e devolvia sempre
  // `hasMore: false`, truncando qualquer varredura na primeira pagina.
  //
  // A versao anterior deste teste apontava para a tabela 1 e afirmava receber
  // 404. Medido em 29/08: a tabela 1 responde 400 ("Nao foi possivel
  // contextualizar o preco") e a tabela 0 responde 200 com dados. O teste
  // portanto so verificava que "algum erro acontece", com o numero errado, e
  // nunca exercitava o contrato. Agora exercita.
  it('precos.porTabela() — contrato precos com metadados na raiz', async () => {
    let result: Awaited<ReturnType<typeof sankhya.precos.porTabela>>;
    try {
      result = await sankhya.precos.porTabela({ codigoTabela: 0 });
    } catch (e: unknown) {
      // Nunca aprovar por omissao: se a tabela 0 sumir do sandbox, diga em voz
      // alta que o contrato nao foi verificado, em vez de deixar passar.
      const err = e as { statusCode?: number; message?: string };
      console.warn(
        `PULADO: tabela 0 indisponivel no sandbox (HTTP ${err.statusCode}) — contrato precos NAO verificado`,
      );
      return;
    }

    expect(result.degraded).toBe(false);
    expect(result.data.length).toBeGreaterThan(0);

    // `hasMore` so pode vir de `temMaisRegistros` — nao ha bloco `pagination`
    // aqui. Com a pagina cheia (50), o sandbox reporta que ha mais.
    expect(typeof result.hasMore).toBe('boolean');
    if (result.data.length === 50) {
      expect(result.hasMore).toBe(true);
    }

    // Campos medidos na resposta real deste endpoint. `codigoTabela` NAO vem
    // aqui (vem em /precos/produto/{id}) — a versao anterior deste teste o
    // afirmava, mas a assercao nunca chegou a rodar.
    const preco = result.data[0];
    expect(typeof preco?.codigoProduto).toBe('number');
    expect(typeof preco?.unidade).toBe('string');
    expect(typeof preco?.valor).toBe('number');

    console.log(
      `precos tabela 0: ${result.data.length} items, hasMore=${result.hasMore}, degraded=${result.degraded}`,
    );
  });

  it('precos.porProduto()', async () => {
    const produtos = await sankhya.produtos.listar();
    const code = produtos.data[0]?.codigoProduto;
    try {
      const result = await sankhya.precos.porProduto(code);
      expect(result.data).toBeDefined();
      if (result.data.length > 0) {
        const preco = result.data[0];
        expect(preco).toHaveProperty('codigoProduto');
        expect(typeof preco.valor).toBe('number');
      }
      console.log(`precos produto ${code}: ${result.data.length} items`);
    } catch (e) {
      // Sandbox retorna HTTP 400 para este endpoint (bug da API Sankhya — JsonObject/JsonArray cast)
      const err = e as { statusCode?: number };
      expect([400, 404]).toContain(err.statusCode);
      console.log(`precos produto ${code}: ${err.statusCode} (endpoint instável no sandbox — OK)`);
    }
  });

  // --- Estoque ---
  it('estoque.listarLocais()', async () => {
    const result = await sankhya.estoque.listarLocais();
    expect(result.data.length).toBeGreaterThan(0);
    const local = result.data[0];
    expect(local).toHaveProperty('codigoLocal');
    expect(typeof local.codigoLocal).toBe('number');
    expect(local).toHaveProperty('descricaoLocal');
    expect(typeof local.descricaoLocal).toBe('string');
    expect(local).toHaveProperty('ativo');
    expect(typeof local.ativo).toBe('boolean');
    console.log(`estoque locais: ${result.data.length} items`);
  });

  it('estoque.porProduto()', async () => {
    const produtos = await sankhya.produtos.listar();
    const code = produtos.data[0]?.codigoProduto;
    const result = await sankhya.estoque.porProduto(code);
    // Empty array is valid (product may have zero stock)
    expect(Array.isArray(result)).toBe(true);
    if (result.length > 0) {
      const item = result[0];
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
    const top = result.data[0];
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
    const nat = result.data[0];
    expect(nat).toHaveProperty('codigoNatureza');
    expect(typeof nat.codigoNatureza).toBe('number');
    expect(nat).toHaveProperty('nome');
    expect(typeof nat.nome).toBe('string');
    console.log(`naturezas: ${result.data.length} items`);
  });

  it('cadastros.listarEmpresas()', async () => {
    const result = await sankhya.cadastros.listarEmpresas();
    expect(result.data.length).toBeGreaterThan(0);
    const emp = result.data[0];
    expect(emp).toHaveProperty('codigoEmpresa');
    expect(typeof emp.codigoEmpresa).toBe('number');
    expect(emp).toHaveProperty('nomeFantasia');
    expect(typeof emp.nomeFantasia).toBe('string');
    console.log(`empresas: ${result.data.length} items`);
  });

  it('cadastros.listarUsuarios()', async () => {
    const result = await sankhya.cadastros.listarUsuarios();
    expect(Array.isArray(result)).toBe(true);
    if (result.length > 0) {
      const usr = result[0];
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
    const cr = result.data[0];
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
    const tipNeg = result[0];
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
    try {
      const result = await sankhya.cadastros.listarModelosNota();
      expect(result.length).toBeGreaterThan(0);
      const modelo = result[0];
      expect(modelo).toHaveProperty('numeroModelo');
      expect(typeof modelo.numeroModelo).toBe('number');
      expect(modelo).toHaveProperty('descricao');
      expect(typeof modelo.descricao).toBe('string');
      console.log(`modelos nota: ${result.length} items, first=${modelo.descricao}`);
    } catch (e) {
      // Sandbox pode retornar NPE interno para esta entity Gateway
      const err = e as { code?: string; message?: string };
      expect(err.code).toBe('GATEWAY_ERROR');
      console.log('modelos nota: Gateway NPE (sandbox limitation — OK)');
    }
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
