import type { DegradedInfo } from './pagination-contracts.js';

/** Parametros de paginacao para listagens. */
export interface PaginationParams {
  /** Numero da pagina (base 0). */
  page?: number;
}

/**
 * Resultado paginado de uma listagem.
 *
 * @typeParam T - Tipo dos itens retornados.
 */
export interface PaginatedResult<T> {
  /** Itens da pagina atual. */
  data: T[];
  /** Numero da pagina atual (base 0). */
  page: number;
  /** Indica se existem mais paginas. */
  hasMore: boolean;
  /** Total de registros (quando disponivel na API). */
  totalRecords?: number | undefined;
  /**
   * `true` quando a resposta nao trouxe o formato declarado pelo endpoint
   * e os dados podem estar incompletos.
   *
   * Opcional no tipo para nao quebrar quem constroi `PaginatedResult` em
   * mocks; **sempre presente** no retorno do SDK. Lista vazia legitima
   * vem com `degraded: false`.
   */
  degraded?: boolean | undefined;
  /**
   * Diagnostico da degradacao, quando `degraded` e `true`. Aditivo e
   * opcional — nao presente antes da 1.5.0.
   */
  degradedInfo?: DegradedInfo | undefined;
}

/**
 * Formato real de paginacao REST v1 do Sankhya.
 * Todos os valores sao strings.
 */
export interface RestPagination {
  /** Pagina atual (string). */
  page: string;
  /** Offset do primeiro registro (string). */
  offset: string;
  /** Total de registros (string). */
  total: string;
  /** Indica se ha mais resultados (string `'true'`/`'false'`). */
  hasMore: string;
}

/**
 * Formato real de resposta REST v1 do Sankhya.
 *
 * A chave do recurso varia por endpoint
 * (`'produtos'`, `'clientes'`, `'vendedores'`, etc.).
 */
export interface RestResponse {
  /** Metadados de paginacao. */
  pagination?: RestPagination;
  /** Dados do recurso (chave dinamica). */
  [key: string]: unknown;
}

/**
 * Formato de entidades do Gateway Sankhya.
 *
 * Contem metadados de paginacao e registros retornados
 * pelo servico `loadRecords`.
 *
 * @typeParam T - Tipo dos registros individuais.
 */
export interface GatewayEntities<T = unknown> {
  /** Total de registros (string). */
  total?: string;
  /** Indica se ha mais resultados (string). */
  hasMoreResult?: string;
  /** Pagina de offset (string). */
  offsetPage?: string;
  /** Offset absoluto (string). */
  offset?: string;
  /** Metadados dos campos retornados. */
  metadata?: {
    fields: {
      field: Array<{ name: string }>;
    };
  };
  /** Registros retornados (array ou objeto unico). */
  entity?: T[] | T;
}

/** Resposta padrao do Gateway Sankhya. */
export interface GatewayResponse<T = unknown> {
  /** Nome do servico chamado. */
  serviceName: string;
  /** Status da operacao (`'0'` = erro, `'1'` = sucesso). */
  status: '0' | '1';
  /** Mensagem descritiva do status. */
  statusMessage: string;
  /** Corpo da resposta (quando sucesso). */
  responseBody?: T;
  /** Detalhes do erro Sankhya (quando falha). */
  tsError?: {
    tsErrorCode: string;
    tsErrorLevel: string;
  };
}

/** Requisicao para o Gateway Sankhya. */
export interface GatewayRequest {
  /** Nome do servico a ser chamado. */
  serviceName: string;
  /** Corpo da requisicao (wrapper obrigatorio). */
  requestBody: Record<string, unknown>;
}

/**
 * Expressao de filtro para consultas Gateway.
 *
 * Usa sintaxe SQL-like com parametros posicionais.
 *
 * @example
 * ```ts
 * const criteria: CriteriaExpression = {
 *   expression: 'CODPARC = ? AND ATIVO = ?',
 *   parameters: [
 *     { value: '123', type: 'I' },
 *     { value: 'S', type: 'S' },
 *   ],
 * };
 * ```
 */
export interface CriteriaExpression {
  /** Expressao SQL-like com placeholders `?`. */
  expression: string;
  /** Valores dos parametros posicionais. */
  parameters?: CriteriaParameter[];
}

/** Parametro de filtro para expressoes Gateway. */
export interface CriteriaParameter {
  /** Valor do parametro. */
  value: string;
  /** Tipo do parametro: S=String, I=Integer, F=Float, D=Date. */
  type: 'S' | 'I' | 'F' | 'D';
}

/** Parametros de filtro por data de modificacao. */
export interface ModifiedSinceParams {
  /**
   * Data no formato `dd/MM/yyyy` ou `dd/MM/yyyy HH:mm:ss`.
   *
   * **Nao aceita ISO 8601** — a API responde `400 ORA-01861`. O filtro e
   * inclusivo (`>=`). Uma janela sem alteracoes responde `404
   * RESOURCE_NOT_FOUND`, nao lista vazia.
   */
  modifiedSince?: string;
}
