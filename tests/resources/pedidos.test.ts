import { describe, expect, it, vi } from 'vitest';
import type { HttpClient } from '../../src/core/http.js';
import { PedidosResource } from '../../src/resources/pedidos.js';

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

describe('PedidosResource', () => {
  // --- REST methods ---

  describe('consultar()', () => {
    it('calls restGet with /vendas/pedidos and required params', async () => {
      const http = createMockHttp();
      const pedidos = new PedidosResource(http);
      http.restGet.mockResolvedValue(makeRestResponse('pedidos', [{ codigoNota: 1 }]));

      const result = await pedidos.consultar({ codigoEmpresa: 1 });

      expect(http.restGet).toHaveBeenCalledWith('/vendas/pedidos', {
        page: '0',
        codigoEmpresa: '1',
      });
      expect(result.data).toHaveLength(1);
      expect(result.page).toBe(0);
    });

    it('passes all optional params as strings', async () => {
      const http = createMockHttp();
      const pedidos = new PedidosResource(http);
      http.restGet.mockResolvedValue(makeRestResponse('pedidos', []));

      await pedidos.consultar({
        codigoEmpresa: 1,
        page: 2,
        modifiedSince: '2024-01-01',
        codigoNota: 100,
        numeroNota: 200,
        serieNota: 'A',
        dataNegociacaoInicio: '2024-01-01',
        dataNegociacaoFinal: '2024-12-31',
        codigoCliente: 50,
        confirmada: true,
        pendente: false,
        codigoNatureza: 10,
        codigoCentroResultado: 20,
        codigoProjeto: 30,
        codigoOrdemCarga: 40,
      });

      const query = http.restGet.mock.calls[0][1] as Record<string, string>;
      expect(query.page).toBe('2');
      expect(query.codigoEmpresa).toBe('1');
      expect(query.modifiedSince).toBe('2024-01-01');
      expect(query.codigoNota).toBe('100');
      expect(query.numeroNota).toBe('200');
      expect(query.serieNota).toBe('A');
      expect(query.dataNegociacaoInicio).toBe('2024-01-01');
      expect(query.dataNegociacaoFinal).toBe('2024-12-31');
      expect(query.codigoCliente).toBe('50');
      expect(query.confirmada).toBe('true');
      expect(query.pendente).toBe('false');
      expect(query.codigoNatureza).toBe('10');
      expect(query.codigoCentroResultado).toBe('20');
      expect(query.codigoProjeto).toBe('30');
      expect(query.codigoOrdemCarga).toBe('40');
    });

    it('returns normalized pagination with hasMore', async () => {
      const http = createMockHttp();
      const pedidos = new PedidosResource(http);
      http.restGet.mockResolvedValue(makeRestResponse('pedidos', [{ codigoNota: 1 }], true));

      const result = await pedidos.consultar({ codigoEmpresa: 1 });

      expect(result.hasMore).toBe(true);
    });
  });

  describe('criar()', () => {
    it('calls restPost with /vendas/pedidos and input', async () => {
      const http = createMockHttp();
      const pedidos = new PedidosResource(http);
      const input = {
        notaModelo: 1,
        data: '2024-01-01',
        hora: '10:00',
        valorTotal: 100,
        itens: [],
        financeiros: [],
      };
      http.restPost.mockResolvedValue({ codigoPedido: 42 });

      const result = await pedidos.criar(input);

      expect(http.restPost).toHaveBeenCalledTimes(1);
      const [path, body] = http.restPost.mock.calls[0];
      expect(path).toBe('/vendas/pedidos');
      expect(body).toEqual(input);
      expect(result.codigoPedido).toBe(42);
    });
  });

  describe('atualizar()', () => {
    it('calls restPut with /vendas/pedidos/{id} and input', async () => {
      const http = createMockHttp();
      const pedidos = new PedidosResource(http);
      const input = {
        notaModelo: 1,
        data: '2024-01-01',
        hora: '10:00',
        valorTotal: 200,
        itens: [],
        financeiros: [],
      };
      http.restPut.mockResolvedValue({ codigoPedido: 42 });

      const result = await pedidos.atualizar(42, input);

      expect(http.restPut).toHaveBeenCalledTimes(1);
      const [path, body] = http.restPut.mock.calls[0];
      expect(path).toBe('/vendas/pedidos/42');
      expect(body).toEqual(input);
      expect(result.codigoPedido).toBe(42);
    });
  });

  describe('cancelar()', () => {
    it('calls restPost with /vendas/pedidos/{id}/cancela', async () => {
      const http = createMockHttp();
      const pedidos = new PedidosResource(http);
      http.restPost.mockResolvedValue({ codigoPedido: 42 });

      const result = await pedidos.cancelar({ codigoPedido: 42, motivo: 'teste' });

      expect(http.restPost).toHaveBeenCalledTimes(1);
      const [path, body] = http.restPost.mock.calls[0];
      expect(path).toBe('/vendas/pedidos/42/cancela');
      expect(body).toEqual({ motivo: 'teste' });
      expect(result.codigoPedido).toBe(42);
    });
  });

  // --- Gateway methods ---

  describe('confirmar()', () => {
    it('calls gatewayCall with NUNOTA wrapped in $', async () => {
      const http = createMockHttp();
      const pedidos = new PedidosResource(http);
      http.gatewayCall.mockResolvedValue({});

      await pedidos.confirmar({ codigoPedido: 123 });

      expect(http.gatewayCall).toHaveBeenCalledTimes(1);
      const [modulo, service, requestBody] = http.gatewayCall.mock.calls[0];
      expect(modulo).toBe('mgecom');
      expect(service).toBe('ServicosNfeSP.confirmarNota');
      expect(requestBody).toEqual({ nota: { NUNOTA: { $: '123' } } });
    });

    it('includes COMPENSAR: { $: "S" } when compensarAutomaticamente=true', async () => {
      const http = createMockHttp();
      const pedidos = new PedidosResource(http);
      http.gatewayCall.mockResolvedValue({});

      await pedidos.confirmar({ codigoPedido: 123, compensarAutomaticamente: true });

      const body = http.gatewayCall.mock.calls[0][2] as Record<string, unknown>;
      expect(body).toEqual({
        nota: {
          NUNOTA: { $: '123' },
          COMPENSAR: { $: 'S' },
        },
      });
    });

    it('includes COMPENSAR: { $: "N" } when compensarAutomaticamente=false', async () => {
      const http = createMockHttp();
      const pedidos = new PedidosResource(http);
      http.gatewayCall.mockResolvedValue({});

      await pedidos.confirmar({ codigoPedido: 123, compensarAutomaticamente: false });

      const body = http.gatewayCall.mock.calls[0][2] as Record<string, unknown>;
      expect(body).toEqual({
        nota: {
          NUNOTA: { $: '123' },
          COMPENSAR: { $: 'N' },
        },
      });
    });

    it('omits COMPENSAR when compensarAutomaticamente is undefined', async () => {
      const http = createMockHttp();
      const pedidos = new PedidosResource(http);
      http.gatewayCall.mockResolvedValue({});

      await pedidos.confirmar({ codigoPedido: 123 });

      const body = http.gatewayCall.mock.calls[0][2] as Record<string, unknown>;
      expect(body).toEqual({
        nota: { NUNOTA: { $: '123' } },
      });
    });
  });

  describe('faturar()', () => {
    it('calls gatewayCall with defaults for tipoFaturamento and faturarTodosItens', async () => {
      const http = createMockHttp();
      const pedidos = new PedidosResource(http);
      http.gatewayCall.mockResolvedValue({});

      await pedidos.faturar({
        codigoPedido: 99,
        codigoTipoOperacao: 1,
        dataFaturamento: '2024-06-01',
      });

      expect(http.gatewayCall).toHaveBeenCalledTimes(1);
      const [modulo, service, requestBody] = http.gatewayCall.mock.calls[0];
      expect(modulo).toBe('mgecom');
      expect(service).toBe('SelecaoDocumentoSP.faturar');
      expect(requestBody).toEqual({
        notas: {
          codTipOper: 1,
          dtFatur: '2024-06-01',
          tipoFaturamento: 'FaturamentoNormal',
          faturarTodosItens: true,
          nota: { NUNOTA: { $: '99' } },
        },
      });
    });

    it('uses custom tipoFaturamento and faturarTodosItens when provided', async () => {
      const http = createMockHttp();
      const pedidos = new PedidosResource(http);
      http.gatewayCall.mockResolvedValue({});

      await pedidos.faturar({
        codigoPedido: 99,
        codigoTipoOperacao: 2,
        dataFaturamento: '2024-06-01',
        tipoFaturamento: 'FaturamentoDireto' as never,
        faturarTodosItens: false,
      });

      const body = http.gatewayCall.mock.calls[0][2] as Record<string, unknown>;
      const notas = body.notas as Record<string, unknown>;
      expect(notas.tipoFaturamento).toBe('FaturamentoDireto');
      expect(notas.faturarTodosItens).toBe(false);
    });
  });

  describe('incluirNotaGateway()', () => {
    it('serializes cabecalho and itens, returns codigoPedido from NUNOTA', async () => {
      const http = createMockHttp();
      const pedidos = new PedidosResource(http);
      http.gatewayCall.mockResolvedValue({ NUNOTA: 42 });

      const result = await pedidos.incluirNotaGateway({
        codigoCliente: 10,
        dataNegociacao: '2024-01-01',
        codigoTipoOperacao: 1,
        codigoTipoNegociacao: 2,
        codigoVendedor: 3,
        codigoEmpresa: 4,
        tipoMovimento: 'V',
        itens: [{ codigoProduto: 100, quantidade: 5, valorUnitario: 10, unidade: 'UN' }],
      });

      expect(result).toEqual({ codigoPedido: 42 });
      expect(http.gatewayCall).toHaveBeenCalledTimes(1);
      const [modulo, service, requestBody] = http.gatewayCall.mock.calls[0];
      expect(modulo).toBe('mgecom');
      expect(service).toBe('CACSP.incluirNota');
      expect(requestBody).toEqual(
        expect.objectContaining({
          nota: expect.objectContaining({
            cabecalho: expect.objectContaining({
              CODPARC: { $: '10' },
              DTNEG: { $: '2024-01-01' },
            }),
            itens: {
              item: [
                expect.objectContaining({
                  CODPROD: { $: '100' },
                  QTDNEG: { $: '5' },
                  VLRUNIT: { $: '10' },
                  CODVOL: { $: 'UN' },
                }),
              ],
            },
          }),
        }),
      );
    });

    it('includes observacao when provided', async () => {
      const http = createMockHttp();
      const pedidos = new PedidosResource(http);
      http.gatewayCall.mockResolvedValue({ NUNOTA: 1 });

      await pedidos.incluirNotaGateway({
        codigoCliente: 10,
        dataNegociacao: '2024-01-01',
        codigoTipoOperacao: 1,
        codigoTipoNegociacao: 2,
        codigoVendedor: 3,
        codigoEmpresa: 4,
        tipoMovimento: 'V',
        observacao: 'obs test',
        itens: [{ codigoProduto: 1, quantidade: 1, valorUnitario: 1, unidade: 'UN' }],
      });

      const body = http.gatewayCall.mock.calls[0][2] as Record<string, unknown>;
      const nota = body.nota as Record<string, unknown>;
      const cab = nota.cabecalho as Record<string, unknown>;
      expect(cab.OBSERVACAO).toEqual({ $: 'obs test' });
    });

    it('includes CODLOCALORIG when item has codigoLocalOrigem', async () => {
      const http = createMockHttp();
      const pedidos = new PedidosResource(http);
      http.gatewayCall.mockResolvedValue({ NUNOTA: 1 });

      await pedidos.incluirNotaGateway({
        codigoCliente: 10,
        dataNegociacao: '2024-01-01',
        codigoTipoOperacao: 1,
        codigoTipoNegociacao: 2,
        codigoVendedor: 3,
        codigoEmpresa: 4,
        tipoMovimento: 'V',
        itens: [
          {
            codigoProduto: 1,
            quantidade: 1,
            valorUnitario: 1,
            unidade: 'UN',
            codigoLocalOrigem: 5,
          },
        ],
      });

      const body = http.gatewayCall.mock.calls[0][2] as Record<string, unknown>;
      const nota = body.nota as Record<string, unknown>;
      const itens = nota.itens as { item: Array<Record<string, unknown>> };
      expect(itens.item[0].CODLOCALORIG).toEqual({ $: '5' });
    });
  });

  describe('incluirAlterarItem()', () => {
    it('serializes itens and calls gatewayCall with NUNOTA', async () => {
      const http = createMockHttp();
      const pedidos = new PedidosResource(http);
      http.gatewayCall.mockResolvedValue({});

      await pedidos.incluirAlterarItem(99, [
        { codigoProduto: 1, quantidade: 2, valorUnitario: 10, unidade: 'UN' },
      ]);

      expect(http.gatewayCall).toHaveBeenCalledTimes(1);
      const [modulo, service, requestBody] = http.gatewayCall.mock.calls[0];
      expect(modulo).toBe('mgecom');
      expect(service).toBe('CACSP.incluirAlterarItemNota');
      expect(requestBody).toEqual({
        nota: {
          NUNOTA: { $: '99' },
          itens: {
            item: [
              {
                CODPROD: { $: '1' },
                QTDNEG: { $: '2' },
                VLRUNIT: { $: '10' },
                CODVOL: { $: 'UN' },
              },
            ],
          },
        },
      });
    });
  });

  describe('excluirItem()', () => {
    it('calls gatewayCall with NUNOTA and SEQUENCIA', async () => {
      const http = createMockHttp();
      const pedidos = new PedidosResource(http);
      http.gatewayCall.mockResolvedValue({});

      await pedidos.excluirItem(99, 3);

      expect(http.gatewayCall).toHaveBeenCalledTimes(1);
      const [modulo, service, requestBody] = http.gatewayCall.mock.calls[0];
      expect(modulo).toBe('mgecom');
      expect(service).toBe('CACSP.excluirItemNota');
      expect(requestBody).toEqual({
        nota: {
          NUNOTA: { $: '99' },
          SEQUENCIA: { $: '3' },
        },
      });
    });
  });
});
