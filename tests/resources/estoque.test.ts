import { describe, expect, it, vi } from 'vitest';
import type { HttpClient } from '../../src/core/http.js';
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
      restGet: vi.fn().mockResolvedValue({ codigoLocal: 3, descricao: 'Filial' }),
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
});
