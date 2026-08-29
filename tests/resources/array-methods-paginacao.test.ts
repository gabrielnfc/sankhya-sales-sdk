import { describe, expect, it, vi } from 'vitest';
import type { HttpClient } from '../../src/core/http.js';
import { CadastrosResource } from '../../src/resources/cadastros.js';
import { FinanceirosResource } from '../../src/resources/financeiros.js';
import { ProdutosResource } from '../../src/resources/produtos.js';

/** Emula um endpoint com 3 paginas de 2 itens. */
function httpComTresPaginas() {
  const paginasPedidas: string[] = [];
  const porPagina: Record<string, { codigoUsuario: number }[]> = {
    '0': [{ codigoUsuario: 1 }, { codigoUsuario: 2 }],
    '1': [{ codigoUsuario: 3 }, { codigoUsuario: 4 }],
    '2': [{ codigoUsuario: 5 }],
  };

  return {
    restGet: vi.fn(async (_path: string, query?: Record<string, string>) => {
      const page = query?.page ?? '0';
      paginasPedidas.push(page);
      const usuarios = porPagina[page] ?? [];
      return {
        usuarios,
        pagination: {
          page,
          offset: String(Number(page) * 2),
          total: String(usuarios.length),
          hasMore: String(page !== '2'),
        },
      };
    }),
    getLogger: vi.fn().mockReturnValue({
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    }),
    paginasPedidas,
  };
}

describe('metodos de array que descartavam paginacao', () => {
  it('listarUsuarios() percorre todas as paginas', async () => {
    const http = httpComTresPaginas();
    const resource = new CadastrosResource(http as unknown as HttpClient);

    const usuarios = await resource.listarUsuarios();

    expect(usuarios).toHaveLength(5);
    expect(usuarios.map((u) => u.codigoUsuario)).toEqual([1, 2, 3, 4, 5]);
    expect(http.paginasPedidas).toEqual(['0', '1', '2']);
  });

  it('listarUsuarios() com uma pagina so faz uma requisicao', async () => {
    const http = {
      restGet: vi.fn().mockResolvedValue({
        usuarios: [{ codigoUsuario: 1 }],
        pagination: { page: '0', offset: '0', total: '1', hasMore: 'false' },
      }),
      getLogger: vi.fn().mockReturnValue({
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      }),
    } as unknown as HttpClient;
    const resource = new CadastrosResource(http);

    const usuarios = await resource.listarUsuarios();

    expect(usuarios).toHaveLength(1);
    expect(http.restGet).toHaveBeenCalledTimes(1);
  });

  it('listarContasBancarias() percorre todas as paginas', async () => {
    const paginasPedidas: string[] = [];
    const porPagina: Record<string, { id: number }[]> = {
      '0': [{ id: 1 }, { id: 2 }],
      '1': [{ id: 3 }],
    };
    const http = {
      restGet: vi.fn(async (_path: string, query?: Record<string, string>) => {
        const page = query?.page ?? '0';
        paginasPedidas.push(page);
        const data = porPagina[page] ?? [];
        return {
          data,
          pagination: {
            page,
            offset: String(Number(page) * 2),
            total: String(data.length),
            hasMore: String(page !== '1'),
          },
        };
      }),
      getLogger: vi.fn().mockReturnValue({
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      }),
    } as unknown as HttpClient;
    const resource = new FinanceirosResource(http);

    const contas = await resource.listarContasBancarias();

    expect(contas).toHaveLength(3);
    expect(paginasPedidas).toEqual(['0', '1']);
  });

  it('produtos.volumes() percorre todas as paginas', async () => {
    const paginasPedidas: string[] = [];
    const porPagina: Record<string, { codigoVolume: string; nome: string }[]> = {
      '0': [{ codigoVolume: 'UN', nome: 'Unidade' }],
      '1': [{ codigoVolume: 'CX', nome: 'Caixa' }],
    };
    const http = {
      restGet: vi.fn(async (_path: string, query?: Record<string, string>) => {
        const page = query?.page ?? '0';
        paginasPedidas.push(page);
        const volumesProduto = porPagina[page] ?? [];
        return {
          volumesProduto,
          pagination: {
            page,
            offset: String(Number(page)),
            total: String(volumesProduto.length),
            hasMore: String(page !== '1'),
          },
        };
      }),
      getLogger: vi.fn().mockReturnValue({
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      }),
    } as unknown as HttpClient;
    const resource = new ProdutosResource(http);

    const volumes = await resource.volumes(10398);

    expect(volumes).toHaveLength(2);
    expect(volumes.map((v) => v.codigoVolume)).toEqual(['UN', 'CX']);
    expect(paginasPedidas).toEqual(['0', '1']);
  });
});
