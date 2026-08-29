import { describe, expect, it } from 'vitest';
import { extractRestData } from '../../src/core/pagination.js';
import type { ResourceDescriptor } from '../../src/types/pagination-contracts.js';

const DESCRITOR: ResourceDescriptor = {
  resourceKey: 'produtos',
  contract: 'rest',
  expectPagination: true,
};

const PAGINATION = { page: '0', offset: '0', total: '1', hasMore: 'false' };

describe('extractRestData — tabela de decisao', () => {
  it('array vira data', () => {
    const r = extractRestData<{ id: number }>(
      { produtos: [{ id: 1 }, { id: 2 }], pagination: PAGINATION },
      DESCRITOR,
    );
    expect(r.data).toHaveLength(2);
    expect(r.degraded).toBe(false);
  });

  it('objeto vira array de um elemento', () => {
    const r = extractRestData<{ id: number }>(
      { produtos: { id: 1 }, pagination: PAGINATION },
      DESCRITOR,
    );
    expect(r.data).toEqual([{ id: 1 }]);
    expect(r.degraded).toBe(false);
  });

  it('array vazio e lista vazia legitima', () => {
    const r = extractRestData({ produtos: [], pagination: PAGINATION }, DESCRITOR);
    expect(r.data).toEqual([]);
    expect(r.degraded).toBe(false);
  });

  it('chave ausente e degradado', () => {
    const r = extractRestData({ outraCoisa: [{ id: 1 }], pagination: PAGINATION }, DESCRITOR);
    expect(r.data).toEqual([]);
    expect(r.degraded).toBe(true);
    expect(r.degradedInfo?.expectedKey).toBe('produtos');
    expect(r.degradedInfo?.receivedKeys).toContain('outraCoisa');
  });

  it('chave com null e degradado', () => {
    const r = extractRestData({ produtos: null, pagination: PAGINATION }, DESCRITOR);
    expect(r.degraded).toBe(true);
  });

  it('chave com escalar e degradado', () => {
    const r = extractRestData({ produtos: 'erro inesperado', pagination: PAGINATION }, DESCRITOR);
    expect(r.degraded).toBe(true);
  });

  it('bloco pagination ausente e degradado quando o contrato o declara', () => {
    const r = extractRestData({ produtos: [{ id: 1 }] }, DESCRITOR);
    expect(r.data).toHaveLength(1);
    expect(r.degraded).toBe(true);
    expect(r.degradedInfo?.reason).toContain('pagination');
  });

  it('resourceKey null mantem o comportamento legado e nunca degrada', () => {
    const descritorNaoMedido: ResourceDescriptor = {
      resourceKey: null,
      contract: 'rest',
      expectPagination: false,
    };
    const r = extractRestData<{ id: number }>({ qualquerChave: [{ id: 1 }] }, descritorNaoMedido);
    expect(r.data).toEqual([{ id: 1 }]);
    expect(r.degraded).toBe(false);
  });

  it('bloco pagination ausente NAO e degradado no contrato precos', () => {
    const descritorPrecos: ResourceDescriptor = {
      resourceKey: 'produtos',
      contract: 'precos',
      expectPagination: false,
    };
    const r = extractRestData(
      {
        codigo: '200',
        pagina: 1,
        numeroRegistros: 1,
        temMaisRegistros: false,
        produtos: [{ id: 1 }],
      },
      descritorPrecos,
    );
    expect(r.degraded).toBe(false);
  });
});
