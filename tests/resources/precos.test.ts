import { describe, expect, it, vi } from 'vitest';
import type { HttpClient } from '../../src/core/http.js';
import { PrecosResource } from '../../src/resources/precos.js';

function createMockHttp(overrides?: Partial<HttpClient>) {
  return {
    restGet: vi.fn().mockResolvedValue({
      precos: [{ codigoProduto: 1, preco: 99.9 }],
      pagination: { page: '0', total: '1', hasMore: 'false', offset: '0' },
    }),
    restPost: vi.fn().mockResolvedValue({
      precos: [{ codigoProduto: 1, preco: 88.5 }],
    }),
    restPut: vi.fn(),
    gatewayCall: vi.fn(),
    ...overrides,
  } as unknown as HttpClient;
}

describe('PrecosResource', () => {
  it('porTabela() calls restGet with /precos/tabela/{id}', async () => {
    const http = createMockHttp();
    const resource = new PrecosResource(http);
    const result = await resource.porTabela({ codigoTabela: 10 });

    expect(http.restGet).toHaveBeenCalledWith('/precos/tabela/10', { pagina: '1' });
    expect(result.data).toHaveLength(1);
  });

  it('porTabela() passes custom pagina', async () => {
    const http = createMockHttp();
    const resource = new PrecosResource(http);
    await resource.porTabela({ codigoTabela: 10, pagina: 3 });

    expect(http.restGet).toHaveBeenCalledWith('/precos/tabela/10', { pagina: '3' });
  });

  it('porProduto() calls restGet with /precos/produto/{id}', async () => {
    const http = createMockHttp();
    const resource = new PrecosResource(http);
    const result = await resource.porProduto(42);

    expect(http.restGet).toHaveBeenCalledWith('/precos/produto/42', { pagina: '1' });
    expect(result.data).toHaveLength(1);
  });

  it('porProduto() passes custom pagina', async () => {
    const http = createMockHttp();
    const resource = new PrecosResource(http);
    await resource.porProduto(42, 5);

    expect(http.restGet).toHaveBeenCalledWith('/precos/produto/42', { pagina: '5' });
  });

  it('porProdutoETabela() calls restGet with correct path', async () => {
    const http = createMockHttp();
    const resource = new PrecosResource(http);
    const result = await resource.porProdutoETabela({
      codigoProduto: 7,
      codigoTabela: 3,
    });

    expect(http.restGet).toHaveBeenCalledWith('/precos/produto/7/tabela/3', { pagina: '1' });
    expect(result.data).toHaveLength(1);
  });

  it('porProdutoETabela() passes custom pagina', async () => {
    const http = createMockHttp();
    const resource = new PrecosResource(http);
    await resource.porProdutoETabela({
      codigoProduto: 7,
      codigoTabela: 3,
      pagina: 2,
    });

    expect(http.restGet).toHaveBeenCalledWith('/precos/produto/7/tabela/3', { pagina: '2' });
  });

  it('contextualizado() calls restPost with /precos/contextualizado', async () => {
    const http = createMockHttp();
    const resource = new PrecosResource(http);
    const input = { codigoProduto: 1, codigoTabela: 2, quantidade: 10 };
    const result = await resource.contextualizado(input);

    expect(http.restPost).toHaveBeenCalledWith('/precos/contextualizado', input);
    expect(result).toHaveLength(1);
  });
});
