# Architecture

**Analysis Date:** 2026-04-06

## Pattern Overview

**Overall:** Layered SDK with REST and Gateway dual-API abstraction

**Key Characteristics:**
- Client-first facade pattern (all resources accessed through `SankhyaClient`)
- Two distinct API protocols: REST v1 (JSON) and Gateway (SOAP-like with XML wrapper)
- Zero runtime dependencies (fetch-based HTTP client)
- Token-based OAuth 2.0 with optional external caching
- Consistent error hierarchy across protocols

## Layers

**Client Layer:**
- Purpose: Single entry point for all API interactions; lazy-loads resource instances
- Location: `src/client.ts`
- Contains: `SankhyaClient` class with getter properties for each resource
- Depends on: Core managers (Auth, HTTP)
- Used by: Consumers of the SDK

**Resource Layer:**
- Purpose: Domain-specific API operations (Clientes, Produtos, Pedidos, etc.)
- Location: `src/resources/`
- Contains: 10 resource classes (`ClientesResource`, `ProdutosResource`, `PedidosResource`, etc.)
- Depends on: HttpClient for HTTP calls; pagination/serialization utilities for data handling
- Used by: Client layer exposes these as properties
- Pattern: Each resource class groups related endpoints (e.g., `ClientesResource.listar()`, `.criar()`, `.atualizar()`)

**HTTP Transport Layer:**
- Purpose: Unified HTTP abstraction for both REST and Gateway protocols
- Location: `src/core/http.ts`
- Contains: `HttpClient` class with methods `restGet()`, `restPost()`, `restPut()`, `gatewayCall()`
- Depends on: AuthManager for token injection, Logger for debugging
- Used by: All resource classes call HTTP methods

**Authentication Layer:**
- Purpose: OAuth 2.0 token management with caching support
- Location: `src/core/auth.ts`
- Contains: `AuthManager` class handling token acquisition, caching, and invalidation
- Depends on: Optional `TokenCacheProvider` interface for persistent caching
- Used by: HttpClient requests token before each call

**Serialization/Deserialization Layer:**
- Purpose: Protocol-specific data transformation
- Location: `src/core/gateway-serializer.ts` (Gateway format); `src/core/pagination.ts` (REST format)
- Contains: Functions `serialize()`, `deserialize()`, `deserializeRows()`, `extractRestData()`, `normalizeRestPagination()`, `normalizeGatewayPagination()`
- Depends on: Type definitions only
- Used by: Resources and HTTP layer

**Type Layer:**
- Purpose: Complete TypeScript definitions for all API entities and operations
- Location: `src/types/`
- Contains: 15+ type files covering auth, common patterns, and domain models
- Depends on: None
- Used by: All other layers

## Data Flow

**REST v1 Request Flow:**

1. Resource method called (e.g., `clientes.listar()`)
2. Resource builds query parameters and calls `http.restGet('/endpoint', params)`
3. HttpClient constructs URL with `/v1` prefix, injects OAuth token and X-Token header
4. Fetch executes GET request
5. Response JSON received, `extractRestData()` locates data array (key varies by endpoint)
6. `normalizeRestPagination()` converts string pagination values to normalized format
7. Resource returns `PaginatedResult<T>`

**Gateway Request Flow:**

1. Resource method calls `http.gatewayCall(modulo, serviceName, requestBody)`
2. HttpClient constructs `/gateway/v1/{modulo}/service.sbr?serviceName=...&outputType=json`
3. Request body wrapped in `{ requestBody: {...} }` envelope
4. Fetch executes POST with OAuth token and X-Token headers
5. Response checked for `status === '0'` (error indicator in Gateway)
6. If error, throws `GatewayError` with Sankhya error details
7. If success, `responseBody` extracted and returned to resource
8. Resource may call `deserializeRows()` to convert field-indexed format to named fields

**State Management:**

- Token caching: Cached in memory by default; optional external storage via `TokenCacheProvider`
- Token refresh: Automatic on 401 response; concurrent requests wait for in-progress refresh
- Logger state: Configurable level (debug, info, warn, error, silent); optional custom implementation
- Resource instances: Lazy-loaded and cached on client object (singleton pattern per resource)

## Key Abstractions

**Resource Pattern:**
- Purpose: Encapsulate endpoint operations for a domain entity
- Examples: `src/resources/clientes.ts`, `src/resources/produtos.ts`, `src/resources/pedidos.ts`
- Pattern: Each resource class accepts `HttpClient` in constructor; public methods call HTTP methods and normalize responses
- Pagination support: `listar()` returns single page; `listarTodos()` returns async generator for full iteration

**Paginator:**
- Purpose: Infinite iteration over paginated API responses
- Examples: `clientes.listarTodos()`, `produtos.listarTodos()`
- Pattern: `createPaginator()` yields items one-by-one, fetching new pages as needed
- Location: `src/core/pagination.ts`

**Error Hierarchy:**
- Purpose: Distinguish error types for proper error handling
- Examples: `AuthError` (auth failures), `ApiError` (HTTP errors), `GatewayError` (Sankhya business errors), `TimeoutError`
- Pattern: All extend `SankhyaError` with `code` field for programmatic handling
- Location: `src/core/errors.ts`

**Gateway Serialization:**
- Purpose: Convert between simple JSON and Sankhya Gateway's nested `{ "$": value }` format
- Pattern: `serialize()` wraps values; `deserialize()` unwraps individual records; `deserializeRows()` handles full responses
- Complexity: Handles arrays, nested objects, null values
- Location: `src/core/gateway-serializer.ts`

**REST Data Extraction:**
- Purpose: Find data array in REST response (key varies by endpoint: "produtos", "clientes", "grupos", etc.)
- Pattern: `extractRestData()` scans response keys, returns first array found plus pagination metadata
- Complexity: Handles missing pagination object gracefully
- Location: `src/core/pagination.ts`

## Entry Points

**SankhyaClient Constructor:**
- Location: `src/client.ts`
- Triggers: Application instantiation with config
- Responsibilities: Validates config, initializes AuthManager, HttpClient, and logger

**Resource Methods:**
- Location: Each `src/resources/*.ts`
- Triggers: Explicit method calls (e.g., `client.clientes.listar()`)
- Responsibilities: Build parameters, call HTTP, normalize response

**HTTP Transport Methods:**
- Location: `src/core/http.ts`
- Triggers: Called by resources
- Responsibilities: URL building, header injection, request execution, error handling

## Error Handling

**Strategy:** Specific error types with protocol-aware details; retry logic for transient failures

**Patterns:**

- **Auth Errors:** `AuthError` thrown if token refresh fails; 401 responses trigger automatic retry
- **API Errors:** `ApiError` contains HTTP status code, endpoint path, method, and response body
- **Gateway Errors:** `GatewayError` contains Sankhya error code and level from `tsError` object
- **Timeout Errors:** `TimeoutError` thrown on AbortController timeout; caught by retry logic
- **Retry Logic:** `withRetry()` utility retries transient failures (429, 5xx, connection errors) with exponential backoff; non-retryable errors propagate immediately

## Cross-Cutting Concerns

**Logging:**
- Approach: Injected `Logger` interface; default uses console, optional custom implementation
- Configuration: `LoggerOptions` with level (debug/info/warn/error/silent) or custom function
- Usage: Debug in HTTP layer, info on auth success, warn on token refresh
- Location: `src/core/logger.ts`

**Validation:**
- Approach: Minimal validation in client; primary validation at resource parameter construction
- Example: `ConsultarPedidosParams` requires `codigoEmpresa`; resource passes to HTTP as query param
- Type-driven: TypeScript types ensure required fields present at compile time

**Authentication:**
- Approach: OAuth 2.0 client credentials grant
- Token obtained on first request, cached with TTL, refreshed on expiration
- Optional persistent cache for multi-process scenarios
- Location: `src/core/auth.ts`

---

*Architecture analysis: 2026-04-06*
