import { toSankhyaDateMaybe } from '../core/date.js';
import { SankhyaError } from '../core/errors.js';
import { buildFaturarWizardPayload } from '../core/faturamento-payload.js';
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

/**
 * As 11 chaves que `incluirNotaGateway` monta no cabecalho a partir de campos
 * TIPADOS de `IncluirNotaGatewayInput`. `camposExtras` e a passagem crua para
 * os outros 18 campos medidos (29 no total, anexo §D1.2) e nunca para estas —
 * inclusive quando o campo tipado correspondente foi omitido: deixar
 * `STATUSNOTA` ou `AD_NUMPEDIDO` passar cru furaria o union `'A' | 'L'` e o
 * contrato de prefixo `SDK-T-` que a D4 pendura em `numeroPedidoExterno`.
 */
const CHAVES_TIPADAS_CABECALHO: ReadonlySet<string> = new Set([
  'NUNOTA',
  'CODPARC',
  'DTNEG',
  'CODTIPOPER',
  'CODTIPVENDA',
  'CODVEND',
  'CODEMP',
  'TIPMOV',
  'OBSERVACAO',
  'STATUSNOTA',
  'AD_NUMPEDIDO',
]);

/**
 * Total do item em CENTAVOS, para nao mandar lixo binario num campo de dinheiro.
 *
 * Medido (review 4 da D4): `1.01 * 3` em ponto flutuante serializa como
 * `'3.0300000000000002'`, e **19,17%** dos pares (preco de 2 casas entre R$1 e
 * R$500 x quantidade 1-20) passam de 2 casas. Nenhum spike mediu `VLRTOT`
 * fracionario — todos os medidos sao `'10'`, `'30'`, `'40'` — entao a reacao do
 * ERP a uma 17a casa e DESCONHECIDA, e escrita ambigua e o que I11 proibe.
 *
 * A conta vai pelo inteiro de centavos e volta dividida por 100: `Math.round`
 * duas vezes, porque `quantidade` pode ser fracionaria (0,5 kg, 1,25 m) e o
 * produto em centavos tambem quebra. O resultado e exato ate 2 casas, e
 * `String()` devolve a forma canonica — `'3.03'`, `'0.3'`, `'10'` —, nunca uma
 * casa inventada.
 */
function totalEmCentavos(valorUnitario: number, quantidade: number): number {
  const centavos = Math.round(valorUnitario * 100);
  return Math.round(centavos * quantidade) / 100;
}

/** Recusa numero de item fora da faixa ANTES da rede (R9/I11). */
function assertNumeroDoItem(
  valor: number | undefined,
  campo: string,
  minimo: number,
  maximo: number,
  indice: number,
): void {
  if (valor === undefined) return;
  if (!Number.isFinite(valor) || valor < minimo || valor > maximo) {
    throw new SankhyaError(
      `incluirNotaGateway: itens[${indice}].${campo} precisa ser um numero finito entre ${minimo} e ${maximo}; recebido: ${String(valor)}. Nenhuma chamada foi feita.`,
      'VALIDATION_ERROR',
    );
  }
}

/** Estreita para objeto simples sem usar `any`. */
function ehRegistro(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor);
}

/** Le `NUNOTA` de um envelope `{ NUNOTA: { $: x } }` ou `{ NUNOTA: x }`. */
function nunotaDoEnvelope(envelope: unknown): unknown {
  if (!ehRegistro(envelope)) return undefined;
  const nunota = envelope.NUNOTA;
  return ehRegistro(nunota) ? nunota.$ : nunota;
}

/**
 * Le o NUNOTA da resposta do `CACSP.incluirNota` na ordem medida:
 * `pk.NUNOTA.$` -> `nota.NUNOTA.$` -> raiz `NUNOTA`.
 *
 * A resposta aceita no sandbox traz a chave em `pk` (M34); ler apenas a raiz
 * devolvia `undefined` e o `codigoPedido` saia 0.
 */
function readNunota(raw: unknown): unknown {
  if (!ehRegistro(raw)) return undefined;
  const viaPk = nunotaDoEnvelope(raw.pk);
  if (viaPk !== undefined) return viaPk;
  const viaNota = nunotaDoEnvelope(raw.nota);
  if (viaNota !== undefined) return viaNota;
  return nunotaDoEnvelope(raw);
}

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
   * Fatura um pedido de venda via Gateway (`SelecaoDocumentoSP.faturar`).
   *
   * O corpo vem inteiro de {@link buildFaturarWizardPayload} — fonte unica do
   * payload do wizard medido no sandbox (M51/M49). Nao montar o corpo aqui.
   *
   * @param input - Dados de faturamento (pedido, tipo operacao, serie, data).
   * @param options - Opcoes de requisicao.
   * @throws {SankhyaError} Se `faturarTodosItens` for `false` (M82, sem rede).
   * @throws {GatewayError} Em erro de negocio Sankhya.
   * @throws {AuthError} Se autenticacao falhar.
   */
  async faturar(input: FaturarPedidoInput, options?: RequestOptions): Promise<void> {
    validateFaturarPedidoInput(input, 'FaturarPedidoInput');
    await this.http.gatewayCall(
      'mgecom',
      'SelecaoDocumentoSP.faturar',
      buildFaturarWizardPayload(input),
      options,
    );
  }

  /**
   * Inclui uma nota via Gateway (CACSP.incluirNota), no formato aceito pelo
   * 4midware (medido, M34/M46): `NUNOTA: {}` no cabecalho e em cada item, e
   * `itens.INFORMARPRECO` como a STRING `'True'`/`'False'`.
   *
   * Campos opcionais do cabecalho: `statusNota` (STATUSNOTA, `'A' | 'L'`),
   * `numeroPedidoExterno` (AD_NUMPEDIDO), `informarPreco` (default `true`) e
   * `camposExtras` — passagem crua para os campos do cabecalho que o SDK nao
   * tipa. `camposExtras` entra por ultimo e **lanca** se citar qualquer uma das
   * 11 chaves tipadas (`CHAVES_TIPADAS_CABECALHO`), inclusive quando o campo
   * tipado correspondente foi omitido.
   *
   * O NUNOTA de retorno e lido em `pk.NUNOTA.$` -> `nota.NUNOTA.$` -> raiz
   * `NUNOTA`; ausente nos tres, **lanca** em vez de devolver `0`.
   *
   * @param input - Dados completos da nota (cliente, itens, operacao).
   * @param options - Opcoes de requisicao.
   * @returns Codigo do pedido/nota criado.
   * @throws {SankhyaError} Se `camposExtras` citar chave tipada, ou se a
   *   resposta nao trouxer NUNOTA.
   * @throws {GatewayError} Em erro de negocio Sankhya.
   * @throws {AuthError} Se autenticacao falhar.
   */
  async incluirNotaGateway(
    input: IncluirNotaGatewayInput,
    options?: RequestOptions,
  ): Promise<{ codigoPedido: number }> {
    // Formato aceito pelo 4midware (M34/M46): `NUNOTA: {}` (objeto vazio, NAO
    // `{ $: '' }`) no cabecalho e em CADA item; `itens.INFORMARPRECO` e a
    // STRING 'True'/'False', fora do serializador. Nao "simplificar".
    // Item COMPLETO, na forma medida (`spike-raw/faturamento/S2_INCLUIR_P1.json`
    // -> `nota.itens.item[0]`, e `ped.ts:6`, 06/09): 8 chaves. `VLRTOT` e
    // `PERCDESC` nao sao decorativos — a lane da D4 mediu duas vezes que, sem o
    // percentual, `CACSP.incluirNota` recusa com `O campo 'Perc. desconto' deve
    // ser informado.` (CORE_E03235); e o campo e do ITEM, nao do cabecalho: a
    // recusa sobreviveu a `PERCDESC` no cabecalho.
    const itens = input.itens.map((item, indice) => {
      // Lixo nao cruza a fronteira: o juiz e local, nao o ERP (R9/I11).
      assertNumeroDoItem(item.percentualDesconto, 'percentualDesconto', 0, 100, indice);
      assertNumeroDoItem(item.valorTotal, 'valorTotal', 0, Number.MAX_SAFE_INTEGER, indice);

      return {
        NUNOTA: {},
        ...serialize({
          CODPROD: item.codigoProduto,
          QTDNEG: item.quantidade,
          VLRUNIT: item.valorUnitario,
          CODVOL: item.unidade,
          ...(item.codigoLocalOrigem ? { CODLOCALORIG: item.codigoLocalOrigem } : {}),
          VLRTOT: item.valorTotal ?? totalEmCentavos(item.valorUnitario, item.quantidade),
          PERCDESC: item.percentualDesconto ?? 0,
        }),
      };
    });

    const cabecalho: Record<string, unknown> = {
      NUNOTA: {},
      ...serialize({
        CODPARC: input.codigoCliente,
        DTNEG: input.dataNegociacao,
        CODTIPOPER: input.codigoTipoOperacao,
        CODTIPVENDA: input.codigoTipoNegociacao,
        CODVEND: input.codigoVendedor,
        CODEMP: input.codigoEmpresa,
        TIPMOV: input.tipoMovimento,
        ...(input.observacao ? { OBSERVACAO: input.observacao } : {}),
        ...(input.statusNota ? { STATUSNOTA: input.statusNota } : {}),
        ...(input.numeroPedidoExterno ? { AD_NUMPEDIDO: input.numeroPedidoExterno } : {}),
      }),
    };

    // camposExtras entra POR ULTIMO, depois de checar colisao contra o conjunto
    // TIPADO (nao contra as chaves montadas): sobrescrever — ou contrabandear
    // por um opcional omitido — um campo tipado mandaria ao ERP um valor que o
    // chamador nao pediu. Falha alto, antes de qualquer side-effect (sem rede).
    if (input.camposExtras) {
      for (const [campo, valor] of Object.entries(input.camposExtras)) {
        if (CHAVES_TIPADAS_CABECALHO.has(campo)) {
          throw new SankhyaError(
            `IncluirNotaGatewayInput.camposExtras nao pode escrever no campo tipado '${campo}' do cabecalho`,
            'VALIDATION_ERROR',
          );
        }
        cabecalho[campo] = serialize({ [campo]: valor })[campo];
      }
    }

    const result = await this.http.gatewayCall<Record<string, unknown>>(
      'mgecom',
      'CACSP.incluirNota',
      {
        nota: {
          cabecalho,
          itens: {
            INFORMARPRECO: input.informarPreco === false ? 'False' : 'True',
            item: itens,
          },
        },
      },
      options,
    );

    // `safeParseNumber` devolve 0 para ausente/vazio/`{}` — e NUNOTA 0 nao
    // existe (sequencia de identidade do ERP). Lancar e preferivel a fabricar
    // um id silencioso que o chamador levaria para `confirmar`/`faturar`, como
    // ja faz `extractCodigoPedido` em `criar()`.
    const codigoPedido = safeParseNumber(readNunota(result), 'NUNOTA');
    if (codigoPedido === 0) {
      throw new SankhyaError(
        'Resposta de CACSP.incluirNota sem NUNOTA em pk/nota/raiz (envelope inesperado da API)',
        'API_ERROR',
      );
    }
    return { codigoPedido };
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
