<!-- GSD:project-start source:PROJECT.md -->
## Project

**sankhya-sales-sdk**

SDK TypeScript independente para as APIs comerciais do Sankhya ERP, focado em vendas B2B. Expoe CRUD completo (consulta, criacao, atualizacao, cancelamento) para todos os dominios de vendas via REST v1 e Gateway. Pacote npm publico para a comunidade Sankhya.

**Core Value:** Qualquer desenvolvedor Node.js consegue integrar com o Sankhya ERP sem precisar estudar a documentacao da API — o SDK abstrai as peculiaridades (formatos Gateway, paginacao inconsistente, campos string-tipados) e entrega tipos seguros e metodos intuitivos.

### Constraints

- **Runtime**: Node 20+ (fetch nativo, sem polyfills)
- **Zero deps**: Nenhuma dependencia de runtime (apenas devDeps)
- **Versao Sankhya**: >= 4.34
- **Auth**: OAuth 2.0 exclusivo (legado descontinuado)
- **Qualidade**: Zero `any`, strict TypeScript, >= 90% coverage
- **Publish**: npm publico, ESM + CJS dual export
<!-- GSD:project-end -->

<!-- GSD:stack-start source:codebase/STACK.md -->
## Technology Stack

## Languages
- TypeScript 5.8 - SDK implementation, type-safe API client
- JavaScript (generated) - Dual CJS/ESM output bundles
## Runtime
- Node.js >= 20.0.0 - Required runtime
- npm - Package management
- Lockfile: present (`package-lock.json`)
## Frameworks
- tsup 8.3.0 - Build bundler (ES modules + CommonJS dual format)
- Vitest 3.0.0 - Test framework and runner
- Biome 1.9.0 - Linter and formatter (replaces Prettier + ESLint)
- Vitest 3.0.0 - Unit and integration test runner
- Vitest config: `vitest.config.ts` with test timeout 30s, node environment
- TypeScript 5.8 - Strict type checking (strict mode enabled)
- tsup - Zero-config bundler with sourcemaps, dual format output
## Key Dependencies
- Native Fetch API - HTTP client (no axios/node-fetch dependency)
- Node.js native AbortController - Request cancellation/timeout handling
- URLSearchParams - URL query parameter building (native)
- JSON.stringify/parse - Serialization (native)
## Configuration
- Loaded from `.env` file via `vitest.config.ts` environment loader
- Supports optional token cache provider injection (memory default)
- Custom logger support (console.log/warn/error default)
- `SANKHYA_BASE_URL` - API base URL (e.g., https://api.sankhya.com.br)
- `SANKHYA_CLIENT_ID` - OAuth 2.0 client ID
- `SANKHYA_CLIENT_SECRET` - OAuth 2.0 client secret
- `SANKHYA_X_TOKEN` - Additional security token (Sankhya requirement)
- `tsconfig.json` - Strict TS config, ES2022 target, ESNext modules, bundler resolution
- `tsup.config.ts` - Dual format (ESM/CJS), sourcemaps, declaration files (.d.ts, .d.cts)
- `biome.json` - Line width 100, single quotes, trailing commas, no-explicit-any error
## Platform Requirements
- Node.js >= 20.0.0
- TypeScript 5.0+ (for consuming projects)
- npm or compatible package manager
- Node.js >= 20.0.0
- Zero runtime dependencies (fetch native since Node 18+)
## Exports Configuration
- ESM: `dist/index.js` (default in modern bundlers)
- CJS: `dist/index.cjs` (for CommonJS consumers)
- Types: `dist/index.d.ts` / `dist/index.d.cts` dual format
## Scripts
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->
## Conventions

## Naming Patterns
- Resource files: `camelCase` with descriptive names — `clientes.ts`, `produtos.ts`, `gateway.ts`
- Type/interface files: descriptive names organized by domain — `src/types/clientes.ts`, `src/types/common.ts`
- Utility files: functional names — `auth.ts`, `http.ts`, `logger.ts`, `pagination.ts`, `retry.ts`
- Constants: `UPPER_SNAKE_CASE` — `TOKEN_CACHE_KEY`, `DEFAULT_MAX_RETRIES`, `SAFETY_MARGIN_SECONDS`
- `camelCase` — `normalizeRestPagination()`, `extractRestData()`, `withRetry()`, `invalidateToken()`
- Verbs for actions — `criar`, `listar`, `atualizar`, `incluir`, `atualizarContato()`, `invalidateToken()`
- Verb + noun pattern for clarity — `createLogger()`, `createMockAuth()`, `createHttpClient()`, `createPaginator()`
- Getters use `get` prefix — `getToken()`, `getCachedToken()`, `getHttpClient()`, `getAuthManager()`
- `camelCase` for all variables and properties — `clientId`, `baseUrl`, `xToken`, `memoryCache`, `refreshPromise`
- Boolean prefixes: `has`, `is` — `hasMore`, `isRetry`, `hasMoreResult`
- Private fields use `private` keyword with underscore prefix: `_clientes`, `_vendedores`, `_produtos`
- Constants are `UPPER_SNAKE_CASE` — `RETRYABLE_STATUS_CODES`, `DEFAULT_BASE_DELAY`
- `PascalCase` for type and interface names — `SankhyaClient`, `HttpClient`, `AuthManager`, `ClientesResource`, `PaginatedResult`
- Enums: `PascalCase` — `TipoPessoa`, `TipoVendedor`, `StatusFinanceiro`
- Input types suffix with `Input` — `CriarClienteInput`, `AtualizarClienteInput`, `PedidoVendaInput`
- Response/result types use domain name — `Cliente`, `Vendedor`, `Produto`
- Generic type parameters: single letter uppercase — `<T>`, `<T = unknown>`
- Mock prefix for test doubles — `mockLogger`, `createMockAuth()`, `mockResolvedValue()`
- Setup function pattern — `createHttpClient()`, `createLogger()`
- Spy prefix for verification — `warnSpy`, `errorSpy`, `debugSpy`, `call`, `call[0]`
## Code Style
- Tool: Biome (`biome.json`)
- Line width: 100 characters
- Indent style: 2 spaces
- Quotes: single quotes (`'`) for JavaScript strings
- Trailing commas: `all` (includes function parameters and array literals)
- Tool: Biome
- Rule set: `recommended` 
- Strict rule: `noExplicitAny: "error"` — no implicit `any` types allowed
- Enforced: camelCase, consistent naming, type safety
## Import Organization
- ES module extensions: Always use `.js` extension in imports — `from './client.js'`, `from '../core/errors.js'`
- No aliasing — use relative paths (`../`, `./`)
- Types exported separately — `export type { ... }` on dedicated lines
- Used for grouped exports — `src/resources/index.ts`, `src/types/index.ts`
- Pattern: `export { Class1 } from './file1.js'; export type { Type1 } from './file1.js';`
## Error Handling
- Custom error class hierarchy — `SankhyaError` (base), `AuthError`, `ApiError`, `GatewayError`, `TimeoutError`
- Each error type extends parent with descriptive `name` and `code` properties
- Error codes are readonly constants — `override readonly code = 'AUTH_ERROR' as const`
- Details preserved in `details` property for debugging — `constructor(..., details?: unknown)`
- Errors rethrown after specific conditions — see `HttpClient.requestWithRetry()` pattern
## Logging
- Managed through `Logger` interface defined in `src/types/config.ts`
- Levels: `debug`, `info`, `warn`, `error`, `silent` (default: `warn`)
- Creation: `createLogger(options?: LoggerOptions)` from `src/core/logger.ts`
- Prefix: all logs include `[sankhya-sdk]` prefix
- Custom logger support: can inject `{ custom: myLogger }` in config
- Debug: low-level details — `this.logger.debug('Token expirado, renovando...')`
- Info: general information — rarely used in current codebase
- Warn: recoverable issues — `this.logger.warn('Token expirado, renovando...')`
- Error: exceptions and failures — used in test verification
## Comments
- Block comments explain "why" and complex algorithms — `/**` JSDoc format
- Inline comments explain non-obvious logic — `//` format
- Do not comment obvious code — naming should be self-documenting
- Document public API, type signatures, and real API quirks
- Used for public functions and types
- Single-line format: `/** description */`
- Multi-line for complex functions:
- `src/core/pagination.ts`: Documents actual API format quirks
- `src/types/common.ts`: Explains string-valued pagination fields
- `src/core/http.ts`: Minimal comments — logic is clear from method names
- `src/client.ts`: `/** @internal */` JSDoc for private methods
## Function Design
- Prefer functions under 30 lines
- Extract retry logic, URL building, and parsing into helpers
- Single responsibility — each function does one thing well
- Typed — no implicit `any`
- Optional parameters use `?:` and provide defaults with `??` operator
- Generic types for flexibility — `<T>`, `<T = unknown>`
- Destructured in parameters when beneficial — `{ data, pagination }`
- Typed explicitly — `Promise<T>`, `PaginatedResult<Cliente>`, etc.
- Async functions return `Promise<T>`
- Generator functions use `AsyncGenerator<T>`
- Void for side-effect-only functions
## Module Design
- Named exports for all classes and functions
- Type exports: `export type { InterfaceName }`
- Value exports: `export { ClassName }`
- Re-exports from barrel files for public API
- `src/index.ts`: Primary public API
- Exports client, resources, errors, utilities, and types
- Groups related exports with comments:
- Mark with `private` keyword
- Prefix with underscore if field: `private _clientes?: ClientesResource`
- Methods: `private async getCachedToken(): Promise<string | null>`
- Internal methods documented with `/** @internal */` JSDoc
- Fields declared at top with visibility and type
- Constructor follows
- Public methods next
- Private methods at end
- Lazy-load pattern for optional properties: `this._clientes ??= new ClientesResource(...)`
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->
## Architecture

## Pattern Overview
- Client-first facade pattern (all resources accessed through `SankhyaClient`)
- Two distinct API protocols: REST v1 (JSON) and Gateway (SOAP-like with XML wrapper)
- Zero runtime dependencies (fetch-based HTTP client)
- Token-based OAuth 2.0 with optional external caching
- Consistent error hierarchy across protocols
## Layers
- Purpose: Single entry point for all API interactions; lazy-loads resource instances
- Location: `src/client.ts`
- Contains: `SankhyaClient` class with getter properties for each resource
- Depends on: Core managers (Auth, HTTP)
- Used by: Consumers of the SDK
- Purpose: Domain-specific API operations (Clientes, Produtos, Pedidos, etc.)
- Location: `src/resources/`
- Contains: 10 resource classes (`ClientesResource`, `ProdutosResource`, `PedidosResource`, etc.)
- Depends on: HttpClient for HTTP calls; pagination/serialization utilities for data handling
- Used by: Client layer exposes these as properties
- Pattern: Each resource class groups related endpoints (e.g., `ClientesResource.listar()`, `.criar()`, `.atualizar()`)
- Purpose: Unified HTTP abstraction for both REST and Gateway protocols
- Location: `src/core/http.ts`
- Contains: `HttpClient` class with methods `restGet()`, `restPost()`, `restPut()`, `gatewayCall()`
- Depends on: AuthManager for token injection, Logger for debugging
- Used by: All resource classes call HTTP methods
- Purpose: OAuth 2.0 token management with caching support
- Location: `src/core/auth.ts`
- Contains: `AuthManager` class handling token acquisition, caching, and invalidation
- Depends on: Optional `TokenCacheProvider` interface for persistent caching
- Used by: HttpClient requests token before each call
- Purpose: Protocol-specific data transformation
- Location: `src/core/gateway-serializer.ts` (Gateway format); `src/core/pagination.ts` (REST format)
- Contains: Functions `serialize()`, `deserialize()`, `deserializeRows()`, `extractRestData()`, `normalizeRestPagination()`, `normalizeGatewayPagination()`
- Depends on: Type definitions only
- Used by: Resources and HTTP layer
- Purpose: Complete TypeScript definitions for all API entities and operations
- Location: `src/types/`
- Contains: 15+ type files covering auth, common patterns, and domain models
- Depends on: None
- Used by: All other layers
## Data Flow
- Token caching: Cached in memory by default; optional external storage via `TokenCacheProvider`
- Token refresh: Automatic on 401 response; concurrent requests wait for in-progress refresh
- Logger state: Configurable level (debug, info, warn, error, silent); optional custom implementation
- Resource instances: Lazy-loaded and cached on client object (singleton pattern per resource)
## Key Abstractions
- Purpose: Encapsulate endpoint operations for a domain entity
- Examples: `src/resources/clientes.ts`, `src/resources/produtos.ts`, `src/resources/pedidos.ts`
- Pattern: Each resource class accepts `HttpClient` in constructor; public methods call HTTP methods and normalize responses
- Pagination support: `listar()` returns single page; `listarTodos()` returns async generator for full iteration
- Purpose: Infinite iteration over paginated API responses
- Examples: `clientes.listarTodos()`, `produtos.listarTodos()`
- Pattern: `createPaginator()` yields items one-by-one, fetching new pages as needed
- Location: `src/core/pagination.ts`
- Purpose: Distinguish error types for proper error handling
- Examples: `AuthError` (auth failures), `ApiError` (HTTP errors), `GatewayError` (Sankhya business errors), `TimeoutError`
- Pattern: All extend `SankhyaError` with `code` field for programmatic handling
- Location: `src/core/errors.ts`
- Purpose: Convert between simple JSON and Sankhya Gateway's nested `{ "$": value }` format
- Pattern: `serialize()` wraps values; `deserialize()` unwraps individual records; `deserializeRows()` handles full responses
- Complexity: Handles arrays, nested objects, null values
- Location: `src/core/gateway-serializer.ts`
- Purpose: Find data array in REST response (key varies by endpoint: "produtos", "clientes", "grupos", etc.)
- Pattern: `extractRestData()` scans response keys, returns first array found plus pagination metadata
- Complexity: Handles missing pagination object gracefully
- Location: `src/core/pagination.ts`
## Entry Points
- Location: `src/client.ts`
- Triggers: Application instantiation with config
- Responsibilities: Validates config, initializes AuthManager, HttpClient, and logger
- Location: Each `src/resources/*.ts`
- Triggers: Explicit method calls (e.g., `client.clientes.listar()`)
- Responsibilities: Build parameters, call HTTP, normalize response
- Location: `src/core/http.ts`
- Triggers: Called by resources
- Responsibilities: URL building, header injection, request execution, error handling
## Error Handling
- **Auth Errors:** `AuthError` thrown if token refresh fails; 401 responses trigger automatic retry
- **API Errors:** `ApiError` contains HTTP status code, endpoint path, method, and response body
- **Gateway Errors:** `GatewayError` contains Sankhya error code and level from `tsError` object
- **Timeout Errors:** `TimeoutError` thrown on AbortController timeout; caught by retry logic
- **Retry Logic:** `withRetry()` utility retries transient failures (429, 5xx, connection errors) with exponential backoff; non-retryable errors propagate immediately
## Cross-Cutting Concerns
- Approach: Injected `Logger` interface; default uses console, optional custom implementation
- Configuration: `LoggerOptions` with level (debug/info/warn/error/silent) or custom function
- Usage: Debug in HTTP layer, info on auth success, warn on token refresh
- Location: `src/core/logger.ts`
- Approach: Minimal validation in client; primary validation at resource parameter construction
- Example: `ConsultarPedidosParams` requires `codigoEmpresa`; resource passes to HTTP as query param
- Type-driven: TypeScript types ensure required fields present at compile time
- Approach: OAuth 2.0 client credentials grant
- Token obtained on first request, cached with TTL, refreshed on expiration
- Optional persistent cache for multi-process scenarios
- Location: `src/core/auth.ts`
<!-- GSD:architecture-end -->

<!-- GSD:workflow-start source:GSD defaults -->
## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd:quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd:debug` for investigation and bug fixing
- `/gsd:execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->



<!-- GSD:profile-start -->
## Developer Profile

> Profile not yet configured. Run `/gsd:profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
