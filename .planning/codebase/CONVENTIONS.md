# Coding Conventions

**Analysis Date:** 2026-04-06

## Naming Patterns

**Files:**
- Resource files: `camelCase` with descriptive names — `clientes.ts`, `produtos.ts`, `gateway.ts`
- Type/interface files: descriptive names organized by domain — `src/types/clientes.ts`, `src/types/common.ts`
- Utility files: functional names — `auth.ts`, `http.ts`, `logger.ts`, `pagination.ts`, `retry.ts`
- Constants: `UPPER_SNAKE_CASE` — `TOKEN_CACHE_KEY`, `DEFAULT_MAX_RETRIES`, `SAFETY_MARGIN_SECONDS`

**Functions:**
- `camelCase` — `normalizeRestPagination()`, `extractRestData()`, `withRetry()`, `invalidateToken()`
- Verbs for actions — `criar`, `listar`, `atualizar`, `incluir`, `atualizarContato()`, `invalidateToken()`
- Verb + noun pattern for clarity — `createLogger()`, `createMockAuth()`, `createHttpClient()`, `createPaginator()`
- Getters use `get` prefix — `getToken()`, `getCachedToken()`, `getHttpClient()`, `getAuthManager()`

**Variables:**
- `camelCase` for all variables and properties — `clientId`, `baseUrl`, `xToken`, `memoryCache`, `refreshPromise`
- Boolean prefixes: `has`, `is` — `hasMore`, `isRetry`, `hasMoreResult`
- Private fields use `private` keyword with underscore prefix: `_clientes`, `_vendedores`, `_produtos`
- Constants are `UPPER_SNAKE_CASE` — `RETRYABLE_STATUS_CODES`, `DEFAULT_BASE_DELAY`

**Types and Interfaces:**
- `PascalCase` for type and interface names — `SankhyaClient`, `HttpClient`, `AuthManager`, `ClientesResource`, `PaginatedResult`
- Enums: `PascalCase` — `TipoPessoa`, `TipoVendedor`, `StatusFinanceiro`
- Input types suffix with `Input` — `CriarClienteInput`, `AtualizarClienteInput`, `PedidoVendaInput`
- Response/result types use domain name — `Cliente`, `Vendedor`, `Produto`
- Generic type parameters: single letter uppercase — `<T>`, `<T = unknown>`

**Test Variables:**
- Mock prefix for test doubles — `mockLogger`, `createMockAuth()`, `mockResolvedValue()`
- Setup function pattern — `createHttpClient()`, `createLogger()`
- Spy prefix for verification — `warnSpy`, `errorSpy`, `debugSpy`, `call`, `call[0]`

## Code Style

**Formatting:**
- Tool: Biome (`biome.json`)
- Line width: 100 characters
- Indent style: 2 spaces
- Quotes: single quotes (`'`) for JavaScript strings
- Trailing commas: `all` (includes function parameters and array literals)

**Linting:**
- Tool: Biome
- Rule set: `recommended` 
- Strict rule: `noExplicitAny: "error"` — no implicit `any` types allowed
- Enforced: camelCase, consistent naming, type safety

**Examples:**
```typescript
// Correct formatting
async function listar(params?: ListarClientesParams): Promise<PaginatedResult<Cliente>> {
  const query: Record<string, string> = { page: String(params?.page ?? 1) };
  if (params?.dataHoraAlteracao) query.dataHoraAlteracao = params.dataHoraAlteracao;
  
  const raw = await this.http.restGet<Record<string, unknown>>('/parceiros/clientes', query);
  const { data, pagination } = extractRestData<Cliente>(raw);
  return normalizeRestPagination(data, pagination);
}
```

## Import Organization

**Order:**
1. Type imports from external packages — `import type { ... } from 'vitest'`
2. Value imports from external packages — `import { defineConfig } from 'vitest/config'`
3. Type imports from local paths — `import type { Logger } from '../types/config.js'`
4. Value imports from local paths — `import { AuthError } from './errors.js'`

**Path Aliases:**
- ES module extensions: Always use `.js` extension in imports — `from './client.js'`, `from '../core/errors.js'`
- No aliasing — use relative paths (`../`, `./`)
- Types exported separately — `export type { ... }` on dedicated lines

**Barrel Files:**
- Used for grouped exports — `src/resources/index.ts`, `src/types/index.ts`
- Pattern: `export { Class1 } from './file1.js'; export type { Type1 } from './file1.js';`

## Error Handling

**Patterns:**
- Custom error class hierarchy — `SankhyaError` (base), `AuthError`, `ApiError`, `GatewayError`, `TimeoutError`
- Each error type extends parent with descriptive `name` and `code` properties
- Error codes are readonly constants — `override readonly code = 'AUTH_ERROR' as const`
- Details preserved in `details` property for debugging — `constructor(..., details?: unknown)`
- Errors rethrown after specific conditions — see `HttpClient.requestWithRetry()` pattern

**Example from `src/core/errors.ts`:**
```typescript
export class ApiError extends SankhyaError {
  override readonly code = 'API_ERROR' as const;
  readonly endpoint: string;
  readonly method: string;

  constructor(
    message: string,
    endpoint: string,
    method: string,
    statusCode?: number,
    details?: unknown,
  ) {
    super(message, 'API_ERROR', statusCode, details);
    this.name = 'ApiError';
    this.endpoint = endpoint;
    this.method = method;
  }
}
```

## Logging

**Framework:** `console` (no external logger)

**Patterns:**
- Managed through `Logger` interface defined in `src/types/config.ts`
- Levels: `debug`, `info`, `warn`, `error`, `silent` (default: `warn`)
- Creation: `createLogger(options?: LoggerOptions)` from `src/core/logger.ts`
- Prefix: all logs include `[sankhya-sdk]` prefix
- Custom logger support: can inject `{ custom: myLogger }` in config

**Usage:**
- Debug: low-level details — `this.logger.debug('Token expirado, renovando...')`
- Info: general information — rarely used in current codebase
- Warn: recoverable issues — `this.logger.warn('Token expirado, renovando...')`
- Error: exceptions and failures — used in test verification

**Example from `src/core/logger.ts`:**
```typescript
const noop = () => {};
const prefix = '[sankhya-sdk]';

return {
  debug: threshold <= LOG_LEVELS.debug
    ? (message: string, ...args: unknown[]) => console.debug(prefix, message, ...args)
    : noop,
  // ...
};
```

## Comments

**When to Comment:**
- Block comments explain "why" and complex algorithms — `/**` JSDoc format
- Inline comments explain non-obvious logic — `//` format
- Do not comment obvious code — naming should be self-documenting
- Document public API, type signatures, and real API quirks

**JSDoc/TSDoc:**
- Used for public functions and types
- Single-line format: `/** description */`
- Multi-line for complex functions:
  ```typescript
  /**
   * Normaliza resposta REST v1 para PaginatedResult.
   *
   * Formato real da API:
   * { "[resource]": [...], "pagination": { "page": "0", ... } }
   */
  ```

**Examples from codebase:**
- `src/core/pagination.ts`: Documents actual API format quirks
- `src/types/common.ts`: Explains string-valued pagination fields
- `src/core/http.ts`: Minimal comments — logic is clear from method names
- `src/client.ts`: `/** @internal */` JSDoc for private methods

## Function Design

**Size:** 
- Prefer functions under 30 lines
- Extract retry logic, URL building, and parsing into helpers
- Single responsibility — each function does one thing well

**Parameters:** 
- Typed — no implicit `any`
- Optional parameters use `?:` and provide defaults with `??` operator
- Generic types for flexibility — `<T>`, `<T = unknown>`
- Destructured in parameters when beneficial — `{ data, pagination }`

**Return Values:** 
- Typed explicitly — `Promise<T>`, `PaginatedResult<Cliente>`, etc.
- Async functions return `Promise<T>`
- Generator functions use `AsyncGenerator<T>`
- Void for side-effect-only functions

**Example from `src/resources/clientes.ts`:**
```typescript
async listar(params?: ListarClientesParams): Promise<PaginatedResult<Cliente>> {
  const query: Record<string, string> = { page: String(params?.page ?? 1) };
  if (params?.dataHoraAlteracao) query.dataHoraAlteracao = params.dataHoraAlteracao;

  const raw = await this.http.restGet<Record<string, unknown>>('/parceiros/clientes', query);
  const { data, pagination } = extractRestData<Cliente>(raw);
  return normalizeRestPagination(data, pagination);
}

listarTodos(params?: Omit<ListarClientesParams, 'page'>): AsyncGenerator<Cliente> {
  return createPaginator((page) => this.listar({ ...params, page }), 1);
}
```

## Module Design

**Exports:** 
- Named exports for all classes and functions
- Type exports: `export type { InterfaceName }`
- Value exports: `export { ClassName }`
- Re-exports from barrel files for public API

**Barrel Files:** 
- `src/index.ts`: Primary public API
- Exports client, resources, errors, utilities, and types
- Groups related exports with comments:
  ```typescript
  // Client
  export { SankhyaClient } from './client.js';

  // Resources
  export { ClientesResource, ... } from './resources/index.js';

  // Errors
  export { SankhyaError, ... } from './core/errors.js';
  ```

**Private Methods:**
- Mark with `private` keyword
- Prefix with underscore if field: `private _clientes?: ClientesResource`
- Methods: `private async getCachedToken(): Promise<string | null>`
- Internal methods documented with `/** @internal */` JSDoc

**Class Structure:**
- Fields declared at top with visibility and type
- Constructor follows
- Public methods next
- Private methods at end
- Lazy-load pattern for optional properties: `this._clientes ??= new ClientesResource(...)`

---

*Convention analysis: 2026-04-06*
