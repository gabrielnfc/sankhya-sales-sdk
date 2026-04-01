# Referência Completa de Tipos

Todas as interfaces, types e enums do `sankhya-sales-sdk`, organizados por módulo.

---

## Config

### `SankhyaConfig`

Configuração principal do SDK.

```typescript
interface SankhyaConfig {
  baseUrl: string;                          // URL base (ex: 'https://api.sankhya.com.br')
  clientId: string;                         // OAuth 2.0 client_id
  clientSecret: string;                     // OAuth 2.0 client_secret
  xToken: string;                           // Token do Gateway Sankhya (header X-Token)
  timeout?: number;                         // Timeout em ms (default: 30000)
  retries?: number;                         // Número de retentativas (default: 3)
  tokenCacheProvider?: TokenCacheProvider;   // Provider customizado para cache de token
  logger?: LoggerOptions;                   // Configuração do logger
}
```

### `TokenCacheProvider`

Interface para injetar cache customizado (ex: Redis).

```typescript
interface TokenCacheProvider {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttlSeconds: number): Promise<void>;
  del(key: string): Promise<void>;
}
```

### `LoggerOptions`

```typescript
interface LoggerOptions {
  level?: LogLevel;
  custom?: Logger;
}
```

### `LogLevel`

```typescript
type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'silent';
```

### `Logger`

```typescript
interface Logger {
  debug(message: string, ...args: unknown[]): void;
  info(message: string, ...args: unknown[]): void;
  warn(message: string, ...args: unknown[]): void;
  error(message: string, ...args: unknown[]): void;
}
```

---

## Auth

### `AuthResponse`

Resposta do endpoint de autenticação.

```typescript
interface AuthResponse {
  access_token: string;
  expires_in: number;
  refresh_expires_in: number;
  token_type: string;
  'not-before-policy': number;
  scope: string;
}
```

### `TokenData`

Dados internos do token em cache.

```typescript
interface TokenData {
  accessToken: string;
  expiresAt: number;     // timestamp em ms
}
```

---

## Common (Tipos Compartilhados)

### `PaginationParams`

Parâmetros de paginação normalizados.

```typescript
interface PaginationParams {
  page?: number;
}
```

### `PaginatedResult<T>`

Resultado paginado normalizado.

```typescript
interface PaginatedResult<T> {
  data: T[];
  page: number;
  hasMore: boolean;
  totalRecords?: number;
}
```

### `RestResponse<T>`

Resposta padrão REST v1.

```typescript
interface RestResponse<T> {
  codigo: number;
  tipo: string;
  mensagem: string;
  page?: number;
  numeroRegistros?: number;
  temMaisRegistros?: boolean;
  [key: string]: unknown;
}
```

### `GatewayResponse<T>`

Resposta padrão Gateway.

```typescript
interface GatewayResponse<T = unknown> {
  serviceName: string;
  status: '0' | '1';
  statusMessage: string;
  responseBody?: T;
  tsError?: {
    tsErrorCode: string;
    tsErrorLevel: string;
  };
}
```

### `GatewayRequest`

Estrutura de request Gateway.

```typescript
interface GatewayRequest {
  serviceName: string;
  requestBody: Record<string, unknown>;
}
```

### `CriteriaExpression`

Filtro para consultas Gateway.

```typescript
interface CriteriaExpression {
  expression: string;                      // ex: "this.ATIVO = 'S'"
  parameters?: CriteriaParameter[];
}

interface CriteriaParameter {
  value: string;
  type: 'S' | 'I' | 'F' | 'D';          // String, Integer, Float, Date
}
```

### `ModifiedSinceParams`

Parâmetros para sync incremental.

```typescript
interface ModifiedSinceParams {
  modifiedSince?: string;                  // AAAA-MM-DDTHH:MM:SS
}
```

---

## Clientes

### `Cliente`

```typescript
interface Cliente {
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
}
```

### `TipoPessoa`

```typescript
type TipoPessoa = 'PF' | 'PJ';
```

### `Endereco`

```typescript
interface Endereco {
  logradouro: string;
  numero: string;
  complemento?: string;
  bairro: string;
  cidade: string;
  codigoIbge: string;
  uf: string;
  cep: string;
}
```

### `Contato`

```typescript
interface Contato {
  codigoContato?: number;
  nome: string;
  email?: string;
  telefoneDdd?: string;
  telefoneNumero?: string;
  logradouro: string;
  numero: string;
  complemento?: string;
  bairro: string;
  cidade: string;
  codigoIbge: string;
  uf: string;
  cep: string;
}
```

### `CriarClienteInput`

```typescript
type CriarClienteInput = Omit<Cliente, 'codigoCliente'>;
```

### `AtualizarClienteInput`

```typescript
type AtualizarClienteInput = Partial<Omit<Cliente, 'codigoCliente'>>;
```

### `ListarClientesParams`

```typescript
interface ListarClientesParams extends PaginationParams {
  dataHoraAlteracao?: string;              // dd/mm/aaaa hh:mm
}
```

---

## Vendedores

### `Vendedor`

```typescript
interface Vendedor {
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
```

### `TipoVendedor` (enum)

```typescript
enum TipoVendedor {
  Comprador = 1,
  Executante = 2,
  Gerente = 3,
  Vendedor = 4,
  Supervisor = 5,
  Tecnico = 6,
  Representante = 7,
}
```

### `ListarVendedoresParams`

```typescript
interface ListarVendedoresParams extends PaginationParams, ModifiedSinceParams {}
```

---

## Produtos

### `Produto`

```typescript
interface Produto {
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
```

### `TipoControleEstoque` (enum)

```typescript
enum TipoControleEstoque {
  Serie = 1,
  Grade = 2,
  Livre = 3,
  Validade = 4,
  SemControle = 5,
  Parceiro = 6,
  Lista = 7,
  Lote = 8,
}
```

### `ComponenteProduto`

```typescript
interface ComponenteProduto {
  codigoProdutoComponente: number;
  nome: string;
  quantidade: number;
  unidade: string;
}
```

### `ProdutoAlternativo`

```typescript
interface ProdutoAlternativo {
  codigoProdutoAlternativo: number;
  nome: string;
}
```

### `Volume`

```typescript
interface Volume {
  codigoVolume: string;
  nome: string;
}
```

### `GrupoProduto`

```typescript
interface GrupoProduto {
  codigoGrupoProduto: number;
  nome: string;
  codigoGrupoProdutoPai?: number;
  grau?: number;
  analitico: boolean;
  ativo: boolean;
}
```

### `ListarProdutosParams`

```typescript
interface ListarProdutosParams extends PaginationParams, ModifiedSinceParams {}
```

---

## Precos

### `Preco`

```typescript
interface Preco {
  codigoProduto: number;
  codigoLocalEstoque?: number;
  controle?: string;
  unidade: string;
  codigoTabela: number;
  valor: number;
}
```

### `PrecoContextualizadoInput`

```typescript
interface PrecoContextualizadoInput {
  codigoEmpresa: number;
  codigoCliente: number;
  codigoVendedor: number;
  codigoTipoOperacao: number;
  codigoTipoNegociacao: number;
  dataNegociacao?: string;
  simularInclusao?: boolean;
  produtos: PrecoContextualizadoProduto[];
}
```

### `PrecoContextualizadoProduto`

```typescript
interface PrecoContextualizadoProduto {
  codigoProduto: number;
  quantidade?: number;
  unidade?: string;
}
```

### `PrecosPorTabelaParams`

```typescript
interface PrecosPorTabelaParams {
  codigoTabela: number;
  pagina?: number;
}
```

### `PrecosPorProdutoETabelaParams`

```typescript
interface PrecosPorProdutoETabelaParams {
  codigoProduto: number;
  codigoTabela: number;
  pagina?: number;
}
```

---

## Estoque

### `Estoque`

```typescript
interface Estoque {
  codigoProduto: number;
  codigoEmpresa: number;
  codigoLocal: number;
  controle?: string;
  estoque: number;
}
```

### `LocalEstoque`

```typescript
interface LocalEstoque {
  codigoLocal: number;
  nome: string;
  ativo: boolean;
}
```

---

## Pedidos

### `PedidoVendaInput`

Input para criação de pedido.

```typescript
interface PedidoVendaInput {
  notaModelo: number;
  data: string;                            // dd/mm/aaaa
  hora: string;                            // hh:mm:ss
  codigoVendedor?: number;
  codigoCliente?: number;
  cliente?: Partial<Cliente>;
  observacao?: string;
  valorFrete?: number;
  valorSeguro?: number;
  valorOutros?: number;
  valorIcms?: number;
  valorCofins?: number;
  valorFcp?: number;
  valorJuro?: number;
  valorTotal: number;
  itens: ItemPedidoInput[];
  financeiros: FinanceiroPedidoInput[];
}
```

### `ItemPedidoInput`

```typescript
interface ItemPedidoInput {
  codigoProduto: number;
  quantidade: number;
  valorUnitario: number;
  unidade: string;
  percentualDesconto?: number;
  valorDesconto?: number;
}
```

### `FinanceiroPedidoInput`

```typescript
interface FinanceiroPedidoInput {
  codigoTipoPagamento: number;
  valor: number;
  dataVencimento: string;                  // dd/mm/aaaa
  numeroParcela: number;
}
```

### `PedidoVenda`

Pedido retornado na consulta.

```typescript
interface PedidoVenda {
  codigoEmpresa: number;
  codigoNota: number;
  numeroNota?: number;
  cliente: {
    codigo: number;
    nome: string;
    cnpjCpf: string;
  };
  confirmada: boolean;
  pendente: boolean;
  dataNegociacao: string;
  codigoVendedor: number;
  valorNota: number;
  itens: ItemPedido[];
  financeiros: FinanceiroPedido[];
}
```

### `ItemPedido`

```typescript
interface ItemPedido {
  codigoProduto: number;
  quantidade: number;
  valorUnitario: number;
  valorTotal: number;
  cfop?: string;
  ncm?: string;
  impostos?: ImpostoPedido[];
}
```

### `FinanceiroPedido`

```typescript
interface FinanceiroPedido {
  sequencia: number;
  tipoPagamento: string;
  dataVencimento: string;
  dataBaixa?: string;
  valorParcela: number;
}
```

### `ImpostoPedido`

```typescript
interface ImpostoPedido {
  tipo: string;
  aliquota: number;
  valor: number;
}
```

### `ConsultarPedidosParams`

```typescript
interface ConsultarPedidosParams extends PaginationParams, ModifiedSinceParams {
  codigoEmpresa: number;                   // obrigatório
  codigoNota?: number;
  numeroNota?: number;
  serieNota?: string;
  dataNegociacaoInicio?: string;           // dd/mm/aaaa
  dataNegociacaoFinal?: string;            // dd/mm/aaaa
  codigoCliente?: number;
  confirmada?: boolean;
  pendente?: boolean;
  codigoNatureza?: number;
  codigoCentroResultado?: number;
  codigoProjeto?: number;
  codigoOrdemCarga?: number;
}
```

### `PedidoMetadados`

```typescript
interface PedidoMetadados {
  paginaAtual: number;
  totalPaginas: number;
  totalRegistros: number;
}
```

### `ConfirmarPedidoInput`

```typescript
interface ConfirmarPedidoInput {
  codigoPedido: number;                    // NUNOTA
  compensarAutomaticamente?: boolean;
}
```

### `FaturarPedidoInput`

```typescript
interface FaturarPedidoInput {
  codigoPedido: number;                    // NUNOTA
  codigoTipoOperacao: number;
  dataFaturamento: string;                 // dd/mm/aaaa
  tipoFaturamento?: TipoFaturamento;
  faturarTodosItens?: boolean;
}
```

### `TipoFaturamento` (enum)

```typescript
enum TipoFaturamento {
  Normal = 'FaturamentoNormal',
  Estoque = 'FaturamentoEstoque',
  EstoqueDeixandoPendente = 'FaturamentoEstoqueDeixandoPendente',
  Direto = 'FaturamentoDireto',
}
```

### `CancelarPedidoInput`

```typescript
interface CancelarPedidoInput {
  codigoPedido: number;
  motivo?: string;
}
```

### `IncluirNotaGatewayInput`

Input para inclusão via Gateway.

```typescript
interface IncluirNotaGatewayInput {
  codigoCliente: number;                   // CODPARC
  dataNegociacao: string;                  // dd/mm/aaaa
  codigoTipoOperacao: number;              // CODTIPOPER
  codigoTipoNegociacao: number;            // CODTIPVENDA
  codigoVendedor: number;                  // CODVEND
  codigoEmpresa: number;                   // CODEMP
  tipoMovimento: string;                   // TIPMOV (ex: 'P' para Pedido)
  observacao?: string;
  itens: ItemNotaGatewayInput[];
}
```

### `ItemNotaGatewayInput`

```typescript
interface ItemNotaGatewayInput {
  codigoProduto: number;                   // CODPROD
  quantidade: number;                      // QTDNEG
  valorUnitario: number;                   // VLRUNIT
  unidade: string;                         // CODVOL
  codigoLocalOrigem?: number;              // CODLOCALORIG
}
```

---

## Financeiros

### `Receita`

```typescript
interface Receita {
  codigoFinanceiro: number;                // NUFIN
  codigoEmpresa: number;
  codigoTipoOperacao: number;
  codigoNatureza: number;
  codigoCentroResultado: number;
  codigoParceiro: number;
  codigoBanco: number;
  codigoContaBancaria: number;
  codigoTipoPagamento: number;
  numeroNota: number;                      // NUNOTA
  dataNegociacao: string;
  dataVencimento: string;
  numeroParcela: number;
  valorParcela: number;
}
```

### `TipoPagamento`

```typescript
interface TipoPagamento {
  codigoTipoPagamento: number;
  nome: string;
  ativo: boolean;
  subTipoPagamento: SubTipoPagamento;
}
```

### `SubTipoPagamento` (enum)

```typescript
enum SubTipoPagamento {
  AVista = 1,
  APrazo = 2,
  Parcelada = 3,
  ChequePredatado = 4,
  Crediario = 5,
  Financeira = 6,
  CartaoCredito = 7,
  CartaoDebito = 8,
  Voucher = 9,
  PIX = 10,
  PIXPOS = 11,
}
```

### `Moeda`

```typescript
interface Moeda {
  codigoMoeda: number;
  nome: string;
}
```

### `ContaBancaria`

```typescript
interface ContaBancaria {
  codigoContaBancaria: number;
  nome: string;
}
```

### `ReceitasFiltro`

```typescript
interface ReceitasFiltro extends PaginationParams {
  codigoEmpresa?: number;
  codigoParceiro?: number;
  statusFinanceiro?: StatusFinanceiro;
  tipoFinanceiro?: TipoFinanceiro;
  dataNegociacaoInicio?: string;           // dd/mm/aaaa
  dataNegociacaoFinal?: string;            // dd/mm/aaaa
}
```

### `StatusFinanceiro` (enum)

```typescript
enum StatusFinanceiro {
  Aberto = 1,
  Baixado = 2,
  Todos = 3,
}
```

### `TipoFinanceiro` (enum)

```typescript
enum TipoFinanceiro {
  Real = 1,
  Provisao = 2,
  Todos = 3,
}
```

---

## Cadastros

### `TipoOperacao`

```typescript
interface TipoOperacao {
  codigoTipoOperacao: number;
  nome: string;
  tipoMovimento: TipoMovimento;
  ativo: boolean;
}
```

### `TipoMovimento` (enum)

```typescript
enum TipoMovimento {
  Faturamento = 4,
  PedidoVenda = 19,
  Venda = 23,
}
```

### `Natureza`

```typescript
interface Natureza {
  codigoNatureza: number;
  nome: string;
}
```

### `Projeto`

```typescript
interface Projeto {
  codigoProjeto: number;
  nome: string;
}
```

### `CentroResultado`

```typescript
interface CentroResultado {
  codigoCentroResultado: number;
  nome: string;
}
```

### `Empresa`

```typescript
interface Empresa {
  codigoEmpresa: number;
  nome: string;
}
```

### `Usuario`

```typescript
interface Usuario {
  codigoUsuario: number;
  nome: string;
}
```

### `TipoNegociacao`

```typescript
interface TipoNegociacao {
  codigoTipoNegociacao: number;            // CODTIPVENDA
  descricao: string;                       // DESCRTIPVENDA
  taxaJuro: number;                        // TAXAJURO
  ativo: boolean;
}
```

### `ModeloNota`

```typescript
interface ModeloNota {
  numeroModelo: number;                    // NUMODELO
  descricao: string;                       // DESCRICAO
  codigoTipoOperacao: number;              // CODTIPOPER
  codigoTipoNegociacao: number;            // CODTIPVENDA
  codigoEmpresa: number;                   // CODEMP
  codigoNatureza?: number;                 // CODNAT
  codigoCentroResultado?: number;          // CODCENCUS
}
```

---

## Fiscal

### `CalculoImpostoInput`

```typescript
interface CalculoImpostoInput {
  notaModelo: number;
  codigoCliente: number;
  codigoEmpresa?: number;
  codigoTipoOperacao?: number;
  finalidadeOperacao?: number;
  despesasAcessorias?: DespesasAcessorias;
  produtos: ProdutoCalculoImposto[];
}
```

### `DespesasAcessorias`

```typescript
interface DespesasAcessorias {
  frete?: number;
  seguro?: number;
  outras?: number;
}
```

### `ProdutoCalculoImposto`

```typescript
interface ProdutoCalculoImposto {
  codigoProduto: number;
  quantidade: number;
  valorUnitario: number;
  unidade?: string;
  valorDesconto?: number;
}
```

### `ResultadoCalculoImposto`

```typescript
interface ResultadoCalculoImposto {
  codigoProduto: number;
  impostos: ImpostoCalculado[];
}
```

### `ImpostoCalculado`

```typescript
interface ImpostoCalculado {
  tipo: TipoImposto;
  cst?: string;
  aliquota: number;
  valorBase: number;
  valorImposto: number;
  percentualFCP?: number;
  valorFCP?: number;
}
```

### `TipoImposto`

```typescript
type TipoImposto =
  | 'icms'
  | 'st'
  | 'ipi'
  | 'pis'
  | 'cofins'
  | 'irf'
  | 'cssl'
  | 'ibsuf'
  | 'ibsmun'
  | 'cbs';
```

---

## Gateway (CRUD Genérico)

### `LoadRecordsParams`

```typescript
interface LoadRecordsParams {
  entity: string;                          // Nome da entidade (ex: 'Produto', 'Parceiro')
  fields: string;                          // Campos separados por vírgula
  criteria?: string;                       // Filtro SQL-like
  page?: number;                           // offsetPage (0-based)
  includePresentationFields?: boolean;
}
```

### `LoadRecordParams`

```typescript
interface LoadRecordParams {
  entity: string;
  fields: string;
  primaryKey: Record<string, string>;      // ex: { CODPROD: '1001' }
}
```

### `SaveRecordParams`

```typescript
interface SaveRecordParams {
  entity: string;
  fields: string;
  data: Record<string, string>;            // Campos e valores
  // Se a PK estiver presente em data → UPDATE
  // Se a PK estiver ausente → INSERT
}
```

### `GatewayDataRow`

```typescript
interface GatewayDataRow {
  id: string;
  fields: Record<string, string>;
}
```

---

## Errors

### `SankhyaError`

Classe base de todos os erros do SDK.

```typescript
class SankhyaError extends Error {
  readonly code: string;
  readonly statusCode?: number;
  readonly details?: unknown;
}
```

### `AuthError`

Erro de autenticação (401, credenciais inválidas).

```typescript
class AuthError extends SankhyaError {
  readonly code = 'AUTH_ERROR';
}
```

### `ApiError`

Erro da API REST v1 (4xx, 5xx).

```typescript
class ApiError extends SankhyaError {
  readonly code = 'API_ERROR';
  readonly endpoint: string;
  readonly method: string;
}
```

### `GatewayError`

Erro de negócio retornado pelo Gateway (HTTP 200, status "0").

```typescript
class GatewayError extends SankhyaError {
  readonly code = 'GATEWAY_ERROR';
  readonly serviceName: string;
  readonly tsErrorCode?: string;
  readonly tsErrorLevel?: string;
}
```

### `TimeoutError`

Timeout na comunicação.

```typescript
class TimeoutError extends SankhyaError {
  readonly code = 'TIMEOUT_ERROR';
}
```
