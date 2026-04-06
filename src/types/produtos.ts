import type { ModifiedSinceParams, PaginationParams } from './common.js';

export enum TipoControleEstoque {
  Serie = 1,
  Grade = 2,
  Livre = 3,
  Validade = 4,
  SemControle = 5,
  Parceiro = 6,
  Lista = 7,
  Lote = 8,
}

export interface Produto {
  codigoProduto: number;
  nome: string;
  complemento?: string;
  caracteristicas?: string;
  referencia?: string;
  codigoGrupoProduto?: number;
  nomeGrupoProduto?: string;
  volume: string;
  marca?: string;
  decimaisValor?: number;
  decimaisQuantidade?: number;
  pesoBruto?: number;
  /** Sandbox pode retornar null */
  agrupamentoMinimo?: number | null;
  /** Sandbox pode retornar null */
  quantidadeEmbalagem?: number | null;
  tipoControleEstoque?: TipoControleEstoque;
  ativo: boolean;
  /** Sandbox pode retornar null */
  estoqueMaximo?: number | null;
  /** Sandbox pode retornar null */
  estoqueMinimo?: number | null;
  usadoComo?: number;
  ncm?: string;
  /** Sandbox pode retornar null */
  cest?: string | null;
  /**
   * Sandbox retorna chave "dataAlteracao:" (com dois-pontos no nome).
   * Mapeado como dataAlteracao no TypeScript; o trailing colon é uma peculiaridade da API.
   */
  dataAlteracao?: string;
  /** Campo "dataAlteracao:" retornado pelo sandbox com dois-pontos no nome */
  'dataAlteracao:'?: string;
  /** Sandbox retorna homepage (string, geralmente vazia) */
  homepage?: string;
  /** Sandbox retorna grupoDesconto (string) */
  grupoDesconto?: string;
  /** Sandbox retorna referenciaFornecedor (string) */
  referenciaFornecedor?: string;
  /** Sandbox retorna cnae (pode ser null) */
  cnae?: string | null;
  /** Sandbox retorna metroCubico (pode ser null) */
  metroCubico?: number | null;
  /** Sandbox retorna altura (pode ser null) */
  altura?: number | null;
  /** Sandbox retorna largura (pode ser null) */
  largura?: number | null;
  /** Sandbox retorna espessura (pode ser null) */
  espessura?: number | null;
  /** Sandbox retorna unidadeMedida (string, ex: "CM") */
  unidadeMedida?: string;
  /** Sandbox retorna utilizaBalanca (boolean) */
  utilizaBalanca?: boolean;
  /** Sandbox retorna codigoPais (pode ser null) */
  codigoPais?: number | null;
}

export interface ComponenteProduto {
  codigoProdutoComponente: number;
  nome: string;
  quantidade: number;
  unidade: string;
}

export interface ProdutoAlternativo {
  codigoProdutoAlternativo: number;
  nome: string;
}

export interface Volume {
  codigoVolume: string;
  nome: string;
}

export interface GrupoProduto {
  codigoGrupoProduto: number;
  nome: string;
  codigoGrupoProdutoPai?: number;
  grau?: number;
  /** Sandbox retorna grupoIcms (pode ser null) */
  grupoIcms?: string | null;
  analitico: boolean;
  ativo: boolean;
}

export interface ListarProdutosParams extends PaginationParams, ModifiedSinceParams {}
