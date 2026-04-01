import { describe, expect, it } from 'vitest';
import {
  createPaginator,
  extractRestData,
  normalizeGatewayPagination,
  normalizeRestPagination,
} from '../../src/core/pagination.js';

describe('normalizeRestPagination', () => {
  it('deve normalizar paginação REST com valores string', () => {
    const result = normalizeRestPagination([{ id: 1 }, { id: 2 }], {
      page: '0',
      offset: '0',
      total: '50',
      hasMore: 'true',
    });
    expect(result).toEqual({
      data: [{ id: 1 }, { id: 2 }],
      page: 0,
      hasMore: true,
      totalRecords: 50,
    });
  });

  it('deve retornar hasMore=false quando hasMore é "false"', () => {
    const result = normalizeRestPagination([{ id: 1 }], {
      page: '2',
      offset: '40',
      total: '42',
      hasMore: 'false',
    });
    expect(result.hasMore).toBe(false);
    expect(result.page).toBe(2);
    expect(result.totalRecords).toBe(42);
  });

  it('deve tratar ausência de pagination', () => {
    const result = normalizeRestPagination([{ id: 1 }, { id: 2 }], undefined);
    expect(result).toEqual({
      data: [{ id: 1 }, { id: 2 }],
      page: 0,
      hasMore: false,
      totalRecords: 2,
    });
  });
});

describe('normalizeGatewayPagination', () => {
  it('deve normalizar paginação Gateway', () => {
    const result = normalizeGatewayPagination([{ CODPROD: '1001' }], {
      total: '100',
      hasMoreResult: 'true',
      offsetPage: '0',
    });
    expect(result).toEqual({
      data: [{ CODPROD: '1001' }],
      page: 0,
      hasMore: true,
      totalRecords: 100,
    });
  });

  it('deve retornar hasMore=false quando hasMoreResult não é "true"', () => {
    const result = normalizeGatewayPagination([{ CODPROD: '1001' }], {
      total: '1',
      hasMoreResult: 'false',
      offsetPage: '0',
    });
    expect(result.hasMore).toBe(false);
  });

  it('deve tratar ausência de entities', () => {
    const result = normalizeGatewayPagination([], undefined);
    expect(result).toEqual({
      data: [],
      page: 0,
      hasMore: false,
      totalRecords: 0,
    });
  });
});

describe('extractRestData', () => {
  it('deve extrair array de dados e pagination', () => {
    const response = {
      produtos: [{ id: 1 }, { id: 2 }],
      pagination: { page: '0', offset: '0', total: '2', hasMore: 'false' },
    };
    const { data, pagination } = extractRestData(response);
    expect(data).toEqual([{ id: 1 }, { id: 2 }]);
    expect(pagination).toEqual({ page: '0', offset: '0', total: '2', hasMore: 'false' });
  });

  it('deve retornar array vazio quando não há dados', () => {
    const response = {
      pagination: { page: '0', offset: '0', total: '0', hasMore: 'false' },
    };
    const { data } = extractRestData(response);
    expect(data).toEqual([]);
  });

  it('deve encontrar o primeiro array independente da chave', () => {
    const response = {
      vendedores: [{ nome: 'João' }],
      pagination: { page: '0', offset: '0', total: '1', hasMore: 'false' },
    };
    const { data } = extractRestData(response);
    expect(data).toEqual([{ nome: 'João' }]);
  });
});

describe('createPaginator', () => {
  it('deve iterar todas as páginas automaticamente', async () => {
    const pages = [
      { data: [1, 2, 3], page: 0, hasMore: true },
      { data: [4, 5, 6], page: 1, hasMore: true },
      { data: [7], page: 2, hasMore: false },
    ];

    let callIndex = 0;
    const fetchFn = async (page: number) => {
      const result = pages[callIndex] ?? { data: [], page: 0, hasMore: false };
      callIndex++;
      expect(page).toBe(result.page);
      return result;
    };

    const items: number[] = [];
    for await (const item of createPaginator(fetchFn)) {
      items.push(item);
    }

    expect(items).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it('deve parar em página vazia', async () => {
    const fetchFn = async (_page: number) => ({
      data: [] as number[],
      page: 0,
      hasMore: true, // hasMore é true mas data vazia → para
    });

    const items: number[] = [];
    for await (const item of createPaginator(fetchFn)) {
      items.push(item);
    }

    expect(items).toEqual([]);
  });

  it('deve suportar startPage customizado', async () => {
    const pages: number[] = [];
    const fetchFn = async (page: number) => {
      pages.push(page);
      return { data: [page], page, hasMore: false };
    };

    for await (const _item of createPaginator(fetchFn, 5)) {
      // consume
    }

    expect(pages).toEqual([5]);
  });
});
