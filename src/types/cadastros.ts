export enum TipoMovimento {
  Faturamento = 4,
  PedidoVenda = 19,
  Venda = 23,
}

export interface TipoOperacao {
  codigoTipoOperacao: number;
  nome: string;
  tipoMovimento: TipoMovimento;
  ativo: boolean;
}

export interface Natureza {
  codigoNatureza: number;
  nome: string;
}

export interface Projeto {
  codigoProjeto: number;
  nome: string;
}

export interface CentroResultado {
  codigoCentroResultado: number;
  nome: string;
}

export interface Empresa {
  codigoEmpresa: number;
  nome: string;
}

export interface Usuario {
  codigoUsuario: number;
  nome: string;
}

export interface TipoNegociacao {
  codigoTipoNegociacao: number;
  descricao: string;
  taxaJuro: number;
  ativo: boolean;
}

export interface ModeloNota {
  numeroModelo: number;
  descricao: string;
  codigoTipoOperacao: number;
  codigoTipoNegociacao: number;
  codigoEmpresa: number;
  codigoNatureza?: number;
  codigoCentroResultado?: number;
}
