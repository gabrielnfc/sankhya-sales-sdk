/**
 * Resultado de `notas.confirmar`.
 *
 * `confirmada` e sempre `true`: o metodo ou resolve confirmado, ou lanca. O que
 * varia e `jaEstavaConfirmada` — `true` quando o Sankhya respondeu
 * `A nota <n> ja foi confirmada.`, que e sucesso equivalente e zero efeito
 * colateral (M80), nao falha.
 */
export interface ConfirmarNotaResult {
  readonly confirmada: true;
  /** `true` se a nota ja estava confirmada antes desta chamada (M80). */
  readonly jaEstavaConfirmada: boolean;
}

/** Entrada de `notas.cancelar`. */
export interface CancelarNotaInput {
  /** NUNOTA da nota a cancelar. Inteiro positivo — validado antes da rede. */
  readonly nunota: number;
  /** Motivo do cancelamento (`MOTCANCEL` em TGFCAN). Nao pode ser vazio. */
  readonly justificativa: string;
}

/**
 * Resultado de `notas.cancelar`.
 *
 * `totalNotasCanceladas` e `gerouRecebimento` sao o que o **Gateway disse**;
 * `confirmadoPorReadBack` e o que o **banco mostra**. Em divergencia, o banco
 * vence: `cancelarNota` devolve HTTP 200 cancelando zero notas (M75/M94).
 */
export interface CancelarNotaResult {
  /** `resultadoCancelamento.totalNotasCanceladas` convertido; `0` se ausente. */
  readonly totalNotasCanceladas: number;
  /** `resultadoCancelamento.gerouRecebimento` convertido; `false` se ausente. */
  readonly gerouRecebimento: boolean;
  /** `true` SOMENTE se o read-back achou a linha em `TGFCAN`. A unica prova. */
  readonly confirmadoPorReadBack: boolean;
  /** `TGFCAB.STATUSNFE` da linha do read-back; `null` se ausente ou vazio. */
  readonly statusNfe: string | null;
  /**
   * Presente **somente** quando a resposta do gateway nao chegou (camada
   * `TIMEOUT`) e o estado foi derivado do read-back.
   *
   * Nesse caso `totalNotasCanceladas` e `gerouRecebimento` valem `0`/`false`
   * por **ausencia de resposta**, nao por medicao — e so
   * `confirmadoPorReadBack` e afirmacao sobre o banco (I11). A chave e omitida
   * no caminho normal, para que o formato comum continue com 4 campos.
   */
  readonly avisoRespostaGateway?: string;
}

/**
 * Resposta crua de `CACSP.cancelarNota`.
 *
 * Fixture literal medida no sandbox
 * (`spike-raw/cancelamento/C5_CANCELARNOTA_1101_V7.json`, campo `res`):
 * `{"resultadoCancelamento":{"totalNotasCanceladas":"0","gerouRecebimento":"false"}}`.
 * Os campos sao **aninhados e string**; ler da raiz devolve `undefined` sempre.
 */
export interface CancelarNotaRawResponse {
  readonly resultadoCancelamento?: {
    readonly totalNotasCanceladas?: unknown;
    readonly gerouRecebimento?: unknown;
  };
}

/**
 * Linha do read-back de cancelamento (`TGFCAN` + `TGFCAB.STATUSNFE`), **depois**
 * da normalizacao do `dbExplorer.query`.
 *
 * Descreve a linha NORMALIZADA, nao a resposta crua do DbExplorer. O
 * DbExplorer devolve tipos mistos — medido em
 * `spike-raw/cancelamento/C1_RB_PA_1.json`, a mesma consulta trouxe
 * `"NUNOTA": 1889304` (number) e `"STATUSNFE": null` — e `query()` passa toda
 * celula por `cellToString` (`src/resources/db-explorer.ts:25-27`), que
 * converte number para string e `null`/`undefined` para `''`. Por isso os
 * campos sao `string`: e o que este resource realmente recebe.
 *
 * Consequencia no consumo: `STATUSNFE` vazio (`''`) **nao e um status**, e
 * ausencia — `cancelar` o traduz para `statusNfe: null`, nunca para `''`. A
 * coluna tambem pode nao vir na linha (consulta sem `fieldsMetadata` para ela),
 * e o tratamento e o mesmo.
 */
export interface CancelamentoReadBackRow {
  readonly NUNOTA: string;
  readonly STATUSNFE: string;
  [key: string]: string;
}
