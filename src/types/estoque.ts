export interface Estoque {
  codigoProduto: number;
  codigoEmpresa: number;
  codigoLocal: number;
  controle?: string;
  estoque: number;
}

export interface LocalEstoque {
  codigoLocal: number;
  nome: string;
  ativo: boolean;
}
