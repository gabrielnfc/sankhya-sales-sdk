import { describe, expect, it, vi } from 'vitest';
import type { HttpClient } from '../../src/core/http.js';
import { ProdutosResource } from '../../src/resources/produtos.js';

function httpComRespostaDegradada() {
  return {
    restGet: vi.fn().mockResolvedValue({ inesperado: 'corpo sem a chave declarada' }),
    getLogger: vi.fn().mockReturnValue({
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    }),
  } as unknown as HttpClient;
}

describe('sinal de degradacao', () => {
  it('marca degraded no resultado e emite logger.error', async () => {
    const http = httpComRespostaDegradada();
    const resource = new ProdutosResource(http);

    const resultado = await resource.listar();

    expect(resultado.degraded).toBe(true);
    expect(resultado.data).toEqual([]);
    expect(http.getLogger().error).toHaveBeenCalledTimes(1);
    expect(vi.mocked(http.getLogger().error).mock.calls[0]?.[0]).toContain('produtos');
  });

  it('resposta integra nao loga nada', async () => {
    const http = {
      restGet: vi.fn().mockResolvedValue({
        produtos: [{ codigoProduto: 1 }],
        pagination: { page: '0', offset: '0', total: '1', hasMore: 'false' },
      }),
      getLogger: vi.fn().mockReturnValue({
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      }),
    } as unknown as HttpClient;
    const resource = new ProdutosResource(http);

    const resultado = await resource.listar();

    expect(resultado.degraded).toBe(false);
    expect(http.getLogger().error).not.toHaveBeenCalled();
  });
});
