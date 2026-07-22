import { describe, expect, it, vi } from 'vitest';
import type { HttpClient } from '../../src/core/http.js';
import { GatewayResource } from '../../src/resources/gateway.js';
import { PedidosResource } from '../../src/resources/pedidos.js';
import type { Logger } from '../../src/types/config.js';

/**
 * REGRESSION GUARD: garante que nenhuma edicao futura marque uma ESCRITA do
 * Gateway como idempotente (5o argumento de gatewayCall) — o que habilitaria
 * retry automatico com risco de duplicacao no ERP — e que as LEITURAS
 * continuem elegiveis a retry.
 */

const mockLogger: Logger = {
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
};

function createHttpSpy() {
  const gatewayCall = vi.fn().mockResolvedValue({});
  const http = {
    gatewayCall,
    getLogger: () => mockLogger,
  } as unknown as HttpClient;
  return { http, gatewayCall };
}

function idempotentArgOf(gatewayCall: ReturnType<typeof vi.fn>): unknown {
  expect(gatewayCall).toHaveBeenCalled();
  return gatewayCall.mock.calls[0][4];
}

const notaInput = {
  codigoCliente: 1,
  dataNegociacao: '2026-07-22',
  codigoTipoOperacao: 1000,
  codigoTipoNegociacao: 1,
  codigoVendedor: 10,
  codigoEmpresa: 1,
  tipoMovimento: 'P',
  itens: [{ codigoProduto: 1001, quantidade: 1, valorUnitario: 10, unidade: 'UN' }],
};

describe('escritas do Gateway NAO passam idempotent (5o arg falsy)', () => {
  it('pedidos.confirmar', async () => {
    const { http, gatewayCall } = createHttpSpy();
    await new PedidosResource(http).confirmar({ codigoPedido: 1 });
    expect(idempotentArgOf(gatewayCall)).toBeFalsy();
  });

  it('pedidos.faturar', async () => {
    const { http, gatewayCall } = createHttpSpy();
    await new PedidosResource(http).faturar({
      codigoPedido: 1,
      codigoTipoOperacao: 1000,
      dataFaturamento: '2026-07-22',
    });
    expect(idempotentArgOf(gatewayCall)).toBeFalsy();
  });

  it('pedidos.incluirNotaGateway', async () => {
    const { http, gatewayCall } = createHttpSpy();
    await new PedidosResource(http).incluirNotaGateway(notaInput);
    expect(idempotentArgOf(gatewayCall)).toBeFalsy();
  });

  it('pedidos.incluirAlterarItem', async () => {
    const { http, gatewayCall } = createHttpSpy();
    await new PedidosResource(http).incluirAlterarItem(1, notaInput.itens);
    expect(idempotentArgOf(gatewayCall)).toBeFalsy();
  });

  it('pedidos.excluirItem', async () => {
    const { http, gatewayCall } = createHttpSpy();
    await new PedidosResource(http).excluirItem(1, 1);
    expect(idempotentArgOf(gatewayCall)).toBeFalsy();
  });

  it('gateway.saveRecord', async () => {
    const { http, gatewayCall } = createHttpSpy();
    await new GatewayResource(http).saveRecord({
      entity: 'Parceiro',
      fields: 'CODPARC,NOMEPARC',
      data: { NOMEPARC: 'Teste' },
    });
    expect(idempotentArgOf(gatewayCall)).toBeFalsy();
  });
});

describe('leituras do Gateway passam idempotent=true (elegiveis a retry)', () => {
  it('gateway.loadRecords', async () => {
    const { http, gatewayCall } = createHttpSpy();
    await new GatewayResource(http).loadRecords({ entity: 'Parceiro', fields: 'CODPARC' });
    expect(idempotentArgOf(gatewayCall)).toBe(true);
  });

  it('gateway.loadRecord', async () => {
    const { http, gatewayCall } = createHttpSpy();
    await new GatewayResource(http).loadRecord({
      entity: 'Parceiro',
      fields: 'CODPARC',
      primaryKey: { CODPARC: '1' },
    });
    expect(idempotentArgOf(gatewayCall)).toBe(true);
  });
});
