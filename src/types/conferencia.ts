/**
 * Carimbo de separacao em `CabecalhoNota` (`TGFCAB.AD_DTHRSEPARACAO` /
 * `AD_NOMESEPARADOR`) — pre-condicao do gatilho `TRG_B_I_TGFCON2_TRUE` (M76).
 */
export interface CarimbarSeparacaoInput {
  /** NUNOTA da nota/pedido a carimbar (inteiro positivo). */
  readonly nunota: number;
  /** Data/hora ja formatada `dd/MM/yyyy HH:mm:ss` — o SDK nao formata data. */
  readonly dataHora: string;
  /** Nome do separador, como vai para `AD_NOMESEPARADOR`. */
  readonly nomeSeparador: string;
}

/** Abertura de conferencia (`TGFCON2`, STATUS `A`). */
export interface AbrirConferenciaInput {
  /** NUNOTA que vira `NUNOTAORIG` (inteiro positivo). */
  readonly nunota: number;
  /** `CODUSUCONF` — usuario Sankhya que assume a conferencia (inteiro positivo). */
  readonly codUsuConf: number;
  /** `DHINICONF` ja formatada `dd/MM/yyyy HH:mm:ss`. */
  readonly dataHora: string;
}

/** Um item bipado (`TGFCOI2`). */
export interface BiparInput {
  /** NUCONF da conferencia aberta (inteiro positivo). */
  readonly nuconf: number;
  /** `SEQCONF` — sequencia do item dentro da conferencia (inteiro positivo). */
  readonly seqConf: number;
  /** `CODPROD` do produto bipado (inteiro positivo). */
  readonly codProd: number;
  /** `CODVOL` — unidade do volume (ex: `'UN'`). */
  readonly codVol: string;
  /** `QTDCONF` — quantidade conferida; precisa ser maior que zero. */
  readonly qtdConf: number;
  /** `CODBARRA` — EAN efetivamente bipado. */
  readonly codBarra: string;
  /**
   * `CONTROLE` — lote do item (M38: persiste em `TGFCOI2`).
   *
   * String vazia e aceita de proposito: produto sem controle de lote nao tem
   * lote a informar, e recusar obrigaria o chamador a inventar um valor.
   */
  readonly controle: string;
}

/** Fechamento da conferencia (`DHFINCONF` + `STATUS='F'`). */
export interface FecharConferenciaInput {
  /** NUCONF a fechar (inteiro positivo). */
  readonly nuconf: number;
  /** `DHFINCONF` ja formatada `dd/MM/yyyy HH:mm:ss`. */
  readonly dataHora: string;
}

/** E1 (M107): aponta uma conferencia existente no `NUCONFATUAL` de uma nota. */
export interface ApontarNaNotaInput {
  /** NUNOTA da nota que recebe o ponteiro (inteiro positivo). */
  readonly nunota: number;
  /** NUCONF da conferencia a apontar (inteiro positivo). */
  readonly nuconf: number;
}

/** E2 (M108): move a `NUNOTAORIG` de uma conferencia para outra nota. */
export interface ReapontarOrigemInput {
  /** NUCONF da conferencia a reapontar (inteiro positivo). */
  readonly nuconf: number;
  /** NUNOTA que passa a ser a `NUNOTAORIG` (inteiro positivo). */
  readonly nunota: number;
}

/** Uma conferencia de `TGFCON2` vista por `NUNOTAORIG`. */
export interface ConferenciaDaNota {
  /** `NUCONF` convertido para numero. */
  readonly nuconf: number;
  /** `STATUS` como veio (`A` aberta, `F` finalizada, `D` divergente, ...). */
  readonly status: string;
}

/** Retorno de `conferencia.abrir`. */
export interface AbrirConferenciaResult {
  /** NUCONF gerado pelo ERP (`TIPONUMERACAO='A'`), lido do `result` do save. */
  readonly nuconf: number;
}
