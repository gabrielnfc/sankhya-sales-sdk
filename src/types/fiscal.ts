/**
 * Tipo de imposto calculavel pelo Sankhya.
 *
 * Valores possiveis: `'icms'`, `'st'`, `'ipi'`, `'pis'`, `'cofins'`,
 * `'irf'`, `'cssl'`, `'ibsuf'`, `'ibsmun'`, `'cbs'`.
 */
export type TipoImposto =
  | 'icms'
  | 'st'
  | 'ipi'
  | 'pis'
  | 'cofins'
  | 'irf'
  | 'cssl'
  | 'ibsuf'
  | 'ibsmun'
  | 'cbs';

/** Despesas acessorias de uma nota fiscal. */
export interface DespesasAcessorias {
  /** Valor do frete. */
  frete?: number;
  /** Valor do seguro. */
  seguro?: number;
  /** Outras despesas. */
  outras?: number;
}

/** Produto para calculo de impostos. */
export interface ProdutoCalculoImposto {
  /** Codigo do produto. */
  codigoProduto: number;
  /** Quantidade. */
  quantidade: number;
  /** Valor unitario. */
  valorUnitario: number;
  /** Unidade de medida. */
  unidade?: string;
  /** Valor de desconto. */
  valorDesconto?: number;
}

/** Dados de entrada para calculo de impostos. */
export interface CalculoImpostoInput {
  /** Modelo de nota. */
  notaModelo: number;
  /** Codigo do cliente. */
  codigoCliente: number;
  /** Codigo da empresa. */
  codigoEmpresa?: number;
  /** Codigo do tipo de operacao (TOP). */
  codigoTipoOperacao?: number;
  /** Finalidade da operacao. */
  finalidadeOperacao?: number;
  /** Despesas acessorias. */
  despesasAcessorias?: DespesasAcessorias;
  /** Produtos para calculo. */
  produtos: ProdutoCalculoImposto[];
}

/** Imposto calculado para um produto. */
export interface ImpostoCalculado {
  /** Tipo do imposto. */
  tipo: TipoImposto;
  /** Codigo CST. */
  cst?: string;
  /** Aliquota do imposto. */
  aliquota: number;
  /** Base de calculo. */
  valorBase: number;
  /** Valor do imposto. */
  valorImposto: number;
  /** Percentual do FCP. */
  percentualFCP?: number;
  /** Valor do FCP. */
  valorFCP?: number;
}

/** Resultado do calculo de impostos por produto. */
export interface ResultadoCalculoImposto {
  /** Codigo do produto. */
  codigoProduto: number;
  /** Lista de impostos calculados. */
  impostos: ImpostoCalculado[];
}

/** Resultado da importacao de NFS-e. */
export interface ImportNfseResult {
  /** Numero da nota de servico importada. */
  numeroNota?: number;
}
