/** Entrada de `faturamento.faturar`. */
export interface FaturarInput {
  /** NUNOTA do PEDIDO a faturar (inteiro positivo; validado antes da rede). */
  readonly nunotaPedido: number;
  /** TOP de faturamento (ex.: `1101`). Inteiro positivo. */
  readonly codigoTipoOperacao: number;
  /** Serie da nota gerada; omitida, o builder usa `'1'` (medida em M49). */
  readonly serie?: string;
}

/**
 * Por que `faturar` terminou.
 *
 * - `FATURADO`: o comando foi aceito **e** o read-back em `TGFVAR` achou a nota.
 * - `JA_FATURADO`: ja existia vinculo em `TGFVAR` (guard) ou a recusa
 *   `O pedido <n> nao esta pendente.` foi confirmada por read-back (M79).
 * - `NAO_PENDENTE`: `TGFCAB.PENDENTE <> 'S'` sem nenhuma nota gerada — nada a
 *   faturar e nada foi enviado (M81).
 */
export type FaturarMotivo = 'FATURADO' | 'JA_FATURADO' | 'NAO_PENDENTE';

/**
 * Resultado de `faturamento.faturar`.
 *
 * `faturado` e `true` **somente** quando esta chamada gerou a nota. Pedido que
 * ja estava faturado devolve `faturado: false` com `nunotaNota` preenchido: o
 * chamador tem a 1101 sem poder confundi-la com um faturamento novo.
 */
export interface FaturarResult {
  /** `true` so quando ESTA chamada gerou a nota. */
  readonly faturado: boolean;
  /** NUNOTA da nota gerada, lida em `TGFVAR`; `null` quando nao ha nota. */
  readonly nunotaNota: number | null;
  /** Desfecho, sempre derivado de read-back — nunca da mensagem do ERP. */
  readonly motivo: FaturarMotivo;
}

/**
 * Vinculo pedido → nota em `TGFVAR`, ja convertido para numero.
 *
 * `TGFVAR.NUNOTAORIG` e o pedido; `NUNOTA` e a nota gerada. A existencia da
 * linha e a **unica** prova de que o faturamento aconteceu (M79/M81) — o
 * `HTTP 200` do Gateway nao e (I3).
 */
export interface VarLinha {
  /** NUNOTA da nota gerada (a 1101). */
  readonly nunota: number;
  /** `TGFVAR.SEQUENCIA` — sequencia do item na nota gerada. */
  readonly sequencia: number;
  /** `TGFVAR.SEQUENCIAORIG` — sequencia do item no pedido de origem. */
  readonly sequenciaOrig: number;
  /** `TGFVAR.QTDATENDIDA` — quantidade atendida (pode ser fracionaria). */
  readonly qtdAtendida: number;
}

/**
 * Linha crua do read-back de `TGFVAR`, **depois** da normalizacao do
 * `dbExplorer.query`.
 *
 * Toda celula chega como `string`: o DbExplorer devolve tipos mistos (a fixture
 * `spike-raw/faturamento/S2_VAR_APOS_FAT1.json` traz `"NUNOTA": 1889308` como
 * number) e `query()` passa tudo por `cellToString`
 * (`src/resources/db-explorer.ts:25-27`). Por isso a conversao para numero e
 * explicita e estrita em `consultarVar`.
 */
export interface VarReadBackRow {
  readonly NUNOTA: string;
  readonly SEQUENCIA: string;
  readonly SEQUENCIAORIG: string;
  readonly QTDATENDIDA: string;
  readonly [key: string]: string;
}

/**
 * Linha do read-back de `TGFCAB` usada pelo guard de pendencia.
 *
 * `PENDENTE` e o flag que o wizard exige (`'S'`); `STATUSNOTA` vai junto porque
 * e o contexto que explica um `PENDENTE <> 'S'` no log do chamador.
 */
export interface CabPendenteReadBackRow {
  readonly PENDENTE: string;
  readonly STATUSNOTA: string;
  readonly [key: string]: string;
}
