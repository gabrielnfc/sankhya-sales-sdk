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

/** Dados de cheque como meio de pagamento de um financeiro. */
export interface ChequeFinanceiroInput {
  codigoBarras?: string;
  numeroCheque?: string;
  banco?: string;
  agencia?: string;
  conta?: string;
  nome?: string;
  cnpjCpf?: string;
  valorCheque?: number;
  /** Data do cheque. Enviada sem conversao — use o formato exigido pelo servidor. */
  dataCheque?: string;
}

/** Dados de cartao como meio de pagamento de um financeiro. */
export interface CartaoFinanceiroInput {
  bandeira?: string;
  autorizacao?: string;
  NSU?: string;
  rede?: string;
  parcela?: number;
  dataHoraTransacao?: string;
  valorTaxa?: number;
}

/** Dados de boleto como meio de pagamento de um financeiro. */
export interface BoletoFinanceiroInput {
  codigoBarras?: string;
  nossoNumero?: string;
  linhaDigitavel?: string;
  numeroRemessa?: string;
  /** Data/hora do pagamento do boleto. */
  dataPagamento?: string;
}

/** Item de rateio de um financeiro (natureza/centro/projeto + percentual). */
export interface RateioFinanceiroInput {
  codigoNatureza: number;
  codigoCentroResultado: number;
  /** Percentual do rateio. */
  percentual: number;
  codigoProjeto?: number;
  codigoParceiro?: number;
  codigoContaContabil?: number;
}

/**
 * Campos opcionais comuns ao registro de receita e despesa, alinhados ao
 * contrato oficial `financeiroModelo`.
 */
interface RegistrarFinanceiroExtras {
  /** Codigo do banco (TGFFIN.CODBCO). */
  codigoBanco?: number;
  /** Codigo da conta bancaria (TGFFIN.CODCTABCOINT). */
  codigoContaBancaria?: number;
  /** Codigo do centro de resultado (TGFFIN.CODCENCUS). */
  codigoCentroResultado?: number;
  /** Codigo do projeto (TGFFIN.CODPROJ). */
  codigoProjeto?: number;
  /** Codigo da moeda (TGFFIN.CODMOEDA). */
  codigoMoeda?: number;
  /** Numero da nota (obrigatorio no contrato oficial). */
  numeroNota?: number;
  /** Maior numero de parcela da nota. */
  maiorNumeroParcela?: number;
  /** Dados do cheque (quando tipoPagamento for Cheque). */
  cheque?: ChequeFinanceiroInput;
  /** Dados do cartao (quando tipoPagamento for Cartao). */
  cartao?: CartaoFinanceiroInput;
  /** Dados do boleto (quando tipoPagamento for a prazo/boleto). */
  boleto?: BoletoFinanceiroInput;
  /** Rateios do financeiro (quando rateado). */
  rateios?: RateioFinanceiroInput[];
  /** Observacao. */
  observacao?: string;
  /**
   * Campos extras (`AD_*` ou atributos do dicionario da entidade `Financeiro`,
   * como `DTVENC`) mesclados no payload. Permite customizacao por empresa.
   * Mesclados por ultimo e enviados verbatim — sem normalizacao de data.
   */
  camposExtras?: Record<string, unknown>;
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

/**
 * Dados para registro de uma nova receita (titulo a receber).
 *
 * Datas aceitas em ISO (`yyyy-MM-dd`) e convertidas internamente para
 * `dd/MM/yyyy` (formato exigido pelo servidor). Campos opcionais do contrato
 * oficial (banco, conta, centro, projeto, moeda, numeroNota, cheque/cartao/
 * boleto/rateios) vem de {@link RegistrarFinanceiroExtras}.
 */
export interface RegistrarReceitaInput extends RegistrarFinanceiroExtras {
  /** Codigo da empresa. */
  codigoEmpresa: number;
  /** Codigo do tipo de operacao (TIPMOV='I'). */
  codigoTipoOperacao: number;
  /** Codigo da natureza (analitica). */
  codigoNatureza: number;
  /** Codigo do parceiro. */
  codigoParceiro: number;
  /** Codigo do tipo de pagamento (tipo de titulo). */
  codigoTipoPagamento: number;
  /** Data da negociacao (ISO ou dd/MM/yyyy). */
  dataNegociacao: string;
  /** Data de vencimento (ISO ou dd/MM/yyyy). */
  dataVencimento: string;
  /** Numero da parcela. */
  numeroParcela?: number;
  /** Valor da parcela. */
  valorParcela: number;
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
  /** Campos extras (`AD_*` ou atributos do dicionario) mesclados no payload. */
  camposExtras?: Record<string, unknown>;
}

/**
 * Dados para baixa (liquidacao) de uma receita.
 *
 * `codigoFinanceiro` vai no path (`/financeiros/receitas/{id}/baixa`).
 * `dataBaixa` e obrigatoria e aceita ISO (`yyyy-MM-dd`) ou `dd/MM/yyyy` —
 * convertida internamente para `dd/MM/yyyy` (formato exigido pelo servidor).
 */
export interface BaixarReceitaInput {
  /** Codigo do titulo financeiro (NUFIN). */
  codigoFinanceiro: number;
  /** Data da baixa (ISO ou dd/MM/yyyy). */
  dataBaixa: string;
  /** Valor efetivo da baixa. */
  valorBaixa?: number;
  /** Conta bancaria da baixa (obrigatoria quando ha mais de uma conta valida). */
  codigoContaBancaria?: number;
  /** Codigo do tipo de operacao para a baixa. */
  codigoTipoOperacao?: number;
  /** Valor de juros. */
  valorJuro?: number;
  /** Valor de multa. */
  valorMulta?: number;
  /** Valor de desconto. */
  valorDesconto?: number;
  /** Observacoes da baixa. */
  observacao?: string;
}

/**
 * Dados para registro de uma nova despesa (titulo a pagar).
 *
 * Mesmas regras de {@link RegistrarReceitaInput} (datas ISO -> dd/MM/yyyy,
 * campos opcionais do contrato oficial via {@link RegistrarFinanceiroExtras}).
 */
export interface RegistrarDespesaInput extends RegistrarFinanceiroExtras {
  /** Codigo da empresa. */
  codigoEmpresa: number;
  /** Codigo do tipo de operacao (TIPMOV='I'). */
  codigoTipoOperacao: number;
  /** Codigo da natureza (analitica). */
  codigoNatureza: number;
  /** Codigo do parceiro. */
  codigoParceiro: number;
  /** Codigo do tipo de pagamento (tipo de titulo). */
  codigoTipoPagamento: number;
  /** Data da negociacao (ISO ou dd/MM/yyyy). */
  dataNegociacao: string;
  /** Data de vencimento (ISO ou dd/MM/yyyy). */
  dataVencimento: string;
  /** Numero da parcela. */
  numeroParcela?: number;
  /** Valor da parcela. */
  valorParcela: number;
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
  /** Campos extras (`AD_*` ou atributos do dicionario) mesclados no payload. */
  camposExtras?: Record<string, unknown>;
}

/**
 * Dados para baixa (liquidacao) de uma despesa.
 *
 * `codigoFinanceiro` vai no path (`/financeiros/despesas/{id}/baixa`).
 * `dataBaixa` e obrigatoria; ISO e convertida para `dd/MM/yyyy`.
 */
export interface BaixarDespesaInput {
  /** Codigo do titulo financeiro (NUFIN). */
  codigoFinanceiro: number;
  /** Data da baixa (ISO ou dd/MM/yyyy). */
  dataBaixa: string;
  /** Valor efetivo da baixa. */
  valorBaixa?: number;
  /** Conta bancaria da baixa (obrigatoria quando ha mais de uma conta valida). */
  codigoContaBancaria?: number;
  /** Codigo do tipo de operacao para a baixa. */
  codigoTipoOperacao?: number;
  /** Valor de juros. */
  valorJuro?: number;
  /** Valor de multa. */
  valorMulta?: number;
  /** Valor de desconto. */
  valorDesconto?: number;
  /** Observacoes da baixa. */
  observacao?: string;
}

/** Resposta de registro/atualizacao de titulo financeiro. */
export interface RegistrarFinanceiroResponse {
  /** Codigo do titulo financeiro. */
  codigoFinanceiro: number;
}

/** Resultado de uma operacao de baixa (liquidacao) de titulo financeiro. */
export interface BaixaResult {
  /** Codigo do titulo financeiro baixado (NUFIN). */
  codigoFinanceiro: number;
}

/** Representa um titulo financeiro a pagar (despesa). Mesma estrutura de Receita. */
export type Despesa = Receita;
