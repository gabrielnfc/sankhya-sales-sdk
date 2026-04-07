/** Parametros para carregar multiplos registros via Gateway. */
export interface LoadRecordsParams {
  /** Nome da entidade Sankhya (ex: `'Parceiro'`, `'Produto'`). */
  entity: string;
  /** Lista de campos separados por virgula (ex: `'CODPARC,NOMEPARC'`). */
  fields: string;
  /** Expressao de filtro SQL-like (ex: `"this.ATIVO = 'S'"`). */
  criteria?: string;
  /** Pagina de offset (base 0). */
  page?: number;
  /** Incluir campos de apresentacao. */
  includePresentationFields?: boolean;
}

/** Parametros para carregar um unico registro via Gateway. */
export interface LoadRecordParams {
  /** Nome da entidade Sankhya. */
  entity: string;
  /** Lista de campos separados por virgula. */
  fields: string;
  /** Chave primaria como pares campo-valor. */
  primaryKey: Record<string, string>;
}

/** Parametros para salvar um registro via Gateway. */
export interface SaveRecordParams {
  /** Nome da entidade Sankhya. */
  entity: string;
  /** Lista de campos separados por virgula. */
  fields: string;
  /** Dados a salvar como pares campo-valor. */
  data: Record<string, string>;
}

/** Registro do Gateway com ID e campos. */
export interface GatewayDataRow {
  /** Identificador do registro. */
  id: string;
  /** Campos do registro como pares chave-valor. */
  fields: Record<string, string>;
}
