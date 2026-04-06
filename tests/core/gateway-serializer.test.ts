import { describe, expect, it, vi } from 'vitest';
import { deserialize, deserializeRows, serialize } from '../../src/core/gateway-serializer.js';
import type { Logger } from '../../src/types/config.js';

function createMockLogger(): Logger {
  return {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };
}

describe('serialize', () => {
  it('deve converter valores simples para formato { $: valor }', () => {
    const result = serialize({ CODPROD: '1001', DESCRPROD: 'Produto A' });
    expect(result).toEqual({
      CODPROD: { $: '1001' },
      DESCRPROD: { $: 'Produto A' },
    });
  });

  it('deve converter números para string', () => {
    const result = serialize({ QTDNEG: 10, VLRUNIT: 25.5 });
    expect(result).toEqual({
      QTDNEG: { $: '10' },
      VLRUNIT: { $: '25.5' },
    });
  });

  it('deve tratar null e undefined como string vazia', () => {
    const result = serialize({ CAMPO: null, OUTRO: undefined });
    expect(result).toEqual({
      CAMPO: { $: '' },
      OUTRO: { $: '' },
    });
  });

  it('deve converter objetos aninhados recursivamente', () => {
    const result = serialize({
      header: { CODPARC: '123', NOME: 'Teste' },
    });
    expect(result).toEqual({
      header: { CODPARC: { $: '123' }, NOME: { $: 'Teste' } },
    });
  });

  it('deve converter arrays', () => {
    const result = serialize({
      items: [{ CODPROD: '1' }, { CODPROD: '2' }],
    });
    expect(result).toEqual({
      items: [{ CODPROD: { $: '1' } }, { CODPROD: { $: '2' } }],
    });
  });
});

describe('deserialize', () => {
  it('deve converter formato { $: valor } para valores planos', () => {
    const result = deserialize({
      CODPROD: { $: '1001' },
      DESCRPROD: { $: 'Produto A' },
    });
    expect(result).toEqual({
      CODPROD: '1001',
      DESCRPROD: 'Produto A',
    });
  });

  it('deve manter strings diretas', () => {
    const result = deserialize({ CAMPO: 'valor direto' });
    expect(result).toEqual({ CAMPO: 'valor direto' });
  });

  it('deve converter outros tipos para string', () => {
    const result = deserialize({ NUM: 42 });
    expect(result).toEqual({ NUM: '42' });
  });
});

describe('deserializeRows', () => {
  it('deve deserializar resposta real do Gateway com campos indexados (f0, f1)', () => {
    const responseBody = {
      entities: {
        total: '2',
        hasMoreResult: 'false',
        offsetPage: '0',
        offset: '0',
        metadata: {
          fields: {
            field: [
              { name: 'CODPROD' },
              { name: 'DESCRPROD' },
              { name: 'CODVOL' },
              { name: 'ATIVO' },
            ],
          },
        },
        entity: [
          {
            _rmd: {},
            f0: { $: '10398' },
            f1: { $: 'MELATONINA' },
            f2: { $: 'UN' },
            f3: { $: 'S' },
          },
          {
            _rmd: {},
            f0: { $: '10399' },
            f1: { $: 'VITAMINA C' },
            f2: { $: 'CX' },
            f3: { $: 'S' },
          },
        ],
      },
    };

    const result = deserializeRows(responseBody);
    expect(result.rows).toHaveLength(2);
    expect(result.rows[0]).toEqual({
      CODPROD: '10398',
      DESCRPROD: 'MELATONINA',
      CODVOL: 'UN',
      ATIVO: 'S',
    });
    expect(result.rows[1]).toEqual({
      CODPROD: '10399',
      DESCRPROD: 'VITAMINA C',
      CODVOL: 'CX',
      ATIVO: 'S',
    });
    expect(result.totalRecords).toBe(2);
    expect(result.hasMore).toBe(false);
    expect(result.page).toBe(0);
  });

  it('deve tratar hasMoreResult "true"', () => {
    const responseBody = {
      entities: {
        total: '100',
        hasMoreResult: 'true',
        offsetPage: '1',
        metadata: {
          fields: {
            field: [{ name: 'CODPROD' }],
          },
        },
        entity: [{ f0: { $: '1001' } }],
      },
    };

    const result = deserializeRows(responseBody);
    expect(result.hasMore).toBe(true);
    expect(result.page).toBe(1);
    expect(result.totalRecords).toBe(100);
  });

  it('deve tratar registro único (não array)', () => {
    const responseBody = {
      entities: {
        total: '1',
        hasMoreResult: 'false',
        offsetPage: '0',
        metadata: {
          fields: {
            field: [{ name: 'CODPROD' }, { name: 'DESCRPROD' }],
          },
        },
        entity: { f0: { $: '10398' }, f1: { $: 'MELATONINA' } },
      },
    };

    const result = deserializeRows(responseBody);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]).toEqual({
      CODPROD: '10398',
      DESCRPROD: 'MELATONINA',
    });
  });

  it('deve retornar vazio quando responseBody é null/undefined/{}', () => {
    expect(deserializeRows(null)).toEqual({ rows: [], totalRecords: 0, hasMore: false, page: 0 });
    expect(deserializeRows(undefined)).toEqual({
      rows: [],
      totalRecords: 0,
      hasMore: false,
      page: 0,
    });
    expect(deserializeRows({})).toEqual({ rows: [], totalRecords: 0, hasMore: false, page: 0 });
  });

  it('deve retornar vazio quando entities não tem entity', () => {
    const responseBody = {
      entities: {
        total: '0',
        hasMoreResult: 'false',
        offsetPage: '0',
      },
    };

    const result = deserializeRows(responseBody);
    expect(result.rows).toEqual([]);
    expect(result.totalRecords).toBe(0);
  });

  it('deve fallback para chaves diretas quando não há metadata', () => {
    const responseBody = {
      entities: {
        total: '1',
        hasMoreResult: 'false',
        offsetPage: '0',
        entity: [{ CODPROD: { $: '1001' }, DESCRPROD: { $: 'Produto A' }, _rmd: { data: 'xxx' } }],
      },
    };

    const result = deserializeRows(responseBody);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]).toEqual({
      CODPROD: '1001',
      DESCRPROD: 'Produto A',
    });
  });
});

describe('deserialize — TAXAJURO bug (CORE-01)', () => {
  it('deve retornar string vazia para { $: {} } (TAXAJURO)', () => {
    const result = deserialize({ TAXAJURO: { $: {} } });
    expect(result).toEqual({ TAXAJURO: '' });
  });

  it('deve retornar string vazia para { $: null }', () => {
    const result = deserialize({ CAMPO: { $: null } });
    expect(result).toEqual({ CAMPO: '' });
  });

  it('deve retornar string vazia para { $: undefined }', () => {
    const result = deserialize({ CAMPO: { $: undefined } });
    expect(result).toEqual({ CAMPO: '' });
  });
});

describe('deserializeRows — TAXAJURO in rows (CORE-01)', () => {
  it('deve retornar string vazia para campo com { $: {} }', () => {
    const responseBody = {
      entities: {
        total: '1',
        hasMoreResult: 'false',
        offsetPage: '0',
        metadata: {
          fields: {
            field: [{ name: 'CODPROD' }, { name: 'TAXAJURO' }],
          },
        },
        entity: [{ f0: { $: '100' }, f1: { $: {} }, _rmd: {} }],
      },
    };

    const result = deserializeRows(responseBody);
    expect(result.rows[0].TAXAJURO).toBe('');
  });
});

describe('deserializeRows — campos extras DHALTER (CORE-02)', () => {
  it('deve logar warning para campos alem do metadata', () => {
    const responseBody = {
      entities: {
        total: '1',
        hasMoreResult: 'false',
        offsetPage: '0',
        metadata: {
          fields: {
            field: [{ name: 'CODPROD' }, { name: 'DESCRPROD' }],
          },
        },
        entity: [
          {
            _rmd: {},
            f0: { $: '100' },
            f1: { $: 'Produto A' },
            f2: { $: '2026-01-01' },
          },
        ],
      },
    };

    const mockLogger = createMockLogger();
    deserializeRows(responseBody, mockLogger);
    expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringMatching(/Campo extra/));
  });

  it('deve preservar campos mapeados mesmo com extras', () => {
    const responseBody = {
      entities: {
        total: '1',
        hasMoreResult: 'false',
        offsetPage: '0',
        metadata: {
          fields: {
            field: [{ name: 'CODPROD' }, { name: 'DESCRPROD' }],
          },
        },
        entity: [
          {
            _rmd: {},
            f0: { $: '100' },
            f1: { $: 'Produto A' },
            f2: { $: '2026-01-01' },
          },
        ],
      },
    };

    const mockLogger = createMockLogger();
    const result = deserializeRows(responseBody, mockLogger);
    expect(result.rows[0]).toEqual({
      CODPROD: '100',
      DESCRPROD: 'Produto A',
    });
  });
});

describe('deserializeRows — resposta vazia/malformada (CORE-03)', () => {
  it('deve logar warning para null', () => {
    const mockLogger = createMockLogger();
    deserializeRows(null, mockLogger);
    expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringMatching(/vazio ou invalido/));
  });

  it('deve logar warning para objeto sem entities', () => {
    const mockLogger = createMockLogger();
    deserializeRows({}, mockLogger);
    expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringMatching(/entities/));
  });

  it('deve logar warning para undefined', () => {
    const mockLogger = createMockLogger();
    deserializeRows(undefined, mockLogger);
    expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringMatching(/vazio ou invalido/));
  });
});
