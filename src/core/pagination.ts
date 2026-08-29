import type { GatewayEntities, PaginatedResult, RestPagination } from '../types/common.js';
import type { Logger } from '../types/config.js';
import type { DegradedInfo, ResourceDescriptor } from '../types/pagination-contracts.js';
import { SankhyaError } from './errors.js';

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
 * Extrai o array de dados de uma resposta REST v1, usando a chave declarada
 * pelo descritor do endpoint quando ela existe.
 *
 * Nesta task a semantica de fallback (primeiro array do corpo) e preservada
 * integralmente — inclusive quando a chave declarada existe mas nao bate.
 * A Task 4 substitui isto pela tabela de decisao que classifica degradacao.
 */
export function extractRestData<T>(
  response: Record<string, unknown>,
  descriptor: ResourceDescriptor,
): { data: T[]; degraded: boolean; degradedInfo?: DegradedInfo } {
  if (descriptor.resourceKey !== null) {
    const valor = response[descriptor.resourceKey];
    if (Array.isArray(valor)) {
      return { data: valor as T[], degraded: false };
    }
  }
  // Comportamento antigo preservado nesta task, e permanente para
  // resourceKey null: cai para o primeiro array.
  // A Task 4 substitui isto pela tabela de decisao.
  for (const [key, value] of Object.entries(response)) {
    if (key === 'pagination') continue;
    if (Array.isArray(value)) return { data: value as T[], degraded: false };
  }
  return { data: [], degraded: false };
}

/**
 * Normaliza uma resposta REST v1 ja extraida em `PaginatedResult`, aplicando
 * o contrato de paginacao declarado pelo descritor do endpoint.
 *
 * Quando `degraded` e `true`, registra o diagnostico em `error` — nivel
 * escolhido de proposito: o default do SDK e `warn`, mas uma degradacao
 * silenciosa e exatamente a falha que este trabalho existe para expor, e
 * precisa sobreviver a configuracoes que sobem o nivel minimo para `error`.
 */
export function normalizePagination<T>(
  data: T[],
  response: Record<string, unknown>,
  descriptor: ResourceDescriptor,
  degraded: boolean,
  logger?: Logger,
  degradedInfo?: DegradedInfo,
): PaginatedResult<T> {
  if (degraded && logger) {
    logger.error(
      `Resposta degradada: ${degradedInfo?.reason ?? 'formato inesperado'} ` +
        `(chave esperada "${descriptor.resourceKey}", recebidas: ${degradedInfo?.receivedKeys?.join(', ') ?? 'nenhuma'})`,
    );
  }

  const pagination = response.pagination as RestPagination | undefined;
  const base = normalizeRestPagination(data, pagination);
  return { ...base, degraded };
}

/**
 * Desempacota o registro unico de uma resposta REST de GET-por-id, no formato
 * `{ "<recurso>": { ...campos } }` (ex.: `{ "grupos": { codigoGrupoProduto, ... } }`).
 *
 * Retorna o primeiro valor objeto sob uma chave que nao seja metadado. Se `key`
 * for informado, usa essa chave diretamente. Retorna `null` quando nao ha
 * registro (resposta vazia ou so metadados).
 */
export function extractRestRecord<T>(response: Record<string, unknown>, key?: string): T | null {
  if (key) {
    const value = response[key];
    return value && typeof value === 'object' && !Array.isArray(value) ? (value as T) : null;
  }
  for (const [k, value] of Object.entries(response)) {
    if (k === 'pagination' || k === 'status' || k === 'statusMessage') continue;
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return value as T;
    }
  }
  return null;
}

/**
 * Como `extractRestRecord`, mas lanca `SankhyaError('NOT_FOUND')` quando a
 * resposta nao traz registro — mantendo o contrato nao-nulo dos metodos `buscar*`.
 */
export function extractRestRecordOrThrow<T>(
  response: Record<string, unknown>,
  notFoundMessage: string,
  key?: string,
): T {
  const record = extractRestRecord<T>(response, key);
  if (!record) {
    throw new SankhyaError(notFoundMessage, 'NOT_FOUND');
  }
  return record;
}

export type FetchPage<T> = (page: number) => Promise<PaginatedResult<T>>;

export async function* createPaginator<T>(fetchFn: FetchPage<T>, startPage = 0): AsyncGenerator<T> {
  let currentPage = startPage;
  let hasMore = true;

  while (hasMore) {
    const result = await fetchFn(currentPage);
    const pageData = result.data;
    const nextPage = result.page + 1;
    const continueIterating = result.hasMore && result.data.length > 0;

    for (const item of pageData) {
      yield item;
    }

    hasMore = continueIterating;
    currentPage = nextPage;
  }
}
