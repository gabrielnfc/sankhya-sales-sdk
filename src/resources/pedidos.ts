import { serialize } from '../core/gateway-serializer.js';
import type { HttpClient } from '../core/http.js';
import { createPaginator, extractRestData, normalizeRestPagination } from '../core/pagination.js';
import type { PaginatedResult } from '../types/common.js';
import type {
  CancelarPedidoInput,
  ConfirmarPedidoInput,
  ConsultarPedidosParams,
  FaturarPedidoInput,
  IncluirNotaGatewayInput,
  ItemNotaGatewayInput,
  PedidoVenda,
  PedidoVendaInput,
} from '../types/pedidos.js';

export class PedidosResource {
  constructor(private readonly http: HttpClient) {}

  async consultar(params: ConsultarPedidosParams): Promise<PaginatedResult<PedidoVenda>> {
    const query: Record<string, string> = {
      page: String(params.page ?? 0),
      codigoEmpresa: String(params.codigoEmpresa),
    };
    if (params.modifiedSince) query.modifiedSince = params.modifiedSince;
    if (params.codigoNota !== undefined) query.codigoNota = String(params.codigoNota);
    if (params.numeroNota !== undefined) query.numeroNota = String(params.numeroNota);
    if (params.serieNota) query.serieNota = params.serieNota;
    if (params.dataNegociacaoInicio) query.dataNegociacaoInicio = params.dataNegociacaoInicio;
    if (params.dataNegociacaoFinal) query.dataNegociacaoFinal = params.dataNegociacaoFinal;
    if (params.codigoCliente !== undefined) query.codigoCliente = String(params.codigoCliente);
    if (params.confirmada !== undefined) query.confirmada = String(params.confirmada);
    if (params.pendente !== undefined) query.pendente = String(params.pendente);
    if (params.codigoNatureza !== undefined) query.codigoNatureza = String(params.codigoNatureza);
    if (params.codigoCentroResultado !== undefined)
      query.codigoCentroResultado = String(params.codigoCentroResultado);
    if (params.codigoProjeto !== undefined) query.codigoProjeto = String(params.codigoProjeto);
    if (params.codigoOrdemCarga !== undefined)
      query.codigoOrdemCarga = String(params.codigoOrdemCarga);

    const raw = await this.http.restGet<Record<string, unknown>>('/vendas/pedidos', query);
    const { data, pagination } = extractRestData<PedidoVenda>(raw);
    return normalizeRestPagination(data, pagination);
  }

  consultarTodos(
    params: Omit<ConsultarPedidosParams, 'page'>,
  ): AsyncGenerator<PedidoVenda> {
    return createPaginator((page) => this.consultar({ ...params, page }));
  }

  async criar(pedido: PedidoVendaInput): Promise<{ codigoPedido: number }> {
    return this.http.restPost('/vendas/pedidos', pedido);
  }

  async atualizar(
    codigoPedido: number,
    pedido: PedidoVendaInput,
  ): Promise<{ codigoPedido: number }> {
    return this.http.restPut(`/vendas/pedidos/${codigoPedido}`, pedido);
  }

  async cancelar(input: CancelarPedidoInput): Promise<{ codigoPedido: number }> {
    return this.http.restPost(`/vendas/pedidos/${input.codigoPedido}/cancela`, {
      motivo: input.motivo,
    });
  }

  async confirmar(input: ConfirmarPedidoInput): Promise<void> {
    await this.http.gatewayCall('mgecom', 'ServicosNfeSP.confirmarNota', {
      nota: {
        NUNOTA: { $: String(input.codigoPedido) },
        ...(input.compensarAutomaticamente !== undefined
          ? { COMPENSAR: { $: input.compensarAutomaticamente ? 'S' : 'N' } }
          : {}),
      },
    });
  }

  async faturar(input: FaturarPedidoInput): Promise<void> {
    await this.http.gatewayCall('mgecom', 'SelecaoDocumentoSP.faturar', {
      notas: {
        codTipOper: input.codigoTipoOperacao,
        dtFatur: input.dataFaturamento,
        tipoFaturamento: input.tipoFaturamento ?? 'FaturamentoNormal',
        faturarTodosItens: input.faturarTodosItens !== false,
        nota: {
          NUNOTA: { $: String(input.codigoPedido) },
        },
      },
    });
  }

  async incluirNotaGateway(input: IncluirNotaGatewayInput): Promise<{ codigoPedido: number }> {
    const itens = input.itens.map((item) =>
      serialize({
        CODPROD: item.codigoProduto,
        QTDNEG: item.quantidade,
        VLRUNIT: item.valorUnitario,
        CODVOL: item.unidade,
        ...(item.codigoLocalOrigem ? { CODLOCALORIG: item.codigoLocalOrigem } : {}),
      }),
    );

    const result = await this.http.gatewayCall<Record<string, unknown>>(
      'mgecom',
      'CACSP.incluirNota',
      {
        nota: {
          cabecalho: serialize({
            CODPARC: input.codigoCliente,
            DTNEG: input.dataNegociacao,
            CODTIPOPER: input.codigoTipoOperacao,
            CODTIPVENDA: input.codigoTipoNegociacao,
            CODVEND: input.codigoVendedor,
            CODEMP: input.codigoEmpresa,
            TIPMOV: input.tipoMovimento,
            ...(input.observacao ? { OBSERVACAO: input.observacao } : {}),
          }),
          itens: { item: itens },
        },
      },
    );

    const nunota = (result as Record<string, unknown>).NUNOTA;
    return { codigoPedido: Number(nunota) || 0 };
  }

  async incluirAlterarItem(codigoPedido: number, itens: ItemNotaGatewayInput[]): Promise<void> {
    const serializedItens = itens.map((item) =>
      serialize({
        CODPROD: item.codigoProduto,
        QTDNEG: item.quantidade,
        VLRUNIT: item.valorUnitario,
        CODVOL: item.unidade,
        ...(item.codigoLocalOrigem ? { CODLOCALORIG: item.codigoLocalOrigem } : {}),
      }),
    );

    await this.http.gatewayCall('mgecom', 'CACSP.incluirAlterarItemNota', {
      nota: {
        NUNOTA: { $: String(codigoPedido) },
        itens: { item: serializedItens },
      },
    });
  }

  async excluirItem(codigoPedido: number, sequencia: number): Promise<void> {
    await this.http.gatewayCall('mgecom', 'CACSP.excluirItemNota', {
      nota: {
        NUNOTA: { $: String(codigoPedido) },
        SEQUENCIA: { $: String(sequencia) },
      },
    });
  }
}
