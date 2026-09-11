/**
 * Entidades do `DatasetSP` que este SDK expõe.
 *
 * Union fechada de proposito: `DatasetSP.save` escreve no ERP, e uma string
 * livre abriria a porta para qualquer entidade (inclusive as que movem saldo).
 * Entidade nova entra aqui por decisao, nao por acidente de digitacao.
 *
 * - `'CabecalhoNota'` / `'ItemNota'` — cabecalho e itens de nota/pedido (TGFCAB/TGFITE).
 * - `'Estoque'` — saldo por lote (TGFEST).
 * - `'Produto'` — cadastro de produto (TGFPRO).
 * - `'CabecalhoConferencia'` / `'DetalhesConferencia'` — conferencia nativa (TGFCON/TGFCON2).
 * - `'ContagemEstoque'` — **SOMENTE leitura/historico.** Gravar nesta entidade
 *   **nao move estoque** (M105): ela registra a contagem, e o acerto de saldo
 *   continua sendo feito por nota com `ATUALESTOQUE`. Nao use `dataset.save`
 *   sobre ela esperando efeito em TGFEST — a rota foi medida e descartada.
 */
export type DatasetEntity =
  | 'CabecalhoNota'
  | 'ItemNota'
  | 'Estoque'
  | 'Produto'
  | 'CabecalhoConferencia'
  | 'DetalhesConferencia'
  | 'ContagemEstoque';

/**
 * Um registro no formato que `DatasetSP.save` exige.
 *
 * Construa com `datasetRecord()` — escrever o indice posicional a mao e a
 * fonte de bug mais provavel desta API.
 */
export interface DatasetRecord {
  /**
   * Chave do registro a atualizar. Ausente = insercao (M88).
   *
   * Chave = nome do campo (`NUNOTA`), nao indice — diferente de `values`.
   */
  readonly pk?: Readonly<Record<string, string>>;
  /** chave = indice POSICIONAL em `fields`, como string ('0','1',...) */
  readonly values: Readonly<Record<string, string>>;
}

/** Parametros de `dataset.save` (`DatasetSP.save`). */
export interface DatasetSaveParams {
  /** Entidade alvo. */
  readonly entityName: DatasetEntity;
  /** Campos na ordem que indexa `DatasetRecord.values`. */
  readonly fields: readonly string[];
  /** Registros a inserir (sem `pk`) ou atualizar (com `pk`). */
  readonly records: readonly DatasetRecord[];
  /**
   * `true` desliga as regras/triggers da entidade no servidor. Default `false`.
   *
   * O default e conservador de proposito: `standAlone: true` silenciosamente
   * ignoraria as regras do ERP.
   */
  readonly standAlone?: boolean;
}

/** Resposta de `DatasetSP.save`, normalizada. */
export interface DatasetSaveResult {
  /** Quantidade de registros afetados, conforme o campo `total` da resposta. */
  readonly total: number;
  /** Linhas devolvidas pelo servidor, posicionais como `fields`, toda celula string. */
  readonly result: readonly (readonly string[])[];
}

/** Parametros de `dataset.removeRecord` (`DatasetSP.removeRecord`). */
export interface DatasetRemoveParams {
  /** Entidade alvo. */
  readonly entityName: DatasetEntity;
  /** Chaves dos registros a remover. Lista vazia e pk vazia sao recusadas (R2). */
  readonly pks: ReadonlyArray<Record<string, string>>;
  /** `true` desliga as regras/triggers da entidade. Default `false`. */
  readonly standAlone?: boolean;
}

/** Parametros de `dataset.load` (leitura via `CRUDServiceProvider.loadRecords`). */
export interface DatasetLoadParams {
  /** Entidade alvo. */
  readonly entityName: DatasetEntity;
  /** Campos a trazer. */
  readonly fields: readonly string[];
  /** Expressao de filtro SQL-like (ex: `"this.NUNOTA = 1889280"`). */
  readonly criteria?: string;
  /** Pagina de offset (base 0). */
  readonly page?: number;
}

/**
 * Resposta crua de `DatasetSP.save`, como o Gateway devolve.
 *
 * Ambos os campos sao opcionais e `unknown` porque e fronteira externa: o
 * resource valida a presenca e a forma antes de converter, e **lanca** em vez
 * de devolver `total: 0` / `result: []` silencioso (I11).
 */
export interface DatasetSaveRawResponse {
  /** `total` vem como string na resposta medida (`'1'`). */
  readonly total?: unknown;
  /** Linhas posicionais; celulas nem sempre string. */
  readonly result?: unknown;
}
