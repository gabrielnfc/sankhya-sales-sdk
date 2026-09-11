# Referência Completa de Tipos

Todas as interfaces, types e enums do `sankhya-sales-sdk`, organizados por módulo.

---

## Config

### `SankhyaConfig`

Configuração principal do SDK.

```typescript
interface SankhyaConfig {
  baseUrl: string;                          // URL base (use o host de sandbox nos exemplos)
  clientId: string;                         // OAuth 2.0 client_id
  clientSecret: string;                     // OAuth 2.0 client_secret
  xToken: string;                           // Token do Gateway Sankhya (header X-Token)
  timeout?: number;                         // Timeout em ms (default: 30000)
  retries?: number;                         // Número de retentativas (default: 3)
  authRetry?: AuthRetryConfig;              // Retry do OAuth (só falha transiente)
  circuitBreaker?: CircuitBreakerConfig;    // Breaker local de autenticação
  tokenCacheProvider?: TokenCacheProvider;  // Provider customizado para cache de token
  logger?: LoggerOptions;                   // Configuração do logger
  allowProduction?: boolean;                // 1.6.0 — libera host de produção (default: false)
  allowedHosts?: readonly string[];         // 1.6.0 — hosts extras na allowlist
  onDegradedResponse?: 'flag';              // hoje sem efeito; default passa a 'throw' na 2.0.0
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

### `VolumeProduto`

Lido de `TGFVOA` por SQL (`produtos.volumesProduto`). **Novo em 1.6.0.**

```typescript
interface VolumeProduto {
  codProd: number;    // TGFVOA.CODPROD — vazio/não numérico/<=0 LANÇA (PARSE_ERROR)
  codVol: string;     // TGFVOA.CODVOL ('UN', 'CX', ...)
  quantidade: number; // unidades por volume. 0 quando não cadastrado (M57)
  lastro: number;     // caixas por camada no palete. 0 quando não cadastrado
  camadas: number;    // camadas por palete. 0 quando não cadastrado
  ativo: boolean;     // TGFVOA.ATIVO === 'S'
}
```

> `quantidade: 0` é **indistinguível** de "sem cadastro" (D-05) — trate como sem cadastro.
> A rota de Gateway (`loadRecords` com `rootEntity: 'VolumeProduto'`) foi REFUTADA no
> sandbox em 2026-09-11: `Erro interno (NPE)`, 0 linhas (RD-7).

### `SetTipoControleInput`

**Novo em 1.6.0.**

```typescript
interface SetTipoControleInput {
  readonly codProd: number;        // CODPROD
  readonly tipo: 'L' | 'N';        // TIPCONTEST: 'L' liga lote, 'N' desliga
  readonly usaLoteDtVal: boolean;  // USALOTEDTVAL: true grava 'S', false grava 'N'
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

### `EstoqueLote`

Linha de `TGFEST` lida por `estoque.porLote`. **Novo em 1.6.0.**

```typescript
interface EstoqueLote {
  readonly codEmp: number;
  readonly codLocal: number;
  readonly codProd: number;
  readonly controle: string;        // ' ' é a linha FLUTUANTE, de reserva sem lote (M92)
  readonly tipo: string;            // medido: 'P'
  readonly codParc: number;         // medido: 0
  readonly estoque: number;         // coluna vazia/não numérica LANÇA — nunca vira 0
  readonly reservado: number;       // disponível = estoque - reservado (M102)
  readonly dtVal: string | null;    // forma CRUA do ERP ('05092027 00:00:00'), não dd/MM/yyyy
  readonly dtFab: string | null;
  readonly statusLote: string;      // domínio fechado ('A','Q','P','N','R') — M89
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
  codigoPedido: number;                    // NUNOTA. INTEIRO desde a 1.6.0 (D-11)
  codigoTipoOperacao: number;              // INTEIRO desde a 1.6.0 (D-11)
  dataFaturamento?: string;                // dd/MM/yyyy — OPCIONAL: vazia, o wizard usa a
                                           // data corrente do ERP (dtFaturamento: '', M51)
  tipoFaturamento?: TipoFaturamento;       // default FaturamentoNormal
  faturarTodosItens?: boolean;             // default true. `false` LANÇA (M82)
  serie?: string;                          // 1.6.0 — default '1' (M49)
  codigoLocalDestino?: string;             // 1.6.0 — default '' = o do cadastro
  umaNotaParaCada?: boolean;               // 1.6.0 — default false
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
  dataNegociacao: string;                  // DTNEG
  codigoTipoOperacao: number;              // CODTIPOPER
  codigoTipoNegociacao: number;            // CODTIPVENDA
  codigoVendedor: number;                  // CODVEND
  codigoEmpresa: number;                   // CODEMP
  tipoMovimento: string;                   // TIPMOV (ex: 'P' para Pedido)
  observacao?: string;                     // OBSERVACAO
  statusNota?: 'A' | 'L';                  // 1.6.0 — STATUSNOTA
  numeroPedidoExterno?: string;            // 1.6.0 — AD_NUMPEDIDO
  informarPreco?: boolean;                 // 1.6.0 — itens.INFORMARPRECO, default true,
                                           // serializado como STRING 'True'/'False' (M46)
  camposExtras?: Record<string, string | number>; // 1.6.0 — cabeçalho cru.
                                           // Citar chave tipada LANÇA (11 chaves)
  itens: ItemNotaGatewayInput[];
}
```

### `ItemNotaGatewayInput`

```typescript
interface ItemNotaGatewayInput {
  codigoProduto: number;                   // CODPROD
  quantidade: number;                      // QTDNEG — finita, > 0
  valorUnitario: number;                   // VLRUNIT — finito, >= 0. Vai CRU
  unidade: string;                         // CODVOL
  codigoLocalOrigem?: number;              // CODLOCALORIG
  percentualDesconto?: number;             // 1.6.0 — PERCDESC, default 0, em [0, 100].
                                           // O ERP EXIGE (CORE_E03235) — D-14
  valorTotal?: number;                     // 1.6.0 — VLRTOT, finito e >= 0.
                                           // Default: valorUnitario x quantidade EM CENTAVOS
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
  data: Record<string, string>;            // -> dataSet.dataRow.localFields
  primaryKey?: Record<string, string>;     // 1.6.0 — presente: dataSet.dataRow.key
                                           // ausente: a chave é omitida
                                           // {}: recusado com VALIDATION_ERROR
}
```

> **Mudou na 1.6.0 (M34).** Até a 1.5.0 a documentação dizia "PK dentro de `data`" e o SDK
> mandava os campos em `dataSet.entity`. O formato aceito é `dataSet.dataRow.{key,
> localFields}`. Ver [gateway-crud.md](./gateway-crud.md#saverecordparams).

### `GatewayDataRow`

```typescript
interface GatewayDataRow {
  id: string;
  fields: Record<string, string>;
}
```

> **Tipo legado, exportado para compatibilidade.** `loadRecords`, `loadRecord` e
> `saveRecord` **não** o devolvem: o retorno é `Record<string, string>` plano.

---

## DbExplorer

### `DbExplorerRow`

```typescript
type DbExplorerRow = Record<string, string>;
```

Linha do DbExplorer normalizada: toda célula como string.

### `DbExplorerRawResponse`

```typescript
interface DbExplorerRawResponse {
  fieldsMetadata?: { name: string }[];  // nomes das colunas, na ordem das células
  rows?: unknown[][];                   // linhas POSICIONAIS: rows[i][j] <-> fieldsMetadata[j]
}
```

Os dois campos são opcionais porque é fronteira externa: consulta sem resultado existe e
não pode derrubar o processo. As células **não** chegam sempre como string — `CODLOCAL`
veio `number` no spike — por isso `unknown[][]` e conversão explícita no resource.

---

## Dataset

### `DatasetEntity`

```typescript
type DatasetEntity =
  | 'CabecalhoNota' | 'ItemNota' | 'Estoque' | 'Produto'
  | 'CabecalhoConferencia' | 'DetalhesConferencia'
  | 'ContagemEstoque';  // SOMENTE leitura/histórico — gravar NÃO move estoque (M105)
```

União fechada de propósito: `save` escreve no ERP, e uma string livre abriria a porta para
qualquer entidade.

### `DatasetRecord`

```typescript
interface DatasetRecord {
  readonly pk?: Readonly<Record<string, string>>;  // ausente = inserção (M88)
  readonly values: Readonly<Record<string, string>>; // chave = índice POSICIONAL em fields
}
```

Construa com `datasetRecord(fields, { pk?, set })` — escrever o índice à mão é a fonte de
bug mais provável desta API.

### `DatasetSaveParams` · `DatasetSaveResult` · `DatasetRemoveParams` · `DatasetLoadParams`

```typescript
interface DatasetSaveParams {
  readonly entityName: DatasetEntity;
  readonly fields: readonly string[];
  readonly records: readonly DatasetRecord[];
  readonly standAlone?: boolean;          // default false — true desliga regras/gatilhos
}

interface DatasetSaveResult {
  readonly total: number;
  readonly result: readonly (readonly string[])[];  // a célula `_rmd` é descartada (RD-8)
}

interface DatasetRemoveParams {
  readonly entityName: DatasetEntity;
  readonly pks: ReadonlyArray<Record<string, string>>;  // vazia/pk vazia recusadas (R2)
  readonly standAlone?: boolean;
}

interface DatasetLoadParams {
  readonly entityName: DatasetEntity;
  readonly fields: readonly string[];
  readonly criteria?: string;
  readonly page?: number;
}
```

---

## Notas

```typescript
interface ConfirmarNotaResult {
  readonly confirmada: true;              // sempre true: o método resolve ou lança
  readonly jaEstavaConfirmada: boolean;   // true quando o ERP disse "já foi confirmada" (M80)
}

interface CancelarNotaInput {
  readonly nunota: number;                // inteiro positivo
  readonly justificativa: string;         // não vazia — vai para TGFCAN.MOTCANCEL
}

interface CancelarNotaResult {
  readonly totalNotasCanceladas: number;  // o que o GATEWAY disse
  readonly gerouRecebimento: boolean;     // o que o GATEWAY disse
  readonly confirmadoPorReadBack: boolean; // o que o BANCO mostra — a única prova
  readonly statusNfe: string | null;
  readonly avisoRespostaGateway?: string; // só quando o estado veio do read-back
}
```

---

## Faturamento

```typescript
interface FaturarInput {
  readonly nunotaPedido: number;          // NUNOTA do PEDIDO, inteiro positivo
  readonly codigoTipoOperacao: number;    // TOP (ex.: 1101), inteiro positivo
  readonly serie?: string;                // default '1' (M49)
}

type FaturarMotivo = 'FATURADO' | 'JA_FATURADO' | 'NAO_PENDENTE';

interface FaturarResult {
  readonly faturado: boolean;             // true SÓ quando esta chamada gerou a nota
  readonly nunotaNota: number | null;     // lida em TGFVAR, nunca no HTTP 200
  readonly motivo: FaturarMotivo;
}

interface VarLinha {
  readonly nunota: number;                // a 1101 gerada
  readonly sequencia: number;
  readonly sequenciaOrig: number;
  readonly qtdAtendida: number;           // pode ser fracionária
}
```

---

## Conferencia

```typescript
interface CarimbarSeparacaoInput { nunota: number; dataHora: string; nomeSeparador: string }
interface AbrirConferenciaInput  { nunota: number; codUsuConf: number; dataHora: string }
interface AbrirConferenciaResult { nuconf: number }
interface BiparInput {
  nuconf: number; seqConf: number; codProd: number;
  codVol: string; qtdConf: number; codBarra: string;
  controle: string;                       // string vazia é aceita (produto sem lote)
}
interface FecharConferenciaInput { nuconf: number; dataHora: string }
interface ApontarNaNotaInput    { nunota: number; nuconf: number }   // E1 (M107)
interface ReapontarOrigemInput  { nuconf: number; nunota: number }   // E2 (M108)
interface ConferenciaDaNota     { nuconf: number; status: string }   // 'A' | 'F' | 'D' | ...
```

Toda `dataHora` é `dd/MM/yyyy HH:mm:ss` **já formatada** — o SDK não formata data.

---

## Lotes

```typescript
interface EntradaLoteItem {
  readonly controle: string;   // TGFEST.CONTROLE, preenchido
  readonly quantidade: number; // > 0
  readonly vlrUnit: number;    // >= 0
  readonly dtVal: string;      // dd/MM/yyyy — OBRIGATÓRIA (M97)
  readonly dtFab: string;      // dd/MM/yyyy — OBRIGATÓRIA (M97)
}

interface EntradaLoteInput {
  readonly codEmp: number; readonly codLocal: number; readonly codProd: number;
  readonly dtNeg: string; readonly observacao: string;
  readonly itens: ReadonlyArray<EntradaLoteItem>;
}

interface BaixaLoteItem {
  readonly codLocal: number;
  readonly quantidade: number;
  readonly controle?: string;  // ou TODOS informam, ou NENHUM (M92)
}

interface BaixaLoteInput {
  readonly codEmp: number; readonly codProd: number;
  readonly dtNeg: string; readonly observacao: string;
  readonly itens: ReadonlyArray<BaixaLoteItem>;
}

interface NotaDeLoteResult { readonly nunota: number }  // nunca inventado: ausente lança
```

---

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

### `CircuitOpenError`

Breaker local aberto — o servidor **não** foi contatado nesta chamada.

```typescript
class CircuitOpenError extends AuthError {
  readonly code = 'CIRCUIT_OPEN';
  readonly retryAfterMs: number;   // ms estimados até o breaker reabrir
}
```

> `isAuthError()` também devolve `true` para `CircuitOpenError` (retrocompat) — cheque
> `isCircuitOpenError()` **antes**.

### `SankhyaErrorCode` — e por que ela NÃO é exaustiva

```typescript
type SankhyaErrorCode =
  | 'AUTH_ERROR' | 'API_ERROR' | 'GATEWAY_ERROR' | 'TIMEOUT_ERROR' | 'CIRCUIT_OPEN';
```

Estes são os códigos das **classes** de erro. Mas `SankhyaError` aceita qualquer string em
`code`, e o SDK lança hoje **17** valores diferentes. Os 12 abaixo estão **fora da união
tipada** — consolidação prevista, ainda não feita (D-07/D-09):

| Código | Onde nasce | Significa |
|---|---|---|
| `VALIDATION_ERROR` | todos os resources | entrada recusada **antes da rede** |
| `PARSE_ERROR` | `estoque`, `produtos`, `dataset`, `notas` | coluna numérica vazia ou não numérica — `0` seria conclusão errada |
| `NOT_FOUND` | REST v1 | recurso inexistente |
| `PRODUCTION_BLOCKED` | `assertAllowedHost` | host de produção sem `allowProduction: true` |
| `METADATA_INVALID_INPUT`, `METADATA_EMPTY` | `metadata` | entrada inválida / metadata vazia |
| `DB_EXPLORER_ROW_MISMATCH` | `dbExplorer.query` | linha com nº de colunas ≠ `fieldsMetadata` |
| `DATASET_SAVE_MALFORMED_RESPONSE` | `dataset.save` | resposta sem `total`/`result` utilizável, ou célula em forma não prevista |
| `CANCELAR_NOTA_READ_BACK_INDISPONIVEL` | `notas.cancelar` | o read-back falhou **depois** do comando enviado |
| `CANCELAR_NOTA_DESFECHO_INDETERMINADO` | `notas.cancelar` | sem resposta do gateway **e** sem linha em `TGFCAN` |
| `FATURAR_DESFECHO_INDETERMINADO` | `faturamento.faturar` | o ERP aceitou/recusou e `TGFVAR` não mostra nota |
| `FATURAR_VAR_INVALIDA` | `faturamento.consultarVar` | coluna de `TGFVAR` não utilizável |
| `CONFERENCIA_SEM_CARIMBO` | `conferencia.abrir` | nota sem `AD_DTHRSEPARACAO` (M76) |
| `CONFERENCIA_DUPLICADA` | `conferencia.abrir` | a nota já tem conferência (M110) |
| `CONFERENCIA_NUCONF_AUSENTE` | `conferencia.abrir` | o `save` não devolveu NUCONF utilizável |
| `CONFERENCIA_NUCONF_INVALIDO` | `conferencia.listarPorNota` | `TGFCON2` devolveu NUCONF não utilizável |
| `LOTES_NUNOTA_AUSENTE` | `lotes.entrada1813` / `baixa1811` | o `save` não devolveu o NUNOTA |

> **Compare `err.code` como string.** Um `switch` exaustivo sobre `SankhyaErrorCode` não
> cobre nada disso, e o TypeScript não vai avisar.

> **`INCOMPLETE_READ` não existe.** RD-5 previu o código para leitura paginada truncada,
> mas a paginação que o motivava (`produtos.volumesProduto`) deixou de existir com RD-7.
> Nenhum caminho do SDK o emite hoje.

### `SankhyaFailureKind`

Não é código de erro: é a **camada** da falha, devolvida por `classifyFailure(err)`.

```typescript
type SankhyaFailureKind = 'AUTH_FAIL' | 'NEGOCIO' | 'TIMEOUT';
```

- `AUTH_FAIL` — credencial/breaker; o passo não chegou a ser aceito, retry é seguro.
- `NEGOCIO` — o ERP entendeu e recusou; **TERMINAL**, nunca retry.
- `TIMEOUT` — desfecho **desconhecido**; decide por read-back, jamais por suposição (R8).
  HTTP **408**, 429 e 5xx caem aqui, e falha que não se sabe classificar também:
  desconhecido nunca é terminal.

Tabela completa em [cliente-sdk.md](./cliente-sdk.md#classificar-uma-falha--classifyfailure).
