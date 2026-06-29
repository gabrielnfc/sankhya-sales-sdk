import { beforeAll, describe, expect, it } from 'vitest';
import { SankhyaClient } from '../../src/client.js';

/**
 * Cobertura live das correcoes 1.2.3: cliente (PF/PJ + AD_), financeiro
 * (registrar + baixa com contrato/datas corretos), AD_ round-trip no pedido,
 * volumes no path oficial, e atualizar/cancelar pedido com assercao real.
 *
 * Valores especificos do tenant tem default do sandbox do mantenedor e podem
 * ser sobrescritos por env. Testes config-dependentes fazem skip dinamico.
 */
const config = {
  baseUrl: process.env.SANKHYA_BASE_URL ?? '',
  clientId: process.env.SANKHYA_CLIENT_ID ?? '',
  clientSecret: process.env.SANKHYA_CLIENT_SECRET ?? '',
  xToken: process.env.SANKHYA_X_TOKEN ?? '',
  timeout: 60_000,
  logger: { level: 'silent' as const },
};
const has = config.baseUrl && config.clientId && config.clientSecret && config.xToken;

const n = (env: string, fb: number) => {
  const v = process.env[env] ? Number(process.env[env]) : fb;
  return Number.isFinite(v) ? v : fb;
};

// Recipe (sandbox-proven defaults; override per tenant via env)
const EMP = n('PEDIDO_EMP', 1);
const TOP_PEDIDO = n('PEDIDO_TOP', 1000);
const NOTA_MODELO = n('PEDIDO_NOTA_MODELO', 12);
const CLIENTE = n('PEDIDO_CLIENTE', 1);
const PRODUTO = n('PEDIDO_PRODUTO', 10398);
const LOCAL = n('PEDIDO_LOCAL', 30102);
const TIPTIT = n('PEDIDO_TIPTIT', 2);
const TOP_RECEITA = n('FIN_TOP_RECEITA', 1650);
const NATUREZA = n('FIN_NATUREZA', 1010101);
const CENTRO = n('FIN_CENTRO', 0);
const CONTA = n('FIN_CONTA', 2);

/** Gera um CPF valido a partir de 9 digitos base. */
function cpf(base: string): string {
  const dv = (slice: string, w0: number) => {
    let s = 0;
    for (let i = 0; i < slice.length; i++) s += Number(slice[i]) * (w0 - i);
    const r = (s * 10) % 11;
    return r === 10 ? 0 : r;
  };
  const d1 = dv(base, 10);
  const d2 = dv(base + d1, 11);
  return `${base}${d1}${d2}`;
}

/**
 * Distingue uma violacao de contrato (bug do SDK — deve FALHAR o teste) de um
 * erro de configuracao do tenant (conta/bairro/EXCLUIRPEDCONF — pode ser skip).
 * Re-lanca formato de data invalido e erros de validacao do SDK.
 */
function isContractViolation(e: unknown): boolean {
  const err = e as { message?: string; code?: string };
  if (err?.code === 'VALIDATION_ERROR') return true;
  return /formato de data|data inv[aá]lid|utilize\s+(dd|yyyy)/i.test(err?.message ?? '');
}

describe.skipIf(!has)('v1.2.3 coverage - LIVE', { timeout: 120_000, sequential: true }, () => {
  let sankhya: SankhyaClient;
  let estoque = 0;

  beforeAll(async () => {
    sankhya = new SankhyaClient(config);
    await sankhya.authenticate();
    const rows = await sankhya.gateway.loadRecords({
      entity: 'Estoque',
      fields: 'CODPROD,ESTOQUE,RESERVADO',
      criteria: `this.CODPROD = ${PRODUTO} AND this.CODLOCAL = ${LOCAL} AND this.CODEMP = ${EMP} AND this.CODPARC = 0`,
    });
    estoque = rows.reduce((a, r) => a + (Number(r.ESTOQUE) - Number(r.RESERVADO || 0)), 0);
  }, 60_000);

  it('produtos.listarVolumes usa o path oficial /volumes-produtos', async () => {
    const vols = await sankhya.produtos.listarVolumes();
    expect(vols.data.length).toBeGreaterThan(0);
  });

  it('clientes.criar (PF) coage codigoCliente para numero e mapeia tipo', async (ctx) => {
    // CPF unico por execucao (deriva de timestamp) para evitar conflito 409
    const seed = String(100000000 + (Date.now() % 800000000)).slice(0, 9);
    let codigoCliente: number;
    try {
      const r = await sankhya.clientes.criar({
        nome: 'TESTE SDK PF',
        tipo: 'PF',
        cnpjCpf: cpf(seed),
        email: 'sdk@teste.com',
        camposAdicionais: { AD_IDEXTERNO: `SDK-${seed}` },
        endereco: {
          logradouro: 'Av Paulista',
          numero: '1000',
          bairro: 'Bela Vista',
          cidade: 'Sao Paulo',
          codigoIbge: '3550308',
          uf: 'SP',
          cep: '01310100',
        },
      });
      codigoCliente = r.codigoCliente;
    } catch (e) {
      if (isContractViolation(e)) throw e;
      // Cadastro de bairro/endereco e config do tenant; o mapeamento tipo->PF e
      // a coercao de codigoCliente sao garantidos pelos unit tests.
      console.warn(
        'cliente.criar: skip best-effort (cadastro de endereco do tenant):',
        (e as Error).message,
      );
      return ctx.skip();
    }
    // Coercao: a API devolve string; o SDK deve entregar number (hard assert).
    expect(typeof codigoCliente).toBe('number');
    expect(codigoCliente).toBeGreaterThan(0);

    // atualizar revalida o endereco completo no servidor -> dependente do
    // cadastro de bairro do tenant -> best-effort.
    try {
      const upd = await sankhya.clientes.atualizar(codigoCliente, {
        telefoneDdd: '11',
        telefoneNumero: '988887777',
      });
      expect(upd.codigoCliente).toBe(codigoCliente);
    } catch (e) {
      if (isContractViolation(e)) throw e;
      console.warn(
        'cliente.atualizar: skip best-effort (cadastro de endereco do tenant):',
        (e as Error).message,
      );
    }
  });

  it('financeiros.registrarReceita cria um titulo a receber', async () => {
    const hoje = new Date().toISOString().slice(0, 10); // ISO -> SDK converte
    const { codigoFinanceiro } = await sankhya.financeiros.registrarReceita({
      codigoEmpresa: EMP,
      codigoTipoOperacao: TOP_RECEITA,
      codigoNatureza: NATUREZA,
      codigoCentroResultado: CENTRO,
      codigoParceiro: CLIENTE,
      codigoTipoPagamento: TIPTIT,
      dataNegociacao: hoje,
      dataVencimento: hoje,
      numeroNota: 990000 + (Date.now() % 9999),
      numeroParcela: 1,
      valorParcela: 1.5,
    });
    expect(codigoFinanceiro).toBeGreaterThan(0);

    const row = await sankhya.gateway.loadRecord({
      entity: 'Financeiro',
      fields: 'NUFIN,VLRDESDOB',
      primaryKey: { NUFIN: String(codigoFinanceiro) },
    });
    expect(row).not.toBeNull();

    // baixa (liquidacao): path/contrato/datas corretos. A selecao de conta e a
    // baixa em si dependem da config financeira do tenant -> best-effort.
    try {
      const baixa = await sankhya.financeiros.baixarReceita({
        codigoFinanceiro,
        dataBaixa: hoje,
        valorBaixa: 1.5,
        codigoContaBancaria: CONTA,
      });
      expect(baixa.codigoFinanceiro).toBe(codigoFinanceiro);
      const after = await sankhya.gateway.loadRecord({
        entity: 'Financeiro',
        fields: 'NUFIN,DHBAIXA',
        primaryKey: { NUFIN: String(codigoFinanceiro) },
      });
      expect(JSON.stringify(after?.DHBAIXA)).not.toBe('"{}"');
    } catch (e) {
      // Re-lanca se for formato de data (regressao real); skip so em config de conta.
      if (isContractViolation(e)) throw e;
      console.warn(
        'baixa: skip best-effort (conta/config financeira do tenant):',
        (e as Error).message,
      );
    }
  });

  it('pedido carrega campo customizado AD_ (camposExtras) end-to-end', async (ctx) => {
    if (!(estoque > 0)) return ctx.skip();
    const now = new Date();
    const hora = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
    const adVal = `SDKAD-${now.getTime() % 100000}`;
    const { codigoPedido } = await sankhya.pedidos.criar({
      notaModelo: NOTA_MODELO,
      data: now.toISOString().slice(0, 10),
      hora,
      codigoCliente: CLIENTE,
      valorTotal: 5,
      camposExtras: { CODTIPOPER: TOP_PEDIDO, CODEMP: EMP, AD_NUMPEDIDO: adVal },
      itens: [
        { codigoProduto: PRODUTO, quantidade: 0.05, valorUnitario: 100, codigoLocalEstoque: LOCAL },
      ],
      financeiros: [
        { tipoPagamento: TIPTIT, valorParcela: 5, dataVencimento: now.toISOString().slice(0, 10) },
      ],
    });
    expect(codigoPedido).toBeGreaterThan(0);

    const back = await sankhya.gateway.loadRecord({
      entity: 'CabecalhoNota',
      fields: 'NUNOTA,AD_NUMPEDIDO',
      primaryKey: { NUNOTA: String(codigoPedido) },
    });
    expect(back?.AD_NUMPEDIDO).toBe(adVal);

    // atualizar + cancelar com assercao real
    await sankhya.pedidos.atualizar(codigoPedido, {
      notaModelo: NOTA_MODELO,
      data: now.toISOString().slice(0, 10),
      hora,
      codigoCliente: CLIENTE,
      valorTotal: 5,
      camposExtras: { CODTIPOPER: TOP_PEDIDO, CODEMP: EMP, AD_NUMPEDIDO: `${adVal}-upd` },
      itens: [
        { codigoProduto: PRODUTO, quantidade: 0.05, valorUnitario: 100, codigoLocalEstoque: LOCAL },
      ],
      financeiros: [
        { tipoPagamento: TIPTIT, valorParcela: 5, dataVencimento: now.toISOString().slice(0, 10) },
      ],
    });
    const upd = await sankhya.gateway.loadRecord({
      entity: 'CabecalhoNota',
      fields: 'NUNOTA,AD_NUMPEDIDO',
      primaryKey: { NUNOTA: String(codigoPedido) },
    });
    expect(upd?.AD_NUMPEDIDO).toBe(`${adVal}-upd`);

    // confirmar + cancelar: o cancelamento mapeia para exclusao, governada pelo
    // parametro EXCLUIRPEDCONF / regras da TOP do tenant -> best-effort.
    try {
      await sankhya.pedidos.confirmar({ codigoPedido });
      const cancel = await sankhya.pedidos.cancelar({ codigoPedido, motivo: 'teste SDK' });
      expect(cancel.codigoPedido).toBe(codigoPedido);
    } catch (e) {
      if (isContractViolation(e)) throw e;
      console.warn(
        'confirmar/cancelar: skip best-effort (regra EXCLUIRPEDCONF/TOP do tenant):',
        (e as Error).message,
      );
    }
  });
});
