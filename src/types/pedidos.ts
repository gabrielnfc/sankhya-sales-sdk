import type { Cliente } from './clientes.js';
import type { ModifiedSinceParams, PaginationParams } from './common.js';

/** Tipo de imposto suportado pela API de pedidos (IBS/CBS e legado). */
export type TipoImpostoPedido = 'icms' | 'icms-st' | 'ipi' | 'ibs' | 'cbs' | 'is';

/**
 * Detalhamento de imposto de um item (entrada). Todos os campos sao opcionais —
 * envie apenas os relevantes ao regime (IBS/CBS ou legado). Campos nao mapeados
 * aqui mas presentes no dicionario de dados podem ir em {@link ImpostoPedidoInput.camposExtras}.
 */
export interface ImpostoPedidoInput {
  /** Tipo do imposto. */
  tipo?: TipoImpostoPedido;
  /** Codigo de Situacao Tributaria (CST). */
  cst?: string;
  /** Codigo de tributacao do municipio (IBS/CBS). */
  tributacaoMunicipio?: string;
  /** Codigo de classificacao tributaria (IBS/CBS). */
  classificacaoTributaria?: number;
  /** Aliquota do imposto. */
  aliquota?: number;
  /** Aliquota efetiva regular (CBS/IBS). */
  aliquotaEfetivaRegular?: number;
  /** Aliquota especifica por unidade de medida. */
  aliquotaUnidadeMedida?: number;
  /** Aliquota efetiva aplicada a base de calculo. */
  aliquotaEfetivaBaseCalculo?: number;
  /** Percentual de reducao de aliquota. */
  reducaoAliquota?: number;
  /** Percentual do Fundo de Combate a Pobreza (FCP). */
  percentualFCP?: number;
  /** Percentual de reducao de aliquota governamental. */
  percentualReducaoAliquotaGovernamental?: number;
  /** Percentual de diferimento. */
  percentualDiferimento?: number;
  /** Valor da base de calculo. */
  valorBase?: number;
  /** Valor da base de calculo reduzida. */
  valorBaseReduzida?: number;
  /** Valor do imposto calculado. */
  valorImposto?: number;
  /** Valor do FCP. */
  valorFCP?: number;
  /** Valor regular do IBS/municipio. */
  valorRegular?: number;
  /** Valor do diferimento. */
  valorDiferimento?: number;
  /** Valor do tributo devolvido. */
  valorTributoDevolvido?: number;
}

/** Dados de cheque usado como meio de pagamento (tipoPagamento Cheque). */
export interface ChequePedidoInput {
  codigoBarras?: string;
  banco?: string;
  agencia?: string;
  conta?: string;
  numero?: string;
  nome?: string;
  cnpjCpf?: string;
}

/** Dados de cartao usado como meio de pagamento. */
export interface CartaoPedidoInput {
  /** Bandeira (padrao NFe: 01 Visa, 02 Mastercard, 06 Elo, 99 Outros...). */
  bandeira?: string;
  /** Codigo de autorizacao da administradora. */
  autorizacao?: string;
}

/**
 * Dados de um item para inclusao em pedido.
 *
 * Mapeia a entidade `ItemNota`. `controle` e `codigoLocalEstoque` sao exigidos
 * pela API quando o produto tem controle/local de estoque; o SDK envia
 * `controle: ' '` (sem controle) quando omitido. `sequencia` e auto-preenchida
 * (1, 2, 3...) na ordem do array se nao informada.
 */
export interface ItemPedidoInput {
  /** Codigo do produto (CODPROD). */
  codigoProduto: number;
  /** Quantidade do item (QTDNEG). */
  quantidade: number;
  /** Valor unitario (VLRUNIT). */
  valorUnitario: number;
  /** Sequencia do item (1, 2, 3...). Auto-preenchida pelo SDK se omitida. */
  sequencia?: number;
  /** Unidade de medida (CODVOL). Opcional — usa a unidade do produto se omitida. */
  unidade?: string;
  /**
   * Controle de estoque (cor/tamanho/lote/voltagem...). Obrigatorio na API;
   * o SDK envia `' '` (sem controle) quando omitido. Use `metadata`/`Estoque`
   * para descobrir o controle correto de produtos controlados.
   */
  controle?: string;
  /** Codigo do local de estoque (CODLOCAL). Necessario quando ha controle por local. */
  codigoLocalEstoque?: number;
  /** Codigo CFOP. */
  cfop?: string;
  /** Sequencia do item de origem (ao faturar pedido lancado no Sankhya Om). */
  sequenciaItemOrigem?: number;
  /** Percentual de desconto. @deprecated A API documenta apenas `valorDesconto`. */
  percentualDesconto?: number;
  /** Valor de desconto absoluto. */
  valorDesconto?: number;
  /** Impostos do item (IBS/CBS/ICMS...). */
  impostos?: ImpostoPedidoInput[];
  /**
   * Campos extras (`AD_*` ou atributos da entidade `ItemNota`, como `QTDNEG`)
   * mesclados no item. Permite customizacao por empresa sem alterar o SDK.
   */
  camposExtras?: Record<string, unknown>;
}

/**
 * Dados do financeiro (parcela) para inclusao em pedido.
 *
 * Mapeia a entidade `Financeiro`. Os nomes canonicos sao `tipoPagamento`,
 * `valorParcela` e `sequencia` (alinhados a API REST oficial). Os nomes antigos
 * `codigoTipoPagamento`, `valor` e `numeroParcela` continuam aceitos como
 * aliases depreciados para retrocompatibilidade.
 */
export interface FinanceiroPedidoInput {
  /** Tipo de titulo (CODTIPTIT). */
  tipoPagamento?: number;
  /** Valor total da parcela. */
  valorParcela?: number;
  /** Data de vencimento (ISO `yyyy-MM-dd` ou `dd/MM/yyyy`). */
  dataVencimento: string;
  /** Sequencia da parcela (1, 2, 3...). Auto-preenchida pelo SDK se omitida. */
  sequencia?: number;
  /** Data da baixa (ISO ou `dd/MM/yyyy`). Omita para deixar em aberto. */
  dataBaixa?: string;
  /** ID da transacao quando houver (ex.: protocolo PIX). */
  idTransacao?: string;
  /** Dados do cheque (quando tipoPagamento for Cheque). */
  cheque?: ChequePedidoInput;
  /** Dados do cartao (quando tipoPagamento for Cartao). */
  cartao?: CartaoPedidoInput;
  /**
   * Campos extras (`AD_*` ou atributos da entidade `Financeiro`, como `DTVENC`)
   * mesclados na parcela.
   */
  camposExtras?: Record<string, unknown>;

  /** @deprecated Use `tipoPagamento`. */
  codigoTipoPagamento?: number;
  /** @deprecated Use `valorParcela`. */
  valor?: number;
  /** @deprecated Use `sequencia`. */
  numeroParcela?: number;
}

/** Dados para criacao de um pedido de venda via REST. */
export interface PedidoVendaInput {
  /** Modelo de nota (numero). */
  notaModelo: number;
  /** Data do pedido (ISO). */
  data: string;
  /** Hora do pedido (HH:mm). */
  hora: string;
  /** Codigo do vendedor. */
  codigoVendedor?: number;
  /** Codigo do cliente existente. */
  codigoCliente?: number;
  /** Dados de cliente para criacao inline. */
  cliente?: Partial<Cliente>;
  /** Observacao do pedido. */
  observacao?: string;
  /** Valor do frete. */
  valorFrete?: number;
  /** Valor do seguro. */
  valorSeguro?: number;
  /** Outros valores. */
  valorOutros?: number;
  /** Valor de ICMS. */
  valorIcms?: number;
  /** Valor de COFINS. */
  valorCofins?: number;
  /** Valor do FCP. */
  valorFcp?: number;
  /** Valor de juros. */
  valorJuro?: number;
  /** Valor total do pedido. */
  valorTotal: number;
  /** Itens do pedido. */
  itens: ItemPedidoInput[];
  /** Parcelas financeiras do pedido. */
  financeiros: FinanceiroPedidoInput[];
  /**
   * Campos extras mesclados no cabecalho do pedido. Aceita campos `AD_*` e
   * qualquer atributo do dicionario da entidade `CabecalhoNota` — inclusive
   * para sobrescrever valores herdados do modelo de nota (ex.: `CODTIPOPER`,
   * `CODEMP`, `CODNAT`). Permite customizacao por empresa sem alterar o SDK.
   *
   * Mesclado por ultimo: chaves aqui sobrescrevem as do payload normalizado
   * (incluindo `data`, `itens`, `financeiros`). Use apenas para campos do
   * dicionario, nao para os ja modelados acima.
   */
  camposExtras?: Record<string, unknown>;
}

/** Imposto de um item de pedido. */
export interface ImpostoPedido {
  /** Tipo do imposto. */
  tipo: string;
  /** Aliquota do imposto. */
  aliquota: number;
  /** Valor do imposto. */
  valor: number;
}

/** Item de um pedido de venda retornado pela API. */
export interface ItemPedido {
  /** Codigo do produto. */
  codigoProduto: number;
  /** Quantidade negociada. */
  quantidade: number;
  /** Valor unitario. */
  valorUnitario: number;
  /** Valor total do item. */
  valorTotal: number;
  /** Codigo CFOP. */
  cfop?: string;
  /** Codigo NCM. */
  ncm?: string;
  /** Impostos do item. */
  impostos?: ImpostoPedido[];
}

/** Parcela financeira de um pedido retornada pela API. */
export interface FinanceiroPedido {
  /** Sequencia da parcela. */
  sequencia: number;
  /** Tipo de pagamento. */
  tipoPagamento: string;
  /** Data de vencimento (ISO). */
  dataVencimento: string;
  /** Data da baixa (ISO), quando pago. */
  dataBaixa?: string;
  /** Valor da parcela. */
  valorParcela: number;
}

/** Pedido de venda retornado pela API. */
export interface PedidoVenda {
  /** Codigo da empresa. */
  codigoEmpresa: number;
  /** Codigo da nota (NUNOTA). */
  codigoNota: number;
  /** Numero da nota fiscal. */
  numeroNota?: number;
  /** Dados do cliente do pedido. */
  cliente: {
    /** Codigo do cliente. */
    codigo: number;
    /** Nome do cliente. */
    nome: string;
    /** CNPJ/CPF do cliente. */
    cnpjCpf: string;
  };
  /** Indica se o pedido esta confirmado. */
  confirmada: boolean;
  /** Indica se o pedido esta pendente. */
  pendente: boolean;
  /** Data da negociacao (ISO). */
  dataNegociacao: string;
  /** Codigo do vendedor. */
  codigoVendedor: number;
  /** Valor total da nota. */
  valorNota: number;
  /** Itens do pedido. */
  itens: ItemPedido[];
  /** Parcelas financeiras. */
  financeiros: FinanceiroPedido[];
}

/** Filtros para consulta de pedidos. */
export interface ConsultarPedidosParams extends PaginationParams, ModifiedSinceParams {
  /** Codigo da empresa (obrigatorio). */
  codigoEmpresa: number;
  /** Filtrar por codigo da nota. */
  codigoNota?: number;
  /** Filtrar por numero da nota fiscal. */
  numeroNota?: number;
  /** Filtrar por serie da nota. */
  serieNota?: string;
  /** Data de negociacao inicio (ISO). */
  dataNegociacaoInicio?: string;
  /** Data de negociacao fim (ISO). */
  dataNegociacaoFinal?: string;
  /** Filtrar por codigo do cliente. */
  codigoCliente?: number;
  /** Filtrar por status confirmada. */
  confirmada?: boolean;
  /** Filtrar por status pendente. */
  pendente?: boolean;
  /** Filtrar por codigo da natureza. */
  codigoNatureza?: number;
  /** Filtrar por centro de resultado. */
  codigoCentroResultado?: number;
  /** Filtrar por projeto. */
  codigoProjeto?: number;
  /** Filtrar por ordem de carga. */
  codigoOrdemCarga?: number;
}

/** Metadados de paginacao de pedidos. */
export interface PedidoMetadados {
  /** Pagina atual. */
  paginaAtual: number;
  /** Total de paginas. */
  totalPaginas: number;
  /** Total de registros. */
  totalRegistros: number;
}

/** Dados para confirmacao de um pedido via Gateway. */
export interface ConfirmarPedidoInput {
  /** Codigo do pedido (NUNOTA). */
  codigoPedido: number;
  /** Compensar financeiro automaticamente. */
  compensarAutomaticamente?: boolean;
}

/**
 * Uma solicitacao de liberacao aberta pelo `CACSP.confirmarNota` (ex.: evento
 * 8 "Atraso" de limite de credito). Campos conforme a resposta real do
 * Gateway — todos strings; o ERP pode anexar campos extras (`liberador`,
 * `hashLiberacao`, ...), preservados pela index signature.
 */
export interface ConfirmarPedidoLiberacao {
  /** Chave do registro travado (NUNOTA quando `tabela` = TGFCAB). */
  chave?: string;
  /** Codigo do evento de liberacao (8 = Atraso, 44/1000 = Analise de credito, ...). */
  evento?: string;
  /** Descricao humana do evento, vinda do ERP. */
  descricaoEvento?: string;
  /** Tabela travada (ex.: TGFCAB). */
  tabela?: string;
  sequencia?: string;
  seqCascata?: string;
  /** Data/hora da solicitacao — granularidade de MINUTO (a TSILIB guarda segundo). */
  dhSolicitacao?: string;
  solicitante?: string;
  valorAtual?: string;
  [key: string]: unknown;
}

/**
 * Corpo da resposta de `CACSP.confirmarNota` com `liberacoes` NORMALIZADO:
 * o bridge XML→JSON do Gateway entrega `liberacoes.liberacao` como OBJETO
 * (uma pendencia) ou ARRAY (varias) — aqui vira SEMPRE um array plano.
 * `avisos` e os demais campos (ex.: `pk`) sao preservados como vieram.
 */
export interface ConfirmarPedidoResponseBody {
  avisos?: unknown;
  liberacoes?: ConfirmarPedidoLiberacao[];
  [key: string]: unknown;
}

/**
 * Retorno de `pedidos.confirmar()` (v1.4.0). `responseBody` fica `undefined`
 * quando o Gateway responde corpo vazio/ausente — consumidor antigo que
 * ignora o retorno continua funcionando (antes o metodo devolvia `void`).
 */
export interface ConfirmarPedidoResult {
  responseBody?: ConfirmarPedidoResponseBody;
}

/** Tipo de faturamento no Sankhya ERP. */
export enum TipoFaturamento {
  /** Faturamento normal. */
  Normal = 'FaturamentoNormal',
  /** Faturamento por estoque. */
  Estoque = 'FaturamentoEstoque',
  /** Faturamento por estoque deixando pendente. */
  EstoqueDeixandoPendente = 'FaturamentoEstoqueDeixandoPendente',
  /** Faturamento direto. */
  Direto = 'FaturamentoDireto',
}

/** Dados para faturamento de um pedido via Gateway. */
export interface FaturarPedidoInput {
  /** Codigo do pedido (NUNOTA). */
  codigoPedido: number;
  /** Codigo do tipo de operacao (TOP). */
  codigoTipoOperacao: number;
  /**
   * Data de faturamento (`dd/MM/yyyy`). Omitida ou vazia, o wizard usa a data
   * corrente do ERP — e o `dtFaturamento: ''` medido (M51).
   */
  dataFaturamento?: string;
  /** Tipo de faturamento (default: Normal). */
  tipoFaturamento?: TipoFaturamento;
  /**
   * Faturar todos os itens (default: `true`). `false` **lanca**: o wizard nao
   * tem faturamento parcial (M82).
   */
  faturarTodosItens?: boolean;
  /** Serie da nota gerada (default: `'1'`, medida em M49). */
  serie?: string;
  /** Local de destino (CODLOCALDEST); default `''` = o do cadastro. */
  codigoLocalDestino?: string;
  /** Uma nota para cada pedido selecionado (default: `false`). */
  umaNotaParaCada?: boolean;
}

/** Dados para cancelamento de um pedido. */
export interface CancelarPedidoInput {
  /** Codigo do pedido (NUNOTA). */
  codigoPedido: number;
  /** Motivo do cancelamento. */
  motivo?: string;
}

/** Dados de um item para inclusao via Gateway (CACSP). */
export interface ItemNotaGatewayInput {
  /** Codigo do produto (CODPROD). */
  codigoProduto: number;
  /** Quantidade negociada (QTDNEG). */
  quantidade: number;
  /** Valor unitario (VLRUNIT). */
  valorUnitario: number;
  /** Unidade de medida (CODVOL). */
  unidade: string;
  /** Codigo do local de origem (CODLOCALORIG). */
  codigoLocalOrigem?: number;
}

/** Dados para inclusao de nota via Gateway (CACSP.incluirNota). */
export interface IncluirNotaGatewayInput {
  /** Codigo do cliente (CODPARC). */
  codigoCliente: number;
  /** Data da negociacao (DTNEG, ISO). */
  dataNegociacao: string;
  /** Codigo do tipo de operacao (CODTIPOPER). */
  codigoTipoOperacao: number;
  /** Codigo do tipo de negociacao (CODTIPVENDA). */
  codigoTipoNegociacao: number;
  /** Codigo do vendedor (CODVEND). */
  codigoVendedor: number;
  /** Codigo da empresa (CODEMP). */
  codigoEmpresa: number;
  /** Tipo de movimento (TIPMOV). */
  tipoMovimento: string;
  /** Observacao da nota. */
  observacao?: string;
  /**
   * Status da nota (STATUSNOTA): `'A'` aberta, `'L'` liberada.
   * Omitido, o campo nao vai no cabecalho e o ERP aplica o default do TOP.
   */
  statusNota?: 'A' | 'L';
  /**
   * Numero do pedido no sistema de origem (AD_NUMPEDIDO) — campo customizado
   * usado pelo 4midware para rastrear o pedido do marketplace/e-commerce.
   */
  numeroPedidoExterno?: string;
  /**
   * Se o preco unitario enviado deve ser respeitado (`itens.INFORMARPRECO`).
   * Default `true`. Serializado como a STRING `'True'`/`'False'` — medido (M46).
   */
  informarPreco?: boolean;
  /**
   * Campos adicionais do cabecalho, crus, em nome de campo Sankhya
   * (`AD_MARKET_PLACE`, `CIF_FOB`, `CODCENCUS`, ...). Entram por ultimo e sao
   * serializados como qualquer outro campo (`{ $: valor }`).
   *
   * Citar qualquer uma das **11 chaves tipadas** do cabecalho (`NUNOTA`,
   * `CODPARC`, `DTNEG`, `CODTIPOPER`, `CODTIPVENDA`, `CODVEND`, `CODEMP`,
   * `TIPMOV`, `OBSERVACAO`, `STATUSNOTA`, `AD_NUMPEDIDO`) **lanca** — tambem
   * quando o campo tipado correspondente foi omitido nesta chamada. Nada e
   * sobrescrito nem contrabandeado em silencio.
   *
   * Existe porque o cabecalho medido no sandbox tem 29 campos e o SDK tipa 11:
   * quem precisa do payload completo nao espera tipagem nova.
   */
  camposExtras?: Record<string, string | number>;
  /** Itens da nota. */
  itens: ItemNotaGatewayInput[];
}
