import { describe, expect, it, vi } from 'vitest';
import type { HttpClient } from '../../src/core/http.js';
import { FinanceirosResource } from '../../src/resources/financeiros.js';

function createMockHttp() {
  return {
    restGet: vi.fn(),
    restPost: vi.fn(),
    restPut: vi.fn(),
    gatewayCall: vi.fn(),
    getLogger: vi.fn(() => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() })),
  } as unknown as HttpClient & {
    restGet: ReturnType<typeof vi.fn>;
    restPost: ReturnType<typeof vi.fn>;
    restPut: ReturnType<typeof vi.fn>;
    gatewayCall: ReturnType<typeof vi.fn>;
    getLogger: ReturnType<typeof vi.fn>;
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
      http.restGet.mockResolvedValue({ tiposPagamento: { id: 10 } });

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
    it('converts ISO dates to dd/MM/yyyy and unwraps codigoFinanceiro', async () => {
      const http = createMockHttp();
      const fin = new FinanceirosResource(http);
      const dados = {
        codigoEmpresa: 1,
        codigoTipoOperacao: 1,
        codigoNatureza: 1,
        codigoParceiro: 10,
        codigoTipoPagamento: 1,
        dataNegociacao: '2024-01-01',
        dataVencimento: '2024-02-01',
        valorParcela: 100,
      };
      http.restPost.mockResolvedValue({ retorno: { codigoFinanceiro: '777' } });

      const result = await fin.registrarReceita(dados);

      expect(http.restPost).toHaveBeenCalledTimes(1);
      const [path, body] = http.restPost.mock.calls[0];
      expect(path).toBe('/financeiros/receitas');
      expect(body).toEqual({
        ...dados,
        dataNegociacao: '01/01/2024',
        dataVencimento: '01/02/2024',
      });
      expect(result).toEqual({ codigoFinanceiro: 777 });
    });

    it('ignores envelope.codigo (status) and throws when retorno has no codigoFinanceiro', async () => {
      const http = createMockHttp();
      const fin = new FinanceirosResource(http);
      const dados = {
        codigoEmpresa: 1,
        codigoTipoOperacao: 1,
        codigoNatureza: 1,
        codigoParceiro: 10,
        codigoTipoPagamento: 1,
        dataNegociacao: '2024-01-01',
        dataVencimento: '2024-02-01',
        valorParcela: 100,
      };
      // codigo=200 e status do envelope, NAO o NUFIN -> deve lancar
      http.restPost.mockResolvedValue({ codigo: 200, tipo: 'OK', mensagem: 'ok', retorno: {} });

      await expect(fin.registrarReceita(dados)).rejects.toThrow('sem codigoFinanceiro');
    });

    it('merges camposExtras (AD_) into the payload', async () => {
      const http = createMockHttp();
      const fin = new FinanceirosResource(http);
      http.restPost.mockResolvedValue({ retorno: { codigoFinanceiro: 1 } });

      await fin.registrarReceita({
        codigoEmpresa: 1,
        codigoTipoOperacao: 1,
        codigoNatureza: 1,
        codigoParceiro: 10,
        codigoTipoPagamento: 1,
        dataNegociacao: '2024-01-01',
        dataVencimento: '2024-02-01',
        valorParcela: 100,
        camposExtras: { AD_CODRECEITA: 'X' },
      });

      const body = http.restPost.mock.calls[0][1] as Record<string, unknown>;
      expect(body.AD_CODRECEITA).toBe('X');
      expect(body.camposExtras).toBeUndefined();
    });
  });

  describe('atualizarReceita()', () => {
    it('calls restPut with /financeiros/receitas/{id} and unwraps response', async () => {
      const http = createMockHttp();
      const fin = new FinanceirosResource(http);
      const dados = { valorParcela: 200 };
      http.restPut.mockResolvedValue({ retorno: { codigoFinanceiro: 5 } });

      const result = await fin.atualizarReceita(5, dados);

      expect(http.restPut).toHaveBeenCalledTimes(1);
      const [path, body] = http.restPut.mock.calls[0];
      expect(path).toBe('/financeiros/receitas/5');
      expect(body).toEqual(dados);
      expect(result).toEqual({ codigoFinanceiro: 5 });
    });
  });

  describe('baixarReceita()', () => {
    it('puts codigoFinanceiro in path, converts dataBaixa, unwraps response', async () => {
      const http = createMockHttp();
      const fin = new FinanceirosResource(http);
      http.restPost.mockResolvedValue({ retorno: { codigoFinanceiro: 1 } });

      const result = await fin.baixarReceita({
        codigoFinanceiro: 1,
        dataBaixa: '2024-03-15',
        valorBaixa: 100,
        codigoContaBancaria: 42,
      });

      expect(http.restPost).toHaveBeenCalledTimes(1);
      const [path, body] = http.restPost.mock.calls[0];
      expect(path).toBe('/financeiros/receitas/1/baixa');
      expect(body).toEqual({ dataBaixa: '15/03/2024', valorBaixa: 100, codigoContaBancaria: 42 });
      expect(body).not.toHaveProperty('codigoFinanceiro');
      expect(result).toEqual({ codigoFinanceiro: 1 });
    });

    it('throws when dataBaixa is missing', async () => {
      const http = createMockHttp();
      const fin = new FinanceirosResource(http);
      await expect(
        fin.baixarReceita({ codigoFinanceiro: 1 } as unknown as Parameters<
          typeof fin.baixarReceita
        >[0]),
      ).rejects.toThrow('dataBaixa');
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
      const dados = {
        codigoEmpresa: 1,
        codigoTipoOperacao: 1,
        codigoNatureza: 1,
        codigoParceiro: 10,
        codigoTipoPagamento: 1,
        dataNegociacao: '2024-01-01',
        dataVencimento: '2024-02-01',
        valorParcela: 50,
      };
      http.restPost.mockResolvedValue({ retorno: { codigoFinanceiro: 2 } });

      const result = await fin.registrarDespesa(dados);

      expect(http.restPost).toHaveBeenCalledTimes(1);
      const [path, body] = http.restPost.mock.calls[0];
      expect(path).toBe('/financeiros/despesas');
      expect(body).toEqual({
        ...dados,
        dataNegociacao: '01/01/2024',
        dataVencimento: '01/02/2024',
      });
      expect(result).toEqual({ codigoFinanceiro: 2 });
    });
  });

  describe('atualizarDespesa()', () => {
    it('calls restPut with /financeiros/despesas/{id} and unwraps response', async () => {
      const http = createMockHttp();
      const fin = new FinanceirosResource(http);
      http.restPut.mockResolvedValue({ retorno: { codigoFinanceiro: 7 } });

      const result = await fin.atualizarDespesa(7, { valorParcela: 75 });

      expect(http.restPut).toHaveBeenCalledTimes(1);
      const [path, body] = http.restPut.mock.calls[0];
      expect(path).toBe('/financeiros/despesas/7');
      expect(body).toEqual({ valorParcela: 75 });
      expect(result).toEqual({ codigoFinanceiro: 7 });
    });
  });

  describe('baixarDespesa()', () => {
    it('puts codigoFinanceiro in path and unwraps response', async () => {
      const http = createMockHttp();
      const fin = new FinanceirosResource(http);
      http.restPost.mockResolvedValue({ retorno: { codigoFinanceiro: 3 } });

      const result = await fin.baixarDespesa({ codigoFinanceiro: 3, dataBaixa: '2024-03-15' });

      expect(http.restPost).toHaveBeenCalledTimes(1);
      const [path, body] = http.restPost.mock.calls[0];
      expect(path).toBe('/financeiros/despesas/3/baixa');
      expect(body).toEqual({ dataBaixa: '15/03/2024' });
      expect(result).toEqual({ codigoFinanceiro: 3 });
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
      http.restGet.mockResolvedValue({ moedas: { id: 3 } });

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
      http.restGet.mockResolvedValue({ contasBancaria: { id: 5 } });

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
