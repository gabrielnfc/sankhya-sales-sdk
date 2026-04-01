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
  agrupamentoMinimo?: number;
  quantidadeEmbalagem?: number;
  tipoControleEstoque?: TipoControleEstoque;
  ativo: boolean;
  estoqueMaximo?: number;
  estoqueMinimo?: number;
  usadoComo?: number;
  ncm?: string;
  cest?: string;
  dataAlteracao?: string;
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
  analitico: boolean;
  ativo: boolean;
}

export interface ListarProdutosParams extends PaginationParams, ModifiedSinceParams {}
