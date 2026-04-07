import type { ModifiedSinceParams, PaginationParams } from './common.js';

/** Tipo de vendedor no Sankhya ERP. */
export enum TipoVendedor {
  /** Comprador. */
  Comprador = 1,
  /** Executante. */
  Executante = 2,
  /** Gerente. */
  Gerente = 3,
  /** Vendedor. */
  Vendedor = 4,
  /** Supervisor. */
  Supervisor = 5,
  /** Tecnico. */
  Tecnico = 6,
  /** Representante. */
  Representante = 7,
}

/** Representa um vendedor no Sankhya ERP. */
export interface Vendedor {
  /** Codigo do vendedor. */
  codigoVendedor: number;
  /** Nome do vendedor. */
  nome: string;
  /** Indica se o vendedor esta ativo. */
  ativo: boolean;
  /** Tipo do vendedor. Sandbox pode retornar string. */
  tipo: TipoVendedor | number | string;
  /** Percentual de comissao de gerencia. Sandbox pode retornar null. */
  comissaoGerencia: number | null;
  /** Percentual de comissao de venda. Sandbox pode retornar null. */
  comissaoVenda: number | null;
  /** Email do vendedor. */
  email: string;
  /** Codigo da empresa. Sandbox pode retornar null. */
  codigoEmpresa: number | null;
  /** Nome da empresa. */
  nomeEmpresa: string;
  /** Codigo do parceiro vinculado. */
  codigoParceiro: number;
  /** Nome do parceiro vinculado. */
  nomeParceiro?: string;
  /** Codigo do gerente. */
  codigoGerente?: number;
  /** Nome do gerente. */
  nomeGerente?: string;
  /** Codigo da regiao de atuacao. */
  codigoRegiao?: number;
  /** Nome da regiao. */
  nomeRegiao?: string;
  /** Codigo do funcionario vinculado. */
  codigoFuncionario?: number | null;
  /** Nome do funcionario. */
  nomeFuncionario?: string;
  /** Codigo do centro de resultado. */
  codigoCentroResultado?: number;
  /** Nome do centro de resultado. */
  nomeCentroResultado?: string;
}

/** Filtros para listagem de vendedores. */
export interface ListarVendedoresParams extends PaginationParams, ModifiedSinceParams {}
