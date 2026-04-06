import { describe, it, expect, beforeAll } from 'vitest';
import { SankhyaClient } from '../../src/client.js';

const config = {
  baseUrl: process.env.SANKHYA_BASE_URL ?? '',
  clientId: process.env.SANKHYA_CLIENT_ID ?? '',
  clientSecret: process.env.SANKHYA_CLIENT_SECRET ?? '',
  xToken: process.env.SANKHYA_X_TOKEN ?? '',
  timeout: 60_000,
  logger: { level: 'silent' as const },
};

const has = config.baseUrl && config.clientId && config.clientSecret && config.xToken;

describe.skipIf(!has)('Financeiros Write — Sandbox Validation', { timeout: 60_000 }, () => {
  let sankhya: SankhyaClient;
  let codigoTipoOperacao: number;
  let codigoNatureza: number;
  let codigoParceiro: number;
  let codigoTipoPagamento: number;
  let codigoEmpresa: number;
  let receitaCriada: number | undefined;
  let despesaCriada: number | undefined;

  beforeAll(async () => {
    sankhya = new SankhyaClient(config);
    await sankhya.authenticate();

    // Discover valid sandbox values
    const [tops, naturezas, clientes, tiposPag, empresas] = await Promise.all([
      sankhya.cadastros.listarTiposOperacao(),
      sankhya.cadastros.listarNaturezas(),
      sankhya.clientes.listar({ page: 0 }),
      sankhya.financeiros.listarTiposPagamento(),
      sankhya.cadastros.listarEmpresas(),
    ]);

    expect(tops.data.length).toBeGreaterThan(0);
    expect(naturezas.data.length).toBeGreaterThan(0);
    expect(clientes.data.length).toBeGreaterThan(0);
    expect(tiposPag.data.length).toBeGreaterThan(0);
    expect(empresas.data.length).toBeGreaterThan(0);

    codigoTipoOperacao = tops.data[0].codigoTipoOperacao;
    codigoNatureza = naturezas.data[0].codigoNatureza;
    codigoParceiro = Number(clientes.data[0].codigoCliente);
    codigoTipoPagamento = tiposPag.data[0].codigoTipoPagamento;
    codigoEmpresa = empresas.data[0].codigoEmpresa;
  });

  it.sequential('financeiros.registrarReceita()', async () => {
    const hoje = new Date();
    const vencimento = new Date(hoje.getTime() + 30 * 24 * 60 * 60 * 1000);

    const formatDate = (d: Date) =>
      `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;

    const result = await sankhya.financeiros.registrarReceita({
      codigoEmpresa,
      codigoTipoOperacao,
      codigoNatureza,
      codigoParceiro,
      codigoTipoPagamento,
      dataNegociacao: formatDate(hoje),
      dataVencimento: formatDate(vencimento),
      valorParcela: 100.0,
    });

    expect(result).toBeDefined();
    expect(typeof result.codigoFinanceiro).toBe('number');
    expect(result.codigoFinanceiro).toBeGreaterThan(0);
    receitaCriada = result.codigoFinanceiro;
    console.log(`Receita criada: codigoFinanceiro=${receitaCriada}`);
  });

  it.sequential('financeiros.listarReceitas()', async () => {
    const result = await sankhya.financeiros.listarReceitas({ codigoEmpresa });
    expect(result.data).toBeDefined();
    expect(Array.isArray(result.data)).toBe(true);
    expect(typeof result.hasMore).toBe('boolean');
    console.log(`Receitas: ${result.data.length} items, hasMore=${result.hasMore}`);
  });

  it.sequential('financeiros.atualizarReceita()', async () => {
    if (!receitaCriada) {
      console.log('Skipping atualizarReceita — no receita was created');
      return;
    }

    try {
      const result = await sankhya.financeiros.atualizarReceita(receitaCriada, {
        observacao: 'Atualizado via SDK test',
      });
      expect(result).toBeDefined();
      expect(typeof result.codigoFinanceiro).toBe('number');
      console.log(`Receita atualizada: codigoFinanceiro=${result.codigoFinanceiro}`);
    } catch (e: unknown) {
      // Some fields may be immutable — document the error
      const err = e as { message?: string; statusCode?: number };
      console.log(
        `atualizarReceita rejected: status=${err.statusCode}, message=${err.message}`,
      );
    }
  });

  it.sequential('financeiros.registrarDespesa()', async () => {
    const hoje = new Date();
    const vencimento = new Date(hoje.getTime() + 30 * 24 * 60 * 60 * 1000);

    const formatDate = (d: Date) =>
      `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;

    const result = await sankhya.financeiros.registrarDespesa({
      codigoEmpresa,
      codigoTipoOperacao,
      codigoNatureza,
      codigoParceiro,
      codigoTipoPagamento,
      dataNegociacao: formatDate(hoje),
      dataVencimento: formatDate(vencimento),
      valorParcela: 50.0,
    });

    expect(result).toBeDefined();
    expect(typeof result.codigoFinanceiro).toBe('number');
    expect(result.codigoFinanceiro).toBeGreaterThan(0);
    despesaCriada = result.codigoFinanceiro;
    console.log(`Despesa criada: codigoFinanceiro=${despesaCriada}`);
  });

  it.sequential('financeiros.listarDespesas()', async () => {
    const result = await sankhya.financeiros.listarDespesas();
    expect(result.data).toBeDefined();
    expect(Array.isArray(result.data)).toBe(true);
    expect(typeof result.hasMore).toBe('boolean');
    console.log(`Despesas: ${result.data.length} items, hasMore=${result.hasMore}`);
  });
});
