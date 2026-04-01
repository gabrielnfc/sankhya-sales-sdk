export interface Preco {
  codigoProduto: number;
  codigoLocalEstoque?: number;
  controle?: string;
  unidade: string;
  codigoTabela: number;
  valor: number;
}

export interface PrecoContextualizadoInput {
  codigoEmpresa: number;
  codigoCliente: number;
  codigoVendedor: number;
  codigoTipoOperacao: number;
  codigoTipoNegociacao: number;
  dataNegociacao?: string;
  simularInclusao?: boolean;
  produtos: PrecoContextualizadoProduto[];
}

export interface PrecoContextualizadoProduto {
  codigoProduto: number;
  quantidade?: number;
  unidade?: string;
}

export interface PrecosPorTabelaParams {
  codigoTabela: number;
  pagina?: number;
}

export interface PrecosPorProdutoETabelaParams {
  codigoProduto: number;
  codigoTabela: number;
  pagina?: number;
}
