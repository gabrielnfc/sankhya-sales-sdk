import { GatewayError, SankhyaError } from '../core/errors.js';
import { classifyFailure } from '../core/failure-classification.js';
import { buildFaturarWizardPayload } from '../core/faturamento-payload.js';
import type { HttpClient } from '../core/http.js';
import type { RequestOptions } from '../types/config.js';
import type {
  CabPendenteReadBackRow,
  FaturarInput,
  FaturarResult,
  VarLinha,
  VarReadBackRow,
} from '../types/faturamento.js';
import type { DbExplorerResource } from './db-explorer.js';

/** O unico servico de faturamento do wizard (mesmo modulo de `pedidos.faturar`). */
const SERVICO_FATURAR = 'SelecaoDocumentoSP.faturar';
const MODULO_FATURAR = 'mgecom';

/** Valor de `TGFCAB.PENDENTE` que o wizard exige para faturar. */
const PENDENTE_SIM = 'S';

/**
 * A **unica** recusa de `SelecaoDocumentoSP.faturar` que e sucesso equivalente
 * (M79), e ainda assim so depois do read-back.
 *
 * Texto medido no sandbox, literal e **acentuado em `nao`, nao em `esta`**:
 * `O pedido 255607 não esta pendente.`
 * (`spike-raw/faturamento/attempts.ndjson:16`, `n: 6`, label
 * `S2_FATURAR_2_IDENTICO`, `service: SelecaoDocumentoSP.faturar`).
 *
 * **Ancorada nas duas pontas** (`^…$`), como `JA_CONFIRMADA` em
 * `src/resources/notas.ts:32` (padrao M80). Uma regex larga como
 * `/nao esta pendente/` aceitaria `Erro ao faturar: o item X nao esta pendente.
 * Estoque insuficiente.` — um erro virando sucesso. Tolera apenas o que o
 * Gateway nao garante: os acentos, o ponto final e a caixa. Falso negativo aqui
 * custa um erro a mais para o chamador; falso positivo custa um pedido NAO
 * faturado tratado como faturado (I9).
 *
 * Casar a mensagem **nao decide nada sozinho**: a idempotencia do faturamento e
 * reversivel (a 1101 pode ser excluida), entao a prova e sempre `TGFVAR` (M81).
 */
const NAO_ESTA_PENDENTE = /^O pedido \d+ n[aã]o est[aá] pendente\.?$/i;

/**
 * `true` so para a recusa de pedido nao pendente **deste** servico.
 *
 * Tres condicoes, todas necessarias: e um `GatewayError` (HTTP 200 com recusa no
 * corpo — um `TimeoutError` com o mesmo texto e desfecho desconhecido, nao
 * recusa), veio de `SelecaoDocumentoSP.faturar`, e a mensagem casa a forma
 * inteira medida.
 */
function isNaoEstaPendente(err: unknown): boolean {
  return (
    err instanceof GatewayError &&
    err.serviceName === SERVICO_FATURAR &&
    NAO_ESTA_PENDENTE.test(err.message.trim())
  );
}

/**
 * Exige inteiro positivo.
 *
 * Nao e preciosismo: o NUNOTA e **interpolado** no SQL dos dois read-backs (o
 * DbExplorer nao tem bind parameter nesta rota) e vai para o payload do wizard
 * como `String(...)`. `1.5` viraria `'1.5'` e `NaN` viraria `'NaN'` — valores
 * que o ERP recusa ou, pior, interpreta. Validar antes da rede e a guarda de
 * injecao (G3) e a guarda de payload ao mesmo tempo.
 *
 * @throws {SankhyaError} `VALIDATION_ERROR`, citando a posicao culpada.
 */
function assertInteiroPositivo(valor: unknown, onde: string): void {
  if (typeof valor !== 'number' || !Number.isInteger(valor) || valor <= 0) {
    throw new SankhyaError(
      `${onde} precisa ser um inteiro positivo (recebido: ${
        typeof valor === 'number' ? String(valor) : typeof valor
      }). Nenhuma consulta e nenhuma chamada foram feitas.`,
      'VALIDATION_ERROR',
    );
  }
}

/**
 * Converte uma celula de `TGFVAR` para numero, **ou lanca**.
 *
 * Mesmo criterio de `parseNuconf` (`src/resources/conferencia.ts:75-79`): celula
 * ausente, vazia ou nao numerica nao vira `0` nem `NaN` silencioso. Aqui o
 * numero e a resposta a "esta faturado, e em qual nota?" — um `NaN` vazaria para
 * `nunotaNota` e o chamador confirmaria a nota errada (I11).
 *
 * `exigirInteiro` separa os dois casos reais: `NUNOTA`/`SEQUENCIA` sao inteiros
 * positivos; `QTDATENDIDA` e quantidade e pode ser fracionaria.
 *
 * @throws {SankhyaError} `FATURAR_VAR_INVALIDA`.
 */
function parseCelulaVar(
  celula: string | undefined,
  coluna: string,
  nunotaPedido: number,
  exigirInteiro: boolean,
): number {
  const texto = (celula ?? '').trim();
  const numero = texto === '' ? Number.NaN : Number(texto);
  const valido =
    Number.isFinite(numero) && (!exigirInteiro || (Number.isInteger(numero) && numero > 0));
  if (!valido) {
    throw new SankhyaError(
      `faturamento.consultarVar: TGFVAR devolveu ${coluna} nao utilizavel para o pedido ${nunotaPedido} (recebido: ${JSON.stringify(celula ?? null)}). Nenhuma lista parcial foi devolvida — um 0 ou NaN aqui viraria a NUNOTA de uma nota que nao existe.`,
      'FATURAR_VAR_INVALIDA',
    );
  }
  return numero;
}

/**
 * Faturamento de pedido de venda via wizard (`SelecaoDocumentoSP.faturar`).
 *
 * Acesse via `sankhya.faturamento`.
 *
 * O metodo `faturar` e **escrita** e nao esta na allowlist de idempotentes
 * (`src/core/http.ts:8-10`): nao e retentado automaticamente.
 *
 * @remarks
 * Relacao com `pedidos.faturar` (`src/resources/pedidos.ts:401`): os dois chamam
 * o mesmo servico com o mesmo corpo (a fonte unica e
 * {@link buildFaturarWizardPayload}), mas sao contratos diferentes e ambos ficam.
 * - use `pedidos.faturar` quando quiser o disparo cru, sem consulta ao banco;
 * - use `faturamento.faturar` quando quiser o **guard** e a **prova**: ele le
 *   `TGFVAR` e `TGFCAB.PENDENTE` antes de mandar e devolve a NUNOTA da nota
 *   lida no banco depois.
 */
export class FaturamentoResource {
  constructor(
    private readonly http: HttpClient,
    private readonly dbExplorer: DbExplorerResource,
  ) {}

  /**
   * Le os vinculos pedido → nota em `TGFVAR` (a prova do faturamento).
   *
   * SQL derivado do read-back medido no spike S2
   * (`spike-raw/faturamento/ped.ts:18`, `RB_VAR`), com as colunas que este
   * contrato devolve. O `JOIN TGFCAB` e o da medicao e fica: ele garante que a
   * nota apontada por `TGFVAR.NUNOTA` **existe** — vinculo orfao nao conta como
   * faturamento.
   *
   * @param nunotaPedido - NUNOTA do pedido (inteiro positivo; interpolado apos validar).
   * @param options - Opcoes de requisicao (timeout, `signal`).
   * @returns Vinculos encontrados; `[]` quando o pedido nao gerou nota.
   * @throws {SankhyaError} `VALIDATION_ERROR` se `nunotaPedido` nao for inteiro
   * positivo (antes da rede); `FATURAR_VAR_INVALIDA` se alguma coluna vier com
   * valor nao numerico.
   * @throws {GatewayError} Em erro de negocio Sankhya.
   * @throws {AuthError} Se autenticacao falhar.
   * @example
   * ```ts
   * const vinculos = await sankhya.faturamento.consultarVar(1889309);
   * if (vinculos.length > 0) console.log('ja faturado na nota', vinculos[0].nunota);
   * ```
   */
  async consultarVar(nunotaPedido: number, options?: RequestOptions): Promise<VarLinha[]> {
    assertInteiroPositivo(nunotaPedido, 'faturamento.consultarVar: nunotaPedido');

    const rows = await this.dbExplorer.query<VarReadBackRow>(
      `SELECT V.NUNOTA, V.SEQUENCIA, V.SEQUENCIAORIG, V.QTDATENDIDA FROM TGFVAR V JOIN TGFCAB C ON C.NUNOTA = V.NUNOTA WHERE V.NUNOTAORIG = ${nunotaPedido}`,
      options,
    );

    return rows.map((row) => ({
      nunota: parseCelulaVar(row.NUNOTA, 'NUNOTA', nunotaPedido, true),
      sequencia: parseCelulaVar(row.SEQUENCIA, 'SEQUENCIA', nunotaPedido, true),
      sequenciaOrig: parseCelulaVar(row.SEQUENCIAORIG, 'SEQUENCIAORIG', nunotaPedido, true),
      qtdAtendida: parseCelulaVar(row.QTDATENDIDA, 'QTDATENDIDA', nunotaPedido, false),
    }));
  }

  /**
   * Fatura um pedido, com guard de estado antes e prova por read-back depois.
   *
   * Ordem, toda ela medida no spike S2:
   * 1. `TGFVAR` por `NUNOTAORIG` — ja tem linha? `JA_FATURADO`, **sem rede**;
   * 2. `TGFCAB.PENDENTE` por `NUNOTA` — `<> 'S'`? `NAO_PENDENTE`, **sem rede**;
   * 3. `SelecaoDocumentoSP.faturar` com o corpo de {@link buildFaturarWizardPayload};
   * 4. `TGFVAR` de novo — a linha e a **unica** prova de que a nota nasceu (I3).
   *
   * Os dois guards sao necessarios juntos (M81): `TGFVAR` vazio nao basta
   * (pedido nao pendente por outro motivo seria recusado pelo ERP) e
   * `PENDENTE='S'` nao basta (o flag e reversivel). Faturar duas vezes um pedido
   * que ja gerou nota e o dano que este guard existe para evitar.
   *
   * No `catch`, a mensagem **nunca** decide sozinha:
   * - recusa `O pedido <n> nao esta pendente.` (M79) → read-back; com linha,
   *   `JA_FATURADO`; **sem** linha, lanca `FATURAR_DESFECHO_INDETERMINADO` — o
   *   ERP recusou dizendo que nao ha o que faturar e o banco nao mostra nota:
   *   "nao sei" nunca vira sucesso (I11, fail-closed G9);
   * - camada `TIMEOUT` (`classifyFailure`) → read-back; com linha, `FATURADO`
   *   (o comando foi executado no servidor); sem linha, o erro original sobe
   *   **como veio**;
   * - `NEGOCIO`/`AUTH_FAIL` fora da recusa conhecida → erro original sobe cru.
   *
   * @param input - `nunotaPedido`, `codigoTipoOperacao` (inteiros positivos) e `serie`.
   * @param options - Opcoes de requisicao (timeout, `signal`).
   * @returns O desfecho e a NUNOTA da nota, sempre lida do banco.
   * @throws {SankhyaError} `VALIDATION_ERROR` se algum inteiro for invalido
   * (antes de qualquer consulta); `FATURAR_DESFECHO_INDETERMINADO` se a recusa
   * de nao pendente vier sem linha em `TGFVAR`; `FATURAR_VAR_INVALIDA` se o
   * read-back devolver coluna nao numerica.
   * @throws {TimeoutError} Se o gateway nao responder **e** o read-back seguir vazio.
   * @throws {GatewayError} Em erro de negocio Sankhya que nao seja a recusa conhecida.
   * @throws {AuthError} Se autenticacao falhar.
   * @example
   * ```ts
   * const r = await sankhya.faturamento.faturar({ nunotaPedido: 1889309, codigoTipoOperacao: 1101 });
   * if (r.nunotaNota === null) console.log('nada foi faturado:', r.motivo);
   * ```
   */
  async faturar(input: FaturarInput, options?: RequestOptions): Promise<FaturarResult> {
    assertInteiroPositivo(input?.nunotaPedido, 'faturamento.faturar: nunotaPedido');
    assertInteiroPositivo(input.codigoTipoOperacao, 'faturamento.faturar: codigoTipoOperacao');
    const { nunotaPedido } = input;

    const jaVinculado = await this.consultarVar(nunotaPedido, options);
    if (jaVinculado.length > 0) {
      return {
        faturado: false,
        nunotaNota: jaVinculado[0]?.nunota ?? null,
        motivo: 'JA_FATURADO',
      };
    }

    if (!(await this.estaPendente(nunotaPedido, options))) {
      return { faturado: false, nunotaNota: null, motivo: 'NAO_PENDENTE' };
    }

    try {
      await this.http.gatewayCall<unknown>(
        MODULO_FATURAR,
        SERVICO_FATURAR,
        buildFaturarWizardPayload({
          codigoPedido: nunotaPedido,
          codigoTipoOperacao: input.codigoTipoOperacao,
          ...(input.serie === undefined ? {} : { serie: input.serie }),
        }),
        options,
        // Sem `idempotent`: SelecaoDocumentoSP.faturar e ESCRITA (src/core/http.ts:8-10).
      );
    } catch (err) {
      return await this.decidirPorReadBack(err, nunotaPedido, options);
    }

    const gerado = await this.consultarVar(nunotaPedido, options);
    if (gerado.length === 0) {
      // HTTP 200 nao e prova (I3): o gateway aceitou e TGFVAR nao mostra nota.
      // Devolver `NAO_PENDENTE` aqui mentiria (o comando FOI enviado) e
      // `FATURADO` com `nunotaNota: null` inventaria sucesso — fail-closed (G9).
      throw new SankhyaError(
        `faturamento.faturar: o Sankhya aceitou o faturamento do pedido ${nunotaPedido}, mas o read-back em TGFVAR nao achou nenhuma nota vinculada — o estado e indeterminado. Consulte TGFVAR antes de repetir a chamada. Nenhum faturamento foi presumido.`,
        'FATURAR_DESFECHO_INDETERMINADO',
      );
    }
    return { faturado: true, nunotaNota: gerado[0]?.nunota ?? null, motivo: 'FATURADO' };
  }

  /**
   * Guard de pendencia: `TGFCAB.PENDENTE = 'S'`.
   *
   * SQL derivado do read-back medido (`spike-raw/faturamento/ped.ts:16`,
   * `RB_CAB`), reduzido as duas colunas que este guard usa. Linha ausente conta
   * como **nao pendente**: leitura vazia nao vira "pode faturar" (I4, G2).
   *
   * @internal
   */
  private async estaPendente(nunotaPedido: number, options?: RequestOptions): Promise<boolean> {
    const rows = await this.dbExplorer.query<CabPendenteReadBackRow>(
      `SELECT PENDENTE, STATUSNOTA FROM TGFCAB WHERE NUNOTA = ${nunotaPedido}`,
      options,
    );
    const linha = rows[0];
    if (linha === undefined || linha.PENDENTE?.trim().toUpperCase() !== PENDENTE_SIM) {
      this.http
        .getLogger()
        .warn(
          `faturamento.faturar: pedido ${nunotaPedido} nao esta pendente (TGFCAB.PENDENTE=${JSON.stringify(linha?.PENDENTE ?? null)}, STATUSNOTA=${JSON.stringify(linha?.STATUSNOTA ?? null)}) e TGFVAR nao tem vinculo. Nenhuma chamada foi feita.`,
        );
      return false;
    }
    return true;
  }

  /**
   * Traduz a falha de `SelecaoDocumentoSP.faturar` **pelo banco**, nunca pela
   * mensagem (M81).
   *
   * @internal
   */
  private async decidirPorReadBack(
    err: unknown,
    nunotaPedido: number,
    options?: RequestOptions,
  ): Promise<FaturarResult> {
    const camada = classifyFailure(err);
    const recusaConhecida = isNaoEstaPendente(err);

    if (!recusaConhecida && camada !== 'TIMEOUT') {
      this.http
        .getLogger()
        .warn(
          `faturamento.faturar: pedido ${nunotaPedido} falhou — camada ${camada}. Erro re-lancado sem alteracao.`,
        );
      throw err;
    }

    const linhas = await this.consultarVar(nunotaPedido, options);

    if (recusaConhecida) {
      if (linhas.length === 0) {
        throw new SankhyaError(
          `faturamento.faturar: o Sankhya recusou o pedido ${nunotaPedido} dizendo que ele nao esta pendente, mas TGFVAR nao tem nenhuma nota vinculada — o estado e indeterminado. Consulte TGFCAB/TGFVAR antes de repetir a chamada. Nenhum faturamento foi presumido.`,
          'FATURAR_DESFECHO_INDETERMINADO',
          undefined,
          err,
        );
      }
      return { faturado: false, nunotaNota: linhas[0]?.nunota ?? null, motivo: 'JA_FATURADO' };
    }

    if (linhas.length === 0) {
      this.http
        .getLogger()
        .warn(
          `faturamento.faturar: pedido ${nunotaPedido} sem resposta do gateway — camada ${camada} — e TGFVAR continua vazio. Erro re-lancado sem alteracao; o faturamento ainda pode acontecer no servidor, confira TGFVAR antes de repetir.`,
        );
      throw err;
    }

    // Sem resposta do gateway, mas o banco mostra a nota: o comando FOI
    // executado no servidor. O desfecho vem do read-back, nunca da suposicao
    // (I11/R8) — mesma regra de `notas.cancelar` (src/resources/notas.ts:283).
    return { faturado: true, nunotaNota: linhas[0]?.nunota ?? null, motivo: 'FATURADO' };
  }
}
