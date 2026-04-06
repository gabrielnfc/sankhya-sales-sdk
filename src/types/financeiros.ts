import type { PaginationParams } from './common.js';

export enum SubTipoPagamento {
  AVista = 1,
  APrazo = 2,
  Parcelada = 3,
  ChequePredatado = 4,
  Crediario = 5,
  Financeira = 6,
  CartaoCredito = 7,
  CartaoDebito = 8,
  Voucher = 9,
  PIX = 10,
  PIXPOS = 11,
}

export enum StatusFinanceiro {
  Aberto = 1,
  Baixado = 2,
  Todos = 3,
}

export enum TipoFinanceiro {
  Real = 1,
  Provisao = 2,
  Todos = 3,
}

export interface Receita {
  codigoFinanceiro: number;
  codigoEmpresa: number;
  codigoTipoOperacao: number;
  codigoNatureza: number;
  codigoCentroResultado: number;
  codigoParceiro: number;
  codigoBanco: number;
  codigoContaBancaria: number;
  codigoTipoPagamento: number;
  numeroNota: number;
  dataNegociacao: string;
  dataVencimento: string;
  numeroParcela: number;
  valorParcela: number;
}

export interface TipoPagamento {
  codigoTipoPagamento: number;
  nome: string;
  ativo: boolean;
  subTipoPagamento: SubTipoPagamento;
}

export interface Moeda {
  codigoMoeda: number;
  nome: string;
}

export interface ContaBancaria {
  codigoContaBancaria: number;
  nome: string;
}

export interface ReceitasFiltro extends PaginationParams {
  codigoEmpresa?: number;
  codigoParceiro?: number;
  statusFinanceiro?: StatusFinanceiro;
  tipoFinanceiro?: TipoFinanceiro;
  dataNegociacaoInicio?: string;
  dataNegociacaoFinal?: string;
}

export interface RegistrarReceitaInput {
  codigoEmpresa: number;
  codigoTipoOperacao: number;
  codigoNatureza: number;
  codigoParceiro: number;
  codigoTipoPagamento: number;
  dataNegociacao: string;
  dataVencimento: string;
  numeroParcela?: number;
  valorParcela: number;
  codigoCentroResultado?: number;
  codigoContaBancaria?: number;
  observacao?: string;
}

export interface AtualizarReceitaInput {
  codigoTipoOperacao?: number;
  codigoNatureza?: number;
  codigoParceiro?: number;
  codigoTipoPagamento?: number;
  dataNegociacao?: string;
  dataVencimento?: string;
  valorParcela?: number;
  codigoCentroResultado?: number;
  codigoContaBancaria?: number;
  observacao?: string;
}

export interface BaixarReceitaInput {
  codigoFinanceiro: number;
  dataBaixa: string;
  valorBaixa: number;
  codigoContaBancaria?: number;
  historico?: string;
}

export interface RegistrarDespesaInput {
  codigoEmpresa: number;
  codigoTipoOperacao: number;
  codigoNatureza: number;
  codigoParceiro: number;
  codigoTipoPagamento: number;
  dataNegociacao: string;
  dataVencimento: string;
  numeroParcela?: number;
  valorParcela: number;
  codigoCentroResultado?: number;
  codigoContaBancaria?: number;
  observacao?: string;
}

export interface AtualizarDespesaInput {
  codigoTipoOperacao?: number;
  codigoNatureza?: number;
  codigoParceiro?: number;
  codigoTipoPagamento?: number;
  dataNegociacao?: string;
  dataVencimento?: string;
  valorParcela?: number;
  codigoCentroResultado?: number;
  codigoContaBancaria?: number;
  observacao?: string;
}

export interface BaixarDespesaInput {
  codigoFinanceiro: number;
  dataBaixa: string;
  valorBaixa: number;
  codigoContaBancaria?: number;
  historico?: string;
}

export interface RegistrarFinanceiroResponse {
  codigoFinanceiro: number;
}
