/**
 * Testes de caracterizacao dos contratos de paginacao reais do Sankhya.
 *
 * Todos os payloads abaixo foram MEDIDOS contra o sandbox em 29/08/2026,
 * nao inventados. Ver docs/superpowers/specs/2026-08-29-paginacao-degradada-design.md
 *
 * Os testes marcados com `it.fails` documentam bugs confirmados na 1.4.0:
 * eles asseguram que o comportamento errado AINDA existe. Quando a correcao
 * entrar, `it.fails` passa a falhar e obriga a virar `it` — o RED do TDD,
 * commitado antes da implementacao.
 */
import { describe, expect, it } from 'vitest';
import { deserializeRows } from '../../src/core/gateway-serializer.js';
import {
  createPaginator,
  extractRestData,
  normalizePagination,
  normalizeRestPagination,
} from '../../src/core/pagination.js';
import type { RestPagination } from '../../src/types/common.js';
import type { ResourceDescriptor } from '../../src/types/pagination-contracts.js';

describe('contrato REST padrao', () => {
  const descritorProdutos: ResourceDescriptor = {
    resourceKey: 'produtos',
    contract: 'rest',
    expectPagination: true,
  };

  // Medido: GET /v1/produtos?modifiedSince=14/08/2026 17:01:02
  // -> { "produtos": { ...objeto unico... }, "pagination": { "total": "1" } }
  it('resultado unico chega como objeto e deve virar array de 1 elemento', () => {
    const resposta = {
      produtos: {
        'dataAlteracao:': '14/08/2026 17:01:02',
        codigoProduto: 10104,
        nome: 'WAFER TRUE CRUNCH PRO CHOCOLATE MEIO AMARGO',
      },
      pagination: { page: '0', offset: '0', total: '1', hasMore: 'false' },
    };

    const { data } = extractRestData<{ codigoProduto: number }>(resposta, descritorProdutos);

    expect(data).toHaveLength(1);
    expect(data[0]?.codigoProduto).toBe(10104);
  });

  it('array vazio com bloco pagination e lista vazia legitima', () => {
    const resposta = {
      produtos: [],
      pagination: { page: '0', offset: '0', total: '0', hasMore: 'false' },
    };

    const { data, degraded } = extractRestData(resposta, descritorProdutos);

    expect(data).toEqual([]);
    // Array vazio sob a chave declarada, com bloco pagination coerente
    // (total "0"), e lista vazia legitima — nao deve ser tratada como
    // degradacao (nem nesta task, nem depois que a Task 4 ativar a deteccao).
    expect(degraded).toBe(false);
  });

  it('total "0" deve normalizar para 0, nao para undefined', () => {
    const pagination: RestPagination = { page: '0', offset: '0', total: '0', hasMore: 'false' };

    const resultado = normalizePagination([], { pagination }, descritorProdutos, false);

    expect(resultado.totalRecords).toBe(0);
  });
});

describe('contrato financeiro (/financeiros/receitas, /financeiros/despesas)', () => {
  // Medido: { page: 1, pageSize: 50, total: 519004, totalPages: 10381, hasMore: true }
  // Numeros e booleano — nao strings. Base 1.
  const paginacaoFinanceiro = {
    page: 1,
    pageSize: 50,
    total: 519004,
    totalPages: 10381,
    hasMore: true,
  } as unknown as RestPagination;

  const descritorFinanceiro: ResourceDescriptor = {
    resourceKey: 'receitas',
    contract: 'financeiro',
    expectPagination: true,
  };

  it('hasMore booleano true deve ser reconhecido como verdadeiro', () => {
    const resultado = normalizePagination(
      [{ codigoFinanceiro: -866265 }],
      { pagination: paginacaoFinanceiro },
      descritorFinanceiro,
      false,
    );

    expect(resultado.hasMore).toBe(true);
  });

  it('total numerico e preservado', () => {
    const resultado = normalizeRestPagination([], paginacaoFinanceiro);

    expect(resultado.totalRecords).toBe(519004);
  });
});

describe('contrato precos (/precos/tabela, /precos/produto)', () => {
  const descritorPrecos: ResourceDescriptor = {
    resourceKey: 'produtos',
    contract: 'precos',
    expectPagination: false,
  };

  // Medido: GET /v1/precos/tabela/0?pagina=1
  // -> { codigo, pagina, numeroRegistros, temMaisRegistros, produtos: [...] }
  // Sem bloco `pagination`. Base 1.
  const respostaPrecos = {
    codigo: '200',
    pagina: 1,
    numeroRegistros: 50,
    temMaisRegistros: true,
    tipo: 'Processamento realizado',
    mensagem: 'Consulta realizada com sucesso!',
    produtos: Array.from({ length: 50 }, (_, i) => ({ codigoProduto: i + 1, valor: 0 })),
  };

  it('temMaisRegistros true deve produzir hasMore true', () => {
    const { data } = extractRestData<{ codigoProduto: number }>(respostaPrecos, descritorPrecos);
    const resultado = normalizePagination(data, respostaPrecos, descritorPrecos, false);

    expect(resultado.data).toHaveLength(50);
    expect(resultado.hasMore).toBe(true);
  });

  // NAO e bug: sem bloco `pagination`, normalizeRestPagination ja usa
  // data.length como totalRecords — e em toda medicao `numeroRegistros`
  // foi igual ao tamanho do array. O campo e redundante, e o criterio de
  // aceite que o exigia era vazio. Mantido como teste de regressao.
  it('totalRecords ja corresponde a numeroRegistros via data.length', () => {
    const { data } = extractRestData(respostaPrecos, descritorPrecos);
    const resultado = normalizeRestPagination(data, undefined);

    expect(resultado.totalRecords).toBe(respostaPrecos.numeroRegistros);
  });
});

describe('createPaginator — iteracao', () => {
  it('startPage 1 com echo de pagina ausente deve avancar, nao repetir', async () => {
    const paginasVisitadas: number[] = [];

    // Servidor que nao ecoa `page` — normalizeRestPagination produz page: 0.
    // Com iteracao dirigida pelo echo, nextPage volta sempre a 1.
    const fetchPage = async (page: number) => {
      paginasVisitadas.push(page);
      const acabou = paginasVisitadas.length >= 5;
      return {
        data: [{ id: page }],
        page: 0,
        hasMore: !acabou,
        totalRecords: undefined,
      };
    };

    const itens: { id: number }[] = [];
    for await (const item of createPaginator(fetchPage, 1)) {
      itens.push(item);
    }

    expect(paginasVisitadas).toEqual([1, 2, 3, 4, 5]);
  });

  it('varredura normal com echo correto percorre todas as paginas', async () => {
    const paginasVisitadas: number[] = [];
    const fetchPage = async (page: number) => {
      paginasVisitadas.push(page);
      return { data: [{ id: page }], page, hasMore: page < 2, totalRecords: undefined };
    };

    const itens: { id: number }[] = [];
    for await (const item of createPaginator(fetchPage, 0)) {
      itens.push(item);
    }

    expect(paginasVisitadas).toEqual([0, 1, 2]);
    expect(itens).toHaveLength(3);
  });
});

describe('deserializeRows — Gateway', () => {
  it.fails('total "0" deve normalizar para 0, nao para undefined', () => {
    const responseBody = {
      entities: {
        total: '0',
        hasMoreResult: 'false',
        offsetPage: '0',
        metadata: { fields: { field: [{ name: 'CODPARC' }] } },
        entity: [] as unknown[],
      },
    };

    const resultado = deserializeRows(responseBody);

    expect(resultado.totalRecords).toBe(0);
  });

  it('entity ausente com entities presente e pagina vazia legitima', () => {
    const responseBody = { entities: { total: '0', hasMoreResult: 'false', offsetPage: '0' } };

    const resultado = deserializeRows(responseBody);

    expect(resultado.rows).toEqual([]);
    expect(resultado.hasMore).toBe(false);
  });
});
