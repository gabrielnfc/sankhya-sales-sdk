import type { PaginationParams } from './common.js';

/**
 * Tipo de pessoa no Sankhya (modelo de leitura).
 *
 * A API REST retorna `'F'` (Fisica) ou `'J'` (Juridica) na consulta.
 */
export type TipoPessoa = 'F' | 'J';

/**
 * Tipo de pessoa aceito na criacao/atualizacao de cliente.
 *
 * O contrato REST oficial exige `'PF'`/`'PJ'` (verificado ao vivo: enviar
 * `'F'`/`'J'` resulta em `TIPPESSOA` nulo). Os valores `'F'`/`'J'` continuam
 * aceitos como aliases e sao mapeados para `'PF'`/`'PJ'` pelo SDK.
 */
export type TipoPessoaInput = 'PF' | 'PJ' | 'F' | 'J';

/** Endereco de um parceiro/cliente. */
export interface Endereco {
  /** Logradouro (rua, avenida, etc.). */
  logradouro: string;
  /** Numero do endereco. */
  numero: string;
  /** Complemento (sala, andar, etc.). */
  complemento?: string;
  /** Bairro. */
  bairro: string;
  /** Nome da cidade. */
  cidade: string;
  /** Codigo IBGE do municipio. */
  codigoIbge: string;
  /** Unidade federativa (sigla). */
  uf: string;
  /** CEP (somente digitos). */
  cep: string;
  /** Latitude geografica. */
  latitude?: string;
  /** Longitude geografica. */
  longitude?: string;
}

/** Contato vinculado a um cliente. */
export interface Contato {
  /** Codigo do contato (gerado pelo sistema). */
  codigoContato?: number;
  /** Nome do contato. */
  nome: string;
  /** Email do contato. */
  email?: string;
  /** DDD do telefone. */
  telefoneDdd?: string;
  /** Numero do telefone. */
  telefoneNumero?: string;
  /** Logradouro do contato. */
  logradouro?: string;
  /** Numero do endereco do contato. */
  numero?: string;
  /** Complemento do endereco. */
  complemento?: string;
  /** Bairro do contato. */
  bairro?: string;
  /** Cidade do contato. */
  cidade?: string;
  /** Codigo IBGE do municipio. */
  codigoIbge?: string;
  /** UF do contato. */
  uf?: string;
  /** CEP do contato. */
  cep?: string;
}

/** Representa um cliente (parceiro) no Sankhya ERP. */
export interface Cliente {
  /** Codigo do cliente. Sandbox retorna string (ex: `'169'`). */
  codigoCliente: number | string;
  /** Tipo de pessoa (F=Fisica, J=Juridica). */
  tipo: TipoPessoa;
  /** CNPJ ou CPF do cliente. */
  cnpjCpf: string;
  /** Inscricao Estadual ou RG. */
  ieRg?: string;
  /** Nome ou razao social. */
  nome: string;
  /** Razao social (quando diferente do nome). */
  razao?: string;
  /** Email de contato principal. */
  email?: string;
  /** DDD do telefone. */
  telefoneDdd?: string;
  /** Numero do telefone. */
  telefoneNumero?: string;
  /** Limite de credito. Sandbox pode retornar string. */
  limiteCredito?: number | string;
  /** Grupo de autorizacao. */
  grupoAutorizacao?: string;
  /** Endereco principal. */
  endereco: Endereco;
  /** Contatos vinculados. */
  contatos?: Contato[];
  /** Indica se o cliente esta ativo. */
  ativo?: boolean;
  /** Codigo do vendedor responsavel. */
  codigoVendedor?: number;
  /** Data da ultima alteracao (ISO). */
  dataAlteracao?: string;
}

/**
 * Dados para criacao de um novo cliente.
 *
 * `tipo` aceita `'PF'`/`'PJ'` (canonico) ou `'F'`/`'J'` (legado, mapeado).
 * `camposAdicionais` carrega campos personalizados `AD_*` no objeto exigido
 * pelo contrato oficial (`{ camposAdicionais: { AD_*: ... } }`).
 */
export type CriarClienteInput = Omit<Cliente, 'codigoCliente' | 'dataAlteracao' | 'tipo'> & {
  /** Tipo de pessoa: `'PF'`/`'PJ'` (ou `'F'`/`'J'` legado). */
  tipo: TipoPessoaInput;
  /** Campos personalizados `AD_*` (objeto `camposAdicionais` do contrato). */
  camposAdicionais?: Record<string, unknown>;
};

/** Dados para atualizacao parcial de um cliente. */
export type AtualizarClienteInput = Partial<
  Omit<Cliente, 'codigoCliente' | 'dataAlteracao' | 'tipo'>
> & {
  /** Tipo de pessoa: `'PF'`/`'PJ'` (ou `'F'`/`'J'` legado). */
  tipo?: TipoPessoaInput;
  /** Campos personalizados `AD_*` (objeto `camposAdicionais` do contrato). */
  camposAdicionais?: Record<string, unknown>;
};

/** Filtros para listagem de clientes. */
export interface ListarClientesParams extends PaginationParams {
  /**
   * Data no formato `dd/MM/yyyy` ou `dd/MM/yyyy HH:mm:ss`.
   *
   * **Nao aceita ISO 8601** — a API responde `400 ORA-01861`. O filtro e
   * inclusivo (`>=`). Uma janela sem alteracoes responde `404
   * RESOURCE_NOT_FOUND`, nao lista vazia.
   */
  dataHoraAlteracao?: string;
}
