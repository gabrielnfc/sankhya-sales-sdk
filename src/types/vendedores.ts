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
  tipo: TipoVendedor;
  comissaoGerencia: number;
  comissaoVenda: number;
  email: string;
  codigoEmpresa: number;
  nomeEmpresa: string;
  codigoParceiro: number;
  codigoGerente?: number;
  codigoRegiao?: number;
  nomeRegiao?: string;
}

export interface ListarVendedoresParams extends PaginationParams, ModifiedSinceParams {}
