# Project Research Summary

**Project:** sankhya-sales-sdk
**Domain:** TypeScript npm SDK — ERP REST + Gateway dual-API integration (Sankhya B2B)
**Researched:** 2026-04-06
**Confidence:** HIGH

## Executive Summary

The `sankhya-sales-sdk` is a production-ready TypeScript SDK targeting developers who integrate with the Sankhya ERP commercial API surface (vendas, clientes, produtos, pedidos, financeiros). The core implementation — OAuth 2.0 auth, HTTP client with retry, AsyncGenerator pagination, Gateway serializer, 10 resource classes, and dual ESM/CJS output — is complete and sandbox-validated. The remaining work is a pure production-readiness milestone: enforcement of coverage thresholds, test architecture hardening, package export validation, documentation generation, and CI/CD with npm provenance publishing. Experts building SDKs at this stage (Stripe, Twilio, AWS SDK v3) follow a deterministic sequence: harden tests first, audit the public API surface, fix structural gaps in the package before publishing, then write documentation against the stable surface.

The recommended approach is a five-phase sequence driven by hard dependencies: (1) fix three high-priority bugs in core (TAXAJURO deserializer, jitter-free retry, token TTL guard) and add coverage enforcement; (2) audit every resource against sandbox to eliminate type drift and validate CRUD flows; (3) complete the public API surface (type guards, error constants, `listarTodos()` wrappers, idempotency keys, JSDoc); (4) harden the package structure (exports map, `sideEffects: false`, `prepublishOnly` gate, dual-format smoke test) and generate documentation; (5) configure CI/CD and publish v1.0.0 with npm provenance. This ordering ensures that documentation is written against a verified, stable API — not against a draft — and that CI gates catch regressions before they reach consumers.

The critical risk is silent data corruption from non-idempotent retries on POST/PUT operations (duplicate orders in production). This must be addressed before any write-path testing. A secondary structural risk is that the `package.json` exports map, while architecturally correct, will break CJS consumers on older TypeScript `moduleResolution` settings if not validated with `publint` and `@arethetypeswrong/cli` before publish. Both risks have documented, low-effort mitigations and must be resolved before v1.0.0.

---

## Key Findings

### Recommended Stack

The existing stack (TypeScript 5.8, tsup 8, Vitest 3, Biome 1.9) is already production-grade and requires no changes. Four targeted devDependency additions complete the toolchain: `@vitest/coverage-v8` (coverage enforcement, V8-native for Node 20, faster than Istanbul), `typedoc ^0.27` (API reference generation from TSDoc — de facto TypeScript standard), `publint` (package.json exports validation before publish), and `@arethetypeswrong/cli` (catches TypeScript type resolution failures across `moduleResolution` variants that `publint` misses). No runtime dependencies are added. CI/CD is GitHub Actions only — no additional npm packages.

**Core technologies:**
- TypeScript 5.8 + strict mode: language foundation — already configured with `noUncheckedIndexedAccess`, no changes needed
- tsup 8.3: ESM + CJS dual build with `.d.ts`/`.d.cts` — add `splitting: true` for tree-shaking
- Vitest 3 + @vitest/coverage-v8: test runner + coverage — add `coverage` block with 90/85 thresholds
- Biome 1.9: lint + format — already configured, no changes
- typedoc ^0.27: API reference HTML/Markdown from TSDoc — new addition
- publint + @arethetypeswrong/cli: package validation gate before every publish — new addition
- GitHub Actions: CI (unit tests, typecheck, lint, exports check) + release (npm publish --provenance)

See `.planning/research/STACK.md` for full rationale and alternatives considered.

### Expected Features

The v0.1.0 baseline covers auth, HTTP, retry, pagination, serialization, and 10 resource classes. The v1.0.0 gap is primarily DX polish and correctness guarantees on the public API surface.

**Must have (table stakes):**
- README with quick-start (< 5 min to first API call) — conversion point for every evaluator
- TSDoc on all public methods and types — makes autocomplete useful, feeds TypeDoc
- `isError()` type guard helpers — first pattern in any error-handling guide
- `SankhyaErrorCode` union type — closes raw-string gap in `err.code` comparisons
- `listarTodos()` AsyncGenerator wrapper on each resource — most common consumer use case
- Idempotency key on pedidos/financeiros mutations — critical for ERP correctness, prevents duplicate orders
- CHANGELOG.md — establishes trust before v1.0.0 publish
- CJS smoke test — verifies dual export before publish
- `npm publish --provenance` via GitHub Actions — 2025 npm security baseline

**Should have (differentiators):**
- `for await...of` transparent pagination with `listarTodos()` — major DX differentiator vs raw HTTP
- `TokenCacheProvider` documented prominently — enables Redis/Memcached for stateless deployments
- Sandbox mode config flag (`config.mode: 'sandbox' | 'production'`) — reduces misconfiguration risk
- Structured log context (resource, method, attempt, durationMs) — integrates with Datadog/CloudWatch
- `createMockSankhyaClient()` test factory — reduces consumer boilerplate, increases SDK adoption
- `Retry-After` header parsing — replaces blind exponential backoff with server-directed delay

**Defer to v1.1+:**
- Request/response hooks (`onRequest`, `onResponse`) — power-user feature, add when consumers request
- Per-call timeout override — workaround: second client instance with different timeout
- `requestsPerSecond` throttle parameter — add after discovering rate limits empirically
- Multi-tenant management helpers — belongs in consumer's service layer, not SDK

**Anti-features (do not build):**
- Runtime validation (Zod/Yup) — adds runtime dependency, schemas break silently on API changes
- Response caching in SDK — cache invalidation is consumer's domain
- CLI tooling, webhook verification, GraphQL DSL — all out of scope

See `.planning/research/FEATURES.md` for full table with complexity ratings and feature dependencies.

### Architecture Approach

The existing five-layer architecture (Consumer → SankhyaClient → Resources → HttpClient → AuthManager) is sound and must not be redesigned. The production-readiness work adds structure around it: the test directory should split into `tests/unit/`, `tests/integration/`, and `tests/fixtures/` (shared API response fixtures extracted from inline test data); the package exports map needs five gaps closed (`./package.json` export, `sideEffects: false`, `publishConfig`, repository metadata, tsup `splitting: true`); and the documentation layer (TypeDoc + README + guides) is built against the stable public surface in `src/index.ts`. The critical architectural decision is which utilities in `src/index.ts` are truly public API vs internal implementation — `withRetry`, `createPaginator`, `serialize`, `deserializeRows` are currently exported but create semver commitments that should be reviewed before v1.0.0.

**Major components:**
1. `SankhyaClient` — facade; owns config; lazy-instantiates resources; single consumer entry point
2. `*Resource` classes (10) — domain operations, parameter validation, response normalization; must not cross-import
3. `HttpClient` — URL construction, header injection, fetch execution, error mapping, retry wrapping
4. `AuthManager` — OAuth 2.0 token acquisition, TTL cache with mutex, optional external `TokenCacheProvider`
5. Serialization utilities (`gateway-serializer`, `pagination`) — stateless pure functions, called by HTTP and resource layers
6. Error hierarchy + type layer — leaf nodes, imported by all layers, no circular dependencies

See `.planning/research/ARCHITECTURE.md` for package exports configuration details and the full build-order dependency graph.

### Critical Pitfalls

1. **Non-idempotent retries on POST/PUT create duplicate orders** — `withRetry()` wraps all HTTP methods including POST; a timeout on `pedidos.criar()` may retry a server-side success; fix: disable retry on POST/PUT by default OR add `retry: false` per-request option; add `@warning` JSDoc on all write methods. (PITFALLS.md Pitfall 2)

2. **Exports map breaks CJS consumers' TypeScript types** — nested `types` inside `import`/`require` conditions fails on `moduleResolution: "node"` (older consumers); fix: run `npx publint && attw --pack .` before every publish; create a consumer test project with both `node16` and `bundler` resolution. (PITFALLS.md Pitfall 1)

3. **TAXAJURO empty object `{}` causes `"[object Object]"` in deserialized rows** — `deserializeRows()` falls through to `JSON.stringify({})` for the `{ "$": {} }` edge case; `Number.parseFloat("{}")` silently produces `NaN` in financial calculations; fix: add guard `if (typeof raw === 'object' && Object.keys(raw).length === 0) return ""`. (PITFALLS.md Pitfall 3)

4. **Token TTL safety margin breaks on short-lived tokens** — `SAFETY_MARGIN_SECONDS = 60` can produce negative TTL if `expires_in < 60`; every request then re-authenticates; fix: `Math.max(10, data.expires_in - SAFETY_MARGIN_SECONDS)`. (PITFALLS.md Pitfall 4)

5. **Jitter-free retry causes synchronized thundering herd** — deterministic `baseDelay * 2 ** attempt` synchronizes all SDK instances during API maintenance windows; fix: add `* (0.5 + Math.random() * 0.5)` — one line, no breaking changes. (PITFALLS.md Pitfall 8)

See `.planning/research/PITFALLS.md` for 18 total pitfalls with phase-specific warnings table.

---

## Implications for Roadmap

Based on research, the phase structure is driven by hard dependency ordering: bugs must be fixed before e2e validation, API must be stable before documentation, package must be validated before publish, CI must exist before automated release.

### Phase 1: Core Hardening + Coverage Infrastructure

**Rationale:** Three critical bugs (Pitfalls 3, 4, 8) must be fixed before any e2e or CRUD validation — they corrupt test results and cause false positives. Coverage enforcement must be configured early so subsequent phases are measured against thresholds from the start.
**Delivers:** Zero known core bugs; Vitest coverage with V8 provider at 90/85 thresholds; test directory restructured with fixtures; `tests/unit/` passing with full coverage.
**Addresses:** Coverage threshold gap (STACK.md), test separation strategy (STACK.md), TAXAJURO bug (PITFALLS Pitfall 3), TTL bug (PITFALLS Pitfall 4), jitter fix (PITFALLS Pitfall 8).
**Avoids:** False confidence from untested edge cases; silent NaN arithmetic in financial resources.
**Research flag:** Standard patterns — no phase research needed. All fixes are one-to-three line changes with documented solutions.

### Phase 2: Resource Audit + E2E Sandbox Validation

**Rationale:** Cannot write correct documentation or guarantee type safety until every resource method is validated against sandbox. Type drift (implicit `any` casts, fields renamed in API) is invisible in unit tests.
**Delivers:** All 10 resources validated against sandbox; every type cross-checked against real response fields; `// validated against sandbox YYYY-MM-DD` comment in each resource; CRUD e2e tests under `tests/integration/`; rate limit behavior documented.
**Addresses:** Non-idempotent retry on write paths (PITFALLS Pitfall 2 — disable or document); field count mismatch in Gateway deserializer (PITFALLS Pitfall 9); `any` creep via type casts (PITFALLS Pitfall 11); URL validation on constructor (PITFALLS Pitfall 12); slow endpoints timeout config (PITFALLS Pitfall 6).
**Avoids:** Documenting incorrect types; publishing a v1.0.0 with type drift that breaks consumer TypeScript.
**Research flag:** Needs phase research — sandbox behavior for write endpoints (pedidos, financeiros) is partially unknown, especially around rate limits and idempotency. Run `test:integration` against sandbox as the primary research method.

### Phase 3: Public API Surface Completion

**Rationale:** Documentation and consumer DX features require a stable, complete public API. These additions are low-complexity but must be done before JSDoc is written — adding methods after TSDoc annotation creates rework.
**Delivers:** `isError()` type guard helpers; `SankhyaErrorCode` union type; `listarTodos()` AsyncGenerator wrapper on all 10 resources; idempotency key on pedidos/financeiros mutations; `sideEffects: false` in package.json; public API audit (which utilities in `src/index.ts` are truly public vs `@internal`).
**Addresses:** Table stakes features (FEATURES.md must-haves); barrel export anti-pattern (ARCHITECTURE.md Anti-Pattern 2); `sideEffects: false` missing (PITFALLS Pitfall 15).
**Avoids:** Semver commitments on internal utilities; shipping v1.0.0 without the type guards developers expect.
**Research flag:** Standard patterns — `isError()` guards and `SankhyaErrorCode` unions are well-documented TypeScript patterns. No phase research needed.

### Phase 4: Documentation + Package Validation

**Rationale:** Documentation is written last because it describes the stable, validated, complete API. Package validation must pass before any publish attempt — `publint` and `attw` errors are blocking.
**Delivers:** TSDoc on all public methods and types; TypeDoc configured and generating HTML; README with quick-start; guides for auth, pagination, and Gateway; CHANGELOG.md; `prepublishOnly` gate; `./package.json` export condition; `publishConfig`; consumer test project validating CJS and ESM resolution; `npm pack --dry-run` verified.
**Addresses:** README missing (FEATURES.md table stakes); TypeDoc not configured (STACK.md gap); exports map CJS type breakage (PITFALLS Pitfall 1); publish without gate (PITFALLS Pitfall 5); OAuth 2.0 deadline documentation (PITFALLS Pitfall 17); Sankhya version compatibility documentation (PITFALLS Pitfall 16).
**Avoids:** Publishing a package that breaks CJS consumers' TypeScript; shipping without consumer documentation.
**Research flag:** TypeDoc version (^0.27.x) should be verified against npm registry before install — MEDIUM confidence on exact version.

### Phase 5: CI/CD + npm v1.0.0 Release

**Rationale:** Automation is the last step — it codifies the manual processes from earlier phases into repeatable gates. The release is the final deliverable.
**Delivers:** GitHub Actions `ci.yml` (unit tests, typecheck, lint, exports check on every PR); GitHub Actions `integration.yml` (sandbox tests on schedule/manual with secrets); GitHub Actions `release.yml` (npm publish --provenance on tag); CHANGELOG with v0.1.0→v1.0.0 history; npm v1.0.0 published with provenance attestation.
**Addresses:** CI/CD missing (STACK.md gap); npm provenance missing (FEATURES.md table stakes); silent integration test skip in CI (PITFALLS Pitfall 13); `npm version` without git tag (PITFALLS Pitfall 14).
**Avoids:** Manual publish from dirty working directory; publishing without SLSA provenance attestation.
**Research flag:** Standard patterns — GitHub Actions `setup-node@v4` + `npm publish --provenance` is well-documented. No phase research needed.

### Phase Ordering Rationale

- **Bugs before validation:** Pitfalls 3, 4, and 8 corrupt e2e test results — they must be fixed in Phase 1 before Phase 2 sandbox validation runs.
- **Validation before documentation:** TypeDoc generates from TSDoc; TSDoc is accurate only after sandbox validation confirms types match reality (Phase 2 before Phase 4).
- **API surface before documentation:** TSDoc annotation after API additions in Phase 3 avoids rework from adding methods post-annotation.
- **Package validation before CI:** `prepublishOnly` gate and export validation (Phase 4) are prerequisites for the automated release pipeline (Phase 5).
- **Integration tests not in CI by default:** Sandbox credentials are slow (30-60s/resource) and require secrets; integration tests run on schedule/manually via separate `integration.yml` workflow, not on every PR.

### Research Flags

Phases needing deeper research during planning:
- **Phase 2 (Resource Audit):** Write-path behavior for `pedidos` and `financeiros` is partially unknown — rate limits are undocumented, idempotency behavior unverified. Treat sandbox e2e runs as the primary research method. Budget extra time.

Phases with standard patterns (skip research-phase):
- **Phase 1 (Core Hardening):** All fixes are one-to-three line changes with documented solutions in PITFALLS.md.
- **Phase 3 (Public API Surface):** `isError()` guards, `SankhyaErrorCode` unions, and `listarTodos()` wrappers are well-documented TypeScript SDK patterns.
- **Phase 5 (CI/CD):** GitHub Actions + npm provenance is a fully documented, stable workflow.

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Core stack validated from actual project files; new additions (typedoc, publint, attw) from training data — verify versions on npm before install |
| Features | HIGH | Based on direct code inspection of v0.1.0 + stable patterns from Stripe, AWS SDK v3, Twilio |
| Architecture | HIGH | Grounded in actual codebase analysis; dual ESM/CJS patterns are long-standing Node.js community practice |
| Pitfalls | HIGH (1–15) / MEDIUM (16–18) | Pitfalls 1–15 derived from direct source analysis; Pitfalls 16–18 from sandbox findings and known ERP patterns — Sankhya changelog not publicly accessible |

**Overall confidence:** HIGH

### Gaps to Address

- **TypeDoc exact version:** Research gives `^0.27.x` from training data cutoff (August 2025). Verify against npm registry before `npm install typedoc` — run `npm info typedoc version` first.
- **publint + @arethetypeswrong/cli exact versions:** Same caveat — `^0.2.x` and `^0.17.x` respectively. Verify before pinning.
- **Sankhya rate limits:** Officially undocumented. Empirical discovery during Phase 2 sandbox validation is the only path. Add `Retry-After` header parsing to `retry.ts` to handle whatever limits are discovered.
- **Sankhya REST v1 behavior on version < 4.40:** SDK was validated against sandbox (which may represent a specific Sankhya minor version). Consumers on older versions may see field or pagination key differences. Document tested Sankhya version in README.
- **CJS moduleResolution compatibility:** The `package.json` exports map is architecturally correct for TypeScript 5+ consumers with `moduleResolution: "bundler"` or `"node16"`. Consumers using `"node"` resolution rely on the top-level `"types"` field. Validate during Phase 4 with the consumer test project.

---

## Sources

### Primary (HIGH confidence)
- Project source files: `src/`, `tests/`, `package.json`, `tsup.config.ts`, `tsconfig.json`, `vitest.config.ts` — read directly during research
- `.planning/codebase/STACK.md`, `.planning/codebase/TESTING.md`, `.planning/codebase/CONCERNS.md` — read directly
- `MEMORY.md` (project memory) — sandbox findings, API quirks, validated paths

### Secondary (MEDIUM confidence)
- Stripe Node.js SDK, AWS SDK v3, Twilio SDK — established patterns referenced from training knowledge (August 2025 cutoff); not scraped live
- TypeDoc ^0.27.x documentation — training knowledge; verify version on npm
- publint, @arethetypeswrong/cli — training knowledge; both tools are established (publint by Evan You's team; attw by Andrew Branch at Microsoft)
- Vitest coverage, projects API — training knowledge; stable since Vitest 2.x

### Tertiary (LOW confidence)
- Sankhya REST v1 version compatibility across ERP minor versions — official changelog not publicly accessible; based on sandbox findings only

---
*Research completed: 2026-04-06*
*Ready for roadmap: yes*
