/** Posicao de estoque de um produto em um local. */
export interface Estoque {
  /** Codigo do produto. */
  codigoProduto: number;
  /** Codigo da empresa. */
  codigoEmpresa: number;
  /** Codigo do local de estoque. */
  codigoLocal: number;
  /** Controle de estoque (serie, lote, etc.). */
  controle?: string;
  /** Quantidade em estoque. */
  estoque: number;
}

/** Local de estoque no Sankhya ERP. */
export interface LocalEstoque {
  /** Codigo do local. */
  codigoLocal: number;
  /** Codigo do local pai (hierarquia). */
  codigoLocalPai: number;
  /** Descricao do local. */
  descricaoLocal: string;
  /** Grau na hierarquia. */
  grau: number;
  /** Indica se e um local analitico (folha). */
  analitico: boolean;
  /** Indica se o local esta ativo. */
  ativo: boolean;
}

/**
 * Uma linha de `TGFEST` — o saldo por lote, como o ERP guarda (D2.6).
 *
 * A PK real e de **6 colunas** (`CODEMP`, `CODLOCAL`, `CODPROD`, `CONTROLE`,
 * `TIPO`, `CODPARC`, M36/M88); as demais colunas sao o estado.
 *
 * A linha e **viva**: zerada em saldo e reserva ela **some** de TGFEST, e volta
 * com `STATUSLOTE='N'` quando a baixa e estornada (M91) — leitura vazia aqui
 * nunca prova que o lote nunca existiu (I4).
 */
export interface EstoqueLote {
  /** `CODEMP`. */
  readonly codEmp: number;
  /** `CODLOCAL`. */
  readonly codLocal: number;
  /** `CODPROD`. */
  readonly codProd: number;
  /** `CONTROLE` — `' '` e a linha "flutuante", de reserva sem lote (M92). */
  readonly controle: string;
  /** `TIPO` (medido: `'P'`). */
  readonly tipo: string;
  /** `CODPARC` (medido: `0`). */
  readonly codParc: number;
  /** `ESTOQUE`. Coluna vazia ou nao-numerica **lanca** — nunca vira `0`. */
  readonly estoque: number;
  /** `RESERVADO`. Disponivel = `estoque - reservado` (M102). */
  readonly reservado: number;
  /**
   * `DTVAL` **na forma crua do ERP**, ou `null` quando vazia.
   *
   * O SDK nao formata data (nem na ida, nem na volta): lido nu, o Oracle
   * devolve `'05092027 00:00:00'` (medido em `spike-raw/lote/T18_RB_EST_FINAL.json`),
   * que **nao** e o `dd/MM/yyyy` que `entrada1813` espera. Converta no chamador.
   */
  readonly dtVal: string | null;
  /** `DTFABRICACAO`, mesma regra de `dtVal`. */
  readonly dtFab: string | null;
  /** `STATUSLOTE` — dominio fechado `('A','Q','P','N','R')` (M89). */
  readonly statusLote: string;
}
