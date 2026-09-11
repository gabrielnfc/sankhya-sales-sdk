import { GatewayError, SankhyaError } from '../core/errors.js';
import { classifyFailure } from '../core/failure-classification.js';
import type { HttpClient } from '../core/http.js';
import { safeParseNumber } from '../core/parse-utils.js';
import type { RequestOptions } from '../types/config.js';
import type {
  CancelamentoReadBackRow,
  CancelarNotaInput,
  CancelarNotaRawResponse,
  CancelarNotaResult,
  ConfirmarNotaResult,
} from '../types/notas.js';
import type { DbExplorerResource } from './db-explorer.js';

/**
 * A **unica** mensagem de `CACSP.confirmarNota` que e sucesso equivalente (M80).
 *
 * Texto medido no sandbox: `A nota 1889309 ja foi confirmada.`. A regex tolera
 * `ja`/`já` (o Gateway nao garante o acento) e caixa livre, mas exige a forma
 * inteira — `nota <numero> ja foi confirmada`. Deliberadamente estreita: uma
 * regex larga (`/ja foi/`) engoliria recusa de negocio como sucesso, que e o
 * bug silencioso que R11/I3 proibem. Falso negativo aqui custa um erro a mais
 * para o chamador; falso positivo custa uma nota nao confirmada tratada como
 * confirmada (I9).
 */
const JA_CONFIRMADA = /\bnota\s+\d+\s+j[aá]\s+foi\s+confirmada/i;

/** `true` so para o erro de idempotencia de `confirmarNota` (M80). */
function isJaConfirmada(err: unknown): boolean {
  return err instanceof GatewayError && JA_CONFIRMADA.test(err.message);
}

/**
 * Exige inteiro positivo em um NUNOTA.
 *
 * Nao e preciosismo de tipo: o NUNOTA e **interpolado** no SQL do read-back de
 * `cancelar` (o DbExplorer nao tem bind parameter nesta rota), e o payload do
 * Gateway leva `String(nunota)`. `1.5` viraria `'1.5'` e `NaN` viraria `'NaN'`
 * — valores que o ERP recusa ou, pior, interpreta. Validar antes da rede e a
 * guarda de injecao (G3) e a guarda de payload ao mesmo tempo.
 *
 * @throws {SankhyaError} `VALIDATION_ERROR` descrevendo a posicao culpada.
 */
function assertNunotaInteiro(nunota: unknown, where: string): void {
  if (typeof nunota !== 'number' || !Number.isInteger(nunota) || nunota <= 0) {
    throw new SankhyaError(
      `${where}: NUNOTA precisa ser um inteiro positivo (recebido: ${typeof nunota === 'number' ? String(nunota) : typeof nunota}). Nenhuma chamada foi feita.`,
      'VALIDATION_ERROR',
    );
  }
}

/**
 * Converte o booleano-string do Gateway.
 *
 * O Gateway manda `'false'`/`'true'` (fixture V7), nao `false`/`true`. Apenas
 * essas duas formas e o boolean nativo sao reconhecidos; qualquer outra coisa
 * vira `false` — e a leitura conservadora, e `gerouRecebimento` nunca e prova
 * de nada por si (a prova e o read-back).
 */
function toBoolean(value: unknown): boolean {
  if (typeof value === 'boolean') return value;
  return typeof value === 'string' && value.trim().toLowerCase() === 'true';
}

/**
 * Confirmacao, exclusao e cancelamento de notas/pedidos via Gateway `CACSP`.
 *
 * Os tres metodos sao **escrita** e nao estao na allowlist de idempotentes
 * (`src/core/http.ts:8-10`): nenhum e retentado automaticamente.
 *
 * Acesse via `sankhya.notas`.
 *
 * @remarks
 * Relacao com `pedidos.confirmar` (`src/resources/pedidos.ts:284`): os dois
 * chamam `CACSP.confirmarNota`, mas sao contratos diferentes e ambos ficam.
 * - use `pedidos.confirmar` quando precisar do **corpo** da resposta
 *   (avisos e `liberacoes` normalizadas) e quiser que "ja confirmada" seja erro;
 * - use `notas.confirmar` quando quiser **idempotencia** (M80): nota ja
 *   confirmada resolve `{ confirmada: true, jaEstavaConfirmada: true }`, que e o
 *   que um retry ou uma reexecucao de fila precisa.
 */
export class NotasResource {
  constructor(
    private readonly http: HttpClient,
    private readonly dbExplorer: DbExplorerResource,
  ) {}

  /**
   * Confirma uma nota/pedido via `CACSP.confirmarNota`, de forma idempotente.
   *
   * Nota **ja confirmada** nao e falha: o Sankhya responde
   * `A nota <n> ja foi confirmada.` sem nenhum efeito colateral (M80), e este
   * metodo resolve `{ confirmada: true, jaEstavaConfirmada: true }`. Qualquer
   * outro erro passa por `classifyFailure` (a classificacao vai para o log) e e
   * **re-lancado como veio** — o chamador continua vendo o erro original.
   *
   * @param nunota - NUNOTA da nota a confirmar (inteiro positivo).
   * @param options - Opcoes de requisicao (timeout, `signal`).
   * @returns `confirmada: true` sempre; `jaEstavaConfirmada` diz se ja estava.
   * @throws {SankhyaError} `VALIDATION_ERROR` se `nunota` nao for inteiro
   * positivo — antes da rede.
   * @throws {GatewayError} Em erro de negocio que **nao** seja o de idempotencia.
   * @throws {AuthError} Se autenticacao falhar.
   * @example
   * ```ts
   * const r = await sankhya.notas.confirmar(1889309);
   * if (r.jaEstavaConfirmada) console.log('nada a fazer');
   * ```
   */
  async confirmar(nunota: number, options?: RequestOptions): Promise<ConfirmarNotaResult> {
    assertNunotaInteiro(nunota, 'notas.confirmar');

    try {
      await this.http.gatewayCall<unknown>(
        'mgecom',
        'CACSP.confirmarNota',
        { nota: { NUNOTA: { $: String(nunota) } } },
        options,
        // Sem `idempotent`: CACSP.confirmarNota e ESCRITA (src/core/http.ts:8-10).
      );
    } catch (err) {
      if (isJaConfirmada(err)) {
        return { confirmada: true, jaEstavaConfirmada: true };
      }
      // Classificacao em 3 camadas (D2.0): registra a camada e re-lanca o erro
      // original — envolver o erro esconderia `tsErrorCode` de quem trata acima.
      this.http
        .getLogger()
        .warn(
          `notas.confirmar: NUNOTA ${nunota} falhou — camada ${classifyFailure(err)}. Erro re-lancado sem alteracao.`,
        );
      throw err;
    }

    return { confirmada: true, jaEstavaConfirmada: false };
  }

  /**
   * Exclui notas/pedidos via `CACSP.excluirNotas`.
   *
   * O servico aceita **um unico** formato, medido no sandbox (M73):
   * `{"notas":{"nota":[{"NUNOTA":"<n>"}]}}` — lista sob `nota`, NUNOTA em
   * string. Formatos alternativos (`notas.NUNOTA[]`, lista na raiz) foram
   * medidos e recusados; nao invente variante.
   *
   * Para pedido de venda (TOP 1001) confirmado, **exclusao** e o caminho real
   * de desfazer — nao `cancelarNota` (M73/M95).
   *
   * @param nunotas - NUNOTAs a excluir (ao menos um, todos inteiros positivos).
   * @param options - Opcoes de requisicao (timeout, `signal`).
   * @returns Nada: o servico responde corpo vazio (`{}`) em caso de sucesso.
   * @throws {SankhyaError} `VALIDATION_ERROR` se a lista vier vazia ou se algum
   * NUNOTA nao for inteiro positivo — nesse caso nenhuma chamada e feita.
   * @throws {GatewayError} Em erro de negocio Sankhya.
   * @throws {AuthError} Se autenticacao falhar.
   * @example
   * ```ts
   * await sankhya.notas.excluir([1889304, 1889305]);
   * ```
   */
  async excluir(nunotas: readonly number[], options?: RequestOptions): Promise<void> {
    if (!Array.isArray(nunotas) || nunotas.length === 0) {
      throw new SankhyaError(
        'notas.excluir: nunotas vazia. Informe ao menos um NUNOTA — uma lista vazia nao tem efeito medido. Nenhuma chamada foi feita.',
        'VALIDATION_ERROR',
      );
    }
    for (const [index, nunota] of nunotas.entries()) {
      assertNunotaInteiro(nunota, `notas.excluir: nunotas[${index}]`);
    }

    await this.http.gatewayCall<unknown>(
      'mgecom',
      'CACSP.excluirNotas',
      { notas: { nota: nunotas.map((nunota) => ({ NUNOTA: String(nunota) })) } },
      options,
      // Sem `idempotent`: CACSP.excluirNotas e ESCRITA (src/core/http.ts:8-10).
    );
  }

  /**
   * Cancela uma nota via `CACSP.cancelarNota` e **prova** o efeito por read-back.
   *
   * Cancelamento e silencioso no sandbox — nunca confie em HTTP 200; exija o
   * read-back de `TGFCAN` (M75/M94). Para pedido 1001 o cenario real de
   * cancelamento e **exclusao** (M73/M95), nao `TGFCAN`.
   *
   * O read-back roda **sempre**, inclusive quando o Gateway diz
   * `totalNotasCanceladas: 0`: o numero do Gateway e informativo, e
   * `confirmadoPorReadBack` e a unica prova (I3). Se o read-back nao puder
   * rodar, este metodo **lanca** em vez de devolver um resultado sem prova
   * (fail-closed declarado, G9) — o comando de cancelamento **ja foi enviado**
   * nesse ponto, e a mensagem diz isso (I11).
   *
   * @param input - `nunota` (inteiro positivo) e `justificativa` nao vazia.
   * @param options - Opcoes de requisicao (timeout, `signal`).
   * @returns O que o Gateway disse + o que o banco mostra.
   * @throws {SankhyaError} `VALIDATION_ERROR` se `nunota` nao for inteiro
   * positivo ou `justificativa` for vazia (antes da rede);
   * `CANCELAR_NOTA_READ_BACK_INDISPONIVEL` se o read-back falhar **apos** o
   * comando ter sido enviado; `PARSE_ERROR` se `totalNotasCanceladas` vier com
   * valor nao numerico.
   * @throws {GatewayError} Em erro de negocio Sankhya.
   * @throws {AuthError} Se autenticacao falhar.
   * @example
   * ```ts
   * const r = await sankhya.notas.cancelar({ nunota: 1889277, justificativa: 'devolucao' });
   * if (!r.confirmadoPorReadBack) throw new Error('cancelamento nao aconteceu');
   * ```
   */
  async cancelar(input: CancelarNotaInput, options?: RequestOptions): Promise<CancelarNotaResult> {
    assertNunotaInteiro(input?.nunota, 'notas.cancelar');
    if (typeof input.justificativa !== 'string' || input.justificativa.trim() === '') {
      throw new SankhyaError(
        'notas.cancelar: justificativa vazia. O motivo vai para TGFCAN.MOTCANCEL e e o unico rastro do cancelamento. Nenhuma chamada foi feita.',
        'VALIDATION_ERROR',
      );
    }

    const raw = await this.http.gatewayCall<CancelarNotaRawResponse>(
      'mgecom',
      'CACSP.cancelarNota',
      {
        notasCanceladas: {
          justificativa: input.justificativa,
          notaCancelada: [{ NUNOTA: String(input.nunota) }],
        },
      },
      options,
      // Sem `idempotent`: CACSP.cancelarNota e ESCRITA (src/core/http.ts:8-10).
    );

    // Aninhado de proposito: `totalNotasCanceladas` NAO existe na raiz da
    // resposta (fixture C5_CANCELARNOTA_1101_V7.json). Ler da raiz devolveria
    // `undefined` => 0 para sempre, mascarando cancelamento bem-sucedido.
    const resultado = raw?.resultadoCancelamento;
    const linha = await this.lerReadBackCancelamento(input.nunota, options);

    return {
      totalNotasCanceladas: safeParseNumber(
        resultado?.totalNotasCanceladas,
        'CACSP.cancelarNota.resultadoCancelamento.totalNotasCanceladas',
      ),
      gerouRecebimento: toBoolean(resultado?.gerouRecebimento),
      confirmadoPorReadBack: linha !== undefined,
      statusNfe: linha === undefined || !linha.STATUSNFE ? null : linha.STATUSNFE,
    };
  }

  /**
   * Le a linha de cancelamento em `TGFCAN`, com `TGFCAB.STATUSNFE` ao lado.
   *
   * `LEFT JOIN` a partir de `TGFCAN`: a existencia da linha **em TGFCAN** e o
   * que prova o cancelamento; `STATUSNFE` e contexto da NFe e pode faltar.
   * `nunota` ja veio validado como inteiro por `cancelar` — e o que autoriza a
   * interpolacao (o DbExplorer nao expoe bind parameter nesta rota).
   * Mais de uma linha e possivel (TGFCAN nao e 1:1 com NUNOTA); a primeira
   * basta, porque a pergunta e "existe cancelamento?".
   *
   * @internal
   */
  private async lerReadBackCancelamento(
    nunota: number,
    options?: RequestOptions,
  ): Promise<CancelamentoReadBackRow | undefined> {
    const sql = `SELECT CAN.NUNOTA AS NUNOTA, CAB.STATUSNFE AS STATUSNFE FROM TGFCAN CAN LEFT JOIN TGFCAB CAB ON CAB.NUNOTA = CAN.NUNOTA WHERE CAN.NUNOTA = ${nunota}`;

    try {
      const rows = await this.dbExplorer.query<CancelamentoReadBackRow>(sql, options);
      return rows[0];
    } catch (err) {
      throw new SankhyaError(
        `notas.cancelar: o comando CACSP.cancelarNota da NUNOTA ${nunota} JA FOI ENVIADO, mas o read-back em TGFCAN falhou (camada ${classifyFailure(err)}) — o efeito e indeterminado. Consulte TGFCAN antes de repetir a chamada. Nenhum sucesso foi presumido.`,
        'CANCELAR_NOTA_READ_BACK_INDISPONIVEL',
        undefined,
        err,
      );
    }
  }
}
