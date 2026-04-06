export interface Estoque {
  codigoProduto: number;
  codigoEmpresa: number;
  codigoLocal: number;
  controle?: string;
  estoque: number;
}

export interface LocalEstoque {
  codigoLocal: number;
  codigoLocalPai: number;
  descricaoLocal: string;
  grau: number;
  analitico: boolean;
  ativo: boolean;
}
