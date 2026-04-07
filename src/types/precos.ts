/** Representa um preco de produto em uma tabela de preco. */
export interface Preco {
  /** Codigo do produto. */
  codigoProduto: number;
  /** Codigo do local de estoque. */
  codigoLocalEstoque?: number;
  /** Controle de estoque (serie, lote, etc.). */
  controle?: string;
  /** Unidade de medida. */
  unidade: string;
  /** Codigo da tabela de preco. */
  codigoTabela: number;
  /** Valor do preco. */
  valor: number;
}

/** Dados para calculo de preco contextualizado. */
export interface PrecoContextualizadoInput {
  /** Codigo da empresa. */
  codigoEmpresa: number;
  /** Codigo do cliente. */
  codigoCliente: number;
  /** Codigo do vendedor. */
  codigoVendedor: number;
  /** Codigo do tipo de operacao (TOP). */
  codigoTipoOperacao: number;
  /** Codigo do tipo de negociacao. */
  codigoTipoNegociacao: number;
  /** Data da negociacao (ISO). */
  dataNegociacao?: string;
  /** Simular inclusao de nota. */
  simularInclusao?: boolean;
  /** Produtos para calculo de preco. */
  produtos: PrecoContextualizadoProduto[];
}

/** Produto para calculo de preco contextualizado. */
export interface PrecoContextualizadoProduto {
  /** Codigo do produto. */
  codigoProduto: number;
  /** Quantidade desejada. */
  quantidade?: number;
  /** Unidade de medida. */
  unidade?: string;
}

/** Filtros para precos por tabela. */
export interface PrecosPorTabelaParams {
  /** Codigo da tabela de preco. */
  codigoTabela: number;
  /** Numero da pagina (default: 1). */
  pagina?: number;
}

/** Filtros para precos por produto e tabela. */
export interface PrecosPorProdutoETabelaParams {
  /** Codigo do produto. */
  codigoProduto: number;
  /** Codigo da tabela de preco. */
  codigoTabela: number;
  /** Numero da pagina (default: 1). */
  pagina?: number;
}
