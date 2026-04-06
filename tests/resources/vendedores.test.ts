import { describe, expect, it, vi } from 'vitest';
import type { HttpClient } from '../../src/core/http.js';
import { VendedoresResource } from '../../src/resources/vendedores.js';

function createMockHttp() {
  return {
    restGet: vi.fn().mockResolvedValue({
      vendedores: [
        { codigoVendedor: 1, nomeVendedor: 'Carlos' },
      ],
      pagination: { page: '0', total: '1', hasMore: 'false', offset: '0' },
    }),
    restPost: vi.fn(),
    restPut: vi.fn(),
    gatewayCall: vi.fn(),
  } as unknown as HttpClient;
}

describe('VendedoresResource', () => {
  it('listar() calls restGet with /vendedores and default page 0', async () => {
    const http = createMockHttp();
    const resource = new VendedoresResource(http);
    const result = await resource.listar();

    expect(http.restGet).toHaveBeenCalledWith('/vendedores', { page: '0' });
    expect(result.data).toHaveLength(1);
  });

  it('listar() passes page and modifiedSince params', async () => {
    const http = createMockHttp();
    const resource = new VendedoresResource(http);
    await resource.listar({ page: 3, modifiedSince: '2024-01-01' });

    expect(http.restGet).toHaveBeenCalledWith('/vendedores', {
      page: '3',
      modifiedSince: '2024-01-01',
    });
  });

  it('buscar() calls restGet with /vendedores/{id}', async () => {
    const http = createMockHttp();
    (http.restGet as ReturnType<typeof vi.fn>).mockResolvedValue(
      { codigoVendedor: 7, nomeVendedor: 'Ana' },
    );
    const resource = new VendedoresResource(http);
    const result = await resource.buscar(7);

    expect(http.restGet).toHaveBeenCalledWith('/vendedores/7');
    expect(result).toEqual({ codigoVendedor: 7, nomeVendedor: 'Ana' });
  });

  it('listarTodos() returns AsyncGenerator yielding items', async () => {
    const http = createMockHttp();
    const resource = new VendedoresResource(http);
    const items: unknown[] = [];

    for await (const item of resource.listarTodos()) {
      items.push(item);
    }

    expect(items).toHaveLength(1);
    expect(items[0]).toEqual({ codigoVendedor: 1, nomeVendedor: 'Carlos' });
  });

  it('listarTodos() passes extra params but not page', async () => {
    const http = createMockHttp();
    const resource = new VendedoresResource(http);

    for await (const _ of resource.listarTodos({ modifiedSince: '2024-06-01' })) {
      // consume
    }

    expect(http.restGet).toHaveBeenCalledWith('/vendedores', {
      page: '0',
      modifiedSince: '2024-06-01',
    });
  });
});
