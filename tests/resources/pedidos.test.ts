import { describe, expect, it, vi } from 'vitest';
import { GatewayError } from '../../src/core/errors.js';
import type { HttpClient } from '../../src/core/http.js';
import { PedidosResource } from '../../src/resources/pedidos.js';

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

describe('PedidosResource', () => {
  // --- REST methods ---

  describe('consultar()', () => {
    it('calls restGet with /vendas/pedidos and required params', async () => {
      const http = createMockHttp();
      const pedidos = new PedidosResource(http);
      // Chave real medida (medicoes-complementares §Lacuna 5): 'pedido', no
      // singular — nao 'pedidos'.
      http.restGet.mockResolvedValue(makeRestResponse('pedido', [{ codigoNota: 1 }]));

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
      http.restGet.mockResolvedValue(makeRestResponse('pedido', []));

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
      http.restGet.mockResolvedValue(makeRestResponse('pedido', [{ codigoNota: 1 }], true));

      const result = await pedidos.consultar({ codigoEmpresa: 1 });

      expect(result.hasMore).toBe(true);
    });
  });

  describe('criar()', () => {
    it('builds the REST payload: canonical financeiro names, sequencia, controle default, br dates', async () => {
      const http = createMockHttp();
      const pedidos = new PedidosResource(http);
      const input = {
        notaModelo: 1,
        data: '2024-01-01',
        hora: '10:00',
        valorTotal: 100,
        itens: [{ codigoProduto: 1, quantidade: 1, valorUnitario: 100, unidade: 'UN' }],
        financeiros: [{ tipoPagamento: 1, valorParcela: 100, dataVencimento: '2024-02-01' }],
      };
      http.restPost.mockResolvedValue({ codigoPedido: 42 });

      const result = await pedidos.criar(input);

      expect(http.restPost).toHaveBeenCalledTimes(1);
      const [path, body] = http.restPost.mock.calls[0];
      expect(path).toBe('/vendas/pedidos');
      expect(body).toEqual({
        notaModelo: 1,
        data: '01/01/2024',
        hora: '10:00',
        valorTotal: 100,
        itens: [
          {
            codigoProduto: 1,
            quantidade: 1,
            valorUnitario: 100,
            unidade: 'UN',
            sequencia: 1,
            controle: ' ',
          },
        ],
        financeiros: [
          { tipoPagamento: 1, valorParcela: 100, dataVencimento: '01/02/2024', sequencia: 1 },
        ],
      });
      expect(result.codigoPedido).toBe(42);
    });

    it('maps deprecated financeiro aliases (codigoTipoPagamento/valor/numeroParcela)', async () => {
      const http = createMockHttp();
      const pedidos = new PedidosResource(http);
      http.restPost.mockResolvedValue({ codigoPedido: 1 });

      await pedidos.criar({
        notaModelo: 1,
        data: '2024-01-01',
        hora: '10:00',
        valorTotal: 100,
        itens: [{ codigoProduto: 1, quantidade: 1, valorUnitario: 100 }],
        financeiros: [
          { codigoTipoPagamento: 7, valor: 100, dataVencimento: '2024-02-01', numeroParcela: 3 },
        ],
      });

      const body = http.restPost.mock.calls[0][1] as Record<string, unknown>;
      const fin = (body.financeiros as Record<string, unknown>[])[0];
      expect(fin).toEqual({
        tipoPagamento: 7,
        valorParcela: 100,
        dataVencimento: '01/02/2024',
        sequencia: 3,
      });
    });

    it('auto-numbers sequencia across multiple itens and financeiros', async () => {
      const http = createMockHttp();
      const pedidos = new PedidosResource(http);
      http.restPost.mockResolvedValue({ codigoPedido: 1 });

      await pedidos.criar({
        notaModelo: 1,
        data: '2024-01-01',
        hora: '10:00',
        valorTotal: 30,
        itens: [
          { codigoProduto: 1, quantidade: 1, valorUnitario: 10 },
          { codigoProduto: 2, quantidade: 1, valorUnitario: 20 },
        ],
        financeiros: [
          { tipoPagamento: 1, valorParcela: 15, dataVencimento: '2024-02-01' },
          { tipoPagamento: 1, valorParcela: 15, dataVencimento: '2024-03-01' },
        ],
      });

      const body = http.restPost.mock.calls[0][1] as Record<string, unknown>;
      const itens = body.itens as Record<string, unknown>[];
      const fins = body.financeiros as Record<string, unknown>[];
      expect(itens.map((i) => i.sequencia)).toEqual([1, 2]);
      expect(fins.map((f) => f.sequencia)).toEqual([1, 2]);
    });

    it('respects explicit sequencia and controle when provided', async () => {
      const http = createMockHttp();
      const pedidos = new PedidosResource(http);
      http.restPost.mockResolvedValue({ codigoPedido: 1 });

      await pedidos.criar({
        notaModelo: 1,
        data: '2024-01-01',
        hora: '10:00',
        valorTotal: 10,
        itens: [
          {
            codigoProduto: 1,
            quantidade: 1,
            valorUnitario: 10,
            sequencia: 5,
            controle: 'AZUL',
            codigoLocalEstoque: 30102,
          },
        ],
        financeiros: [{ tipoPagamento: 1, valorParcela: 10, dataVencimento: '2024-02-01' }],
      });

      const item = (http.restPost.mock.calls[0][1] as Record<string, unknown>).itens as Record<
        string,
        unknown
      >[];
      expect(item[0]).toMatchObject({ sequencia: 5, controle: 'AZUL', codigoLocalEstoque: 30102 });
    });

    it('merges camposExtras at cabecalho, item, and financeiro levels', async () => {
      const http = createMockHttp();
      const pedidos = new PedidosResource(http);
      http.restPost.mockResolvedValue({ codigoPedido: 1 });

      await pedidos.criar({
        notaModelo: 12,
        data: '2024-01-01',
        hora: '10:00',
        valorTotal: 10,
        camposExtras: { CODTIPOPER: 1000, CODEMP: 1, AD_CAMPO: 'x' },
        itens: [
          {
            codigoProduto: 1,
            quantidade: 1,
            valorUnitario: 10,
            camposExtras: { AD_ITEM: 'y' },
          },
        ],
        financeiros: [
          {
            tipoPagamento: 1,
            valorParcela: 10,
            dataVencimento: '2024-02-01',
            camposExtras: { AD_FIN: 'z' },
          },
        ],
      });

      const body = http.restPost.mock.calls[0][1] as Record<string, unknown>;
      expect(body).toMatchObject({ CODTIPOPER: 1000, CODEMP: 1, AD_CAMPO: 'x' });
      expect((body.itens as Record<string, unknown>[])[0]).toMatchObject({ AD_ITEM: 'y' });
      expect((body.financeiros as Record<string, unknown>[])[0]).toMatchObject({ AD_FIN: 'z' });
    });

    it('unwraps codigoPedido from the real REST envelope (retorno.codigoPedido string)', async () => {
      const http = createMockHttp();
      const pedidos = new PedidosResource(http);
      http.restPost.mockResolvedValue({
        codigo: '1541414',
        tipo: 'Pedido',
        mensagem: 'Pedido Incluido/Atualizado com sucesso.',
        retorno: { codigoPedido: '1541414' },
      });

      const result = await pedidos.criar({
        notaModelo: 1,
        data: '2024-01-01',
        hora: '10:00',
        valorTotal: 10,
        itens: [{ codigoProduto: 1, quantidade: 1, valorUnitario: 10 }],
        financeiros: [{ tipoPagamento: 1, valorParcela: 10, dataVencimento: '2024-02-01' }],
      });

      expect(result).toEqual({ codigoPedido: 1541414 });
    });

    it('throws when the success envelope has no codigoPedido (no silent 0)', async () => {
      const http = createMockHttp();
      const pedidos = new PedidosResource(http);
      http.restPost.mockResolvedValue({ tipo: 'Pedido', mensagem: 'ok', retorno: {} });

      await expect(
        pedidos.criar({
          notaModelo: 1,
          data: '2024-01-01',
          hora: '10:00',
          valorTotal: 10,
          itens: [{ codigoProduto: 1, quantidade: 1, valorUnitario: 10 }],
          financeiros: [{ tipoPagamento: 1, valorParcela: 10, dataVencimento: '2024-02-01' }],
        }),
      ).rejects.toThrow('sem codigoPedido');
    });

    it('emits impostos on item and cheque/cartao/idTransacao on financeiro', async () => {
      const http = createMockHttp();
      const pedidos = new PedidosResource(http);
      http.restPost.mockResolvedValue({ retorno: { codigoPedido: '7' } });

      await pedidos.criar({
        notaModelo: 1,
        data: '2024-01-01',
        hora: '10:00',
        valorTotal: 10,
        itens: [
          {
            codigoProduto: 1,
            quantidade: 1,
            valorUnitario: 10,
            impostos: [{ tipo: 'ibs', aliquota: 26.5, valorImposto: 2.65 }],
          },
        ],
        financeiros: [
          {
            tipoPagamento: 2,
            valorParcela: 10,
            dataVencimento: '2024-02-01',
            cheque: { banco: '341', numero: '1880' },
            cartao: { bandeira: '02', autorizacao: '4581596' },
            idTransacao: 'pix-abc',
          },
        ],
      });

      const body = http.restPost.mock.calls[0][1] as Record<string, unknown>;
      const item = (body.itens as Record<string, unknown>[])[0];
      const fin = (body.financeiros as Record<string, unknown>[])[0];
      expect(item.impostos).toEqual([{ tipo: 'ibs', aliquota: 26.5, valorImposto: 2.65 }]);
      expect(fin.cheque).toEqual({ banco: '341', numero: '1880' });
      expect(fin.cartao).toEqual({ bandeira: '02', autorizacao: '4581596' });
      expect(fin.idTransacao).toBe('pix-abc');
    });

    it('passes dd/MM/yyyy dates through unchanged', async () => {
      const http = createMockHttp();
      const pedidos = new PedidosResource(http);
      http.restPost.mockResolvedValue({ codigoPedido: 1 });

      await pedidos.criar({
        notaModelo: 1,
        data: '15/03/2024',
        hora: '10:00',
        valorTotal: 10,
        itens: [{ codigoProduto: 1, quantidade: 1, valorUnitario: 10 }],
        financeiros: [{ tipoPagamento: 1, valorParcela: 10, dataVencimento: '20/04/2024' }],
      });

      const body = http.restPost.mock.calls[0][1] as Record<string, unknown>;
      expect(body.data).toBe('15/03/2024');
      expect((body.financeiros as Record<string, unknown>[])[0].dataVencimento).toBe('20/04/2024');
    });
  });

  describe('atualizar()', () => {
    it('calls restPut with /vendas/pedidos/{id} and built payload', async () => {
      const http = createMockHttp();
      const pedidos = new PedidosResource(http);
      const input = {
        notaModelo: 1,
        data: '2024-01-01',
        hora: '10:00',
        valorTotal: 200,
        itens: [{ codigoProduto: 1, quantidade: 2, valorUnitario: 100, unidade: 'UN' }],
        financeiros: [{ tipoPagamento: 1, valorParcela: 200, dataVencimento: '2024-02-01' }],
      };
      http.restPut.mockResolvedValue({ codigoPedido: 42 });

      const result = await pedidos.atualizar(42, input);

      expect(http.restPut).toHaveBeenCalledTimes(1);
      const [path, body] = http.restPut.mock.calls[0];
      expect(path).toBe('/vendas/pedidos/42');
      expect(body).toEqual({
        notaModelo: 1,
        data: '01/01/2024',
        hora: '10:00',
        valorTotal: 200,
        itens: [
          {
            codigoProduto: 1,
            quantidade: 2,
            valorUnitario: 100,
            unidade: 'UN',
            sequencia: 1,
            controle: ' ',
          },
        ],
        financeiros: [
          { tipoPagamento: 1, valorParcela: 200, dataVencimento: '01/02/2024', sequencia: 1 },
        ],
      });
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
      expect(service).toBe('CACSP.confirmarNota');
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

  // Fixture com o shape REAL da resposta de CACSP.confirmarNota quando o
  // parceiro tem liberacao de credito pendente (nota 1543007 / TFS-000775,
  // sandbox 19/08/2026). O bridge XML→JSON do Gateway entrega `liberacao`
  // como OBJETO quando ha uma pendencia e como ARRAY quando ha varias.
  const LIBERACAO_FIXTURE = {
    chave: '1543007',
    evento: '8',
    descricaoEvento: 'Atraso',
    tabela: 'TGFCAB',
    sequencia: '0',
    seqCascata: '0',
    dhSolicitacao: '19/08/2026 11:20',
    solicitante: '11',
    valorAtual: '61',
    liberador: '38',
    tipoEvento: '1',
    editaLiberador: 'N',
  };

  const CONFIRMAR_RESPONSE_COM_LIBERACAO = {
    avisos: {
      aviso: {
        $: 'Cliente em atraso desde o dia 19/06/2026.\nTotal atrasado: 36.683,37. Há liberação pendente.',
      },
    },
    liberacoes: { liberacao: LIBERACAO_FIXTURE },
    pk: { NUNOTA: { $: '1543007' } },
  };

  describe('confirmar() — responseBody normalizado (v1.4.0)', () => {
    it('devolve responseBody com liberacoes normalizado para array quando o gateway entrega OBJETO', async () => {
      const http = createMockHttp();
      const pedidos = new PedidosResource(http);
      http.gatewayCall.mockResolvedValue(CONFIRMAR_RESPONSE_COM_LIBERACAO);

      const result = await pedidos.confirmar({ codigoPedido: 1543007 });

      expect(result.responseBody).toBeDefined();
      expect(result.responseBody?.liberacoes).toEqual([LIBERACAO_FIXTURE]);
      expect(result.responseBody?.avisos).toEqual(CONFIRMAR_RESPONSE_COM_LIBERACAO.avisos);
      // Campos fora de avisos/liberacoes sao preservados (o worker loga o corpo inteiro).
      expect((result.responseBody as Record<string, unknown>).pk).toEqual({
        NUNOTA: { $: '1543007' },
      });
    });

    it('preserva o array quando o gateway ja entrega liberacao como ARRAY', async () => {
      const http = createMockHttp();
      const pedidos = new PedidosResource(http);
      const segunda = { ...LIBERACAO_FIXTURE, seqCascata: '1', dhSolicitacao: '19/08/2026 12:00' };
      http.gatewayCall.mockResolvedValue({
        ...CONFIRMAR_RESPONSE_COM_LIBERACAO,
        liberacoes: { liberacao: [LIBERACAO_FIXTURE, segunda] },
      });

      const result = await pedidos.confirmar({ codigoPedido: 1543007 });

      expect(result.responseBody?.liberacoes).toEqual([LIBERACAO_FIXTURE, segunda]);
    });

    it('caminho feliz ({pk} sem avisos/liberacoes) devolve responseBody sem liberacoes', async () => {
      const http = createMockHttp();
      const pedidos = new PedidosResource(http);
      http.gatewayCall.mockResolvedValue({ pk: { NUNOTA: { $: '1543049' } } });

      const result = await pedidos.confirmar({ codigoPedido: 1543049 });

      expect(result.responseBody).toBeDefined();
      expect(result.responseBody?.liberacoes).toBeUndefined();
      expect(result.responseBody?.avisos).toBeUndefined();
    });

    it('corpo ausente (undefined) devolve responseBody undefined sem lancar', async () => {
      const http = createMockHttp();
      const pedidos = new PedidosResource(http);
      http.gatewayCall.mockResolvedValue(undefined);

      const result = await pedidos.confirmar({ codigoPedido: 123 });

      expect(result).toEqual({});
      expect(result.responseBody).toBeUndefined();
    });

    it('corpo vazio ({}) devolve responseBody undefined sem lancar', async () => {
      const http = createMockHttp();
      const pedidos = new PedidosResource(http);
      http.gatewayCall.mockResolvedValue({});

      const result = await pedidos.confirmar({ codigoPedido: 123 });

      expect(result.responseBody).toBeUndefined();
    });

    it('status 0 continua lancando GatewayError como hoje (o erro do gatewayCall propaga)', async () => {
      const http = createMockHttp();
      const pedidos = new PedidosResource(http);
      const erro = new GatewayError(
        'A nota 1543049 já foi confirmada.',
        'CACSP.confirmarNota',
        undefined,
        undefined,
        { status: '0' },
      );
      http.gatewayCall.mockRejectedValue(erro);

      await expect(pedidos.confirmar({ codigoPedido: 1543049 })).rejects.toBe(erro);
    });

    it('liberacoes com marcador vazio do gateway ("{}") devolve responseBody sem liberacoes', async () => {
      const http = createMockHttp();
      const pedidos = new PedidosResource(http);
      http.gatewayCall.mockResolvedValue({ pk: { NUNOTA: { $: '1' } }, liberacoes: '{}' });

      const result = await pedidos.confirmar({ codigoPedido: 1 });

      expect(result.responseBody).toBeDefined();
      expect(result.responseBody?.liberacoes).toBeUndefined();
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
            // `itens` deixou de ser exato: ganhou `INFORMARPRECO` (M46), travado
            // no bloco "formato 4midware" abaixo.
            itens: expect.objectContaining({
              item: [
                expect.objectContaining({
                  CODPROD: { $: '100' },
                  QTDNEG: { $: '5' },
                  VLRUNIT: { $: '10' },
                  CODVOL: { $: 'UN' },
                }),
              ],
            }),
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

  // Formato medido no sandbox (M34/M46): o payload aceito pelo 4midware traz
  // `NUNOTA: {}` no cabecalho E em cada item, e `itens.INFORMARPRECO` como
  // STRING 'True'/'False'. Fonte: spike-raw/cancelamento/C1_INCLUIR_PA.json e
  // spike-raw/faturamento/ped.ts:8.
  describe('incluirNotaGateway() — formato 4midware (M34/M46)', () => {
    it('inclui NUNOTA vazio no cabecalho e em cada item, com AD_NUMPEDIDO', async () => {
      const http = createMockHttp();
      const pedidos = new PedidosResource(http);
      http.gatewayCall.mockResolvedValue({ pk: { NUNOTA: { $: '1889304' } } });

      const r = await pedidos.incluirNotaGateway({
        codigoCliente: 312984,
        dataNegociacao: '06/09/2026 12:00:00',
        codigoTipoOperacao: 1001,
        codigoTipoNegociacao: 200,
        codigoVendedor: 50,
        codigoEmpresa: 2,
        tipoMovimento: 'P',
        statusNota: 'A',
        numeroPedidoExterno: 'SDK-T-1200',
        itens: [
          {
            codigoProduto: 10051,
            quantidade: 1,
            valorUnitario: 10,
            unidade: 'UN',
            codigoLocalOrigem: 30301,
          },
        ],
      });

      const body = http.gatewayCall.mock.calls[0][2] as {
        nota: {
          cabecalho: Record<string, unknown>;
          itens: { INFORMARPRECO: string; item: Record<string, unknown>[] };
        };
      };
      expect(body.nota.cabecalho.NUNOTA).toEqual({});
      expect(body.nota.cabecalho.STATUSNOTA).toEqual({ $: 'A' });
      expect(body.nota.cabecalho.AD_NUMPEDIDO).toEqual({ $: 'SDK-T-1200' });
      expect(body.nota.itens.INFORMARPRECO).toBe('True');
      expect(body.nota.itens.item[0].NUNOTA).toEqual({});
      expect(body.nota.itens.item[0].CODLOCALORIG).toEqual({ $: '30301' });
      expect(r.codigoPedido).toBe(1889304);
    });

    it('camposExtras entram no cabecalho sem serem reinterpretados', async () => {
      const http = createMockHttp();
      const pedidos = new PedidosResource(http);
      http.gatewayCall.mockResolvedValue({ pk: { NUNOTA: { $: '1' } } });

      await pedidos.incluirNotaGateway({
        codigoCliente: 1,
        dataNegociacao: '06/09/2026',
        codigoTipoOperacao: 1001,
        codigoTipoNegociacao: 200,
        codigoVendedor: 50,
        codigoEmpresa: 2,
        tipoMovimento: 'P',
        itens: [],
        camposExtras: { AD_MARKET_PLACE: 'Shopify.EC.V1', CIF_FOB: 'C', CODCENCUS: '0102002' },
      });

      const cab = (
        http.gatewayCall.mock.calls[0][2] as { nota: { cabecalho: Record<string, unknown> } }
      ).nota.cabecalho;
      expect(cab.AD_MARKET_PLACE).toEqual({ $: 'Shopify.EC.V1' });
      expect(cab.CIF_FOB).toEqual({ $: 'C' });
      expect(cab.CODCENCUS).toEqual({ $: '0102002' });
    });

    it('camposExtras nao pode sobrescrever campo tipado (falha alto)', async () => {
      const http = createMockHttp();
      const pedidos = new PedidosResource(http);

      await expect(
        pedidos.incluirNotaGateway({
          codigoCliente: 1,
          dataNegociacao: '06/09/2026',
          codigoTipoOperacao: 1001,
          codigoTipoNegociacao: 200,
          codigoVendedor: 50,
          codigoEmpresa: 2,
          tipoMovimento: 'P',
          itens: [],
          camposExtras: { CODPARC: '999' },
        }),
      ).rejects.toThrow(/CODPARC/);
      expect(http.gatewayCall).not.toHaveBeenCalled();
    });

    it('informarPreco: false manda a string False', async () => {
      const http = createMockHttp();
      const pedidos = new PedidosResource(http);
      http.gatewayCall.mockResolvedValue({ nota: { NUNOTA: { $: '7' } } });

      const r = await pedidos.incluirNotaGateway({
        codigoCliente: 1,
        dataNegociacao: '06/09/2026',
        codigoTipoOperacao: 1001,
        codigoTipoNegociacao: 200,
        codigoVendedor: 50,
        codigoEmpresa: 2,
        tipoMovimento: 'P',
        informarPreco: false,
        itens: [],
      });

      const body = http.gatewayCall.mock.calls[0][2] as {
        nota: { itens: { INFORMARPRECO: string } };
      };
      expect(body.nota.itens.INFORMARPRECO).toBe('False');
      // readNunota: 2o lugar da ordem (nota.NUNOTA.$), nao a raiz.
      expect(r.codigoPedido).toBe(7);
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
