// Client
export { SankhyaClient } from './client.js';

// Resources
export {
  ClientesResource,
  VendedoresResource,
  ProdutosResource,
  PrecosResource,
  EstoqueResource,
  PedidosResource,
  FinanceirosResource,
  CadastrosResource,
  FiscalResource,
  GatewayResource,
  MetadataResource,
} from './resources/index.js';

// Errors
export {
  SankhyaError,
  AuthError,
  CircuitOpenError,
  ApiError,
  GatewayError,
  TimeoutError,
  isSankhyaError,
  isAuthError,
  isCircuitOpenError,
  isApiError,
  isGatewayError,
  isTimeoutError,
} from './core/errors.js';
export type { SankhyaErrorCode } from './core/errors.js';

// Guarda de ambiente (allowlist de host, fail-closed)
export {
  assertAllowedHost,
  isAllowedHost,
  isProductionHost,
  SANDBOX_MARKER,
  PRODUCTION_HOSTS,
} from './core/environment-guard.js';

// Classificacao de falha (3 camadas)
export { classifyFailure } from './core/failure-classification.js';
export type { SankhyaFailureKind } from './core/failure-classification.js';

// Validators
export {
  validatePedidoVendaInput,
  validateCriarClienteInput,
  validateAtualizarClienteInput,
  validateContatoInput,
  validateRegistrarReceitaInput,
  validateRegistrarDespesaInput,
  validateBaixarFinanceiroInput,
  validateLoadRecordsParams,
  validateSaveRecordParams,
  validateCalculoImpostoInput,
  validateConfirmarPedidoInput,
  validateFaturarPedidoInput,
  validateCancelarPedidoInput,
} from './core/validators.js';

// Types
export type {
  SankhyaConfig,
  AuthRetryConfig,
  CircuitBreakerConfig,
  TokenCacheProvider,
  LoggerOptions,
  LogLevel,
  Logger,
  RequestOptions,
  AuthResponse,
  TokenData,
  PaginationParams,
  PaginatedResult,
  RestPagination,
  RestResponse,
  GatewayEntities,
  GatewayResponse,
  GatewayRequest,
  CriteriaExpression,
  CriteriaParameter,
  ModifiedSinceParams,
  Cliente,
  TipoPessoa,
  TipoPessoaInput,
  Endereco,
  Contato,
  CriarClienteInput,
  AtualizarClienteInput,
  ListarClientesParams,
  Vendedor,
  ListarVendedoresParams,
  Produto,
  ComponenteProduto,
  ProdutoAlternativo,
  Volume,
  VolumeProduto,
  GrupoProduto,
  ListarProdutosParams,
  Preco,
  PrecoContextualizadoInput,
  PrecoContextualizadoProduto,
  PrecosPorTabelaParams,
  PrecosPorProdutoETabelaParams,
  Estoque,
  LocalEstoque,
  PedidoVendaInput,
  ItemPedidoInput,
  FinanceiroPedidoInput,
  PedidoVenda,
  ItemPedido,
  FinanceiroPedido,
  ImpostoPedido,
  ImpostoPedidoInput,
  TipoImpostoPedido,
  ChequePedidoInput,
  CartaoPedidoInput,
  ConsultarPedidosParams,
  PedidoMetadados,
  ConfirmarPedidoInput,
  FaturarPedidoInput,
  CancelarPedidoInput,
  IncluirNotaGatewayInput,
  ItemNotaGatewayInput,
  Receita,
  Despesa,
  BaixaResult,
  TipoPagamento,
  Moeda,
  ContaBancaria,
  ReceitasFiltro,
  TipoOperacao,
  Natureza,
  Projeto,
  CentroResultado,
  Empresa,
  Usuario,
  TipoNegociacao,
  ModeloNota,
  CalculoImpostoInput,
  DespesasAcessorias,
  ProdutoCalculoImposto,
  ResultadoCalculoImposto,
  ImpostoCalculado,
  TipoImposto,
  ImportNfseResult,
  LoadRecordsParams,
  LoadRecordParams,
  SaveRecordParams,
  GatewayDataRow,
  EntityField,
  ListFieldsOptions,
  PaginationContract,
  FinanceiroPagination,
  PrecosPagination,
  DegradedInfo,
} from './types/index.js';

// Enums (re-exported as values)
export {
  TipoVendedor,
  TipoControleEstoque,
  TipoFaturamento,
  SubTipoPagamento,
  StatusFinanceiro,
  TipoFinanceiro,
  TipoMovimento,
} from './types/index.js';

// DbExplorer (D2.1) — bloco proprio ao fim para merge limpo
export { DbExplorerResource } from './resources/db-explorer.js';
export type { DbExplorerRawResponse, DbExplorerRow } from './types/db-explorer.js';
