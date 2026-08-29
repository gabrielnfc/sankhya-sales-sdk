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
 * pelo descritor do endpoint e a tabela de decisao completa (ver §D2 do
 * design):
 *
 * | Valor sob a chave         | Resultado                        |
 * |----------------------------|----------------------------------|
 * | array                      | `data` = o array                 |
 * | objeto                     | `data` = `[objeto]`               |
 * | chave ausente               | degradado                        |
 * | `null` / `undefined`        | degradado                        |
 * | string, numero, booleano    | degradado                        |
 * | array vazio                 | `data` = `[]`, **nao** degradado |
 *
 * Alem disso, bloco `pagination` ausente num contrato que o declara
 * (`expectPagination: true`) tambem e degradado.
 *
 * `resourceKey: null` mantem o comportamento legado de pegar o primeiro
 * array do corpo e nunca marca degradacao — sao endpoints nao medidos
 * neste sandbox, sem contrato conhecido contra o qual julgar a resposta.
 */
export function extractRestData<T>(
  response: Record<string, unknown>,
  descriptor: ResourceDescriptor,
): { data: T[]; degraded: boolean; degradedInfo?: DegradedInfo } {
  const receivedKeys = Object.keys(response);

  if (descriptor.resourceKey === null) {
    for (const [key, value] of Object.entries(response)) {
      if (key === 'pagination') continue;
      if (Array.isArray(value)) return { data: value as T[], degraded: false };
    }
    return { data: [], degraded: false };
  }

  const valor = response[descriptor.resourceKey];

  let data: T[];
  let reason: string | null = null;

  if (Array.isArray(valor)) {
    data = valor as T[];
  } else if (valor !== null && valor !== undefined && typeof valor === 'object') {
    // A API devolve objeto quando exatamente 1 registro corresponde ao filtro.
    data = [valor as T];
  } else {
    data = [];
    reason =
      valor === undefined
        ? `chave "${descriptor.resourceKey}" ausente na resposta`
        : `chave "${descriptor.resourceKey}" nao contem registros (${valor === null ? 'null' : typeof valor})`;
  }

  if (reason === null && descriptor.expectPagination && response.pagination === undefined) {
    reason = 'bloco "pagination" ausente num endpoint que o declara';
  }

  if (reason === null) {
    return { data, degraded: false };
  }

  return {
    data,
    degraded: true,
    degradedInfo: { expectedKey: descriptor.resourceKey, receivedKeys, reason },
  };
}

/** A API usa `'true'` no contrato REST e `true` nos financeiros. */
function ehVerdadeiro(valor: unknown): boolean {
  return valor === true || valor === 'true';
}

/**
 * Converte para numero preservando o zero.
 *
 * `Number.parseInt('0', 10) || undefined` devolveria `undefined` — era
 * assim que lista legitimamente vazia perdia o total.
 */
function paraNumero(valor: unknown): number | undefined {
  if (typeof valor === 'number') return Number.isFinite(valor) ? valor : undefined;
  if (typeof valor === 'string' && valor.trim() !== '') {
    const n = Number.parseInt(valor, 10);
    return Number.isNaN(n) ? undefined : n;
  }
  return undefined;
}

/**
 * Normaliza uma resposta REST v1 ja extraida em `PaginatedResult`, aplicando
 * o contrato de paginacao declarado pelo descritor do endpoint.
 *
 * Quando `degraded` e `true`, registra o diagnostico em `error` — nivel
 * escolhido de proposito: o default do SDK e `warn`, mas uma degradacao
 * silenciosa e exatamente a falha que este trabalho existe para expor, e
 * precisa sobreviver a configuracoes que sobem o nivel minimo para `error`.
 *
 * O contrato `financeiro` nao tem ramo proprio: seus campos ja chegam como
 * numero/booleano nativos, e `paraNumero`/`ehVerdadeiro` aceitam esses tipos
 * sem conversao — o mesmo caminho do contrato `rest` (que usa string) atende
 * aos dois. So `precos` diverge de verdade, por nao ter bloco `pagination`.
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

  if (descriptor.contract === 'precos') {
    // Sem bloco `pagination`: os campos vem na raiz do corpo.
    return {
      data,
      page: paraNumero(response.pagina) ?? 1,
      hasMore: ehVerdadeiro(response.temMaisRegistros),
      totalRecords: paraNumero(response.numeroRegistros) ?? data.length,
      degraded,
    };
  }

  const pagination = response.pagination as Record<string, unknown> | undefined;
  if (!pagination) {
    return { data, page: 0, hasMore: false, totalRecords: data.length, degraded };
  }

  return {
    data,
    page: paraNumero(pagination.page) ?? 0,
    hasMore: ehVerdadeiro(pagination.hasMore),
    totalRecords: paraNumero(pagination.total),
    degraded,
  };
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
