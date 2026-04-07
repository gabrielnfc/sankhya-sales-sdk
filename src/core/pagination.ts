import type { GatewayEntities, PaginatedResult, RestPagination } from '../types/common.js';

/**
 * Normaliza resposta REST v1 para PaginatedResult.
 *
 * Formato real da API:
 * { "[resource]": [...], "pagination": { "page": "0", "offset": "0", "total": "50", "hasMore": "true" } }
 */
export function normalizeRestPagination<T>(
  data: T[],
  pagination?: RestPagination,
): PaginatedResult<T> {
  if (!pagination) {
    return { data, page: 0, hasMore: false, totalRecords: data.length };
  }

  return {
    data,
    page: Number.parseInt(pagination.page, 10) || 0,
    hasMore: pagination.hasMore === 'true',
    totalRecords: Number.parseInt(pagination.total, 10) || undefined,
  };
}

/**
 * Normaliza resposta Gateway para PaginatedResult.
 *
 * Formato real da API:
 * { entities: { total: "50", hasMoreResult: "true", offsetPage: "0", entity: [...] } }
 */
export function normalizeGatewayPagination<T>(
  data: T[],
  entities?: GatewayEntities,
): PaginatedResult<T> {
  if (!entities) {
    return { data, page: 0, hasMore: false, totalRecords: 0 };
  }

  return {
    data,
    page: Number.parseInt(entities.offsetPage ?? '0', 10) || 0,
    hasMore: entities.hasMoreResult === 'true',
    totalRecords: Number.parseInt(entities.total ?? '0', 10) || undefined,
  };
}

/**
 * Extrai o array de dados de uma resposta REST v1.
 * A chave do recurso varia por endpoint — esta função encontra o primeiro array.
 */
export function extractRestData<T>(response: Record<string, unknown>): {
  data: T[];
  pagination?: RestPagination | undefined;
} {
  const pagination = response.pagination as RestPagination | undefined;
  let data: T[] = [];

  for (const [key, value] of Object.entries(response)) {
    if (key === 'pagination') continue;
    if (Array.isArray(value)) {
      data = value as T[];
      break;
    }
  }

  return { data, pagination };
}

export type FetchPage<T> = (page: number) => Promise<PaginatedResult<T>>;

export async function* createPaginator<T>(fetchFn: FetchPage<T>, startPage = 0): AsyncGenerator<T> {
  let currentPage = startPage;
  let hasMore = true;

  while (hasMore) {
    const result = await fetchFn(currentPage);
    for (const item of result.data) {
      yield item;
    }
    hasMore = result.hasMore && result.data.length > 0;
    currentPage = result.page + 1;
  }
}
