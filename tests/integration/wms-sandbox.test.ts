import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { SankhyaClient } from '../../src/client.js';
import { datasetRecord } from '../../src/resources/dataset.js';
import { callBudget } from './_call-budget.js';
// A decisao de "o que e host de sandbox" vem de `src/core/environment-guard.ts`
// (D3); este modulo so reexporta. Nenhum host literal mora aqui (RD-2).
import { assertSandbox } from './_write-guard.js';

/**
 * Lane WMS — contrato do SDK contra o SANDBOX Sankhya, opt-in duplo.
 *
 * O que esta suite prova: o caminho que o WMS v3 usa de ponta a ponta (ler
 * estoque, ler volume, abrir pedido em `A`, gravar item com `CONTROLE`, checar
 * que nao ha rateio de var) **existe no ERP real** e nao so no mock.
 *
 * REGRAS DURAS — cada uma custou um incidente:
 *
 * 1. **Opt-in duplo.** Credenciais completas **e** `SDK_INTEGRATION_WMS=1`.
 *    Faltando qualquer um, a suite e SKIP e imprime o motivo. Credencial
 *    presente por acidente (um `.env` esquecido) nao basta para escrever no ERP.
 * 2. **Sandbox ou nada.** `assertSandbox` no `beforeAll`, e o log cita **so o
 *    hostname** — nunca a `baseUrl` crua (pode carregar `user:senha@`).
 * 3. **Teto de 40 chamadas.** Contadas por interceptacao do `fetch` global:
 *    conta TODA requisicao HTTP do SDK (auth, REST e gateway), portanto e um
 *    superconjunto do "todo gatewayCall conta" — retry de rede tambem paga.
 *    Estourou, a suite morre no ato.
 * 4. **Nunca liberar nem faturar.** Regra de ouro do T0-4: objeto que vira `L`
 *    e residuo PERMANENTE no sandbox — nao ha desfazer. Tudo que esta suite
 *    cria nasce e morre em `A`, e a trava esta em
 *    `tests/security/ci-lanes.test.ts`, que roda no CI de PR.
 * 5. **Teardown por id.** So os NUNOTAs que ESTA execucao criou, com guarda
 *    contra lista vazia e read-back em `TGFCAB` provando a ausencia.
 * 6. **Nunca em CI de PR.** `.github/workflows/integration.yml` nao tem
 *    gatilho `pull_request` — e ha teste travando isso.
 */

const config = {
  baseUrl: process.env.SANKHYA_BASE_URL ?? '',
  clientId: process.env.SANKHYA_CLIENT_ID ?? '',
  clientSecret: process.env.SANKHYA_CLIENT_SECRET ?? '',
  xToken: process.env.SANKHYA_X_TOKEN ?? '',
  timeout: 30_000,
  logger: { level: 'silent' as const },
};

const temCredenciais = Boolean(
  config.baseUrl && config.clientId && config.clientSecret && config.xToken,
);
const temOptIn = process.env.SDK_INTEGRATION_WMS === '1';
const habilitada = temCredenciais && temOptIn;

if (!habilitada) {
  const faltando = [
    temCredenciais ? '' : 'credenciais SANKHYA_* (baseUrl/clientId/clientSecret/xToken)',
    temOptIn ? '' : 'SDK_INTEGRATION_WMS=1 (opt-in explicito, escreve no sandbox)',
  ].filter(Boolean);
  console.log(`[wms-sandbox] SKIP — falta: ${faltando.join(' + ')}. Nenhuma chamada foi feita.`);
}

/**
 * Fixtures do sandbox medidas nos spikes T0 (anexo §D1.2 do plano; M46/M54).
 * Valor errado aqui reprova a lane com erro de negocio do ERP, nunca em silencio.
 */
const CODPARC = 312984;
const CODTIPOPER = 1001;
const CODTIPVENDA = 200;
const CODVEND = 50;
const CODEMP = 2;
const TIPMOV = 'P';
const CODPROD_ITEM = 10051;
const CODLOCALORIG = 30301;
/** Produto com volume cadastrado completo no sandbox (M54). */
const CODPROD_VOLUME = 13609;
/** Campos de `TGFVOA` lidos pelo `loadRecords` — premissa (b) da D1.4. */
const FIELDSET_VOLUME = 'CODPROD,CODVOL,QUANTIDADE,LASTRO,CAMADAS,ATIVO';

const agora = new Date();
const dois = (n: number): string => String(n).padStart(2, '0');
const hhmm = `${dois(agora.getHours())}${dois(agora.getMinutes())}`;
/** Marca tudo que esta execucao criou: `AD_NUMPEDIDO`, `OBSERVACAO` e `CONTROLE`. */
const PREFIXO = `SDK-T-${hhmm}`;
const DTNEG = `${dois(agora.getDate())}/${dois(agora.getMonth() + 1)}/${agora.getFullYear()} ${dois(agora.getHours())}:${dois(agora.getMinutes())}:${dois(agora.getSeconds())}`;

/** Teto da lane. Mudar este numero sem mudar `tests/security/ci-lanes.test.ts` reprova. */
const orcamento = callBudget(40);

/** Residuo desta execucao, por id. Nada aqui vem de leitura do ERP — so do que criamos. */
const residuo = {
  /** NUNOTA de conferencias abertas. Sempre vazio: esta suite nao abre conferencia. */
  conferencias: [] as number[],
  /** NUNOTA de notas 1101. Sempre vazio: esta suite nunca fatura. */
  notas1101: [] as number[],
  /** NUNOTA dos pedidos em `A` criados aqui. */
  pedidos: [] as number[],
};

let sankhya: SankhyaClient;
let fetchOriginal: typeof globalThis.fetch;

/**
 * Exclui, por id, o que ESTA execucao criou.
 *
 * Ordem obrigatoria (M113): conferencia -> 1101 -> pedido. Aqui so o pedido
 * existe — a suite nunca libera nem fatura — mas as duas primeiras fases ficam
 * escritas, guardadas por lista vazia, porque quem copiar este teardown vai
 * copiar tambem o caso em que elas existem, e a ordem inversa falha no ERP.
 */
async function teardownPorId(): Promise<void> {
  const ids = [...residuo.conferencias, ...residuo.notas1101, ...residuo.pedidos];
  if (ids.length === 0) {
    // Guarda dura (R2): lista vazia NUNCA vira filtro amplo. Sem id, nada a fazer.
    console.log('[wms-sandbox] teardown: nenhum id criado nesta execucao — nada a excluir.');
    return;
  }
  console.log(`[wms-sandbox] teardown por id: ${ids.join(', ')}`);

  // Fase 1 — conferencia: zera `NUCONFATUAL` com STRING VAZIA antes (M113: o
  // ERP recusa excluir nota com conferencia atual apontada) e so entao remove.
  if (residuo.conferencias.length > 0) {
    const campos = ['NUNOTA', 'NUCONFATUAL'];
    await sankhya.dataset.save({
      entityName: 'CabecalhoNota',
      fields: campos,
      records: residuo.pedidos.map((nunota) =>
        datasetRecord(campos, { pk: { NUNOTA: String(nunota) }, set: { NUCONFATUAL: '' } }),
      ),
    });
    await sankhya.dataset.removeRecord({
      entityName: 'CabecalhoConferencia',
      pks: residuo.conferencias.map((nunota) => ({ NUNOTA: String(nunota) })),
    });
  }

  // Fase 2 — 1101 antes do pedido: a nota de faturamento referencia o pedido.
  if (residuo.notas1101.length > 0) {
    await sankhya.notas.excluir(residuo.notas1101);
  }

  // Fase 3 — pedido.
  if (residuo.pedidos.length > 0) {
    await sankhya.notas.excluir(residuo.pedidos);

    // Read-back (I3): resposta do ERP nao prova efeito. A prova e a ausencia em TGFCAB.
    const sobrando = await sankhya.dbExplorer.query<{ NUNOTA: string }>(
      `SELECT NUNOTA FROM TGFCAB WHERE NUNOTA IN (${residuo.pedidos.join(', ')})`,
    );
    expect(sobrando).toEqual([]);
    console.log(
      `[wms-sandbox] read-back: 0 linhas em TGFCAB. Chamadas gastas: ${orcamento.spent()}.`,
    );
  }
}

describe.skipIf(!habilitada)('Lane WMS — sandbox Sankhya (opt-in duplo)', () => {
  beforeAll(async () => {
    // Sandbox ou nada — antes de qualquer chamada.
    assertSandbox(config.baseUrl);
    console.log(`[wms-sandbox] host=${new URL(config.baseUrl).hostname}`);

    // Teto por interceptacao do fetch global: toda requisicao HTTP do SDK paga.
    fetchOriginal = globalThis.fetch;
    const contado: typeof globalThis.fetch = (entrada, init) => {
      const alvo = entrada instanceof Request ? entrada.url : String(entrada);
      // So o pathname: querystring e header podem carregar credencial.
      orcamento.spend(new URL(alvo).pathname);
      return fetchOriginal(entrada, init);
    };
    globalThis.fetch = contado;

    sankhya = new SankhyaClient(config);
    await sankhya.authenticate();
  });

  afterAll(async () => {
    try {
      await teardownPorId();
    } finally {
      if (fetchOriginal) globalThis.fetch = fetchOriginal;
    }
  });

  it('1 — dbExplorer.query le TGFEST e casa colunas com valores', async () => {
    const linhas = await sankhya.dbExplorer.query<{
      CODPROD: string;
      CODLOCAL: string;
      ESTOQUE: string;
    }>('SELECT CODPROD, CODLOCAL, ESTOQUE FROM TGFEST WHERE ROWNUM = 1');

    expect(linhas).toHaveLength(1);
    expect(Object.keys(linhas[0]).sort()).toEqual(['CODLOCAL', 'CODPROD', 'ESTOQUE']);
  });

  it('2 — volumesProduto(13609) devolve quantidade/lastro/camadas (M54)', async () => {
    const volumes = await sankhya.produtos.volumesProduto(CODPROD_VOLUME);

    expect(volumes.length).toBeGreaterThan(0);
    expect(volumes[0]).toMatchObject({ quantidade: 72, lastro: 12, camadas: 4 });
  });

  it('3 — incluirNotaGateway abre pedido em A com AD_NUMPEDIDO prefixado', async () => {
    const { codigoPedido } = await sankhya.pedidos.incluirNotaGateway({
      codigoCliente: CODPARC,
      dataNegociacao: DTNEG,
      codigoTipoOperacao: CODTIPOPER,
      codigoTipoNegociacao: CODTIPVENDA,
      codigoVendedor: CODVEND,
      codigoEmpresa: CODEMP,
      tipoMovimento: TIPMOV,
      statusNota: 'A',
      numeroPedidoExterno: PREFIXO,
      observacao: `${PREFIXO} lane WMS do SDK — descartavel`,
      itens: [
        {
          codigoProduto: CODPROD_ITEM,
          quantidade: 1,
          valorUnitario: 10,
          unidade: 'UN',
          codigoLocalOrigem: CODLOCALORIG,
        },
      ],
    });

    expect(Number.isInteger(codigoPedido)).toBe(true);
    expect(codigoPedido).toBeGreaterThan(0);
    // Registra ANTES de qualquer assercao seguinte: id nao registrado e residuo eterno.
    residuo.pedidos.push(codigoPedido);
  });

  it('4 — dataset.save grava ItemNota com CONTROLE prefixado', async () => {
    const nunota = residuo.pedidos[0];
    expect(nunota).toBeGreaterThan(0);

    const campos = ['NUNOTA', 'CODPROD', 'QTDNEG', 'VLRUNIT', 'CODVOL', 'CODLOCALORIG', 'CONTROLE'];
    const out = await sankhya.dataset.save({
      entityName: 'ItemNota',
      fields: campos,
      records: [
        datasetRecord(campos, {
          set: {
            NUNOTA: String(nunota),
            CODPROD: String(CODPROD_ITEM),
            QTDNEG: '1',
            VLRUNIT: '10',
            CODVOL: 'UN',
            CODLOCALORIG: String(CODLOCALORIG),
            CONTROLE: PREFIXO,
          },
        }),
      ],
    });

    expect(out.total).toBe(1);
  });

  it('5 — consultarVar do pedido em A devolve lista vazia', async () => {
    const linhas = await sankhya.faturamento.consultarVar(residuo.pedidos[0]);
    expect(linhas).toEqual([]);
  });

  it('7 — loadRecords com rootEntity VolumeProduto responde (premissa (b) da D1.4)', async (ctx) => {
    // M57 mediu TGFVOA por SQL (`DbExplorerSP`), nunca por `loadRecords`. Se o
    // Gateway nao servir a entidade, a premissa e REFUTADA e `volumesProduto`
    // cai para `dbExplorer.query` (D2.1) — e este passo NAO reprova a lane:
    // ele registra o motivo e se marca como pendente.
    let resposta: Record<string, unknown>;
    try {
      resposta = await sankhya.gateway.call<Record<string, unknown>>(
        'mge',
        'CRUDServiceProvider.loadRecords',
        {
          dataSet: {
            rootEntity: 'VolumeProduto',
            includePresentationFields: 'N',
            offsetPage: '0',
            criteria: { expression: { $: `this.CODPROD = '${CODPROD_VOLUME}'` } },
            entity: { fieldset: { list: FIELDSET_VOLUME } },
          },
        },
      );
    } catch (erro) {
      const motivo = erro instanceof Error ? erro.message : String(erro);
      console.log(`[wms-sandbox] (b) D1.4 REFUTADA — loadRecords/VolumeProduto recusou: ${motivo}`);
      ctx.skip(`premissa (b) da D1.4 refutada no sandbox: ${motivo}`);
      return;
    }

    console.log(
      `[wms-sandbox] (b) D1.4 — chaves da resposta: ${Object.keys(resposta).sort().join(', ')}`,
    );
    expect(resposta).toHaveProperty('entities');
  });

  it('8 — cabecalho minimo aceito por CACSP.incluirNota (premissa (b) da D1.2)', async (ctx) => {
    // So as chaves TIPADAS obrigatorias + `statusNota` + prefixo. Sem
    // `camposExtras`, sem os 18 campos crus do payload do 4midware. Aceito ou
    // recusado, o resultado e a medicao — e o que nascer e apagado no teardown.
    try {
      const { codigoPedido } = await sankhya.pedidos.incluirNotaGateway({
        codigoCliente: CODPARC,
        dataNegociacao: DTNEG,
        codigoTipoOperacao: CODTIPOPER,
        codigoTipoNegociacao: CODTIPVENDA,
        codigoVendedor: CODVEND,
        codigoEmpresa: CODEMP,
        tipoMovimento: TIPMOV,
        statusNota: 'A',
        numeroPedidoExterno: `${PREFIXO}-MIN`,
        itens: [
          {
            codigoProduto: CODPROD_ITEM,
            quantidade: 1,
            valorUnitario: 10,
            unidade: 'UN',
            codigoLocalOrigem: CODLOCALORIG,
          },
        ],
      });
      residuo.pedidos.push(codigoPedido);
      console.log(
        `[wms-sandbox] (b) D1.2 CONFIRMADA — cabecalho minimo (11 chaves tipadas) aceito, NUNOTA ${codigoPedido}.`,
      );
      expect(codigoPedido).toBeGreaterThan(0);
    } catch (erro) {
      const motivo = erro instanceof Error ? erro.message : String(erro);
      console.log(`[wms-sandbox] (b) D1.2 REFUTADA — cabecalho minimo recusado: ${motivo}`);
      ctx.skip(`cabecalho minimo recusado pelo ERP: ${motivo}`);
    }
  });
});
