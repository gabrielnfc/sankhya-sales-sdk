import type { ModifiedSinceParams, PaginationParams } from './common.js';

/** Tipo de controle de estoque no Sankhya ERP. */
export enum TipoControleEstoque {
  /** Controle por serie. */
  Serie = 1,
  /** Controle por grade. */
  Grade = 2,
  /** Controle livre. */
  Livre = 3,
  /** Controle por validade. */
  Validade = 4,
  /** Sem controle de estoque. */
  SemControle = 5,
  /** Controle por parceiro. */
  Parceiro = 6,
  /** Controle por lista. */
  Lista = 7,
  /** Controle por lote. */
  Lote = 8,
}

/** Representa um produto no Sankhya ERP. */
export interface Produto {
  /** Codigo do produto (CODPROD). */
  codigoProduto: number;
  /** Nome/descricao do produto. */
  nome: string;
  /** Complemento da descricao. */
  complemento?: string;
  /** Caracteristicas do produto. */
  caracteristicas?: string;
  /** Referencia do produto. */
  referencia?: string;
  /** Codigo do grupo de produto. */
  codigoGrupoProduto?: number;
  /** Nome do grupo de produto. */
  nomeGrupoProduto?: string;
  /** Unidade de volume padrao. */
  volume: string;
  /** Marca do produto. */
  marca?: string;
  /** Casas decimais para valores. */
  decimaisValor?: number;
  /** Casas decimais para quantidades. */
  decimaisQuantidade?: number;
  /** Peso bruto do produto. */
  pesoBruto?: number;
  /** Agrupamento minimo. Sandbox pode retornar null. */
  agrupamentoMinimo?: number | null;
  /** Quantidade por embalagem. Sandbox pode retornar null. */
  quantidadeEmbalagem?: number | null;
  /** Tipo de controle de estoque. */
  tipoControleEstoque?: TipoControleEstoque;
  /** Indica se o produto esta ativo. */
  ativo: boolean;
  /** Estoque maximo. Sandbox pode retornar null. */
  estoqueMaximo?: number | null;
  /** Estoque minimo. Sandbox pode retornar null. */
  estoqueMinimo?: number | null;
  /** Indicador de uso do produto. */
  usadoComo?: number;
  /** Codigo NCM (Nomenclatura Comum do Mercosul). */
  ncm?: string;
  /** Codigo CEST. Sandbox pode retornar null. */
  cest?: string | null;
  /** Data da ultima alteracao (ISO). */
  dataAlteracao?: string;
  /** Campo retornado pelo sandbox com dois-pontos no nome. */
  'dataAlteracao:'?: string;
  /** Homepage do produto. */
  homepage?: string;
  /** Grupo de desconto. */
  grupoDesconto?: string;
  /** Referencia do fornecedor. */
  referenciaFornecedor?: string;
  /** Codigo CNAE. */
  cnae?: string | null;
  /** Volume em metros cubicos. */
  metroCubico?: number | null;
  /** Altura do produto. */
  altura?: number | null;
  /** Largura do produto. */
  largura?: number | null;
  /** Espessura do produto. */
  espessura?: number | null;
  /** Unidade de medida (ex: `'CM'`). */
  unidadeMedida?: string;
  /** Indica se utiliza balanca. */
  utilizaBalanca?: boolean;
  /** Codigo do pais de origem. */
  codigoPais?: number | null;
}

/** Componente de um produto composto (kit). */
export interface ComponenteProduto {
  /** Codigo do produto componente. */
  codigoProdutoComponente: number;
  /** Nome do componente. */
  nome: string;
  /** Quantidade do componente. */
  quantidade: number;
  /** Unidade de medida. */
  unidade: string;
}

/** Produto alternativo/substituto. */
export interface ProdutoAlternativo {
  /** Codigo do produto alternativo. */
  codigoProdutoAlternativo: number;
  /** Nome do produto alternativo. */
  nome: string;
}

/** Volume/unidade de medida de produto. */
export interface Volume {
  /** Codigo do volume (string). */
  codigoVolume: string;
  /** Descricao do volume. */
  nome: string;
}

/** Grupo de produto no Sankhya ERP. */
export interface GrupoProduto {
  /** Codigo do grupo. */
  codigoGrupoProduto: number;
  /** Nome do grupo. */
  nome: string;
  /** Codigo do grupo pai (hierarquia). */
  codigoGrupoProdutoPai?: number;
  /** Grau na hierarquia. */
  grau?: number;
  /** Grupo ICMS. Sandbox pode retornar null. */
  grupoIcms?: string | null;
  /** Indica se e um grupo analitico (folha). */
  analitico: boolean;
  /** Indica se o grupo esta ativo. */
  ativo: boolean;
}

/** Filtros para listagem de produtos. */
export interface ListarProdutosParams extends PaginationParams, ModifiedSinceParams {}
