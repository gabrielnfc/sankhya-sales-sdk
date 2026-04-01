import type { PaginationParams } from './common.js';

/** API Sankhya retorna 'F' (Física) ou 'J' (Jurídica) */
export type TipoPessoa = 'F' | 'J';

export interface Endereco {
  logradouro: string;
  numero: string;
  complemento?: string;
  bairro: string;
  cidade: string;
  codigoIbge: string;
  uf: string;
  cep: string;
  latitude?: string;
  longitude?: string;
}

export interface Contato {
  codigoContato?: number;
  nome: string;
  email?: string;
  telefoneDdd?: string;
  telefoneNumero?: string;
  logradouro?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  cidade?: string;
  codigoIbge?: string;
  uf?: string;
  cep?: string;
}

export interface Cliente {
  codigoCliente: number;
  tipo: TipoPessoa;
  cnpjCpf: string;
  ieRg?: string;
  nome: string;
  razao?: string;
  email?: string;
  telefoneDdd?: string;
  telefoneNumero?: string;
  limiteCredito?: number;
  grupoAutorizacao?: string;
  endereco: Endereco;
  contatos?: Contato[];
  ativo?: boolean;
  codigoVendedor?: number;
  dataAlteracao?: string;
}

export type CriarClienteInput = Omit<Cliente, 'codigoCliente' | 'dataAlteracao'>;

export type AtualizarClienteInput = Partial<Omit<Cliente, 'codigoCliente' | 'dataAlteracao'>>;

export interface ListarClientesParams extends PaginationParams {
  dataHoraAlteracao?: string;
}
