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

export interface DespesasAcessorias {
  frete?: number;
  seguro?: number;
  outras?: number;
}

export interface ProdutoCalculoImposto {
  codigoProduto: number;
  quantidade: number;
  valorUnitario: number;
  unidade?: string;
  valorDesconto?: number;
}

export interface CalculoImpostoInput {
  notaModelo: number;
  codigoCliente: number;
  codigoEmpresa?: number;
  codigoTipoOperacao?: number;
  finalidadeOperacao?: number;
  despesasAcessorias?: DespesasAcessorias;
  produtos: ProdutoCalculoImposto[];
}

export interface ImpostoCalculado {
  tipo: TipoImposto;
  cst?: string;
  aliquota: number;
  valorBase: number;
  valorImposto: number;
  percentualFCP?: number;
  valorFCP?: number;
}

export interface ResultadoCalculoImposto {
  codigoProduto: number;
  impostos: ImpostoCalculado[];
}
