import { describe, expect, it, vi } from 'vitest';
import type { HttpClient } from '../../src/core/http.js';
import { FinanceirosResource } from '../../src/resources/financeiros.js';

function createMockHttp() {
  return {
    restGet: vi.fn(),
    restPost: vi.fn(),
    restPut: vi.fn(),
    gatewayCall: vi.fn(),
  } as unknown as HttpClient & {
    restGet: ReturnType<typeof vi.fn>;
    restPost: ReturnType<typeof vi.fn>;
    restPut: ReturnType<typeof vi.fn>;
    gatewayCall: ReturnType<typeof vi.fn>;
  };
}

function makeRestResponse(key: string, items: unknown[], hasMore = false) {
  return {
    [key]: items,
    pagination: { page: '0', offset: '0', total: String(items.length), hasMore: String(hasMore) },
  };
}

describe('FinanceirosResource', () => {
  // --- Tipos de Pagamento ---

  describe('listarTiposPagamento()', () => {
    it('calls restGet with /financeiros/tipos-pagamento and default page', async () => {
      const http = createMockHttp();
      const fin = new FinanceirosResource(http);
      http.restGet.mockResolvedValue(makeRestResponse('tiposPagamento', [{ id: 1 }]));

      const result = await fin.listarTiposPagamento();

      expect(http.restGet).toHaveBeenCalledWith('/financeiros/tipos-pagamento', { page: '0' });
      expect(result.data).toHaveLength(1);
    });

    it('passes subTipoPagamento param', async () => {
      const http = createMockHttp();
      const fin = new FinanceirosResource(http);
      http.restGet.mockResolvedValue(makeRestResponse('tiposPagamento', []));

      await fin.listarTiposPagamento({ subTipoPagamento: 5, page: 1 });

      expect(http.restGet).toHaveBeenCalledWith('/financeiros/tipos-pagamento', {
        page: '1',
        subTipoPagamento: '5',
      });
    });
  });

  describe('buscarTipoPagamento()', () => {
    it('calls restGet with id in path', async () => {
      const http = createMockHttp();
      const fin = new FinanceirosResource(http);
      http.restGet.mockResolvedValue({ id: 10 });

      const result = await fin.buscarTipoPagamento(10);

      expect(http.restGet).toHaveBeenCalledWith('/financeiros/tipos-pagamento/10');
      expect(result).toEqual({ id: 10 });
    });
  });

  // --- Receitas ---

  describe('listarReceitas()', () => {
    it('calls restGet with /financeiros/receitas and default page', async () => {
      const http = createMockHttp();
      const fin = new FinanceirosResource(http);
      http.restGet.mockResolvedValue(makeRestResponse('receitas', [{ id: 1 }]));

      const result = await fin.listarReceitas();

      expect(http.restGet).toHaveBeenCalledWith('/financeiros/receitas', { page: '0' });
      expect(result.data).toHaveLength(1);
    });

    it('passes all optional filter params', async () => {
      const http = createMockHttp();
      const fin = new FinanceirosResource(http);
      http.restGet.mockResolvedValue(makeRestResponse('receitas', []));

      await fin.listarReceitas({
        page: 2,
        codigoEmpresa: 1,
        codigoParceiro: 10,
        statusFinanceiro: 'A',
        tipoFinanceiro: 'R',
        dataNegociacaoInicio: '2024-01-01',
        dataNegociacaoFinal: '2024-12-31',
      });

      const query = http.restGet.mock.calls[0][1] as Record<string, string>;
      expect(query.page).toBe('2');
      expect(query.codigoEmpresa).toBe('1');
      expect(query.codigoParceiro).toBe('10');
      expect(query.statusFinanceiro).toBe('A');
      expect(query.tipoFinanceiro).toBe('R');
      expect(query.dataNegociacaoInicio).toBe('2024-01-01');
      expect(query.dataNegociacaoFinal).toBe('2024-12-31');
    });
  });

  describe('registrarReceita()', () => {
    it('calls restPost with /financeiros/receitas', async () => {
      const http = createMockHttp();
      const fin = new FinanceirosResource(http);
      const dados = { valor: 100 };
      http.restPost.mockResolvedValue({ id: 1 });

      const result = await fin.registrarReceita(dados);

      expect(http.restPost).toHaveBeenCalledWith('/financeiros/receitas', dados, undefined);
      expect(result).toEqual({ id: 1 });
    });
  });

  describe('atualizarReceita()', () => {
    it('calls restPut with /financeiros/receitas/{id}', async () => {
      const http = createMockHttp();
      const fin = new FinanceirosResource(http);
      const dados = { valor: 200 };
      http.restPut.mockResolvedValue({ id: 5 });

      const result = await fin.atualizarReceita(5, dados);

      expect(http.restPut).toHaveBeenCalledWith('/financeiros/receitas/5', dados, undefined);
      expect(result).toEqual({ id: 5 });
    });
  });

  describe('baixarReceita()', () => {
    it('calls restPost with /financeiros/receitas/baixa', async () => {
      const http = createMockHttp();
      const fin = new FinanceirosResource(http);
      const dados = { codigoFinanceiro: 1 };
      http.restPost.mockResolvedValue({ ok: true });

      const result = await fin.baixarReceita(dados);

      expect(http.restPost).toHaveBeenCalledWith('/financeiros/receitas/baixa', dados, undefined);
      expect(result).toEqual({ ok: true });
    });
  });

  // --- Despesas ---

  describe('listarDespesas()', () => {
    it('calls restGet with /financeiros/despesas and default page', async () => {
      const http = createMockHttp();
      const fin = new FinanceirosResource(http);
      http.restGet.mockResolvedValue(makeRestResponse('despesas', [{ id: 1 }]));

      const result = await fin.listarDespesas();

      expect(http.restGet).toHaveBeenCalledWith('/financeiros/despesas', { page: '0' });
      expect(result.data).toHaveLength(1);
    });
  });

  describe('registrarDespesa()', () => {
    it('calls restPost with /financeiros/despesas', async () => {
      const http = createMockHttp();
      const fin = new FinanceirosResource(http);
      const dados = { valor: 50 };
      http.restPost.mockResolvedValue({ id: 2 });

      await fin.registrarDespesa(dados);

      expect(http.restPost).toHaveBeenCalledWith('/financeiros/despesas', dados, undefined);
    });
  });

  describe('atualizarDespesa()', () => {
    it('calls restPut with /financeiros/despesas/{id}', async () => {
      const http = createMockHttp();
      const fin = new FinanceirosResource(http);
      http.restPut.mockResolvedValue({});

      await fin.atualizarDespesa(7, { valor: 75 });

      expect(http.restPut).toHaveBeenCalledWith('/financeiros/despesas/7', { valor: 75 }, undefined);
    });
  });

  describe('baixarDespesa()', () => {
    it('calls restPost with /financeiros/despesas/baixa', async () => {
      const http = createMockHttp();
      const fin = new FinanceirosResource(http);
      http.restPost.mockResolvedValue({});

      await fin.baixarDespesa({ codigoFinanceiro: 3 });

      expect(http.restPost).toHaveBeenCalledWith('/financeiros/despesas/baixa', {
        codigoFinanceiro: 3,
      }, undefined);
    });
  });

  // --- Moedas ---

  describe('listarMoedas()', () => {
    it('calls restGet with /financeiros/moedas and default page', async () => {
      const http = createMockHttp();
      const fin = new FinanceirosResource(http);
      http.restGet.mockResolvedValue(makeRestResponse('moedas', [{ id: 1 }]));

      const result = await fin.listarMoedas();

      expect(http.restGet).toHaveBeenCalledWith('/financeiros/moedas', { page: '0' });
      expect(result.data).toHaveLength(1);
    });
  });

  describe('buscarMoeda()', () => {
    it('calls restGet with id in path', async () => {
      const http = createMockHttp();
      const fin = new FinanceirosResource(http);
      http.restGet.mockResolvedValue({ id: 3 });

      const result = await fin.buscarMoeda(3);

      expect(http.restGet).toHaveBeenCalledWith('/financeiros/moedas/3');
      expect(result).toEqual({ id: 3 });
    });
  });

  // --- Contas Bancarias ---

  describe('listarContasBancarias()', () => {
    it('calls restGet and returns array directly', async () => {
      const http = createMockHttp();
      const fin = new FinanceirosResource(http);
      http.restGet.mockResolvedValue(makeRestResponse('contasBancarias', [{ id: 1 }, { id: 2 }]));

      const result = await fin.listarContasBancarias();

      expect(http.restGet).toHaveBeenCalledWith('/financeiros/contas-bancaria');
      expect(result).toHaveLength(2);
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('buscarContaBancaria()', () => {
    it('calls restGet with id in path', async () => {
      const http = createMockHttp();
      const fin = new FinanceirosResource(http);
      http.restGet.mockResolvedValue({ id: 5 });

      const result = await fin.buscarContaBancaria(5);

      expect(http.restGet).toHaveBeenCalledWith('/financeiros/contas-bancaria/5');
      expect(result).toEqual({ id: 5 });
    });
  });

  // --- Iteradores ---

  describe('listarTodasReceitas()', () => {
    it('returns AsyncGenerator that yields all items across pages', async () => {
      const http = createMockHttp();
      const fin = new FinanceirosResource(http);

      http.restGet
        .mockResolvedValueOnce(makeRestResponse('receitas', [{ id: 1 }], true))
        .mockResolvedValueOnce(makeRestResponse('receitas', [{ id: 2 }], false));

      const items = [];
      for await (const item of fin.listarTodasReceitas()) {
        items.push(item);
      }

      expect(items).toHaveLength(2);
      expect(items[0]).toEqual({ id: 1 });
      expect(items[1]).toEqual({ id: 2 });
    });
  });
});
