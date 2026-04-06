# External Integrations

**Analysis Date:** 2026-04-06

## APIs & External Services

**Sankhya ERP (Primary Integration):**
- **REST v1 API** - Synchronous endpoint operations (Products, Clients, Sellers, Prices, Stock, Orders, Financial, Cadastros)
  - SDK/Client: Native Fetch + custom `HttpClient` in `src/core/http.ts`
  - Auth: OAuth 2.0 Bearer token from `/authenticate` endpoint
  - Base URL: `SANKHYA_BASE_URL` environment variable (typically https://api.sankhya.com.br)
  - Version: `/v1` prefix for all REST endpoints
  - Timeout: Configurable via `SankhyaConfig.timeout` (default 30s)

- **Gateway API** - Complex CRUD and business logic (loadRecords, loadRecord, saveRecord via CRUDServiceProvider)
  - SDK/Client: `src/resources/gateway.ts` wrapping `gatewayCall()` in `HttpClient`
  - Module: `mge` (Management module)
  - Service: `CRUDServiceProvider.loadRecords`, `CRUDServiceProvider.loadRecord`, `CRUDServiceProvider.saveRecord`
  - Query Params: `serviceName`, `outputType=json` required
  - Request Format: `{ requestBody: { dataSet: {...} } }` wrapper mandatory
  - Response: Indexed field format (f0, f1, f2...) mapped via metadata

- **Authentication Endpoint**
  - Endpoint: `POST {baseUrl}/authenticate`
  - Grant Type: `client_credentials`
  - Credentials: `client_id`, `client_secret`, `X-Token` header
  - Response: OAuth 2.0 token response with `access_token`, `expires_in`, `token_type`
  - Implementation: `src/core/auth.ts` (AuthManager class)

## REST v1 Endpoints (55 operations across 10 resources)

**Clientes (5 methods):**
- `GET /v1/parceiros/clientes` - List clients with pagination
- `POST /v1/parceiros/clientes` - Create client
- `PUT /v1/parceiros/clientes/{codigoCliente}` - Update client
- `POST /v1/parceiros/clientes/{codigoCliente}/contatos` - Add contact
- `PUT /v1/parceiros/clientes/{codigoCliente}/contatos/{codigoContato}` - Update contact

**Vendedores (2 methods):**
- `GET /v1/vendedores` - List sellers
- `GET /v1/vendedores/{codigoVendedor}` - Get seller by code

**Produtos (9 methods):**
- `GET /v1/produtos` - List products (paginated)
- `GET /v1/produtos/{codigoProduto}` - Get product by code
- `GET /v1/produtos/{codigoProduto}/componentes` - Product components/BOM
- `GET /v1/produtos/{codigoProduto}/alternativos` - Alternative products
- `GET /v1/produtos/{codigoProduto}/volumes` - Volume configurations
- `GET /v1/grupos-produto` - List product groups
- `GET /v1/grupos-produto/{codigoGrupo}` - Get product group by code
- `POST /v1/produtos` - Create product
- `PUT /v1/produtos/{codigoProduto}` - Update product

**Preços (4 methods):**
- `GET /v1/precos/tabelas` - List price tables
- `GET /v1/precos/tabela/{codigoTabelaPreco}` - Get prices by table (paginated)
- `POST /v1/precos/contextualizado` - Contextualized price calculation (business rules applied)
- `GET /v1/precos/{codigoProduto}/{codigoTabelaPreco}` - Get product price by table

**Estoque (5 methods):**
- `GET /v1/estoque` - List stock by product
- `GET /v1/estoque/{codigoProduto}` - Get stock by product code
- `GET /v1/estoque/locais` - List storage locations
- `GET /v1/estoque/locais/{codigoLocal}` - Get location by code
- `GET /v1/estoque/movimentacao` - Stock movement history (paginated)

**Pedidos (9 methods):**
- `GET /v1/vendas/pedidos` - List sales orders
- `GET /v1/vendas/pedidos/{codigoPedido}` - Get order by code
- `POST /v1/vendas/pedidos` - Create sales order
- `PUT /v1/vendas/pedidos/{codigoPedido}` - Update sales order
- `DELETE /v1/vendas/pedidos/{codigoPedido}` - Delete sales order (draft only)
- `POST /v1/vendas/pedidos/{codigoPedido}/confirmar` - Confirm order (triggers workflow)
- `POST /v1/vendas/pedidos/{codigoPedido}/faturar` - Invoice order
- `POST /v1/vendas/pedidos/{codigoPedido}/cancelar` - Cancel order
- `POST /v1/vendas/pedidos/{codigoPedido}/desfazer-confirmacao` - Undo confirmation

**Financeiros (13 methods):**
- `GET /v1/financeiros/receitas` - List receipts with filters (date range, status)
- `GET /v1/financeiros/despesas` - List expenses
- `GET /v1/financeiros/movimentacao` - Financial movement history
- `GET /v1/financeiros/tipos-pagamento` - List payment types
- `GET /v1/financeiros/moedas` - List currencies
- `GET /v1/financeiros/contas-bancaria` - List bank accounts
- `POST /v1/financeiros/receitas` - Create receipt
- `POST /v1/financeiros/despesas` - Create expense
- `PUT /v1/financeiros/receitas/{codigoReceita}` - Update receipt
- `PUT /v1/financeiros/despesas/{codigoDespesa}` - Update expense
- `DELETE /v1/financeiros/receitas/{codigoReceita}` - Delete receipt
- `DELETE /v1/financeiros/despesas/{codigoDespesa}` - Delete expense
- `POST /v1/financeiros/receitas/{codigoReceita}/cancelar` - Cancel receipt

**Cadastros (11 methods):**
- `GET /v1/tipos-operacao` - List operation types (TOP)
- `GET /v1/naturezas` - List natures (fiscal classification)
- `GET /v1/projetos` - List projects
- `GET /v1/centros-resultado` - List cost/profit centers
- `GET /v1/empresas` - List companies
- `GET /v1/usuarios` - List users
- `POST /v1/tipos-operacao` - Create operation type
- `POST /v1/naturezas` - Create nature
- `POST /v1/projetos` - Create project
- `POST /v1/centros-resultado` - Create cost/profit center
- `POST /v1/empresas` - Create company

**Fiscal (2 methods):**
- `POST /v1/fiscal/impostos/calculo` - Calculate taxes (ICMS, PIS, COFINS, IPI)
- `POST /v1/fiscal/servicos-tomados/nfse` - Import NFS-e (service invoice)

## Gateway Endpoints (12 operations)

**CRUDServiceProvider (Generic operations on any entity):**

**loadRecords:**
- Service: `CRUDServiceProvider.loadRecords`
- Purpose: Query multiple records with criteria, fields, pagination
- Supports: Criteria expressions with parameters, offset pagination, presentation fields
- Entity types: TGFPRO (Products), TGFCLI (Clients), TGFEST (Stock), TGF_PEDV (Orders), TGF_RECB (Receipts), TGF_DESP (Expenses), TGFVND (Sellers), etc.

**loadRecord:**
- Service: `CRUDServiceProvider.loadRecord`
- Purpose: Query single record by primary key
- Parameters: rootEntity, primaryKey object, fields, includePresentationFields
- Returns: Single record or null if not found

**saveRecord:**
- Service: `CRUDServiceProvider.saveRecord`
- Purpose: Insert or update single record (upsert by primary key)
- Parameters: rootEntity, field values, fieldset
- Returns: Saved record with system-generated fields (codes, timestamps)

## Authentication & Identity

**Auth Provider:**
- Sankhya OAuth 2.0 (v2+ from 2026-04-30, v1 auth deprecated)
- Implementation: `src/core/auth.ts` (AuthManager)
- Grant Type: Client Credentials flow (server-to-server)
- Credentials Required:
  - `clientId` - OAuth client ID
  - `clientSecret` - OAuth client secret
  - `xToken` - Additional security token (Sankhya requirement, sent with every request)

**Token Management:**
- Token cache: Pluggable `TokenCacheProvider` interface (memory default)
- Memory cache: In-process token storage with expiration (60s safety margin)
- External cache: Implement `TokenCacheProvider` for Redis/distributed caching
- Auto-refresh: Mutex-protected token refresh on expiration or 401 response
- Invalidation: `client.invalidateToken()` forces token refresh on next request

**Custom Logger Support:**
- Interface: `Logger` in `src/types/config.ts`
- Provider: `LoggerOptions.custom` injection in `SankhyaConfig`
- Default: Console-based logger with level filtering (debug/info/warn/error/silent)

## Data Storage

**Databases:**
- None - SDK is stateless, queries only Sankhya APIs
- Client's responsibility: Data persistence handled externally

**File Storage:**
- None - SDK does not handle file uploads/downloads
- NFS-e documents: Via fiscal endpoints (metadata only, files via separate mechanism)

**Caching:**
- In-memory token cache (default) - Session-scoped, cleared on process restart
- Pluggable token cache - Implement `TokenCacheProvider` for Redis/distributed storage
- No response caching (stateless per-request pattern)

## Monitoring & Observability

**Error Tracking:**
- Not integrated - Custom error handling required
- Error types exported: `SankhyaError`, `AuthError`, `ApiError`, `GatewayError`, `TimeoutError` in `src/core/errors.ts`
- Gateway errors: Detected on HTTP 200 with `status='0'` (non-standard error pattern)

**Logs:**
- Approach: Injected logger (console.log default, or custom implementation)
- Log levels: debug, info, warn, error, silent
- Implementation: `src/core/logger.ts` (createLogger factory)
- Common log events: Authentication, token refresh, API requests, timeouts, retries

## CI/CD & Deployment

**Hosting:**
- Not applicable - SDK is npm package (published to npm registry)
- Target environments: Node.js 20+ applications consuming the SDK

**CI Pipeline:**
- Not configured (can be added)
- Build: `npm run build` → ESM + CJS bundles to `dist/`
- Test: `npm run test` → Vitest runner
- Lint: `npm run lint` → Biome static analysis
- Coverage: `npm run test:coverage` → Vitest coverage report

**Publishing:**
- Package: `sankhya-sales-sdk` on npm
- Version: 0.1.0 (current)
- Files published: `dist/` directory only (configured in package.json `files` field)

## Webhooks & Callbacks

**Incoming:**
- Not supported - SDK initiates requests only

**Outgoing:**
- Not applicable - SDK does not make callbacks

## Request/Response Patterns

**REST v1 Response Format:**
```json
{
  "[resource_key]": [...],
  "pagination": { "page": "0", "offset": "0", "total": "50", "hasMore": "true" }
}
```
- Resource key varies: `produtos`, `clientes`, `vendedores`, `estoque`, etc.
- Pagination values are strings (parsed by `normalizeRestPagination()`)
- Parsing: `extractRestData()` + `normalizeRestPagination()` in `src/core/pagination.ts`

**Gateway Response Format:**
```json
{
  "entities": {
    "total": "50",
    "hasMoreResult": "true",
    "offsetPage": "0",
    "metadata": { "fields": { "field": [{"name":"CODPROD"}, ...] } },
    "entity": [{ "f0": {"$":"10398"}, "f1": {"$":"MELATONINA"}, ... }]
  }
}
```
- Fields indexed as f0, f1, f2... and mapped via metadata
- Deserialization: `deserializeRows()` in `src/core/gateway-serializer.ts`
- Returns normalized: `{ rows: Record<string,string>[], totalRecords, hasMore, page }`

**Error Handling:**
- HTTP errors: Throw `ApiError` on non-2xx status
- Gateway errors: Throw `GatewayError` on `status='0'` (HTTP 200 with error flag)
- Timeout: Throw `TimeoutError` after `timeout` ms (AbortController)
- Auth errors: Throw `AuthError` on 401 or authentication failure
- Retry logic: `withRetry()` wrapper for transient errors (429, 5xx)

---

*Integration audit: 2026-04-06*
