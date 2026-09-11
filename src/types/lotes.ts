/**
 * Um lote a dar entrada (uma linha de `ItemNota` + uma linha de `Estoque`).
 *
 * `dtVal` e `dtFab` sao **obrigatorias**: sem elas a entrada de um produto
 * `TIPCONTEST='L'` move o estoque e depois **nao confirma** (M97).
 */
export interface EntradaLoteItem {
  /** `CONTROLE` do lote (TGFEST.CONTROLE). String preenchida. */
  readonly controle: string;
  /** Quantidade a entrar (`QTDNEG`). Maior que zero. */
  readonly quantidade: number;
  /** Valor unitario (`VLRUNIT`). Zero ou mais. */
  readonly vlrUnit: number;
  /** Data de validade `dd/MM/yyyy` — o SDK nao formata data. */
  readonly dtVal: string;
  /** Data de fabricacao `dd/MM/yyyy` — o SDK nao formata data. */
  readonly dtFab: string;
}

/** Parametros de `lotes.entrada1813` (nota de entrada TOP 1813). */
export interface EntradaLoteInput {
  /** `CODEMP` da nota e da PK de `Estoque`. */
  readonly codEmp: number;
  /** `CODLOCALORIG` do item e `CODLOCAL` da PK de `Estoque`. */
  readonly codLocal: number;
  /** `CODPROD` — uma entrada por produto, N lotes. */
  readonly codProd: number;
  /** `DTNEG` no formato `dd/MM/yyyy`. */
  readonly dtNeg: string;
  /** `OBSERVACAO` da nota. Use um marcador rastreavel em ambiente compartilhado (R12). */
  readonly observacao: string;
  /** Lotes a entrar. Lista vazia e recusada antes de qualquer escrita. */
  readonly itens: ReadonlyArray<EntradaLoteItem>;
}

/** Uma linha de baixa (um local de estoque). */
export interface BaixaLoteItem {
  /** `CODLOCALORIG` do item. */
  readonly codLocal: number;
  /** Quantidade a baixar (`QTDNEG`). Maior que zero. */
  readonly quantidade: number;
  /**
   * `CONTROLE` do lote. Opcional — **ou todos os itens informam, ou nenhum**:
   * `fields` e unico para o `save` inteiro, e mandar `CONTROLE` vazio para
   * parte das linhas cairia na linha flutuante `' '` de TGFEST (M92).
   */
  readonly controle?: string;
}

/** Parametros de `lotes.baixa1811` (nota de ajuste TOP 1811). */
export interface BaixaLoteInput {
  /** `CODEMP` da nota. Uma nota por empresa (M104). */
  readonly codEmp: number;
  /** `CODPROD` — uma baixa por produto, N locais. */
  readonly codProd: number;
  /** `DTNEG` no formato `dd/MM/yyyy`. */
  readonly dtNeg: string;
  /** `OBSERVACAO` da nota. */
  readonly observacao: string;
  /** Linhas a baixar. Lista vazia e recusada antes de qualquer escrita. */
  readonly itens: ReadonlyArray<BaixaLoteItem>;
}

/** Resultado de `entrada1813` / `baixa1811`: o NUNOTA gerado, lido do `result` do `save`. */
export interface NotaDeLoteResult {
  /** `NUNOTA` da nota criada. Nunca inventado: ausente ou nao-numerico **lanca**. */
  readonly nunota: number;
}
