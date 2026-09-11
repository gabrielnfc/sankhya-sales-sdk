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

// Dataset (D2.2) — bloco proprio ao fim para merge limpo
export { DatasetResource, datasetRecord } from './resources/dataset.js';
export type {
  DatasetEntity,
  DatasetLoadParams,
  DatasetRecord,
  DatasetRemoveParams,
  DatasetSaveParams,
  DatasetSaveRawResponse,
  DatasetSaveResult,
} from './types/dataset.js';

// Notas (D2.3) — bloco proprio ao fim para merge limpo
export { NotasResource } from './resources/notas.js';
export type {
  CancelamentoReadBackRow,
  CancelarNotaInput,
  CancelarNotaRawResponse,
  CancelarNotaResult,
  ConfirmarNotaResult,
} from './types/notas.js';

// Conferencia (D2.5) — bloco proprio ao fim para merge limpo
export { ConferenciaResource } from './resources/conferencia.js';
export type {
  AbrirConferenciaInput,
  AbrirConferenciaResult,
  ApontarNaNotaInput,
  BiparInput,
  CarimbarSeparacaoInput,
  ConferenciaDaNota,
  FecharConferenciaInput,
  ReapontarOrigemInput,
} from './types/conferencia.js';

// Lotes / virada (D2.6) — bloco proprio ao fim para merge limpo
export { LotesResource } from './resources/lotes.js';
export type {
  BaixaLoteInput,
  BaixaLoteItem,
  EntradaLoteInput,
  EntradaLoteItem,
  NotaDeLoteResult,
} from './types/lotes.js';
export type { EstoqueLote } from './types/estoque.js';
export type { SetTipoControleInput } from './types/produtos.js';
