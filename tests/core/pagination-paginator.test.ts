import { describe, expect, it, vi } from 'vitest';
import { createPaginator } from '../../src/core/pagination.js';
import type { PaginatedResult } from '../../src/types/common.js';

function pagina<T>(
  data: T[],
  hasMore: boolean,
  echo: number,
  degraded = false,
): PaginatedResult<T> {
  return { data, page: echo, hasMore, totalRecords: undefined, degraded };
}

describe('createPaginator', () => {
  it('avanca por contador local, ignorando o echo do servidor', async () => {
    const visitadas: number[] = [];
    const fetchFn = async (page: number) => {
      visitadas.push(page);
      return pagina([{ id: page }], visitadas.length < 3, 0); // echo sempre 0
    };

    const itens = [];
    for await (const item of createPaginator(fetchFn, 1)) itens.push(item);

    expect(visitadas).toEqual([1, 2, 3]);
    expect(itens).toHaveLength(3);
  });

  it('para em pagina vazia com hasMore verdadeiro, sinalizando, sem laco infinito', async () => {
    const visitadas: number[] = [];
    const onDegraded = vi.fn();
    const error = vi.fn();
    const logger = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error };
    const fetchFn = async (page: number) => {
      visitadas.push(page);
      return page === 0 ? pagina([{ id: 0 }], true, page) : pagina<{ id: number }>([], true, page);
    };

    const itens = [];
    for await (const item of createPaginator(fetchFn, 0, { onDegraded, logger })) itens.push(item);

    expect(visitadas).toEqual([0, 1]);
    expect(itens).toHaveLength(1);
    expect(onDegraded).toHaveBeenCalledTimes(1);
    expect(error).toHaveBeenCalledTimes(1);
    expect(error.mock.calls[0]?.[0]).toContain('hasMore');
  });

  it('pagina vazia com hasMore falso encerra em silencio — fim normal', async () => {
    const visitadas: number[] = [];
    const onDegraded = vi.fn();
    const error = vi.fn();
    const logger = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error };
    const fetchFn = async (page: number) => {
      visitadas.push(page);
      return page === 0 ? pagina([{ id: 0 }], true, page) : pagina<{ id: number }>([], false, page);
    };

    for await (const _ of createPaginator(fetchFn, 0, { onDegraded, logger })) {
      // consumir
    }

    // Prova que a varredura de fato chegou na pagina vazia final — sem
    // isto o teste passaria mesmo se o laco parasse cedo demais, sem
    // nunca exercitar o ramo "fim normal" que da nome ao teste.
    expect(visitadas).toEqual([0, 1]);
    expect(onDegraded).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();
  });

  it('chama onDegraded uma vez por pagina degradada', async () => {
    const onDegraded = vi.fn();
    const fetchFn = async (page: number) => pagina([{ id: page }], page < 1, page, true);

    for await (const _ of createPaginator(fetchFn, 0, { onDegraded })) {
      // consumir
    }

    expect(onDegraded).toHaveBeenCalledTimes(2);
    expect(onDegraded.mock.calls[0]?.[0]).toMatchObject({ page: 0 });
  });

  it('avisa uma unica vez ao ultrapassar 100 paginas', async () => {
    const warn = vi.fn();
    const logger = { debug: vi.fn(), info: vi.fn(), warn, error: vi.fn() };
    const fetchFn = async (page: number) => pagina([{ id: page }], page < 150, page);

    for await (const _ of createPaginator(fetchFn, 0, { logger })) {
      // consumir
    }

    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]?.[0]).toContain('100');
  });
});
