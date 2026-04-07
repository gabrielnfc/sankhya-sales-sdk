import type { PaginationParams } from './common.js';

/** Subtipo de pagamento no Sankhya ERP. */
export enum SubTipoPagamento {
  /** Pagamento a vista. */
  AVista = 1,
  /** Pagamento a prazo. */
  APrazo = 2,
  /** Pagamento parcelado. */
  Parcelada = 3,
  /** Cheque pre-datado. */
  ChequePredatado = 4,
  /** Crediario. */
  Crediario = 5,
  /** Financeira. */
  Financeira = 6,
  /** Cartao de credito. */
  CartaoCredito = 7,
  /** Cartao de debito. */
  CartaoDebito = 8,
  /** Voucher. */
  Voucher = 9,
  /** PIX. */
  PIX = 10,
  /** PIX POS. */
  PIXPOS = 11,
}

/** Status do titulo financeiro. */
export enum StatusFinanceiro {
  /** Titulo em aberto. */
  Aberto = 1,
  /** Titulo baixado (pago). */
  Baixado = 2,
  /** Todos os status. */
  Todos = 3,
}

/** Tipo do titulo financeiro. */
export enum TipoFinanceiro {
  /** Titulo real. */
  Real = 1,
  /** Titulo provisao. */
  Provisao = 2,
  /** Todos os tipos. */
  Todos = 3,
}

/** Representa um titulo financeiro (receita ou despesa) no Sankhya ERP. */
export interface Receita {
  /** Codigo do titulo financeiro. */
  codigoFinanceiro: number;
  /** Codigo da empresa. */
  codigoEmpresa: number;
  /** Codigo do tipo de operacao (TOP). */
  codigoTipoOperacao: number;
  /** Codigo da natureza. */
  codigoNatureza: number;
  /** Codigo do centro de resultado. */
  codigoCentroResultado: number;
  /** Codigo do parceiro. */
  codigoParceiro: number;
  /** Codigo do banco. */
  codigoBanco: number;
  /** Codigo da conta bancaria. */
  codigoContaBancaria: number;
  /** Codigo do tipo de pagamento. */
  codigoTipoPagamento: number;
  /** Numero da nota fiscal. */
  numeroNota: number;
  /** Data da negociacao (ISO). */
  dataNegociacao: string;
  /** Data de vencimento (ISO). */
  dataVencimento: string;
  /** Numero da parcela. */
  numeroParcela: number;
  /** Valor da parcela. */
  valorParcela: number;
}

/** Tipo de pagamento no Sankhya ERP. */
export interface TipoPagamento {
  /** Codigo do tipo de pagamento. */
  codigoTipoPagamento: number;
  /** Nome do tipo de pagamento. */
  nome: string;
  /** Indica se esta ativo. */
  ativo: boolean;
  /** Subtipo de pagamento. */
  subTipoPagamento: SubTipoPagamento;
}

/** Moeda no Sankhya ERP. */
export interface Moeda {
  /** Codigo da moeda. */
  codigoMoeda: number;
  /** Nome da moeda. */
  nome: string;
}

/** Conta bancaria no Sankhya ERP. */
export interface ContaBancaria {
  /** Codigo da conta bancaria. */
  codigoContaBancaria: number;
  /** Nome da conta bancaria. */
  nome: string;
}

/** Filtros para listagem de receitas. */
export interface ReceitasFiltro extends PaginationParams {
  /** Filtrar por empresa. */
  codigoEmpresa?: number;
  /** Filtrar por parceiro. */
  codigoParceiro?: number;
  /** Filtrar por status financeiro. */
  statusFinanceiro?: StatusFinanceiro;
  /** Filtrar por tipo financeiro. */
  tipoFinanceiro?: TipoFinanceiro;
  /** Data de negociacao inicio (ISO). */
  dataNegociacaoInicio?: string;
  /** Data de negociacao fim (ISO). */
  dataNegociacaoFinal?: string;
}

/** Dados para registro de uma nova receita. */
export interface RegistrarReceitaInput {
  /** Codigo da empresa. */
  codigoEmpresa: number;
  /** Codigo do tipo de operacao. */
  codigoTipoOperacao: number;
  /** Codigo da natureza. */
  codigoNatureza: number;
  /** Codigo do parceiro. */
  codigoParceiro: number;
  /** Codigo do tipo de pagamento. */
  codigoTipoPagamento: number;
  /** Data da negociacao (ISO). */
  dataNegociacao: string;
  /** Data de vencimento (ISO). */
  dataVencimento: string;
  /** Numero da parcela. */
  numeroParcela?: number;
  /** Valor da parcela. */
  valorParcela: number;
  /** Codigo do centro de resultado. */
  codigoCentroResultado?: number;
  /** Codigo da conta bancaria. */
  codigoContaBancaria?: number;
  /** Observacao. */
  observacao?: string;
}

/** Dados para atualizacao parcial de uma receita. */
export interface AtualizarReceitaInput {
  /** Codigo do tipo de operacao. */
  codigoTipoOperacao?: number;
  /** Codigo da natureza. */
  codigoNatureza?: number;
  /** Codigo do parceiro. */
  codigoParceiro?: number;
  /** Codigo do tipo de pagamento. */
  codigoTipoPagamento?: number;
  /** Data da negociacao (ISO). */
  dataNegociacao?: string;
  /** Data de vencimento (ISO). */
  dataVencimento?: string;
  /** Valor da parcela. */
  valorParcela?: number;
  /** Codigo do centro de resultado. */
  codigoCentroResultado?: number;
  /** Codigo da conta bancaria. */
  codigoContaBancaria?: number;
  /** Observacao. */
  observacao?: string;
}

/** Dados para baixa (pagamento) de uma receita. */
export interface BaixarReceitaInput {
  /** Codigo do titulo financeiro. */
  codigoFinanceiro: number;
  /** Data da baixa (ISO). */
  dataBaixa: string;
  /** Valor da baixa. */
  valorBaixa: number;
  /** Codigo da conta bancaria para baixa. */
  codigoContaBancaria?: number;
  /** Historico da baixa. */
  historico?: string;
}

/** Dados para registro de uma nova despesa. */
export interface RegistrarDespesaInput {
  /** Codigo da empresa. */
  codigoEmpresa: number;
  /** Codigo do tipo de operacao. */
  codigoTipoOperacao: number;
  /** Codigo da natureza. */
  codigoNatureza: number;
  /** Codigo do parceiro. */
  codigoParceiro: number;
  /** Codigo do tipo de pagamento. */
  codigoTipoPagamento: number;
  /** Data da negociacao (ISO). */
  dataNegociacao: string;
  /** Data de vencimento (ISO). */
  dataVencimento: string;
  /** Numero da parcela. */
  numeroParcela?: number;
  /** Valor da parcela. */
  valorParcela: number;
  /** Codigo do centro de resultado. */
  codigoCentroResultado?: number;
  /** Codigo da conta bancaria. */
  codigoContaBancaria?: number;
  /** Observacao. */
  observacao?: string;
}

/** Dados para atualizacao parcial de uma despesa. */
export interface AtualizarDespesaInput {
  /** Codigo do tipo de operacao. */
  codigoTipoOperacao?: number;
  /** Codigo da natureza. */
  codigoNatureza?: number;
  /** Codigo do parceiro. */
  codigoParceiro?: number;
  /** Codigo do tipo de pagamento. */
  codigoTipoPagamento?: number;
  /** Data da negociacao (ISO). */
  dataNegociacao?: string;
  /** Data de vencimento (ISO). */
  dataVencimento?: string;
  /** Valor da parcela. */
  valorParcela?: number;
  /** Codigo do centro de resultado. */
  codigoCentroResultado?: number;
  /** Codigo da conta bancaria. */
  codigoContaBancaria?: number;
  /** Observacao. */
  observacao?: string;
}

/** Dados para baixa (pagamento) de uma despesa. */
export interface BaixarDespesaInput {
  /** Codigo do titulo financeiro. */
  codigoFinanceiro: number;
  /** Data da baixa (ISO). */
  dataBaixa: string;
  /** Valor da baixa. */
  valorBaixa: number;
  /** Codigo da conta bancaria para baixa. */
  codigoContaBancaria?: number;
  /** Historico da baixa. */
  historico?: string;
}

/** Resposta de registro/atualizacao de titulo financeiro. */
export interface RegistrarFinanceiroResponse {
  /** Codigo do titulo financeiro. */
  codigoFinanceiro: number;
}
