import { describe, expect, it, vi } from 'vitest';
import type { HttpClient } from '../../src/core/http.js';
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
  } as unknown as HttpClient & {
    restGet: ReturnType<typeof vi.fn>;
    restPost: ReturnType<typeof vi.fn>;
    restPut: ReturnType<typeof vi.fn>;
    gatewayCall: ReturnType<typeof vi.fn>;
    getLogger: ReturnType<typeof vi.fn>;
  };
}

/** Copiado de tests/resources/gateway.test.ts:23-36 — nao criar variante. */
function makeGatewayResponse(fieldNames: string[], entities: Array<Record<string, unknown>>) {
  return {
    entities: {
      total: String(entities.length),
      hasMoreResult: 'false',
      offsetPage: '0',
      metadata: {
        fields: {
          field: fieldNames.map((name) => ({ name })),
        },
      },
      entity: entities,
    },
  };
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

  it('le volumes do gateway (TGFVOA) e converte os numericos', async () => {
    const http = createMockHttp();
    const produtos = new ProdutosResource(http);
    http.gatewayCall.mockResolvedValue(
      makeGatewayResponse(
        ['CODPROD', 'CODVOL', 'QUANTIDADE', 'LASTRO', 'CAMADAS', 'ATIVO'],
        [
          {
            f0: { $: '13609' },
            f1: { $: 'CX' },
            f2: { $: '72' },
            f3: { $: '12' },
            f4: { $: '4' },
            f5: { $: 'S' },
          },
        ],
      ),
    ); // M54: 13609 = 72 un/cx, 12x4
    const vols = await produtos.volumesProduto(13609);

    expect(http.gatewayCall.mock.calls[0][1]).toBe('CRUDServiceProvider.loadRecords');
    expect(vols).toEqual([
      { codProd: 13609, codVol: 'CX', quantidade: 72, lastro: 12, camadas: 4, ativo: true },
    ]);
  });

  it('devolve [] quando o produto nao tem volume cadastrado (M57) — sem lancar', async () => {
    const http = createMockHttp();
    const produtos = new ProdutosResource(http);
    http.gatewayCall.mockResolvedValue(makeGatewayResponse(['CODPROD'], []));

    await expect(produtos.volumesProduto(10077)).resolves.toEqual([]);
  });

  // Adicao a §D1.4 do anexo: a mutacao prescrita no Step 5 (`ATIVO === 'S'` ->
  // `Boolean(ATIVO)`) SOBREVIVIA com a fixture do anexo, que so tem ATIVO='S'.
  // Este caso e o que a mata.
  it('ativo e false quando ATIVO nao e S (mata Boolean(ATIVO))', async () => {
    const http = createMockHttp();
    const produtos = new ProdutosResource(http);
    http.gatewayCall.mockResolvedValue(
      makeGatewayResponse(
        ['CODPROD', 'CODVOL', 'QUANTIDADE', 'LASTRO', 'CAMADAS', 'ATIVO'],
        [
          {
            f0: { $: '13609' },
            f1: { $: 'UN' },
            f2: { $: '1' },
            f3: { $: '0' },
            f4: { $: '0' },
            f5: { $: 'N' },
          },
        ],
      ),
    );
    const [vol] = await produtos.volumesProduto(13609);

    expect(vol?.ativo).toBe(false);
  });

  it('recusa codigoProduto que nao e inteiro (guarda de injecao no criteria)', async () => {
    const http = createMockHttp();

    await expect(new ProdutosResource(http).volumesProduto(1.5)).rejects.toThrow(/inteiro/i);
    expect(http.gatewayCall).not.toHaveBeenCalled();
  });
});
