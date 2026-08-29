import type { PaginatedResult, RestPagination } from '../../src/types/common.js';

// Codigo de consumidor real, escrito contra o tipo publicado na 1.4.0.
// Se RestPagination for alargada, estas linhas param de compilar.
export function consumidorRestPagination(p: RestPagination) {
  const total: string = p.total;
  const page: string = p.page;
  const offset: string = p.offset;
  const hasMore: string = p.hasMore;
  return { total, page, offset, hasMore };
}

// Consumidor que constroi PaginatedResult (mock de teste).
// `degraded` precisa ser opcional, senao esta construcao quebra.
export function consumidorConstroiResultado(): PaginatedResult<{ id: number }> {
  return { data: [{ id: 1 }], page: 0, hasMore: false, totalRecords: 1 };
}

// Consumidor que le `degraded` do retorno do SDK.
export function consumidorLeDegraded(r: PaginatedResult<{ id: number }>): boolean {
  return r.degraded === true;
}
