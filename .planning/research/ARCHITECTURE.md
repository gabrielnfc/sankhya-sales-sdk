# Architecture Patterns

**Domain:** TypeScript SDK for ERP REST + Gateway dual-API
**Researched:** 2026-04-06
**Confidence:** HIGH (grounded in actual codebase + established npm/TypeScript patterns)

---

## Recommended Architecture

The SDK already has a sound layered architecture. This document maps the **production-readiness dimensions** the roadmap must address on top of the existing implementation: test architecture, documentation generation, and package publishing structure.

### Current Layer Map (Established — Do Not Redesign)

```
Consumer Code
     │
     ▼
SankhyaClient (src/client.ts)          ← facade / entry point
     │  lazy-loads on first access
     ▼
Resource Layer (src/resources/*.ts)     ← domain operations
     │  calls HTTP methods
     ▼
HttpClient (src/core/http.ts)           ← REST + Gateway transport
     │  requests token before each call
     ▼
AuthManager (src/core/auth.ts)          ← OAuth 2.0 + token cache
     │
     ▼
Sankhya API (REST v1 / Gateway)
```

Serialization utilities (`gateway-serializer.ts`, `pagination.ts`) sit beside HttpClient
and are called by both the HTTP layer and individual resources.

---

## Component Boundaries

| Component | Responsibility | Communicates With | Direction |
|-----------|---------------|-------------------|-----------|
| `SankhyaClient` | Facade; owns config; lazy-instantiates resources | Resource classes, `AuthManager`, `HttpClient` | Inward only — consumers call it |
| `*Resource` classes | Domain operations; parameter validation; response normalization | `HttpClient` (down), serialization utilities | Always downward |
| `HttpClient` | URL construction; header injection; fetch execution; error mapping | `AuthManager` (token), `Logger`, `withRetry` | Calls Auth on each request |
| `AuthManager` | Token acquisition; TTL cache; mutex on concurrent refresh | External `TokenCacheProvider` (optional), native fetch | No knowledge of resources |
| Serialization (`gateway-serializer`, `pagination`) | Protocol-specific data transformation | Type layer only; stateless | Pure functions, no side effects |
| Error hierarchy (`errors.ts`) | Typed error classes with `code` field | Used by all layers | Leaf node — no imports |
| Type layer (`types/*.ts`) | Interfaces, param types, response types | Imported by all layers | Leaf node — no runtime code |

### Key Boundary Rule

Resources MUST NOT import from other resources. All inter-resource coordination goes through the client. This prevents circular dependencies and keeps each resource independently testable.

---

## Production Readiness Dimensions

### 1. Test Architecture

The existing test organization is architecturally correct. The gaps are in coverage depth, configuration, and CI integration.

**Current Structure:**
```
tests/
├── core/          ← unit tests (mock fetch, mock auth)
│   ├── auth.test.ts
│   ├── http.test.ts
│   ├── errors.test.ts
│   ├── logger.test.ts
│   ├── pagination.test.ts
│   ├── gateway-serializer.test.ts
│   ├── retry.test.ts
│   └── date.test.ts
└── integration/   ← sandbox tests (.skipIf(!credentials))
    ├── sandbox.test.ts
    ├── resources.test.ts
    ├── curadoria.test.ts
    └── curadoria-v2.test.ts
```

**Recommended Final Structure:**
```
tests/
├── unit/          ← renamed from core/ — aligns with convention
│   └── (8 existing core test files)
├── integration/   ← sandbox API tests — require .env credentials
│   └── (existing 4 integration files + new e2e resource tests)
└── fixtures/      ← shared mock data and factory functions
    ├── api-responses.ts   ← real API response shapes (from sandbox findings)
    └── client-factory.ts  ← shared SankhyaClient test factory
```

**Test Type Boundaries:**

| Type | Location | Requires Network | What It Tests | Gate |
|------|----------|-----------------|---------------|------|
| Unit | `tests/unit/` | No (vi.fn() mocks) | Each class/function in isolation | Always runs, CI blocking |
| Integration | `tests/integration/` | Yes (sandbox) | Real API calls, response format | Requires `.env`, skips gracefully |
| Type-check | `tsc --noEmit` | No | TypeScript soundness | Always runs, CI blocking |

**Unit Test Pattern (fetch mocking):**
The existing pattern in `http.test.ts` is correct: replace `globalThis.fetch` in `beforeEach`, restore in `afterEach`, spy with `vi.fn()`. This works because the SDK uses native fetch with zero dependencies — no need for `msw` or `nock`.

**Integration Test Pattern (conditional skip):**
The existing `describe.skipIf(!hasCredentials)(...)` pattern is correct. Integration tests should never fail CI when `.env` is absent — they skip. This enables local sandbox validation without blocking automated pipelines.

**Coverage Configuration (missing — must add):**
The `vitest.config.ts` needs a `coverage` block:
```typescript
coverage: {
  provider: 'v8',
  include: ['src/**'],
  exclude: ['src/types/**', 'src/index.ts'],
  thresholds: { lines: 90, functions: 90, branches: 85 },
}
```
Types and barrel exports are excluded because they contain no runtime logic.

**Test Fixture Gap:**
Real API response shapes discovered during sandbox curation exist only in test files inline. They should be extracted to `tests/fixtures/api-responses.ts` as typed constants, making them reusable across test files and as documentation of real API behavior.

---

### 2. Package Exports Configuration

The current `package.json` exports configuration is structurally correct for dual ESM/CJS. Two gaps exist:

**Current (correct baseline):**
```json
{
  "exports": {
    ".": {
      "import": { "types": "./dist/index.d.ts", "default": "./dist/index.js" },
      "require": { "types": "./dist/index.d.cts", "default": "./dist/index.cjs" }
    }
  }
}
```

**Gap 1 — Missing `package.json` condition:**
Bundlers (webpack, vite, rollup) rely on the `package.json` export condition for monorepo tooling. Add:
```json
{
  "exports": {
    ".": {
      "import": { "types": "./dist/index.d.ts", "default": "./dist/index.js" },
      "require": { "types": "./dist/index.d.cts", "default": "./dist/index.cjs" }
    },
    "./package.json": "./package.json"
  }
}
```

**Gap 2 — Missing `sideEffects: false`:**
This single field enables bundler tree-shaking. Without it, bundlers assume every module has side effects and cannot eliminate dead code. Because this SDK has zero side effects (no global mutations, no module-level I/O), add:
```json
{
  "sideEffects": false
}
```

**Gap 3 — tsup `splitting` for true tree-shaking:**
The current `tsup.config.ts` does not enable code splitting. For ESM output, enabling `splitting: true` generates per-module chunks so bundlers can exclude unused resources. Consumers who only use `clientes` resource will not bundle `pedidos` code.

**Gap 4 — Missing `publishConfig`:**
For safety during `npm publish`, add:
```json
{
  "publishConfig": { "access": "public" }
}
```

**Gap 5 — Missing required metadata for npm:**
- `repository` field (GitHub URL)
- `homepage` field
- `bugs` field
These are required for a quality npm listing and for `npm info` to show useful information.

---

### 3. Documentation Generation

**Recommended tool: TypeDoc**

TypeDoc reads TypeScript source directly with no separate annotation language. Configuration lives in `typedoc.json`. Output can be HTML (hosted) or Markdown (for GitHub wiki or `/docs` folder).

**Recommended setup:**
```json
// typedoc.json
{
  "entryPoints": ["src/index.ts"],
  "out": "docs/api",
  "excludePrivate": true,
  "excludeInternal": true,
  "readme": "README.md",
  "name": "sankhya-sales-sdk",
  "includeVersion": true,
  "tsconfig": "./tsconfig.json"
}
```

**What needs JSDoc annotation (currently missing):**
- `SankhyaClient` constructor: document all config fields
- Every public method on every resource: `@param`, `@returns`, `@throws`, `@example`
- Error classes: document when each is thrown
- `TokenCacheProvider` interface: document contract for external implementors

**Documentation to produce beyond API reference:**
- `README.md` — quickstart (install, authenticate, first query, error handling)
- `docs/guides/autenticacao.md` — OAuth flow, TokenCacheProvider, token refresh
- `docs/guides/paginacao.md` — `listar()` vs `listarTodos()` AsyncGenerator pattern
- `docs/guides/gateway.md` — when to use `GatewayResource` directly
- `CHANGELOG.md` — required for v1.0.0 npm publish
- `CONTRIBUTING.md` — optional but expected for public packages

---

### 4. Build Order for Production Readiness Phases

These components have hard dependencies. Build in this order:

```
Phase A — Test Hardening (prerequisite for confidence in everything else)
  1. Add coverage config to vitest.config.ts
  2. Rename tests/core/ → tests/unit/ (optional, for clarity)
  3. Extract fixtures to tests/fixtures/
  4. Achieve 90% coverage on src/core/**
  5. Achieve 90% coverage on src/resources/**

Phase B — Resource Audit + E2E Validation (prerequisite for documentation)
  1. Run each resource method against sandbox
  2. Fix mismatches (types vs actual response)
  3. Fill missing methods (zero `any`, complete CRUD)
  → Cannot document correctly until API behavior is validated

Phase C — Package Structure (prerequisite for publishing)
  1. Add sideEffects: false to package.json
  2. Add ./package.json export
  3. Add publishConfig
  4. Add repository/homepage/bugs fields
  5. Enable tsup splitting for ESM
  6. Verify dist output: index.js, index.cjs, index.d.ts, index.d.cts all present
  7. Test with `node --input-type=commonjs` and native ESM import

Phase D — Documentation (prerequisite for v1.0.0 announcement)
  1. Add JSDoc to all public API surface
  2. Configure TypeDoc
  3. Write README quickstart
  4. Write guides (auth, pagination, gateway)
  5. Generate CHANGELOG.md
  6. npm pack --dry-run to verify files field

Phase E — CI + Release
  1. GitHub Actions: typecheck + lint + test:coverage on PR
  2. GitHub Actions: npm publish on version tag
  3. GitHub Release with CHANGELOG extract
```

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Testing Types in Unit Tests
**What:** Writing tests that just assert `typeof x === 'string'` on every field
**Why bad:** TypeScript compile-time already enforces this; test suite becomes maintenance burden with zero bug-catching value
**Instead:** Test behavior and edge cases (what happens when pagination has `hasMore: true` but empty data? what happens when TAXAJURO is `{}`?)

### Anti-Pattern 2: Barrel Exports That Re-export Internal Utilities
**What:** Exporting `AuthManager`, `HttpClient`, `withRetry` from `src/index.ts` as top-level public API
**Current state:** `src/index.ts` currently exports `withRetry`, `createPaginator`, `serialize`, `deserialize`, `deserializeRows`, `normalizeRestPagination`, etc.
**Risk:** These are implementation utilities. Exporting them widens the public API surface, creates semver commitments, and confuses consumers about what's "official" vs "internal"
**Decision needed:** Audit which utilities should be `@internal` in JSDoc (excluded from TypeDoc) vs truly public API

### Anti-Pattern 3: Integration Tests That Always Skip in CI
**What:** Integration tests that require `.env` but CI never has credentials → 0 integration test runs ever in CI
**Why bad:** Regressions in API format handling are never caught automatically
**Instead:** Consider a CI job with sandbox credentials as a GitHub Actions secret, running on push to main only (not PRs from forks)

### Anti-Pattern 4: Single `index.d.ts` for Both ESM and CJS
**What:** Only one `.d.ts` declaration file serving both module formats
**Why bad:** When CJS consumers use `require()`, TypeScript resolves types from `index.d.cts` (per exports map). If that file doesn't exist, types break in CJS contexts
**Current state:** tsup with `dts: true` generates both `.d.ts` and `.d.cts` — this is already handled correctly

### Anti-Pattern 5: `npm publish` Without `files` Field Verification
**What:** Publishing without checking what `files` actually includes
**Why bad:** Can accidentally publish `.env`, `.planning/`, test files, or miss `dist/`
**Prevention:** Run `npm pack --dry-run` and inspect the tarball contents before every publish

---

## Scalability Considerations

This is a client-side library SDK — "scalability" means consumer-side impact, not server load.

| Concern | Impact | Mitigation |
|---------|--------|------------|
| Bundle size (CJS/ESM consumers) | Each resource imports all types; full bundle ~50-100KB | `sideEffects: false` + tsup splitting; types are erased at runtime |
| Token refresh contention | Multiple concurrent requests → multiple token refreshes | Already solved via mutex pattern in AuthManager |
| Pagination memory | `listarTodos()` AsyncGenerator avoids loading all pages at once | Correct pattern already implemented; document explicitly |
| TypeScript version compatibility | SDK uses `isolatedModules`, `noUncheckedIndexedAccess` | Consumers with older TS may see stricter type errors; document minimum TS version (5.x) |
| Node version | `fetch` native requires Node 20+ | Documented in `engines` field; no polyfill needed |

---

## Data Flow: Production-Readiness Perspective

### Publish Flow

```
src/index.ts (public API surface)
     │
     ▼ tsup build
dist/
├── index.js       ← ESM (import)
├── index.cjs      ← CJS (require)
├── index.d.ts     ← TypeScript declarations for ESM
└── index.d.cts    ← TypeScript declarations for CJS
     │
     ▼ npm pack
sankhya-sales-sdk-1.0.0.tgz
  └── (only dist/ + package.json + README + LICENSE)
     │
     ▼ npm publish
npm registry
```

### Type Resolution Flow (consumer perspective)

```
Consumer: import { SankhyaClient } from 'sankhya-sales-sdk'
     │
     ▼ package.json "exports"."."."import"."types"
dist/index.d.ts
     │ re-exports
     ▼
All types from src/types/*.ts (erased at runtime, present at design time)
     │
IDE: full autocomplete, inline JSDoc, parameter types
```

---

## Sources

- Project codebase analysis: `src/`, `tests/`, `package.json`, `tsup.config.ts`, `tsconfig.json`, `vitest.config.ts` — HIGH confidence
- Established Node.js dual package patterns (ESM/CJS): HIGH confidence (long-standing community practice, Node.js docs)
- TypeDoc configuration patterns: MEDIUM confidence (based on TypeDoc v0.27 knowledge; verify against current TypeDoc docs before implementation)
- tsup code splitting: HIGH confidence (tsup v8.x `splitting` option well-documented)
- `sideEffects: false` tree-shaking: HIGH confidence (webpack/rollup/vite all honor this field per their official docs)
- `npm pack --dry-run` pre-publish verification: HIGH confidence (standard npm CLI workflow)
