# Feature Landscape

**Domain:** TypeScript API SDK — ERP integration (Sankhya, B2B sales)
**Researched:** 2026-04-06
**Confidence:** HIGH (patterns from Stripe, AWS SDK v3, Twilio, Shopify — all stable, well-documented conventions)

---

## Already Implemented (baseline)

These are built and validated. Listed here to avoid duplicate work in roadmap phases.

| Feature | Status | Location |
|---------|--------|----------|
| OAuth 2.0 auth with token cache + mutex | Done | `src/core/auth.ts` |
| HTTP client with timeout + 401 auto-refresh | Done | `src/core/http.ts` |
| Typed error hierarchy (5 error classes) | Done | `src/core/errors.ts` |
| Retry with exponential backoff (429/5xx/ECONNRESET) | Done | `src/core/retry.ts` |
| AsyncGenerator paginator | Done | `src/core/pagination.ts` |
| Gateway serializer (deserializeRows/serialize) | Done | `src/core/gateway-serializer.ts` |
| Injectable logger (level + custom) | Done | `src/core/logger.ts` |
| Date format conversion utilities | Done | `src/core/date.ts` |
| 10 resource classes | Done | `src/resources/` |
| ESM + CJS dual export | Done | `package.json` exports |
| All public types exported | Done | `src/index.ts` |
| 90 tests (unit + integration) | Done | — |

---

## Table Stakes

Features users expect from any production-ready SDK. Missing = product feels incomplete or untrustworthy.

| Feature | Why Expected | Complexity | Status | Notes |
|---------|--------------|------------|--------|-------|
| **README with quick-start (< 5 min to first call)** | Every npm package needs this; it is the conversion point | Low | Missing | Auth, install, first `clientes.listar()` call must fit in one screen |
| **API reference documentation** | Devs won't guess 63+ method signatures | Med | Missing | TSDoc comments on all public methods + types; generates via TypeDoc |
| **Error handling guide** | Sankhya has unusual patterns (HTTP 200 on Gateway errors); devs need to know | Low | Missing | Show try/catch with each error class + `instanceof` checks |
| **Working code examples** | `examples/` directory or README snippets covering each resource | Low | Missing | One file per common use case (listar clientes, criar pedido, consultar estoque) |
| **Stable semantic versioning** | Users need to know when to update and whether v1 breaks v0 | Low | In progress | CHANGELOG.md not yet written; `v1.0.0` not published |
| **`instanceof` guarantees on errors** | `err instanceof SankhyaError` must work across module boundaries | Low | Done | Error classes use `name` property correctly — verify prototype chain on CJS consumers |
| **`isError()` type guard helpers** | Common pattern in Stripe, Twilio SDKs | Low | Missing | `isSankhyaError(e)`, `isAuthError(e)`, `isGatewayError(e)` — 10 lines of code |
| **Exported error codes as constants** | Consumers type-switch on `err.code` — should not use raw strings | Low | Partial | Codes exist as `readonly` properties; a `SankhyaErrorCode` union type would close the gap |
| **Idempotency key support for mutations** | Prevents duplicate orders/invoices on network retry — critical for ERP | Med | Missing | POST/PUT on `pedidos`, `financeiros` should accept `idempotencyKey?: string` → `Idempotency-Key` header |
| **Request timeout configurable per-call** | Some Sankhya endpoints are slow (pedidos, estoque); global 30s is too coarse | Low | Partial | Global config exists; per-resource override not exposed |
| **`.env`-friendly config** | Devs expect to pass `process.env.SANKHYA_CLIENT_ID` | Low | Done | Config is plain object — consumer's responsibility, but README must show pattern |
| **Zero breaking changes policy on patch** | Follows semver; users need trust | Low | Missing | No CHANGELOG; must write one |
| **TypeScript strict mode compliance** | Consumers get autocomplete without `any` leaking from SDK | Low | Partial | Zero `any` target; `tsconfig strict: true` must be verified |
| **Dual ESM/CJS compatibility tested** | `require()` consumers must not see broken exports | Low | Partial | Build config exists; no smoke test for CJS import |
| **`types` field in package.json exports** | IDEs use this for autocomplete | Low | Done | Present in `exports` map |
| **`engines` field (Node >=20)** | Manages expectations, avoids fetch polyfill questions | Low | Done | Present |
| **npm provenance / trusted publishing** | Modern npm security; more critical for SDKs used in production | Low | Missing | `npm publish --provenance` requires GitHub Actions |

---

## Differentiators

Features that set this SDK apart from raw HTTP calls or generic REST clients. Not expected by default, but valued by target users.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **`for await...of` transparent pagination** | Iterating all clients is `for await (const c of sdk.clientes.listarTodos())` — no page management | Low | AsyncGenerator already exists; needs `listarTodos()` convenience wrapper on each resource |
| **Sankhya domain type completeness** | All enums, DTOs, and quirks pre-typed (TipoPessoa F/J, campos string-numerics) | Med | Already strong; gaps are edge-case fields exposed raw |
| **`TokenCacheProvider` interface for Redis/Memcached** | Stateless deployments (Lambda, containers) can share token across instances | Low | Done; document the pattern prominently |
| **Gateway raw access as first-class resource** | Consumers not limited to 10 resources; can call any Sankhya service | Low | `GatewayResource` exists; needs typed return for common custom services |
| **Retry transparent to caller** | Caller never writes retry loops; transient failures resolved silently | Low | Done; needs documenting explicitly (what is retried, what is not) |
| **`modifiedSince` delta sync support** | ERP integrations need incremental sync; polling `modifiedSince` is the pattern | Low | Type exists; resource methods need consistent implementation |
| **Sandbox / test mode flag in config** | `config.mode: 'sandbox' | 'production'` auto-adjusts base URL or adds header | Low | Not implemented; reduces misconfiguration risk |
| **Structured log context on every request** | Each HTTP log includes `resource`, `method`, `attempt`, `durationMs` — integrates with Datadog/CloudWatch | Med | Current logger logs URL; structured JSON context would be a differentiator |
| **`vi.mock`-friendly test helpers** | Exporting mock factory functions (`createMockSankhyaClient()`) reduces consumer boilerplate | Med | Missing; Stripe does this; high value for SDK adoption |
| **Explicit rate limit surface** | `RateLimitError extends SankhyaError` with `retryAfterMs` from `Retry-After` header | Low | Currently mapped to generic `ApiError 429`; extracting makes consumer code cleaner |
| **Request/response hooks (`onRequest`, `onResponse`)** | Power users add telemetry, audit logs, request signing without forking | Med | Not implemented; AWS SDK v3 middleware stack is the gold standard; simpler hooks suffice here |
| **CHANGELOG.md with migration guide** | Reduces churn when consumers upgrade | Low | Missing |
| **`preinstall` / peer dependency warnings** | Warn if Node < 20 or TypeScript < 5 at install time | Low | Missing; small script |

---

## Anti-Features

Things to deliberately NOT build. Each represents scope creep or a technical trap.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| **Runtime data validation (Zod/Yup schemas)** | Adds a runtime dependency and doubles bundle size; Sankhya API changes break schemas silently anyway | Trust TypeScript at compile time; document known coercions (numeric strings) in JSDoc |
| **Response caching in the SDK** | Cache invalidation is the consumer's problem domain; SDK has no business knowing TTLs for `clientes` vs `precos` | Expose `TokenCacheProvider` for auth only; document that consumers should use their own cache layer (Redis, in-memory) |
| **CLI tooling** | Out of scope per PROJECT.md; creates a separate maintenance surface | SDK is library-only |
| **Webhook signature verification** | Sankhya ERP does not emit webhooks in the standard OAuth/REST v1 integration surface | If Sankhya adds webhooks in the future, add as a separate optional utility |
| **Multi-tenant auth management** | Managing multiple `clientId`/`clientSecret` pairs (one per Sankhya tenant) belongs in the consumer's service layer | Each `SankhyaClient` instance handles one tenant; consumers instantiate multiple clients |
| **Auto-pagination on list methods** | Returning `PaginatedResult` and providing `AsyncGenerator` gives consumer full control; auto-paginating all results silently could exhaust memory on large catalogs | Keep `listar()` (single page) + `listarTodos()` (generator) pattern explicit |
| **GraphQL or query DSL** | Sankhya's API is REST + Gateway; a DSL abstraction layer creates maintenance burden with no gain | Use typed method params (`ListarClientesParams`) directly |
| **Retry on business logic errors** | Gateway HTTP-200 errors (wrong CNPJ, stock unavailable) must NOT be retried | Only retry network errors (5xx, 429, ECONNRESET, ETIMEDOUT) — already correct |
| **Node.js < 20 polyfills** | Adds complexity, hides runtime issues, contradicts zero-dep goal | Document Node 20 requirement clearly; fail fast with a readable error if `fetch` is undefined |
| **Legacy auth (user/password)** | Sankhya discontinued on 30/04/2026 | OAuth 2.0 only — already decided |

---

## Feature Dependencies

```
README/docs
  └─ requires: all resources stable (methods finalized)
  └─ requires: type exports complete

idempotencyKey on mutations
  └─ requires: HttpClient.restPost/restPut accepts extra headers

isError() type guards
  └─ requires: error hierarchy stable (already done)

SankhyaErrorCode union type
  └─ requires: error hierarchy stable (already done)

listarTodos() AsyncGenerator wrappers on each resource
  └─ requires: createPaginator() (already done)

Sandbox mode config flag
  └─ requires: SankhyaConfig extended with mode field

Structured log context
  └─ requires: HttpClient logs durationMs (start timer before fetch)

Mock factory helpers
  └─ requires: all resource methods finalized (stable interface)

npm publish with provenance
  └─ requires: GitHub Actions CI configured
  └─ requires: CHANGELOG.md + semantic version

Per-call timeout override
  └─ requires: each resource method accepts optional RequestOptions
```

---

## MVP Recommendation

For `v1.0.0` — the version developers will evaluate before adopting the SDK:

**Prioritize (must have):**
1. README with quick-start — first thing any evaluator reads
2. TSDoc on all public methods and types — makes autocomplete useful
3. `isError()` type guard helpers — one of the first patterns any error-handling guide shows
4. `SankhyaErrorCode` union type — closes the raw-string gap in error codes
5. `listarTodos()` generator wrapper on each resource — most common consumer use case
6. CHANGELOG.md — establishes trust before publishing
7. Idempotency key on pedidos/financeiros mutations — critical for ERP correctness
8. CJS smoke test — verifies dual export before publish

**Defer to v1.1+:**
- Sandbox mode flag (nice-to-have, low risk without it)
- Structured log context (improves DX; not blocking adoption)
- Mock factory helpers (reduces consumer boilerplate; can add after stable interface)
- Request/response hooks (power-user feature; add when consumers ask)
- Per-call timeout override (workaround: instantiate a second client with different timeout)

---

## Sources

Analysis based on:
- Direct code inspection of `sankhya-sales-sdk` v0.1.0 source (`src/`)
- Industry patterns from Stripe Node.js SDK (stripe/stripe-node), AWS SDK v3, Twilio, Shopify Admin API SDK — conventions well-established and stable as of knowledge cutoff (August 2025)
- Confidence: HIGH — these are stable, widely-adopted patterns in the TypeScript SDK ecosystem
- Note: WebSearch and WebFetch were unavailable during this research session; findings rely on training knowledge of production SDK conventions. Specific version numbers for referenced SDKs were not verified against live registries.
