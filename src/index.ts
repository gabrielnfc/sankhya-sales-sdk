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
} from './resources/index.js';

// Errors
export {
  SankhyaError,
  AuthError,
  ApiError,
  GatewayError,
  TimeoutError,
} from './core/errors.js';

// Core utilities
export { createLogger } from './core/logger.js';
export { serialize, deserialize, deserializeRows } from './core/gateway-serializer.js';
export {
  normalizeRestPagination,
  normalizeGatewayPagination,
  extractRestData,
  createPaginator,
} from './core/pagination.js';
export type { FetchPage } from './core/pagination.js';
export { withRetry } from './core/retry.js';
export type { RetryOptions } from './core/retry.js';
export { toSankhyaDate, toSankhyaDateTime, toISODate } from './core/date.js';

// Types
export type {
  SankhyaConfig,
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
  ConsultarPedidosParams,
  PedidoMetadados,
  ConfirmarPedidoInput,
  FaturarPedidoInput,
  CancelarPedidoInput,
  IncluirNotaGatewayInput,
  ItemNotaGatewayInput,
  Receita,
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
  LoadRecordsParams,
  LoadRecordParams,
  SaveRecordParams,
  GatewayDataRow,
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
