import type { Cliente } from './clientes.js';
import type { ModifiedSinceParams, PaginationParams } from './common.js';

/** Dados de um item para inclusao em pedido. */
export interface ItemPedidoInput {
  /** Codigo do produto. */
  codigoProduto: number;
  /** Quantidade do item. */
  quantidade: number;
  /** Valor unitario. */
  valorUnitario: number;
  /** Unidade de medida. */
  unidade: string;
  /** Percentual de desconto. */
  percentualDesconto?: number;
  /** Valor de desconto absoluto. */
  valorDesconto?: number;
}

/** Dados do financeiro (parcela) para inclusao em pedido. */
export interface FinanceiroPedidoInput {
  /** Codigo do tipo de pagamento. */
  codigoTipoPagamento: number;
  /** Valor da parcela. */
  valor: number;
  /** Data de vencimento (ISO). */
  dataVencimento: string;
  /** Numero da parcela. */
  numeroParcela: number;
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
  /** Data de faturamento (ISO). */
  dataFaturamento: string;
  /** Tipo de faturamento (default: Normal). */
  tipoFaturamento?: TipoFaturamento;
  /** Faturar todos os itens (default: true). */
  faturarTodosItens?: boolean;
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
  /** Itens da nota. */
  itens: ItemNotaGatewayInput[];
}
