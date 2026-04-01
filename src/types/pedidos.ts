import type { Cliente } from './clientes.js';
import type { ModifiedSinceParams, PaginationParams } from './common.js';

export interface ItemPedidoInput {
  codigoProduto: number;
  quantidade: number;
  valorUnitario: number;
  unidade: string;
  percentualDesconto?: number;
  valorDesconto?: number;
}

export interface FinanceiroPedidoInput {
  codigoTipoPagamento: number;
  valor: number;
  dataVencimento: string;
  numeroParcela: number;
}

export interface PedidoVendaInput {
  notaModelo: number;
  data: string;
  hora: string;
  codigoVendedor?: number;
  codigoCliente?: number;
  cliente?: Partial<Cliente>;
  observacao?: string;
  valorFrete?: number;
  valorSeguro?: number;
  valorOutros?: number;
  valorIcms?: number;
  valorCofins?: number;
  valorFcp?: number;
  valorJuro?: number;
  valorTotal: number;
  itens: ItemPedidoInput[];
  financeiros: FinanceiroPedidoInput[];
}

export interface ImpostoPedido {
  tipo: string;
  aliquota: number;
  valor: number;
}

export interface ItemPedido {
  codigoProduto: number;
  quantidade: number;
  valorUnitario: number;
  valorTotal: number;
  cfop?: string;
  ncm?: string;
  impostos?: ImpostoPedido[];
}

export interface FinanceiroPedido {
  sequencia: number;
  tipoPagamento: string;
  dataVencimento: string;
  dataBaixa?: string;
  valorParcela: number;
}

export interface PedidoVenda {
  codigoEmpresa: number;
  codigoNota: number;
  numeroNota?: number;
  cliente: {
    codigo: number;
    nome: string;
    cnpjCpf: string;
  };
  confirmada: boolean;
  pendente: boolean;
  dataNegociacao: string;
  codigoVendedor: number;
  valorNota: number;
  itens: ItemPedido[];
  financeiros: FinanceiroPedido[];
}

export interface ConsultarPedidosParams extends PaginationParams, ModifiedSinceParams {
  codigoEmpresa: number;
  codigoNota?: number;
  numeroNota?: number;
  serieNota?: string;
  dataNegociacaoInicio?: string;
  dataNegociacaoFinal?: string;
  codigoCliente?: number;
  confirmada?: boolean;
  pendente?: boolean;
  codigoNatureza?: number;
  codigoCentroResultado?: number;
  codigoProjeto?: number;
  codigoOrdemCarga?: number;
}

export interface PedidoMetadados {
  paginaAtual: number;
  totalPaginas: number;
  totalRegistros: number;
}

export interface ConfirmarPedidoInput {
  codigoPedido: number;
  compensarAutomaticamente?: boolean;
}

export enum TipoFaturamento {
  Normal = 'FaturamentoNormal',
  Estoque = 'FaturamentoEstoque',
  EstoqueDeixandoPendente = 'FaturamentoEstoqueDeixandoPendente',
  Direto = 'FaturamentoDireto',
}

export interface FaturarPedidoInput {
  codigoPedido: number;
  codigoTipoOperacao: number;
  dataFaturamento: string;
  tipoFaturamento?: TipoFaturamento;
  faturarTodosItens?: boolean;
}

export interface CancelarPedidoInput {
  codigoPedido: number;
  motivo?: string;
}

export interface ItemNotaGatewayInput {
  codigoProduto: number;
  quantidade: number;
  valorUnitario: number;
  unidade: string;
  codigoLocalOrigem?: number;
}

export interface IncluirNotaGatewayInput {
  codigoCliente: number;
  dataNegociacao: string;
  codigoTipoOperacao: number;
  codigoTipoNegociacao: number;
  codigoVendedor: number;
  codigoEmpresa: number;
  tipoMovimento: string;
  observacao?: string;
  itens: ItemNotaGatewayInput[];
}
