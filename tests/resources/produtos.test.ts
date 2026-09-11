import { describe, expect, it, vi } from 'vitest';
import type { HttpClient } from '../../src/core/http.js';
import type { DatasetResource } from '../../src/resources/dataset.js';
import type { DbExplorerResource } from '../../src/resources/db-explorer.js';
import { ProdutosResource } from '../../src/resources/produtos.js';

function createMockHttp(overrides?: Partial<HttpClient>) {
  return {
    restGet: vi.fn().mockResolvedValue({
      produtos: [{ codigoProduto: 1, descricao: 'Widget' }],
      pagination: { page: '0', total: '1', hasMore: 'false', offset: '0' },
    }),
    restPost: vi.fn(),
    restPut: vi.fn(),
    gatewayCall: vi.fn(),
    getLogger: vi.fn(() => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() })),
    ...overrides,
  } as unknown as HttpClient;
}

describe('ProdutosResource', () => {
  it('listar() calls restGet with /produtos and default page 0', async () => {
    const http = createMockHttp();
    const resource = new ProdutosResource(http);
    const result = await resource.listar();

    expect(http.restGet).toHaveBeenCalledWith('/produtos', { page: '0' });
    expect(result.data).toHaveLength(1);
  });

  it('listar() passes modifiedSince param', async () => {
    const http = createMockHttp();
    const resource = new ProdutosResource(http);
    await resource.listar({ page: 2, modifiedSince: '2024-01-01' });

    expect(http.restGet).toHaveBeenCalledWith('/produtos', {
      page: '2',
      modifiedSince: '2024-01-01',
    });
  });

  it('buscar() calls restGet with /produtos/{id}', async () => {
    const http = createMockHttp({
      restGet: vi.fn().mockResolvedValue({ codigoProduto: 5, descricao: 'Gadget' }),
    });
    const resource = new ProdutosResource(http);
    const result = await resource.buscar(5);

    expect(http.restGet).toHaveBeenCalledWith('/produtos/5');
    expect(result.descricao).toBe('Gadget');
  });

  it('componentes() calls restGet with correct path', async () => {
    const http = createMockHttp({
      restGet: vi.fn().mockResolvedValue({
        componentes: [{ codigoProduto: 10, quantidade: 2 }],
      }),
    });
    const resource = new ProdutosResource(http);
    const result = await resource.componentes(5);

    expect(http.restGet).toHaveBeenCalledWith('/produtos/5/componentes');
    expect(result).toHaveLength(1);
  });

  it('alternativos() calls restGet with correct path', async () => {
    const http = createMockHttp({
      restGet: vi.fn().mockResolvedValue({
        alternativos: [{ codigoProduto: 20 }],
      }),
    });
    const resource = new ProdutosResource(http);
    const result = await resource.alternativos(5);

    expect(http.restGet).toHaveBeenCalledWith('/produtos/5/alternativos');
    expect(result).toHaveLength(1);
  });

  it('volumes() calls restGet with correct path for specific product', async () => {
    const http = createMockHttp({
      // Chave real medida (medicoes-complementares §Lacuna 1/5): 'volumesProduto',
      // nao 'volumes' — esse nome e o de listarVolumes()/'/volumes-produtos', um
      // endpoint diferente. O endpoint tambem devolve pagination real (Task 8b).
      restGet: vi.fn().mockResolvedValue({
        volumesProduto: [{ codigoVolume: 'UN' }],
        pagination: { page: '0', total: '1', hasMore: 'false', offset: '0' },
      }),
    });
    const resource = new ProdutosResource(http);
    const result = await resource.volumes(5);

    expect(http.restGet).toHaveBeenCalledWith('/produtos/5/volumes', { page: '0' });
    expect(result).toHaveLength(1);
  });

  it('listarVolumes() calls restGet with /volumes-produtos', async () => {
    const http = createMockHttp({
      restGet: vi.fn().mockResolvedValue({
        volumes: [{ codigoVolume: 'UN' }],
        pagination: { page: '0', total: '1', hasMore: 'false', offset: '0' },
      }),
    });
    const resource = new ProdutosResource(http);
    const result = await resource.listarVolumes();

    expect(http.restGet).toHaveBeenCalledWith('/volumes-produtos', { page: '0' });
    expect(result.data).toHaveLength(1);
  });

  it('buscarVolume() calls restGet with /volumes-produtos/{id}', async () => {
    const http = createMockHttp({
      restGet: vi.fn().mockResolvedValue({ volumes: { codigoVolume: 'CX', descricao: 'Caixa' } }),
    });
    const resource = new ProdutosResource(http);
    const result = await resource.buscarVolume('CX');

    expect(http.restGet).toHaveBeenCalledWith('/volumes-produtos/CX');
    expect(result.codigoVolume).toBe('CX');
  });

  it('listarGrupos() calls restGet with /grupos-produto', async () => {
    const http = createMockHttp({
      restGet: vi.fn().mockResolvedValue({
        grupos: [{ codigoGrupoProduto: 1, descricao: 'Eletronicos' }],
        pagination: { page: '0', total: '1', hasMore: 'false', offset: '0' },
      }),
    });
    const resource = new ProdutosResource(http);
    const result = await resource.listarGrupos();

    expect(http.restGet).toHaveBeenCalledWith('/grupos-produto', { page: '0' });
    expect(result.data).toHaveLength(1);
  });

  it('buscarGrupo() calls restGet with /grupos-produto/{id}', async () => {
    const http = createMockHttp({
      restGet: vi
        .fn()
        .mockResolvedValue({ grupos: { codigoGrupoProduto: 3, descricao: 'Ferramentas' } }),
    });
    const resource = new ProdutosResource(http);
    const result = await resource.buscarGrupo(3);

    expect(http.restGet).toHaveBeenCalledWith('/grupos-produto/3');
    expect(result.descricao).toBe('Ferramentas');
  });

  it('listarTodos() returns AsyncGenerator yielding items', async () => {
    const http = createMockHttp();
    const resource = new ProdutosResource(http);
    const items: unknown[] = [];

    for await (const item of resource.listarTodos()) {
      items.push(item);
    }

    expect(items).toHaveLength(1);
    expect(items[0]).toEqual({ codigoProduto: 1, descricao: 'Widget' });
  });
  // --- setTipoControle (D2.6, REQ-VIR-3) — prova de saldo E reserva zero ---

  /** `dbExplorer` dublado: a prova de saldo zero e SELECT global em TGFEST. */
  function createMockDbx(rows: Array<Record<string, string>>) {
    return { query: vi.fn().mockResolvedValue(rows) } as unknown as DbExplorerResource & {
      query: ReturnType<typeof vi.fn>;
    };
  }

  /** `dataset` dublado: a escrita e `DatasetSP.save` em `Produto`. */
  function createMockDs(result: unknown = { total: 1, result: [['10015']] }) {
    return { save: vi.fn().mockResolvedValue(result) } as unknown as DatasetResource & {
      save: ReturnType<typeof vi.fn>;
    };
  }

  it('setTipoControle recusa quando ha SALDO em qualquer empresa/local (M103, REQ-VIR-3)', async () => {
    const http = createMockHttp();
    const dbx = createMockDbx([
      { CODEMP: '1', CODLOCAL: '30201', ESTOQUE: '0', RESERVADO: '0' },
      { CODEMP: '2', CODLOCAL: '30301', ESTOQUE: '12', RESERVADO: '0' },
    ]);
    const ds = createMockDs();

    await expect(
      new ProdutosResource(http, { dataset: ds, dbExplorer: dbx }).setTipoControle({
        codProd: 10015,
        tipo: 'L',
        usaLoteDtVal: true,
      }),
    ).rejects.toThrow(/saldo/i);
    expect(ds.save).not.toHaveBeenCalled();
  });

  it('setTipoControle recusa quando ha RESERVA, mesmo com ESTOQUE zero (M102, spec §4.2.3 passo 1)', async () => {
    const http = createMockHttp();
    const dbx = createMockDbx([{ CODEMP: '2', CODLOCAL: '30301', ESTOQUE: '0', RESERVADO: '3' }]);
    const ds = createMockDs();

    await expect(
      new ProdutosResource(http, { dataset: ds, dbExplorer: dbx }).setTipoControle({
        codProd: 10015,
        tipo: 'L',
        usaLoteDtVal: true,
      }),
    ).rejects.toThrow(/reserva/i);
    expect(ds.save).not.toHaveBeenCalled();
  });

  it('setTipoControle grava Produto quando TODAS as linhas estao zeradas em ESTOQUE e RESERVADO', async () => {
    const http = createMockHttp();
    const dbx = createMockDbx([{ CODEMP: '1', CODLOCAL: '30201', ESTOQUE: '0', RESERVADO: '0' }]);
    const ds = createMockDs();

    await new ProdutosResource(http, { dataset: ds, dbExplorer: dbx }).setTipoControle({
      codProd: 10015,
      tipo: 'L',
      usaLoteDtVal: true,
    });

    expect(dbx.query.mock.calls[0]?.[0]).not.toMatch(/CODEMP\s*=/); // SELECT global (M103)
    expect(ds.save).toHaveBeenCalledWith({
      entityName: 'Produto',
      fields: ['CODPROD', 'TIPCONTEST', 'USALOTEDTVAL'],
      records: [{ pk: { CODPROD: '10015' }, values: { '1': 'L', '2': 'S' } }],
    });
  });

  it('setTipoControle grava quando o SELECT global nao devolve nenhuma linha de TGFEST (M104/M91, RD-6)', async () => {
    const http = createMockHttp();
    const dbx = createMockDbx([]);
    const ds = createMockDs();

    await new ProdutosResource(http, { dataset: ds, dbExplorer: dbx }).setTipoControle({
      codProd: 10015,
      tipo: 'N',
      usaLoteDtVal: false,
    });

    expect(dbx.query).toHaveBeenCalledTimes(1); // o SELECT EXECUTOU: 0 linhas e resposta, nao ausencia
    expect(ds.save).toHaveBeenCalledWith({
      entityName: 'Produto',
      fields: ['CODPROD', 'TIPCONTEST', 'USALOTEDTVAL'],
      records: [{ pk: { CODPROD: '10015' }, values: { '1': 'N', '2': 'N' } }],
    });
  });

  it('setTipoControle propaga a falha do SELECT em vez de tratar como 0 linhas (RD-6)', async () => {
    const http = createMockHttp();
    const dbx = {
      query: vi.fn().mockRejectedValue(new Error('DbExplorer fora do ar')),
    } as unknown as DbExplorerResource & { query: ReturnType<typeof vi.fn> };
    const ds = createMockDs();

    await expect(
      new ProdutosResource(http, { dataset: ds, dbExplorer: dbx }).setTipoControle({
        codProd: 10015,
        tipo: 'N',
        usaLoteDtVal: false,
      }),
    ).rejects.toThrow(/DbExplorer fora do ar/);
    expect(ds.save).not.toHaveBeenCalled();
  });

  it('setTipoControle sem as deps injetadas lanca citando a dep faltante', async () => {
    await expect(
      new ProdutosResource(createMockHttp()).setTipoControle({
        codProd: 10015,
        tipo: 'L',
        usaLoteDtVal: true,
      }),
    ).rejects.toThrow(/dbExplorer/);
  });
});
