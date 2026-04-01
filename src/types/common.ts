export interface PaginationParams {
  page?: number;
}

export interface PaginatedResult<T> {
  data: T[];
  page: number;
  hasMore: boolean;
  totalRecords?: number;
}

/**
 * Formato real de paginação REST v1 do Sankhya.
 * Todos os valores são strings.
 */
export interface RestPagination {
  page: string;
  offset: string;
  total: string;
  hasMore: string;
}

/**
 * Formato real de resposta REST v1 do Sankhya.
 * A chave do recurso varia por endpoint (produtos, clientes, vendedores, etc.).
 */
export interface RestResponse {
  pagination?: RestPagination;
  [key: string]: unknown;
}

/**
 * Formato de paginação do Gateway (dentro de entities).
 */
export interface GatewayEntities<T = unknown> {
  total?: string;
  hasMoreResult?: string;
  offsetPage?: string;
  offset?: string;
  metadata?: {
    fields: {
      field: Array<{ name: string }>;
    };
  };
  entity?: T[] | T;
}

export interface GatewayResponse<T = unknown> {
  serviceName: string;
  status: '0' | '1';
  statusMessage: string;
  responseBody?: T;
  tsError?: {
    tsErrorCode: string;
    tsErrorLevel: string;
  };
}

export interface GatewayRequest {
  serviceName: string;
  requestBody: Record<string, unknown>;
}

export interface CriteriaExpression {
  expression: string;
  parameters?: CriteriaParameter[];
}

export interface CriteriaParameter {
  value: string;
  type: 'S' | 'I' | 'F' | 'D';
}

export interface ModifiedSinceParams {
  modifiedSince?: string;
}
