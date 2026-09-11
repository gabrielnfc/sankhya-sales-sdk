import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { SankhyaClient } from '../../src/client.js';
import { datasetRecord } from '../../src/resources/dataset.js';
import {
  type CallBudget,
  type FetchInterceptado,
  TETO_CHAMADAS,
  callBudget,
  credenciaisDaLane,
  ehErroDeTeto,
  interceptarFetch,
  motivoDoSkip,
  optInSatisfeito,
} from './_call-budget.js';
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

// Conjunto resolvido em UM lugar (`_call-budget.ts`): existindo
// `SANKHYA_SANDBOX_API_URL`, vale o conjunto `SANKHYA_SANDBOX_*` inteiro; senao,
// os nomes genericos que o workflow injeta. Nunca os dois misturados.
const credenciais = credenciaisDaLane(process.env);

const config = {
  baseUrl: credenciais.baseUrl,
  clientId: credenciais.clientId,
  clientSecret: credenciais.clientSecret,
  xToken: credenciais.xToken,
  timeout: 30_000,
  logger: { level: 'silent' as const },
};

// A decisao do opt-in duplo mora em `_call-budget.ts` e e testada la, direto,
// por `tests/security/ci-lanes.test.ts` — nao por grep de prosa.
const habilitada = optInSatisfeito(process.env);

if (!habilitada) {
  console.log(
    `[wms-sandbox] SKIP — falta: ${motivoDoSkip(process.env)}. Nenhuma chamada foi feita.`,
  );
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
/**
 * Cabecalho INTEIRO que o ERP aceitou em 2026-09-06, menos as 11 chaves que a
 * D1.2 tipa — estas ficam nos campos tipados de `incluirNotaGateway` e citar
 * qualquer uma aqui lanca (guarda de colisao, `src/resources/pedidos.ts:41-53`).
 *
 * Proveniencia: `spike-raw/faturamento/ped.ts:8`, valores literais. Decisao
 * D-14: a lane para de descobrir o "minimo" campo a campo. Tres execucoes
 * mediram que o ERP revela UMA exigencia por rodada — primeiro a natureza
 * (`CORE_E00899`, `EXIGNATCFR`), depois o percentual de desconto
 * (`CORE_E03235`) — e cada rodada custa ~6 chamadas. Com o cabecalho inteiro a
 * lane volta a medir o que interessa: o caminho ponta a ponta.
 *
 * Duas diferencas deliberadas em relacao ao spike:
 * - `STATUSNOTA` NAO vem daqui. O spike usou `'L'`; esta suite nunca libera —
 *   objeto em `L` e residuo permanente (T0-4). O campo e tipado e vale `'A'`.
 * - `DTPREVENT` usa a data corrente, nao a data fixa do spike.
 */
const CABECALHO_REFERENCIA_06_09: Record<string, string | number> = {
  CODCONTATO: '1',
  VLRDESCTOT: 0.0,
  VLRNOTA: 10.0,
  AD_MARKET_PLACE: 'Shopify.EC.V1',
  VLRFRETE: 0.0,
  AD_FRETEECOMMERCE: 0.0,
  CIF_FOB: 'C',
  APROVADO: 'S',
  PERCDESC: '0',
  CODPARCTRANSP: '138422',
  AD_CODRASTREIO: '',
  AD_URLRASTREIO: '',
  CODCONTATOENTREGA: '1',
  VLRDESTAQUE: 0.0,
  CODCENCUS: '0102002',
  CODNAT: '01010101',
  AD_STATUSPED: 'P',
};
/** Produto com volume cadastrado completo no sandbox (M54). */
const CODPROD_VOLUME = 13609;

const agora = new Date();
const dois = (n: number): string => String(n).padStart(2, '0');
const hhmm = `${dois(agora.getHours())}${dois(agora.getMinutes())}`;
/** Marca tudo que esta execucao criou: `AD_NUMPEDIDO`, `OBSERVACAO` e `CONTROLE`. */
const PREFIXO = `SDK-T-${hhmm}`;
const DTNEG = `${dois(agora.getDate())}/${dois(agora.getMonth() + 1)}/${agora.getFullYear()} ${dois(agora.getHours())}:${dois(agora.getMinutes())}:${dois(agora.getSeconds())}`;
const DATA_HOJE = `${dois(agora.getDate())}/${dois(agora.getMonth() + 1)}/${agora.getFullYear()}`;

/** Teto da lane. O numero vive em `_call-budget.ts` e e assertado no CI de PR. */
const orcamento: CallBudget = callBudget(TETO_CHAMADAS);

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
let fetchDaLane: FetchInterceptado | undefined;

/**
 * Registra um NUNOTA criado por ESTA execucao.
 *
 * Valida antes de guardar: o id e interpolado em SQL no teardown e entregue a
 * `notas.excluir`. `0`, fracionario, negativo ou `undefined` nao entram — e o
 * caso e gritado, porque id perdido e residuo permanente no sandbox.
 */
function registrarPedido(nunota: number | undefined): void {
  if (typeof nunota !== 'number' || !Number.isInteger(nunota) || nunota <= 0) {
    console.log(`[wms-sandbox] ATENCAO: NUNOTA invalido (${String(nunota)}) — nao registrado.`);
    return;
  }
  if (!residuo.pedidos.includes(nunota)) residuo.pedidos.push(nunota);
}

/** O pedido do passo 3. Lanca se ele nao existe — passo seguinte nunca chama com `undefined`. */
function pedidoDoPasso3(): number {
  const nunota = residuo.pedidos[0];
  if (nunota === undefined) {
    throw new Error('[wms-sandbox] passo 3 nao registrou NUNOTA — passos dependentes abortados.');
  }
  return nunota;
}

/**
 * Le `NUNOTA`/`STATUSNOTA` no ERP para os ids informados.
 *
 * "Criado em `A`" nao e "esta em `A`" na hora do teardown (I10): entre a criacao
 * e o `afterAll` alguem pode ter liberado a nota. Por isso o status vem do ERP,
 * nunca da memoria da suite.
 */
async function lerStatus(ids: readonly number[]): Promise<Map<number, string>> {
  const linhas = await sankhya.dbExplorer.query<{ NUNOTA: string; STATUSNOTA: string }>(
    `SELECT NUNOTA, STATUSNOTA FROM TGFCAB WHERE NUNOTA IN (${ids.join(', ')})`,
  );
  return new Map(linhas.map((l) => [Number(l.NUNOTA), String(l.STATUSNOTA).trim()]));
}

/**
 * Exclui, por id, o que ESTA execucao criou — e SO o que continua em `A`.
 *
 * Ordem obrigatoria (M113): conferencia -> 1101 -> pedido. Aqui so o pedido
 * existe — a suite nunca libera nem fatura — mas as duas primeiras fases ficam
 * escritas, guardadas por lista vazia, porque quem copiar este teardown vai
 * copiar tambem o caso em que elas existem, e a ordem inversa falha no ERP.
 *
 * Nota fora de `A` NAO e apagada: e impressa como residuo e derruba o `afterAll`.
 * Residuo e achado, nunca silencio.
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
      records: residuo.conferencias.map((nunota) =>
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

  // Fase 3 — pedido, so o que o ERP confirma estar em `A`.
  if (residuo.pedidos.length === 0) return;

  const status = await lerStatus(residuo.pedidos);
  const emA = residuo.pedidos.filter((nunota) => status.get(nunota) === 'A');
  const foraDeA = residuo.pedidos.filter(
    (nunota) => status.has(nunota) && status.get(nunota) !== 'A',
  );
  // Id registrado cuja linha NAO voltou. Leitura vazia nao prova remocao (I4):
  // pode ser leitura truncada, permissao, ou a nota noutro lugar. Nunca e
  // "sumiu, tudo certo" — e achado, como qualquer outro residuo.
  const ausentes = residuo.pedidos.filter((nunota) => !status.has(nunota));

  for (const nunota of foraDeA) {
    console.log(`[wms-sandbox] RESIDUO NUNOTA=${nunota} STATUSNOTA=${status.get(nunota)}`);
  }
  for (const nunota of ausentes) {
    console.log(`[wms-sandbox] RESIDUO NUNOTA=${nunota} STATUSNOTA=AUSENTE`);
  }

  if (emA.length > 0) {
    await sankhya.notas.excluir(emA);

    // Read-back (I3): resposta do ERP nao prova efeito. A prova e a ausencia em TGFCAB.
    const sobrando = await lerStatus(emA);
    expect([...sobrando.keys()]).toEqual([]);
    console.log(
      `[wms-sandbox] read-back: 0 linhas em TGFCAB para ${emA.join(', ')}. Chamadas gastas: ${orcamento.spent()}.`,
    );
  }

  const naoApagados = [...foraDeA, ...ausentes];
  if (naoApagados.length > 0) {
    throw new Error(
      `[wms-sandbox] residuo NAO apagado (fora de 'A' ou sem linha em TGFCAB): ${naoApagados.join(', ')}. Confira a mao antes de repetir a lane.`,
    );
  }
}

describe.skipIf(!habilitada)('Lane WMS — sandbox Sankhya (opt-in duplo)', () => {
  beforeAll(async () => {
    // Sandbox ou nada — antes de qualquer chamada.
    assertSandbox(config.baseUrl);
    console.log(
      `[wms-sandbox] conjunto=${credenciais.conjunto.nome} host=${new URL(config.baseUrl).hostname}`,
    );

    // Teto por interceptacao do fetch global: toda requisicao HTTP do SDK paga.
    fetchDaLane = interceptarFetch(orcamento);

    sankhya = new SankhyaClient(config);
    await sankhya.authenticate();
  });

  afterAll(async () => {
    // SEMPRE, e antes do teardown: quanto a lane gastou. Na 1a execucao real a
    // unica impressao do orcamento vivia dentro do ramo de read-back, que nao
    // roda quando nada e criado — e a execucao terminou sem ninguem saber o
    // numero. Instrumentacao que so aparece no caminho feliz nao instrumenta.
    const gastas = orcamento.spent();
    console.log(`[wms-sandbox] chamadas=${gastas}/${TETO_CHAMADAS}`);

    try {
      await teardownPorId();
    } finally {
      fetchDaLane?.restaurar();
    }
  });

  it('1 — dbExplorer.query le TGFEST e casa colunas com valores', async () => {
    const linhas = await sankhya.dbExplorer.query<{
      CODPROD: string;
      CODLOCAL: string;
      ESTOQUE: string;
    }>('SELECT CODPROD, CODLOCAL, ESTOQUE FROM TGFEST WHERE ROWNUM = 1');

    expect(linhas).toHaveLength(1);
    const primeira = linhas[0];
    if (primeira === undefined) {
      throw new Error('[wms-sandbox] TGFEST devolveu 0 linhas para ROWNUM = 1.');
    }
    expect(Object.keys(primeira).sort()).toEqual(['CODLOCAL', 'CODPROD', 'ESTOQUE']);
  });

  it('2 — volumesProduto(13609) devolve quantidade/lastro/camadas (M54)', async () => {
    const volumes = await sankhya.produtos.volumesProduto(CODPROD_VOLUME);

    expect(volumes.length).toBeGreaterThan(0);
    expect(volumes[0]).toMatchObject({ quantidade: 72, lastro: 12, camadas: 4 });
  });

  it('3 — incluirNotaGateway abre pedido em A com AD_NUMPEDIDO prefixado', async () => {
    // Erro NAO prova que nada foi criado (I3/I11): se a chamada falhar, o id e
    // recuperado pelo NOSSO marcador antes de qualquer veredito, para entrar no
    // teardown. Depois disso o erro sobe — este passo FALHA, nunca vira skip.
    let codigoPedido: number | undefined;
    let falha: unknown;

    try {
      codigoPedido = (
        await sankhya.pedidos.incluirNotaGateway({
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
          camposExtras: { ...CABECALHO_REFERENCIA_06_09, DTPREVENT: DATA_HOJE },
          itens: [
            {
              codigoProduto: CODPROD_ITEM,
              quantidade: 1,
              valorUnitario: 10,
              unidade: 'UN',
              codigoLocalOrigem: CODLOCALORIG,
            },
          ],
        })
      ).codigoPedido;
    } catch (erro) {
      falha = erro;
    }

    // Teto estourado nao gasta mais chamada com a recuperacao.
    if (falha !== undefined && !ehErroDeTeto(falha)) {
      const criados = await sankhya.dbExplorer.query<{ NUNOTA: string }>(
        `SELECT NUNOTA FROM TGFCAB WHERE AD_NUMPEDIDO = '${PREFIXO}'`,
      );
      for (const linha of criados) registrarPedido(Number(linha.NUNOTA));
    }
    registrarPedido(codigoPedido);

    if (falha !== undefined) throw falha;

    expect(Number.isInteger(codigoPedido)).toBe(true);
    expect(codigoPedido).toBeGreaterThan(0);
  });

  it('4 — dataset.save grava ItemNota com CONTROLE prefixado', async () => {
    const nunota = pedidoDoPasso3();

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
    const linhas = await sankhya.faturamento.consultarVar(pedidoDoPasso3());
    expect(linhas).toEqual([]);
  });

  // 7 — MEDIDO E REFUTADO em 2026-09-11, nao ha o que repetir.
  //
  // `CRUDServiceProvider.loadRecords` com `rootEntity: 'VolumeProduto'` e o
  // fieldset `CODPROD,CODVOL,QUANTIDADE,LASTRO,CAMADAS,ATIVO` foi chamado 2
  // vezes no sandbox e recusou as 2: `GatewayError: Erro interno (NPE)`
  // (`status '0'`, transactionId B13E2C8D39AEA4CE10EAE94BCF73F6FC), 0 linhas e
  // 0 colunas. `produtos.volumesProduto` passou a ler TGFVOA por
  // `dbExplorer.query` (D1.4b) — que e como M54 e o censo T0-3 sempre mediram.
  //
  // Fica como `it.skip` e NAO chama o gateway: repetir a chamada so gastaria
  // orcamento para reconfirmar um NPE. Se um dia o ERP servir a entidade, a
  // volta e apagar este bloco e medir de novo.
  it.skip('7 — loadRecords rootEntity VolumeProduto: REFUTADA no sandbox (Erro interno (NPE), transactionId B13E2C8D39AEA4CE10EAE94BCF73F6FC)', () => {});

  // 8 — MEDIDO E REFUTADO DUAS VEZES; virou registro, nao chama nada.
  //
  // A pergunta era "qual o cabecalho MINIMO que `CACSP.incluirNota` aceita".
  // Duas rodadas, duas recusas de negocio, uma exigencia revelada por vez:
  //   1) com as 11 chaves tipadas: `Erro na nota. A Natureza deve ser
  //      informada.` + `O parametro 'EXIGNATCFR' esta ligado.` (CORE_E00899);
  //   2) com 12 (as 11 + CODNAT): `O campo 'Perc. desconto' deve ser
  //      informado.` (CORE_E03235, transactionId
  //      BF064C4FBAA7537C3DAB798E39B0B56B).
  // Logo o minimo e >= 13 e inclui CODNAT e o percentual de desconto.
  //
  // Descobrir o resto campo a campo custa ~6 chamadas por rodada e revela UMA
  // exigencia de cada vez (D-14): a lane passou a mandar o cabecalho inteiro ja
  // aceito (ver CABECALHO_REFERENCIA_06_09) e deixou de medir o minimo. Quem
  // quiser o numero exato faz um spike dedicado, com orcamento proprio.
  it.skip("8 — cabecalho minimo de CACSP.incluirNota: REFUTADA 2x (>= 13 chaves; faltaram CODNAT por 'A Natureza deve ser informada.' e o percentual por \"O campo 'Perc. desconto' deve ser informado.\")", () => {});
});
