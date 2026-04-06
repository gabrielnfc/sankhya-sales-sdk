import type { ModifiedSinceParams, PaginationParams } from './common.js';

export enum TipoVendedor {
  Comprador = 1,
  Executante = 2,
  Gerente = 3,
  Vendedor = 4,
  Supervisor = 5,
  Tecnico = 6,
  Representante = 7,
}

export interface Vendedor {
  codigoVendedor: number;
  nome: string;
  ativo: boolean;
  /** Sandbox retorna string (ex: "" ou "4"), não enum numérico */
  tipo: TipoVendedor | number | string;
  /** Sandbox pode retornar null quando não definido */
  comissaoGerencia: number | null;
  /** Sandbox pode retornar null quando não definido */
  comissaoVenda: number | null;
  email: string;
  /** Sandbox pode retornar null quando não definido */
  codigoEmpresa: number | null;
  nomeEmpresa: string;
  codigoParceiro: number;
  /** Sandbox retorna campo nomeParceiro junto com codigoParceiro */
  nomeParceiro?: string;
  codigoGerente?: number;
  /** Sandbox retorna campo nomeGerente junto com codigoGerente */
  nomeGerente?: string;
  codigoRegiao?: number;
  nomeRegiao?: string;
  /** Sandbox retorna codigoFuncionario (pode ser null) */
  codigoFuncionario?: number | null;
  /** Sandbox retorna nomeFuncionario */
  nomeFuncionario?: string;
  /** Sandbox retorna codigoCentroResultado */
  codigoCentroResultado?: number;
  /** Sandbox retorna nomeCentroResultado */
  nomeCentroResultado?: string;
}

export interface ListarVendedoresParams extends PaginationParams, ModifiedSinceParams {}
