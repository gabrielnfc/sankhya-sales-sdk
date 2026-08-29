import { toSankhyaDateMaybe } from '../core/date.js';
import { SankhyaError } from '../core/errors.js';
import { serialize } from '../core/gateway-serializer.js';
import type { HttpClient } from '../core/http.js';
import { createPaginator, extractRestData, normalizePagination } from '../core/pagination.js';
import { safeParseNumber } from '../core/parse-utils.js';
import {
  validateCancelarPedidoInput,
  validateConfirmarPedidoInput,
  validateFaturarPedidoInput,
  validatePedidoVendaInput,
} from '../core/validators.js';
import type { PaginatedResult } from '../types/common.js';
import type { RequestOptions } from '../types/config.js';
import type { DegradedInfo, ResourceDescriptor } from '../types/pagination-contracts.js';
import type {
  CancelarPedidoInput,
  ConfirmarPedidoInput,
  ConfirmarPedidoLiberacao,
  ConfirmarPedidoResponseBody,
  ConfirmarPedidoResult,
  ConsultarPedidosParams,
  FaturarPedidoInput,
  FinanceiroPedidoInput,
  IncluirNotaGatewayInput,
  ItemNotaGatewayInput,
  ItemPedidoInput,
  PedidoVenda,
  PedidoVendaInput,
} from '../types/pedidos.js';

// resourceKey 'pedido' no singular — medido (ver §3.2 do design). O plural
// 'pedidos' quebra o metodo inteiro; nao "corrigir" por semelhanca ao path.
const DESCRITOR_CONSULTAR: ResourceDescriptor = {
  resourceKey: 'pedido',
  contract: 'rest',
  expectPagination: true,
  endpoint: '/vendas/pedidos',
};

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
    const { data, degraded, degradedInfo } = extractRestData<PedidoVenda>(raw, DESCRITOR_CONSULTAR);
    return normalizePagination(
      data,
      raw,
      DESCRITOR_CONSULTAR,
      degraded,
      this.http.getLogger(),
      degradedInfo,
    );
  }

  /**
   * Itera sobre todos os pedidos automaticamente.
   *
   * @param params - Filtros (sem paginacao).
   * @returns AsyncGenerator que emite pedidos individualmente.
   * @throws {ApiError} Em erro HTTP.
   * @throws {AuthError} Se autenticacao falhar.
   */
  consultarTodos(
    params: Omit<ConsultarPedidosParams, 'page'> & {
      onDegraded?: ((info: DegradedInfo) => void) | undefined;
    },
  ): AsyncGenerator<PedidoVenda> {
    const { onDegraded, ...filtros } = params;
    return createPaginator((page) => this.consultar({ ...filtros, page }), 0, {
      onDegraded,
      logger: this.http.getLogger(),
    });
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
    validatePedidoVendaInput(pedido, 'PedidoVendaInput');
    const raw = await this.http.restPost<Record<string, unknown>>(
      '/vendas/pedidos',
      this.buildPedidoPayload(pedido),
      options,
    );
    return { codigoPedido: this.extractCodigoPedido(raw) };
  }

  /**
   * Desempacota o codigo do pedido do envelope REST.
   *
   * A API responde `{ codigo, tipo, mensagem, retorno: { codigoPedido } }` com
   * o id (string) em `retorno.codigoPedido`. Tolerante a respostas ja
   * desempacotadas (`{ codigoPedido }`) e ao campo de topo `codigo`. Lanca
   * quando nenhum desses campos esta presente — preferivel a fabricar um id `0`
   * silencioso que o chamador passaria adiante para `confirmar`/`cancelar`.
   *
   * @internal
   */
  private extractCodigoPedido(raw: unknown): number {
    const envelope = (raw ?? {}) as Record<string, unknown>;
    const retorno = (envelope.retorno ?? {}) as Record<string, unknown>;
    const value = retorno.codigoPedido ?? envelope.codigoPedido ?? envelope.codigo;
    if (value === undefined || value === null) {
      throw new SankhyaError(
        'Resposta de pedido sem codigoPedido (envelope inesperado da API)',
        'API_ERROR',
      );
    }
    return safeParseNumber(value, 'codigoPedido');
  }

  /**
   * Monta o payload REST do pedido a partir do input tipado.
   *
   * Normaliza datas (ISO → `dd/MM/yyyy`), auto-preenche `sequencia` de itens e
   * financeiros, aplica o default `controle: ' '`, mapeia os aliases
   * depreciados do financeiro (`codigoTipoPagamento`/`valor`/`numeroParcela`)
   * para os nomes canonicos e mescla `camposExtras` em cada nivel.
   *
   * @internal
   */
  private buildPedidoPayload(pedido: PedidoVendaInput): Record<string, unknown> {
    const { itens, financeiros, data, camposExtras, ...rest } = pedido;
    const payload: Record<string, unknown> = {
      ...rest,
      data: toSankhyaDateMaybe(data),
      itens: itens.map((item, i) => this.buildItemPayload(item, i)),
      financeiros: financeiros.map((fin, i) => this.buildFinanceiroPayload(fin, i)),
    };
    if (camposExtras) Object.assign(payload, camposExtras);
    return payload;
  }

  /** @internal */
  private buildItemPayload(item: ItemPedidoInput, index: number): Record<string, unknown> {
    const { sequencia, controle, camposExtras, ...rest } = item;
    const out: Record<string, unknown> = {
      ...rest,
      sequencia: sequencia ?? index + 1,
      controle: controle ?? ' ',
    };
    if (camposExtras) Object.assign(out, camposExtras);
    return out;
  }

  /** @internal */
  private buildFinanceiroPayload(
    fin: FinanceiroPedidoInput,
    index: number,
  ): Record<string, unknown> {
    const {
      tipoPagamento,
      valorParcela,
      sequencia,
      dataVencimento,
      dataBaixa,
      codigoTipoPagamento,
      valor,
      numeroParcela,
      camposExtras,
      ...rest
    } = fin;
    const out: Record<string, unknown> = {
      ...rest,
      sequencia: sequencia ?? numeroParcela ?? index + 1,
      tipoPagamento: tipoPagamento ?? codigoTipoPagamento,
      valorParcela: valorParcela ?? valor,
      dataVencimento: toSankhyaDateMaybe(dataVencimento),
    };
    if (dataBaixa !== undefined) out.dataBaixa = toSankhyaDateMaybe(dataBaixa);
    if (camposExtras) Object.assign(out, camposExtras);
    return out;
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
    validatePedidoVendaInput(pedido, 'PedidoVendaInput');
    const raw = await this.http.restPut<Record<string, unknown>>(
      `/vendas/pedidos/${codigoPedido}`,
      this.buildPedidoPayload(pedido),
      options,
    );
    return { codigoPedido: this.extractCodigoPedido(raw) };
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
    validateCancelarPedidoInput(input, 'CancelarPedidoInput');
    await this.http.restPost(
      `/vendas/pedidos/${input.codigoPedido}/cancela`,
      {
        motivo: input.motivo,
      },
      options,
    );
    // O id cancelado e o proprio input — nao depende do shape da resposta.
    return { codigoPedido: input.codigoPedido };
  }

  /**
   * Confirma um pedido de venda via Gateway.
   *
   * Desde a v1.4.0 devolve `{ responseBody }` normalizado: `status "1"` com
   * `liberacoes.liberacao` objeto OU array vira SEMPRE `liberacoes` array;
   * corpo vazio/ausente vira `responseBody` `undefined`. `status "0"` continua
   * lancando `GatewayError` (nada mudou no caminho de erro) — consumidor
   * antigo que ignorava o retorno `void` segue funcionando.
   *
   * @param input - Codigo do pedido e opcao de compensacao.
   * @param options - Opcoes de requisicao.
   * @returns Corpo da resposta do Gateway normalizado (avisos/liberacoes).
   * @throws {GatewayError} Em erro de negocio Sankhya.
   * @throws {AuthError} Se autenticacao falhar.
   */
  async confirmar(
    input: ConfirmarPedidoInput,
    options?: RequestOptions,
  ): Promise<ConfirmarPedidoResult> {
    validateConfirmarPedidoInput(input, 'ConfirmarPedidoInput');
    const raw = await this.http.gatewayCall<unknown>(
      'mgecom',
      'CACSP.confirmarNota',
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
    const responseBody = this.normalizeConfirmarResponseBody(raw);
    return responseBody === undefined ? {} : { responseBody };
  }

  /**
   * Normaliza o corpo da resposta do `confirmarNota`: corpo nao-objeto ou
   * objeto vazio vira `undefined`; `liberacoes` vira array plano (ver
   * {@link ConfirmarPedidoResponseBody}); marcador vazio do Gateway (`"{}"`)
   * ou shape ilegivel de `liberacoes` e tratado como ausencia de pendencia.
   *
   * @internal
   */
  private normalizeConfirmarResponseBody(raw: unknown): ConfirmarPedidoResponseBody | undefined {
    if (raw === null || raw === undefined || typeof raw !== 'object' || Array.isArray(raw)) {
      return undefined;
    }
    const body = raw as Record<string, unknown>;
    if (Object.keys(body).length === 0) return undefined;
    const { liberacoes: rawLiberacoes, ...rest } = body;
    const liberacoes = this.normalizeLiberacoes(rawLiberacoes);
    return liberacoes === undefined ? rest : { ...rest, liberacoes };
  }

  /** @internal */
  private normalizeLiberacoes(value: unknown): ConfirmarPedidoLiberacao[] | undefined {
    const isRecord = (v: unknown): v is ConfirmarPedidoLiberacao =>
      typeof v === 'object' && v !== null && !Array.isArray(v);
    if (Array.isArray(value)) return value.filter(isRecord);
    if (!isRecord(value)) return undefined;
    const inner = (value as { liberacao?: unknown }).liberacao;
    if (Array.isArray(inner)) return inner.filter(isRecord);
    if (isRecord(inner)) return [inner];
    return undefined;
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
    validateFaturarPedidoInput(input, 'FaturarPedidoInput');
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
