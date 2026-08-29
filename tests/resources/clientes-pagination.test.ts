/**
 * Caracterizacao da base de pagina de /parceiros/clientes.
 *
 * MEDIDO em 29/08/2026: o endpoint e 0-based. As paginas 0, 1 e 2 devolvem
 * conjuntos distintos, e o primeiro item da pagina 0 (codigoCliente
 * "1000000000") nunca aparece na pagina 1.
 *
 * `it.fails` documenta o bug confirmado na 1.4.0. Ver
 * docs/superpowers/specs/2026-08-29-paginacao-degradada-design.md §3.3
 */
import { describe, expect, it, vi } from 'vitest';
import type { HttpClient } from '../../src/core/http.js';
import { ClientesResource } from '../../src/resources/clientes.js';

/** Emula o endpoint real: pagina 0-based, conteudo distinto por pagina. */
function createPaginatedHttp() {
  const paginasPedidas: string[] = [];
  const porPagina: Record<string, { codigoCliente: string }[]> = {
    '0': [{ codigoCliente: '1000000000' }, { codigoCliente: '290742' }],
    '1': [{ codigoCliente: '290693' }, { codigoCliente: '290692' }],
    '2': [{ codigoCliente: '290643' }],
  };

  const http = {
    restGet: vi.fn(async (_path: string, query?: Record<string, string>) => {
      const page = query?.page ?? '0';
      paginasPedidas.push(page);
      const clientes = porPagina[page] ?? [];
      return {
        clientes,
        pagination: {
          page,
          offset: String(Number(page) * 50),
          total: String(clientes.length),
          hasMore: String(page !== '2'),
        },
      };
    }),
  } as unknown as HttpClient;

  return { http, paginasPedidas };
}

describe('ClientesResource — base de pagina', () => {
  it.fails('listar() sem argumentos deve pedir a primeira pagina (0)', async () => {
    const { http } = createPaginatedHttp();
    const resource = new ClientesResource(http);

    await resource.listar();

    expect(http.restGet).toHaveBeenCalledWith('/parceiros/clientes', { page: '0' });
  });

  it.fails('listarTodos() deve emitir o primeiro item da pagina 0', async () => {
    const { http, paginasPedidas } = createPaginatedHttp();
    const resource = new ClientesResource(http);

    const emitidos: string[] = [];
    for await (const cliente of resource.listarTodos()) {
      emitidos.push(String(cliente.codigoCliente));
    }

    expect(paginasPedidas[0]).toBe('0');
    expect(emitidos[0]).toBe('1000000000');
  });

  it.fails('listarTodos() deve emitir todos os clientes das tres paginas', async () => {
    const { http } = createPaginatedHttp();
    const resource = new ClientesResource(http);

    const emitidos: string[] = [];
    for await (const cliente of resource.listarTodos()) {
      emitidos.push(String(cliente.codigoCliente));
    }

    expect(emitidos).toHaveLength(5);
  });
});
