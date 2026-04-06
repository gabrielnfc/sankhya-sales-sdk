import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PedidosResource } from '../../src/resources/pedidos.js';
import type { HttpClient } from '../../src/core/http.js';
import type { RequestOptions } from '../../src/types/config.js';

function createMockHttp() {
  return {
    restGet: vi.fn().mockResolvedValue({ data: [], pagination: { page: '0', total: '0', hasMore: 'false', offset: '0' } }),
    restPost: vi.fn().mockResolvedValue({ codigoPedido: 123 }),
    restPut: vi.fn().mockResolvedValue({ codigoPedido: 123 }),
    gatewayCall: vi.fn().mockResolvedValue({}),
  } as unknown as HttpClient;
}

describe('PedidosResource idempotency', () => {
  let http: ReturnType<typeof createMockHttp>;
  let pedidos: PedidosResource;

  beforeEach(() => {
    http = createMockHttp();
    pedidos = new PedidosResource(http as unknown as HttpClient);
  });

  const options: RequestOptions = { idempotencyKey: 'test-uuid-123' };

  it('criar forwards RequestOptions to restPost', async () => {
    const input = { codigoCliente: 1, codigoEmpresa: 1, codigoTipoOperacao: 1, itens: [] };
    await pedidos.criar(input, options);

    expect((http as Record<string, ReturnType<typeof vi.fn>>).restPost).toHaveBeenCalledWith(
      '/vendas/pedidos',
      input,
      options,
    );
  });

  it('criar works without options (backward compatible)', async () => {
    const input = { codigoCliente: 1, codigoEmpresa: 1, codigoTipoOperacao: 1, itens: [] };
    await pedidos.criar(input);

    expect((http as Record<string, ReturnType<typeof vi.fn>>).restPost).toHaveBeenCalledWith(
      '/vendas/pedidos',
      input,
      undefined,
    );
  });

  it('atualizar forwards RequestOptions to restPut', async () => {
    const input = { codigoCliente: 1, codigoEmpresa: 1, codigoTipoOperacao: 1, itens: [] };
    await pedidos.atualizar(42, input, options);

    expect((http as Record<string, ReturnType<typeof vi.fn>>).restPut).toHaveBeenCalledWith(
      '/vendas/pedidos/42',
      input,
      options,
    );
  });

  it('cancelar forwards RequestOptions to restPost', async () => {
    const input = { codigoPedido: 42, motivo: 'duplicado' };
    await pedidos.cancelar(input, options);

    expect((http as Record<string, ReturnType<typeof vi.fn>>).restPost).toHaveBeenCalledWith(
      '/vendas/pedidos/42/cancela',
      { motivo: 'duplicado' },
      options,
    );
  });

  it('confirmar forwards RequestOptions to gatewayCall', async () => {
    await pedidos.confirmar({ codigoPedido: 42 }, options);

    expect((http as Record<string, ReturnType<typeof vi.fn>>).gatewayCall).toHaveBeenCalledWith(
      'mgecom',
      'ServicosNfeSP.confirmarNota',
      expect.any(Object),
      options,
    );
  });

  it('faturar forwards RequestOptions to gatewayCall', async () => {
    await pedidos.faturar({
      codigoPedido: 42,
      codigoTipoOperacao: 1,
      dataFaturamento: '2026-01-01',
    }, options);

    expect((http as Record<string, ReturnType<typeof vi.fn>>).gatewayCall).toHaveBeenCalledWith(
      'mgecom',
      'SelecaoDocumentoSP.faturar',
      expect.any(Object),
      options,
    );
  });

  it('incluirNotaGateway forwards RequestOptions to gatewayCall', async () => {
    await pedidos.incluirNotaGateway({
      codigoCliente: 1,
      dataNegociacao: '2026-01-01',
      codigoTipoOperacao: 1,
      codigoTipoNegociacao: 1,
      codigoVendedor: 1,
      codigoEmpresa: 1,
      tipoMovimento: 'V',
      itens: [{ codigoProduto: 1, quantidade: 1, valorUnitario: 10, unidade: 'UN' }],
    }, options);

    expect((http as Record<string, ReturnType<typeof vi.fn>>).gatewayCall).toHaveBeenCalledWith(
      'mgecom',
      'CACSP.incluirNota',
      expect.any(Object),
      options,
    );
  });

  it('incluirAlterarItem forwards RequestOptions to gatewayCall', async () => {
    await pedidos.incluirAlterarItem(
      42,
      [{ codigoProduto: 1, quantidade: 1, valorUnitario: 10, unidade: 'UN' }],
      options,
    );

    expect((http as Record<string, ReturnType<typeof vi.fn>>).gatewayCall).toHaveBeenCalledWith(
      'mgecom',
      'CACSP.incluirAlterarItemNota',
      expect.any(Object),
      options,
    );
  });

  it('excluirItem forwards RequestOptions to gatewayCall', async () => {
    await pedidos.excluirItem(42, 1, options);

    expect((http as Record<string, ReturnType<typeof vi.fn>>).gatewayCall).toHaveBeenCalledWith(
      'mgecom',
      'CACSP.excluirItemNota',
      expect.any(Object),
      options,
    );
  });
});
