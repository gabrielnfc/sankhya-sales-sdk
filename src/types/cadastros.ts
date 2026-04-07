/** Tipo de movimento no Sankhya ERP. */
export enum TipoMovimento {
  /** Faturamento. */
  Faturamento = 4,
  /** Pedido de venda. */
  PedidoVenda = 19,
  /** Venda. */
  Venda = 23,
}

/** Tipo de operacao (TOP) no Sankhya ERP. */
export interface TipoOperacao {
  /** Codigo do tipo de operacao. */
  codigoTipoOperacao: number;
  /** Nome do tipo de operacao. */
  nome: string;
  /** Tipo de movimento associado. */
  tipoMovimento: TipoMovimento;
  /** Indica se esta ativo. */
  ativo: boolean;
}

/** Natureza financeira no Sankhya ERP. */
export interface Natureza {
  /** Codigo da natureza. */
  codigoNatureza: number;
  /** Nome da natureza. */
  nome: string;
}

/** Projeto no Sankhya ERP. */
export interface Projeto {
  /** Codigo do projeto. */
  codigoProjeto: number;
  /** Nome do projeto. */
  nome: string;
}

/** Centro de resultado no Sankhya ERP. */
export interface CentroResultado {
  /** Codigo do centro de resultado. */
  codigoCentroResultado: number;
  /** Nome do centro de resultado. */
  nome: string;
}

/** Empresa no Sankhya ERP. */
export interface Empresa {
  /** Codigo da empresa. */
  codigoEmpresa: number;
  /** Nome fantasia. */
  nomeFantasia: string;
  /** Razao social. */
  razaoSocial: string;
  /** Razao social abreviada. */
  razaoAbreviada: string;
  /** CNPJ ou CPF. */
  cnpjCpf: string;
  /** Inscricao Estadual. */
  inscricaoEstadual: string;
  /** Inscricao Municipal. */
  inscricaoMunicipal: string;
  /** Telefone. */
  telefone: string;
  /** Email. */
  email: string;
  /** Homepage/website. */
  homepage: string;
  /** Codigo do logradouro. */
  codigoLogradouro: number;
  /** Nome do logradouro. */
  nomeLogradouro: string;
  /** Numero do endereco. */
  numero: string;
  /** Complemento do endereco. */
  complemento: string;
  /** Codigo do bairro. */
  codigoBairro: number;
  /** Nome do bairro. */
  nomeBairro: string;
  /** Codigo da cidade. */
  codigoCidade: number;
  /** Nome da cidade. */
  nomeCidade: string;
  /** CEP. */
  cep: string;
  /** Codigo da empresa matriz (null se for matriz). */
  codigoEmpresaMatriz: number | null;
}

/** Usuario do sistema Sankhya. */
export interface Usuario {
  /** Codigo do usuario. */
  codigoUsuario: number;
  /** Nome do usuario. */
  nome: string;
}

/** Tipo de negociacao no Sankhya ERP (disponivel apenas via Gateway). */
export interface TipoNegociacao {
  /** Codigo do tipo de negociacao. */
  codigoTipoNegociacao: number;
  /** Descricao do tipo de negociacao. */
  descricao: string;
  /** Taxa de juro aplicada. */
  taxaJuro: number;
  /** Indica se esta ativo. */
  ativo: boolean;
}

/** Modelo de nota no Sankhya ERP (disponivel apenas via Gateway). */
export interface ModeloNota {
  /** Numero do modelo de nota. */
  numeroModelo: number;
  /** Descricao do modelo. */
  descricao: string;
  /** Codigo do tipo de operacao vinculado. */
  codigoTipoOperacao: number;
  /** Codigo do tipo de negociacao vinculado. */
  codigoTipoNegociacao: number;
  /** Codigo da empresa. */
  codigoEmpresa: number;
  /** Codigo da natureza (opcional). */
  codigoNatureza?: number | undefined;
  /** Codigo do centro de resultado (opcional). */
  codigoCentroResultado?: number | undefined;
}
