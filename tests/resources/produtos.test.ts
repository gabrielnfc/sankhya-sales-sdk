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
      restGet: vi.fn().mockResolvedValue({
        volumes: [{ codigoVolume: 'UN' }],
      }),
    });
    const resource = new ProdutosResource(http);
    const result = await resource.volumes(5);

    expect(http.restGet).toHaveBeenCalledWith('/produtos/5/volumes');
    expect(result).toHaveLength(1);
  });

  it('listarVolumes() calls restGet with /produtos/volumes', async () => {
    const http = createMockHttp({
      restGet: vi.fn().mockResolvedValue({
        volumes: [{ codigoVolume: 'UN' }],
        pagination: { page: '0', total: '1', hasMore: 'false', offset: '0' },
      }),
    });
    const resource = new ProdutosResource(http);
    const result = await resource.listarVolumes();

    expect(http.restGet).toHaveBeenCalledWith('/produtos/volumes', { page: '0' });
    expect(result.data).toHaveLength(1);
  });

  it('buscarVolume() calls restGet with /produtos/volumes/{id}', async () => {
    const http = createMockHttp({
      restGet: vi.fn().mockResolvedValue({ codigoVolume: 'CX', descricao: 'Caixa' }),
    });
    const resource = new ProdutosResource(http);
    const result = await resource.buscarVolume('CX');

    expect(http.restGet).toHaveBeenCalledWith('/produtos/volumes/CX');
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
      restGet: vi.fn().mockResolvedValue({ codigoGrupoProduto: 3, descricao: 'Ferramentas' }),
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
});
