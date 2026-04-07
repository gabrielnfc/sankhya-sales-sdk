import { serialize } from '../core/gateway-serializer.js';
import type { HttpClient } from '../core/http.js';
import { createPaginator, extractRestData, normalizeRestPagination } from '../core/pagination.js';
import { safeParseNumber } from '../core/parse-utils.js';
import type { PaginatedResult } from '../types/common.js';
import type { RequestOptions } from '../types/config.js';
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

/** Operacoes de pedidos de venda no Sankhya ERP. Acesse via `sankhya.pedidos`. */
export class PedidosResource {
  constructor(private readonly http: HttpClient) {}

  /**
   * Consulta pedidos de venda paginados.
   *
   * @param params - Filtros obrigatorios (codigoEmpresa) e opcionais.
   * @returns Resultado paginado com pedidos.
   * @throws {ApiError} Em erro HTTP.
   * @throws {AuthError} Se autenticacao falhar.
   * @example
   * ```ts
   * const pedidos = await sankhya.pedidos.consultar({
   *   codigoEmpresa: 1,
   * });
   * ```
   */
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

  /**
   * Itera sobre todos os pedidos automaticamente.
   *
   * @param params - Filtros (sem paginacao).
   * @returns AsyncGenerator que emite pedidos individualmente.
   * @throws {ApiError} Em erro HTTP.
   * @throws {AuthError} Se autenticacao falhar.
   */
  consultarTodos(params: Omit<ConsultarPedidosParams, 'page'>): AsyncGenerator<PedidoVenda> {
    return createPaginator((page) => this.consultar({ ...params, page }));
  }

  /**
   * Cria um novo pedido de venda via REST.
   *
   * @param pedido - Dados do pedido a criar.
   * @param options - Opcoes de requisicao (timeout, idempotencyKey).
   * @returns Codigo do pedido criado.
   * @throws {ApiError} Em erro HTTP.
   * @throws {AuthError} Se autenticacao falhar.
   */
  async criar(
    pedido: PedidoVendaInput,
    options?: RequestOptions,
  ): Promise<{ codigoPedido: number }> {
    return this.http.restPost('/vendas/pedidos', pedido, options);
  }

  /**
   * Atualiza um pedido de venda existente.
   *
   * @param codigoPedido - Codigo do pedido a atualizar.
   * @param pedido - Dados atualizados do pedido.
   * @param options - Opcoes de requisicao.
   * @returns Codigo do pedido atualizado.
   * @throws {ApiError} Em erro HTTP.
   * @throws {AuthError} Se autenticacao falhar.
   */
  async atualizar(
    codigoPedido: number,
    pedido: PedidoVendaInput,
    options?: RequestOptions,
  ): Promise<{ codigoPedido: number }> {
    return this.http.restPut(`/vendas/pedidos/${codigoPedido}`, pedido, options);
  }

  /**
   * Cancela um pedido de venda.
   *
   * @param input - Codigo do pedido e motivo opcional.
   * @param options - Opcoes de requisicao.
   * @returns Codigo do pedido cancelado.
   * @throws {ApiError} Em erro HTTP.
   * @throws {AuthError} Se autenticacao falhar.
   */
  async cancelar(
    input: CancelarPedidoInput,
    options?: RequestOptions,
  ): Promise<{ codigoPedido: number }> {
    return this.http.restPost(
      `/vendas/pedidos/${input.codigoPedido}/cancela`,
      {
        motivo: input.motivo,
      },
      options,
    );
  }

  /**
   * Confirma um pedido de venda via Gateway.
   *
   * @param input - Codigo do pedido e opcao de compensacao.
   * @param options - Opcoes de requisicao.
   * @throws {GatewayError} Em erro de negocio Sankhya.
   * @throws {AuthError} Se autenticacao falhar.
   */
  async confirmar(input: ConfirmarPedidoInput, options?: RequestOptions): Promise<void> {
    await this.http.gatewayCall(
      'mgecom',
      'ServicosNfeSP.confirmarNota',
      {
        nota: {
          NUNOTA: { $: String(input.codigoPedido) },
          ...(input.compensarAutomaticamente !== undefined
            ? { COMPENSAR: { $: input.compensarAutomaticamente ? 'S' : 'N' } }
            : {}),
        },
      },
      options,
    );
  }

  /**
   * Fatura um pedido de venda via Gateway.
   *
   * @param input - Dados de faturamento (pedido, tipo operacao, data).
   * @param options - Opcoes de requisicao.
   * @throws {GatewayError} Em erro de negocio Sankhya.
   * @throws {AuthError} Se autenticacao falhar.
   */
  async faturar(input: FaturarPedidoInput, options?: RequestOptions): Promise<void> {
    await this.http.gatewayCall(
      'mgecom',
      'SelecaoDocumentoSP.faturar',
      {
        notas: {
          codTipOper: input.codigoTipoOperacao,
          dtFatur: input.dataFaturamento,
          tipoFaturamento: input.tipoFaturamento ?? 'FaturamentoNormal',
          faturarTodosItens: input.faturarTodosItens !== false,
          nota: {
            NUNOTA: { $: String(input.codigoPedido) },
          },
        },
      },
      options,
    );
  }

  /**
   * Inclui uma nota via Gateway (CACSP.incluirNota).
   *
   * @param input - Dados completos da nota (cliente, itens, operacao).
   * @param options - Opcoes de requisicao.
   * @returns Codigo do pedido/nota criado.
   * @throws {GatewayError} Em erro de negocio Sankhya.
   * @throws {AuthError} Se autenticacao falhar.
   */
  async incluirNotaGateway(
    input: IncluirNotaGatewayInput,
    options?: RequestOptions,
  ): Promise<{ codigoPedido: number }> {
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
      options,
    );

    const nunota = (result as Record<string, unknown>).NUNOTA;
    return { codigoPedido: safeParseNumber(nunota, 'NUNOTA') };
  }

  /**
   * Inclui ou altera itens em um pedido existente via Gateway.
   *
   * @param codigoPedido - Codigo do pedido (NUNOTA).
   * @param itens - Itens a incluir/alterar.
   * @param options - Opcoes de requisicao.
   * @throws {GatewayError} Em erro de negocio Sankhya.
   * @throws {AuthError} Se autenticacao falhar.
   */
  async incluirAlterarItem(
    codigoPedido: number,
    itens: ItemNotaGatewayInput[],
    options?: RequestOptions,
  ): Promise<void> {
    const serializedItens = itens.map((item) =>
      serialize({
        CODPROD: item.codigoProduto,
        QTDNEG: item.quantidade,
        VLRUNIT: item.valorUnitario,
        CODVOL: item.unidade,
        ...(item.codigoLocalOrigem ? { CODLOCALORIG: item.codigoLocalOrigem } : {}),
      }),
    );

    await this.http.gatewayCall(
      'mgecom',
      'CACSP.incluirAlterarItemNota',
      {
        nota: {
          NUNOTA: { $: String(codigoPedido) },
          itens: { item: serializedItens },
        },
      },
      options,
    );
  }

  /**
   * Exclui um item de um pedido via Gateway.
   *
   * @param codigoPedido - Codigo do pedido (NUNOTA).
   * @param sequencia - Sequencia do item a excluir.
   * @param options - Opcoes de requisicao.
   * @throws {GatewayError} Em erro de negocio Sankhya.
   * @throws {AuthError} Se autenticacao falhar.
   */
  async excluirItem(
    codigoPedido: number,
    sequencia: number,
    options?: RequestOptions,
  ): Promise<void> {
    await this.http.gatewayCall(
      'mgecom',
      'CACSP.excluirItemNota',
      {
        nota: {
          NUNOTA: { $: String(codigoPedido) },
          SEQUENCIA: { $: String(sequencia) },
        },
      },
      options,
    );
  }
}
