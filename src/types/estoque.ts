/** Posicao de estoque de um produto em um local. */
export interface Estoque {
  /** Codigo do produto. */
  codigoProduto: number;
  /** Codigo da empresa. */
  codigoEmpresa: number;
  /** Codigo do local de estoque. */
  codigoLocal: number;
  /** Controle de estoque (serie, lote, etc.). */
  controle?: string;
  /** Quantidade em estoque. */
  estoque: number;
}

/** Local de estoque no Sankhya ERP. */
export interface LocalEstoque {
  /** Codigo do local. */
  codigoLocal: number;
  /** Codigo do local pai (hierarquia). */
  codigoLocalPai: number;
  /** Descricao do local. */
  descricaoLocal: string;
  /** Grau na hierarquia. */
  grau: number;
  /** Indica se e um local analitico (folha). */
  analitico: boolean;
  /** Indica se o local esta ativo. */
  ativo: boolean;
}
