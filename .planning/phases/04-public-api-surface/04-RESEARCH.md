# Phase 4: Public API Surface - Research

**Researched:** 2026-04-06
**Domain:** TypeScript public API design, type guards, export auditing, idempotency patterns
**Confidence:** HIGH

## Summary

Phase 4 polishes the public-facing API of sankhya-sales-sdk before v1.0.0. The work is purely code/config-level: adding type guard functions for the error hierarchy, extracting a `SankhyaErrorCode` union type, ensuring every paginated resource exposes `listarTodos()`, wiring idempotency key support into mutation methods, adding per-call timeout overrides via `RequestOptions`, and auditing `src/index.ts` to stop leaking internal utilities.

The codebase is well-structured for these changes. The error hierarchy already uses `as const` code overrides per class, making type guards straightforward. Three resources already implement `listarTodos()` (clientes, vendedores, produtos, estoque), leaving pedidos, financeiros, cadastros, precos as gaps. The `HttpClient` already accepts a timeout in the constructor but has no per-call override mechanism; adding `RequestOptions` requires threading an optional parameter through `restGet`, `restPost`, `restPut`, and `gatewayCall`.

**Primary recommendation:** Implement in three plans: (1) type guards + error code union + export audit, (2) listarTodos() gap fill + RequestOptions per-call timeout, (3) idempotency key support for pedidos/financeiros mutations.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| APIS-01 | Type guard helpers exported: isSankhyaError(), isAuthError(), isApiError(), isGatewayError(), isTimeoutError() | Error hierarchy uses instanceof + as const codes; type guards are trivial. See Architecture Patterns. |
| APIS-02 | Union type SankhyaErrorCode exported with all possible error codes | Four concrete codes exist (`AUTH_ERROR`, `API_ERROR`, `GATEWAY_ERROR`, `TIMEOUT_ERROR`). Extract as union from existing classes. |
| APIS-03 | listarTodos() AsyncGenerator on all resources with paginated listing | 4 of 8 paginated resources already have it. Gap: pedidos, financeiros (receitas, despesas, tiposPagamento, moedas), cadastros (6 sub-resources), precos (porTabela). |
| APIS-04 | Mutations in pedidos and financeiros accept optional idempotencyKey | HttpClient needs to forward `X-Idempotency-Key` header when provided. Resource methods accept it via options parameter. |
| APIS-05 | Internal utilities marked @internal and excluded from public type surface | Currently `src/index.ts` exports withRetry, createPaginator, deserializeRows, serialize, deserialize, and other internals. Must remove from index.ts. |
| APIS-06 | Per-call timeout override via RequestOptions | HttpClient.requestWithRetry uses constructor timeout. Add optional `RequestOptions` parameter with `timeout?: number` and `signal?: AbortSignal`. |
</phase_requirements>

## Standard Stack

No new dependencies required. All work uses existing TypeScript features.

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| TypeScript | 5.8 | Type guards, discriminated unions, `as const` | Already in project |
| Vitest | 3.0 | Unit tests for type guards and new methods | Already in project |

### Supporting
No additional libraries needed. This phase is pure TypeScript refactoring.

## Architecture Patterns

### Pattern 1: Type Guard Functions

**What:** Functions that narrow `unknown` to specific error types using `instanceof`.
**When to use:** For every error class in the hierarchy.

```typescript
// src/core/errors.ts — add at bottom
export function isSankhyaError(err: unknown): err is SankhyaError {
  return err instanceof SankhyaError;
}

export function isAuthError(err: unknown): err is AuthError {
  return err instanceof AuthError;
}

export function isApiError(err: unknown): err is ApiError {
  return err instanceof ApiError;
}

export function isGatewayError(err: unknown): err is GatewayError {
  return err instanceof GatewayError;
}

export function isTimeoutError(err: unknown): err is TimeoutError {
  return err instanceof TimeoutError;
}
```

**Why `instanceof` over duck-typing:** The SDK ships as a single package. CJS/ESM dual-build uses the same class definitions (tsup bundles both from one source). `instanceof` is reliable within a single package. Duck-typing adds unnecessary complexity.

**Edge case to test:** `instanceof` across CJS/ESM boundaries within the SAME package works because tsup re-exports from the same module graph. This will be verified in Phase 5 (TEST-04, TEST-05).

### Pattern 2: SankhyaErrorCode Union Type

**What:** A union type extracted from the error classes' `code` properties.

```typescript
// src/core/errors.ts
export type SankhyaErrorCode =
  | typeof AuthError.prototype.code
  | typeof ApiError.prototype.code
  | typeof GatewayError.prototype.code
  | typeof TimeoutError.prototype.code;
// Resolves to: 'AUTH_ERROR' | 'API_ERROR' | 'GATEWAY_ERROR' | 'TIMEOUT_ERROR'
```

Alternative (simpler, equally valid since codes are known constants):
```typescript
export type SankhyaErrorCode = 'AUTH_ERROR' | 'API_ERROR' | 'GATEWAY_ERROR' | 'TIMEOUT_ERROR';
```

**Recommendation:** Use the explicit string literal union. It is self-documenting, works with `switch` exhaustiveness checking, and does not depend on class prototype access patterns.

### Pattern 3: RequestOptions for Per-Call Overrides

**What:** An options bag threaded through resource methods to HttpClient.

```typescript
// src/types/config.ts
export interface RequestOptions {
  /** Override default timeout for this request (ms) */
  timeout?: number;
  /** External AbortSignal for cancellation */
  signal?: AbortSignal;
}
```

**Threading through HttpClient:**

```typescript
// src/core/http.ts — modify method signatures
async restGet<T>(path: string, params?: Record<string, string>, options?: RequestOptions): Promise<T>
async restPost<T>(path: string, body: unknown, options?: RequestOptions): Promise<T>
async restPut<T>(path: string, body: unknown, options?: RequestOptions): Promise<T>
async gatewayCall<T>(modulo: string, serviceName: string, requestBody: Record<string, unknown>, options?: RequestOptions): Promise<T>
```

**In requestWithRetry:** Use `options?.timeout ?? this.timeout` for the AbortController timeout. If `options?.signal` is provided, combine with internal timeout signal using `AbortSignal.any()` (available in Node 20+).

### Pattern 4: Idempotency Key Header

**What:** Forward `X-Idempotency-Key` header on mutation requests when provided.

```typescript
// In HttpClient.requestWithRetry, when building headers:
if (options?.idempotencyKey) {
  headers['X-Idempotency-Key'] = options.idempotencyKey;
}
```

**Extend RequestOptions:**
```typescript
export interface RequestOptions {
  timeout?: number;
  signal?: AbortSignal;
  /** Idempotency key for mutation safety (forwarded as X-Idempotency-Key header) */
  idempotencyKey?: string;
}
```

**Resource-level API:** Mutation methods on pedidos and financeiros accept `options?: RequestOptions` as the last parameter.

```typescript
// pedidos.ts
async criar(pedido: PedidoVendaInput, options?: RequestOptions): Promise<{ codigoPedido: number }>
async atualizar(codigoPedido: number, pedido: PedidoVendaInput, options?: RequestOptions): Promise<{ codigoPedido: number }>

// financeiros.ts
async registrarReceita(dados: RegistrarReceitaInput, options?: RequestOptions): Promise<RegistrarFinanceiroResponse>
async registrarDespesa(dados: RegistrarDespesaInput, options?: RequestOptions): Promise<RegistrarFinanceiroResponse>
```

**Note on Sankhya API support:** The Sankhya REST v1 API does not document `X-Idempotency-Key` header support. The SDK will forward it — if the server ignores it, there is no harm. If Sankhya adds support later, SDK consumers are already wired. The header is a best-practice passthrough.

### Pattern 5: Export Audit (APIS-05)

**Current state of `src/index.ts`** — these internal utilities are currently exported and MUST be removed:

| Export | Why Internal |
|--------|-------------|
| `createLogger` | SDK internal — consumers pass logger config to SankhyaClient |
| `serialize` | Gateway protocol detail |
| `deserialize` | Gateway protocol detail |
| `deserializeRows` | Gateway protocol detail |
| `normalizeRestPagination` | Internal pagination helper |
| `normalizeGatewayPagination` | Internal pagination helper |
| `extractRestData` | Internal REST response parser |
| `createPaginator` | Internal pagination iterator factory |
| `withRetry` | Internal retry utility |
| `toSankhyaDate` | Internal date formatter |
| `toSankhyaDateTime` | Internal date formatter |
| `toISODate` | Internal date formatter |
| `FetchPage` type | Internal pagination type |
| `RetryOptions` type | Internal retry type |

**Keep exported:** `SankhyaClient`, all Resource classes, all Error classes + type guards + SankhyaErrorCode, all domain types/interfaces/enums, `SankhyaConfig`, `TokenCacheProvider`, `LoggerOptions`, `Logger`, `LogLevel`, `RequestOptions`, `PaginatedResult`, `PaginationParams`.

**Decision point:** Date utilities (`toSankhyaDate`, `toSankhyaDateTime`, `toISODate`) could be useful to consumers formatting dates for filter params. However, APIS-05 specifically lists them as internal utilities to exclude. Recommendation: remove from public exports but add a note in Phase 6 docs that date strings follow `DD/MM/YYYY` (Sankhya format) and `YYYY-MM-DD` (ISO).

### Pattern 6: listarTodos() Gap Analysis

**Already implemented:**
- `ClientesResource.listarTodos()` -- page starts at 1
- `VendedoresResource.listarTodos()` -- page starts at 0
- `ProdutosResource.listarTodos()` -- page starts at 0
- `EstoqueResource.listarTodos()` -- page starts at 0

**Missing — need to add:**
- `PedidosResource.consultarTodos(params: Omit<ConsultarPedidosParams, 'page'>)` -- wraps `consultar()`
- `FinanceirosResource.listarTodosTiposPagamento()` -- wraps `listarTiposPagamento()`
- `FinanceirosResource.listarTodasDespesas()` -- wraps `listarDespesas()` (listarTodasReceitas already exists)
- `FinanceirosResource.listarTodasMoedas()` -- wraps `listarMoedas()`
- `CadastrosResource.listarTodosTiposOperacao()` -- wraps `listarTiposOperacao()`
- `CadastrosResource.listarTodasNaturezas()` -- wraps `listarNaturezas()`
- `CadastrosResource.listarTodosProjetos()` -- wraps `listarProjetos()`
- `CadastrosResource.listarTodosCentrosResultado()` -- wraps `listarCentrosResultado()`
- `CadastrosResource.listarTodasEmpresas()` -- wraps `listarEmpresas()`
- `PrecosResource.todosPorTabela(params: Omit<PrecosPorTabelaParams, 'pagina'>)` -- wraps `porTabela()`

**Not applicable (no pagination):**
- `FiscalResource` -- no list methods
- `GatewayResource` -- generic, consumer controls pagination
- `PrecosResource.contextualizado()` -- POST, not paginated
- `CadastrosResource.listarUsuarios()` -- returns flat array, no pagination
- `FinanceirosResource.listarContasBancarias()` -- returns flat array, no pagination

**Naming convention:** Follow existing pattern: `listarTodos` / `listarTodas` (gender agreement in Portuguese). For pedidos, use `consultarTodos` to match the base method name `consultar`.

### Anti-Patterns to Avoid

- **Exporting internal helpers "just in case":** Every export is a public API contract. Once shipped in v1.0.0, removing it is a breaking change. Be aggressive about hiding internals.
- **Adding idempotencyKey to the domain input types (e.g., PedidoVendaInput):** This is a transport concern, not a domain concern. It belongs in `RequestOptions`, not in the business payload.
- **Separate `options` parameter per feature:** Don't create `TimeoutOptions`, `IdempotencyOptions`, etc. One `RequestOptions` bag handles all per-call overrides.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| AbortSignal combining | Custom signal merge logic | `AbortSignal.any([...signals])` | Node 20+ native, handles cleanup |
| Type narrowing | String-based code checks | `instanceof` type guards | TypeScript narrows automatically, IDE autocomplete works |
| Exhaustive switch | Manual default with throw | `satisfies never` pattern | Compile-time exhaustiveness check |

## Common Pitfalls

### Pitfall 1: Breaking Existing Tests When Removing Exports
**What goes wrong:** Removing exports from `src/index.ts` may break existing tests that import internal utilities directly from the package index.
**Why it happens:** Tests often import from the public API barrel file.
**How to avoid:** Check all test imports. Tests should import internals directly from source files (`../src/core/pagination.js`), not from the public barrel (`../src/index.js`).
**Warning signs:** `grep -r "from.*index" tests/` shows imports of removed utilities.

### Pitfall 2: listarTodos Page Start Inconsistency
**What goes wrong:** Some resources start pagination at page 0, others at page 1 (clientes uses 1, vendedores uses 0).
**Why it happens:** The Sankhya REST API is inconsistent across endpoints.
**How to avoid:** Each `listarTodos()` implementation must use the same start page as its corresponding `listar()` method. Check the `page` default in each `listar()` method.
**Warning signs:** First page returns empty or duplicates the second page.

### Pitfall 3: RequestOptions Breaking HttpClient Method Signatures
**What goes wrong:** Adding `options?: RequestOptions` to `restGet(path, params?, options?)` creates ambiguity when `params` is omitted.
**Why it happens:** Two adjacent optional object parameters.
**How to avoid:** `params` defaults to `undefined`, and `RequestOptions` is always the last parameter. Since `params` is `Record<string, string>` and `RequestOptions` has different keys, TypeScript can distinguish them. But to be safe, always pass `params` explicitly (even as `undefined`) when using `options`.
**Warning signs:** TypeScript inference picks wrong overload.

### Pitfall 4: Idempotency Key Not Reaching Gateway Calls
**What goes wrong:** `gatewayCall` uses a different code path than REST methods; the idempotency header could be added only to REST calls.
**Why it happens:** Gateway and REST share `requestWithRetry` but the header injection happens there.
**How to avoid:** The `RequestOptions` parameter must be threaded through to `requestWithRetry`, which is the single place headers are built. Both REST and Gateway paths converge there.

### Pitfall 5: Precos Pagination Uses 'pagina' Not 'page'
**What goes wrong:** `PrecosResource.porTabela()` uses `pagina` parameter, not `page`.
**Why it happens:** The Sankhya precos endpoint uses a different query parameter name.
**How to avoid:** The `listarTodos` wrapper for precos must use `pagina` in its fetchFn, not `page`. Check the existing `porTabela` implementation.

## Code Examples

### Type Guard Usage (Consumer Perspective)
```typescript
import { SankhyaClient, isApiError, isGatewayError, isTimeoutError } from 'sankhya-sales-sdk';
import type { SankhyaErrorCode } from 'sankhya-sales-sdk';

try {
  await client.pedidos.criar(pedido);
} catch (err) {
  if (isApiError(err)) {
    console.log(err.statusCode, err.endpoint); // fully typed
  } else if (isGatewayError(err)) {
    console.log(err.serviceName, err.tsErrorCode); // fully typed
  } else if (isTimeoutError(err)) {
    console.log('timeout'); // err is TimeoutError
  }
}
```

### Switch on Error Code (Consumer Perspective)
```typescript
import { isSankhyaError } from 'sankhya-sales-sdk';
import type { SankhyaErrorCode } from 'sankhya-sales-sdk';

if (isSankhyaError(err)) {
  const code: SankhyaErrorCode = err.code as SankhyaErrorCode;
  switch (code) {
    case 'AUTH_ERROR': /* handle */ break;
    case 'API_ERROR': /* handle */ break;
    case 'GATEWAY_ERROR': /* handle */ break;
    case 'TIMEOUT_ERROR': /* handle */ break;
    default: {
      const _exhaustive: never = code;
      throw new Error(`Unknown error code: ${_exhaustive}`);
    }
  }
}
```

### Per-Call Timeout (Consumer Perspective)
```typescript
// Override timeout for a slow endpoint
const result = await client.estoque.listar({ page: 0 }, { timeout: 60_000 });

// With idempotency key
const pedido = await client.pedidos.criar(input, {
  idempotencyKey: crypto.randomUUID(),
  timeout: 45_000,
});
```

### AbortSignal.any() Usage (Internal)
```typescript
// In HttpClient.requestWithRetry
const timeoutMs = options?.timeout ?? this.timeout;
const internalController = new AbortController();
const timeoutId = setTimeout(() => internalController.abort(), timeoutMs);

const signals = [internalController.signal];
if (options?.signal) signals.push(options.signal);
const combinedSignal = AbortSignal.any(signals);

const response = await fetch(url, { signal: combinedSignal, ... });
```

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 3.0 |
| Config file | `vitest.config.ts` |
| Quick run command | `npx vitest run tests/core/errors.test.ts` |
| Full suite command | `npx vitest run` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| APIS-01 | Type guards narrow error types | unit | `npx vitest run tests/core/errors.test.ts` | Exists (needs new tests) |
| APIS-02 | SankhyaErrorCode union covers all codes | unit (type-level) | `npx vitest run tests/core/errors.test.ts` | Exists (needs new tests) |
| APIS-03 | listarTodos() on all paginated resources | unit | `npx vitest run tests/resources/` | Wave 0 |
| APIS-04 | Idempotency key forwarded as header | unit | `npx vitest run tests/core/http.test.ts` | Exists (needs new tests) |
| APIS-05 | Internal utilities not in public exports | unit (import check) | `npx vitest run tests/api-surface.test.ts` | Wave 0 |
| APIS-06 | Per-call timeout override works | unit | `npx vitest run tests/core/http.test.ts` | Exists (needs new tests) |

### Sampling Rate
- **Per task commit:** `npx vitest run tests/core/errors.test.ts tests/core/http.test.ts`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `tests/api-surface.test.ts` -- covers APIS-05 (import audit)
- [ ] `tests/resources/pedidos.test.ts` -- covers APIS-03, APIS-04 for pedidos
- [ ] `tests/resources/financeiros.test.ts` -- covers APIS-03, APIS-04 for financeiros
- [ ] `tests/resources/cadastros.test.ts` -- covers APIS-03 for cadastros
- [ ] `tests/resources/precos.test.ts` -- covers APIS-03 for precos

## Open Questions

1. **Does Sankhya REST API honor X-Idempotency-Key header?**
   - What we know: Sankhya API documentation does not mention this header. The SDK will forward it regardless.
   - What's unclear: Whether the server processes it or silently ignores it.
   - Recommendation: Implement as a passthrough header. Document that idempotency is SDK-level best practice; server-side enforcement depends on Sankhya version. The retry logic already skips unsafe methods by default (CORE-07), so this is defense-in-depth.

2. **Should date utilities remain public?**
   - What we know: APIS-05 says to exclude internal utilities. Date helpers are used by consumers for formatting filter parameters.
   - What's unclear: Whether consumers need them or can format dates themselves.
   - Recommendation: Remove from public exports per APIS-05. If demand arises post-v1, re-export in v1.1 as a non-breaking addition.

3. **SankhyaError.code type is `string`, not `SankhyaErrorCode`**
   - What we know: The base `SankhyaError` class declares `code: string`. Subclasses override with `as const`.
   - What's unclear: Should the base class be typed as `SankhyaErrorCode`?
   - Recommendation: Keep base class as `string` (it is extensible for future error types). The type guard + cast pattern shown in code examples handles this cleanly. Consumers who want exhaustive switching use `isSankhyaError()` then cast.

## Sources

### Primary (HIGH confidence)
- Codebase inspection: `src/core/errors.ts`, `src/core/http.ts`, `src/core/pagination.ts`, `src/index.ts`
- Codebase inspection: All 10 resource files in `src/resources/`
- Codebase inspection: `src/types/config.ts`, `src/types/common.ts`
- TypeScript handbook: Type guards, discriminated unions, `as const` assertions
- Node.js 20 docs: `AbortSignal.any()` available since Node 20.3.0

### Secondary (MEDIUM confidence)
- Idempotency key header convention: Standard HTTP pattern (Stripe, AWS use `Idempotency-Key` header)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - no new dependencies, pure TypeScript
- Architecture: HIGH - patterns directly derived from existing codebase inspection
- Pitfalls: HIGH - identified from actual code inconsistencies (page start, param naming)

**Research date:** 2026-04-06
**Valid until:** 2026-05-06 (stable, no external dependency risk)
