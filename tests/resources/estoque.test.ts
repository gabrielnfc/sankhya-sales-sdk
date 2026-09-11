import { describe, expect, it, vi } from 'vitest';
import type { HttpClient } from '../../src/core/http.js';
import type { DbExplorerResource } from '../../src/resources/db-explorer.js';
import { EstoqueResource } from '../../src/resources/estoque.js';

function createMockHttp(overrides?: Partial<HttpClient>) {
  return {
    restGet: vi.fn().mockResolvedValue({
      estoque: [{ codigoProduto: 1, quantidade: 100 }],
      pagination: { page: '0', total: '1', hasMore: 'false', offset: '0' },
    }),
    restPost: vi.fn(),
    restPut: vi.fn(),
    gatewayCall: vi.fn(),
    getLogger: vi.fn(() => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() })),
    ...overrides,
  } as unknown as HttpClient;
}

describe('EstoqueResource', () => {
  it('porProduto() calls restGet with /estoque/produtos/{id}', async () => {
    const http = createMockHttp();
    const resource = new EstoqueResource(http);
    const result = await resource.porProduto(42);

    expect(http.restGet).toHaveBeenCalledWith('/estoque/produtos/42');
    expect(result).toHaveLength(1);
  });

  it('porProduto() loga error e devolve [] quando a chave "estoque" esta ausente', async () => {
    const error = vi.fn();
    const http = createMockHttp({
      restGet: vi.fn().mockResolvedValue({ outraCoisa: [] }),
      getLogger: vi.fn(() => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error })),
    });
    const resource = new EstoqueResource(http);

    const result = await resource.porProduto(42);

    expect(result).toEqual([]);
    expect(error).toHaveBeenCalledTimes(1);
    expect(error.mock.calls[0]?.[0]).toContain('/estoque/produtos/42');
  });

  it('listar() calls restGet with /estoque/produtos and default page 0', async () => {
    const http = createMockHttp();
    const resource = new EstoqueResource(http);
    const result = await resource.listar();

    expect(http.restGet).toHaveBeenCalledWith('/estoque/produtos', { page: '0' });
    expect(result.data).toHaveLength(1);
  });

  it('listar() passes custom page', async () => {
    const http = createMockHttp();
    const resource = new EstoqueResource(http);
    await resource.listar({ page: 5 });

    expect(http.restGet).toHaveBeenCalledWith('/estoque/produtos', { page: '5' });
  });

  it('listarLocais() calls restGet with /estoque/locais', async () => {
    const http = createMockHttp({
      restGet: vi.fn().mockResolvedValue({
        locais: [{ codigoLocal: 1, descricao: 'Deposito' }],
        pagination: { page: '0', total: '1', hasMore: 'false', offset: '0' },
      }),
    });
    const resource = new EstoqueResource(http);
    const result = await resource.listarLocais();

    expect(http.restGet).toHaveBeenCalledWith('/estoque/locais', { page: '0' });
    expect(result.data).toHaveLength(1);
  });

  it('buscarLocal() calls restGet with /estoque/locais/{id}', async () => {
    const http = createMockHttp({
      restGet: vi.fn().mockResolvedValue({ locais: { codigoLocal: 3, descricao: 'Filial' } }),
    });
    const resource = new EstoqueResource(http);
    const result = await resource.buscarLocal(3);

    expect(http.restGet).toHaveBeenCalledWith('/estoque/locais/3');
    expect(result.descricao).toBe('Filial');
  });

  it('listarTodos() returns AsyncGenerator yielding items', async () => {
    const http = createMockHttp();
    const resource = new EstoqueResource(http);
    const items: unknown[] = [];

    for await (const item of resource.listarTodos()) {
      items.push(item);
    }

    expect(items).toHaveLength(1);
    expect(items[0]).toEqual({ codigoProduto: 1, quantidade: 100 });
  });
  // --- porLote (D2.6) — leitura de TGFEST via DbExplorer, sem rede ---

  /** `dbExplorer` dublado: `porLote` e SELECT puro, nunca REST. */
  function createMockDbx(rows: Array<Record<string, string>>) {
    return { query: vi.fn().mockResolvedValue(rows) } as unknown as DbExplorerResource & {
      query: ReturnType<typeof vi.fn>;
    };
  }

  it('estoque.porLote devolve numeros e nulos tipados', async () => {
    const http = createMockHttp();
    const dbx = createMockDbx([
      {
        CODEMP: '2',
        CODLOCAL: '30301',
        CODPROD: '10077',
        CONTROLE: 'SDK-T-A',
        TIPO: 'P',
        CODPARC: '0',
        ESTOQUE: '10',
        RESERVADO: '0',
        DTVAL: '06/09/2027',
        DTFABRICACAO: '',
        STATUSLOTE: 'N',
      },
    ]);

    await expect(new EstoqueResource(http, { dbExplorer: dbx }).porLote({ codProd: 10077 })).resolves.toEqual([
      {
        codEmp: 2,
        codLocal: 30301,
        codProd: 10077,
        controle: 'SDK-T-A',
        tipo: 'P',
        codParc: 0,
        estoque: 10,
        reservado: 0,
        dtVal: '06/09/2027',
        dtFab: null,
        statusLote: 'N',
      },
    ]);
  });

  it('porLote sem dbExplorer injetado lanca mensagem explicita (compat com new EstoqueResource(http))', async () => {
    await expect(new EstoqueResource(createMockHttp()).porLote({ codProd: 1 })).rejects.toThrow(
      /dbExplorer/,
    );
  });

  it('porLote recusa ESTOQUE nao numerico em vez de devolver 0 (parse estrito)', async () => {
    const dbx = createMockDbx([
      {
        CODEMP: '2',
        CODLOCAL: '30301',
        CODPROD: '10077',
        CONTROLE: 'SDK-T-A',
        TIPO: 'P',
        CODPARC: '0',
        ESTOQUE: 'ABC',
        RESERVADO: '0',
        DTVAL: '',
        DTFABRICACAO: '',
        STATUSLOTE: 'N',
      },
    ]);

    await expect(
      new EstoqueResource(createMockHttp(), { dbExplorer: dbx }).porLote({ codProd: 10077 }),
    ).rejects.toThrow(/ESTOQUE/);
  });

  it('porLote recusa codProd nao inteiro antes da consulta (G3)', async () => {
    const dbx = createMockDbx([]);

    await expect(
      new EstoqueResource(createMockHttp(), { dbExplorer: dbx }).porLote({ codProd: 1.5 }),
    ).rejects.toThrow(/codProd/);
    expect(dbx.query).not.toHaveBeenCalled();
  });

  it('porLote filtra por CODEMP e CODLOCAL quando informados', async () => {
    const dbx = createMockDbx([]);

    await new EstoqueResource(createMockHttp(), { dbExplorer: dbx }).porLote({
      codProd: 10077,
      codEmp: 2,
      codLocal: 30301,
    });

    const sql = dbx.query.mock.calls[0]?.[0] as string;
    expect(sql).toMatch(/CODPROD = 10077/);
    expect(sql).toMatch(/CODEMP = 2/);
    expect(sql).toMatch(/CODLOCAL = 30301/);
  });
});
