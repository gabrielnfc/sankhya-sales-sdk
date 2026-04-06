# Roadmap: sankhya-sales-sdk

## Overview

The SDK core is complete (OAuth 2.0, HTTP client, 10 resources, dual ESM/CJS build). This roadmap covers the production-readiness milestone: fix three known core bugs, validate every resource against the real Sankhya sandbox, complete the public API surface, harden test coverage, write documentation, validate the package structure, configure CI/CD, and publish v1.0.0 to npm. Each phase depends on the previous — bugs must be fixed before sandbox validation, types must be verified before documentation, package must pass publint before CI releases it.

## Phases

- [ ] **Phase 1: Core Hardening** - Fix three known bugs in the serializer, retry, and auth token layers; configure coverage enforcement
- [x] **Phase 2: Read-Path Resource Validation** - Validate all read-only resources against sandbox; verify TypeScript types match real API fields (completed 2026-04-06)
- [ ] **Phase 3: Write-Path & E2E Validation** - Validate write operations for pedidos, financeiros, fiscal, gateway; run complete B2B order flow e2e
- [ ] **Phase 4: Public API Surface** - Add type guards, SankhyaErrorCode union, listarTodos() on all resources, idempotency keys, per-call timeout, internal audit
- [ ] **Phase 5: Test Coverage Hardening** - Enforce 90% unit coverage, add edge case tests, write integration test suite, CJS/ESM smoke tests
- [ ] **Phase 6: Documentation** - Write README, TSDoc all public API, configure TypeDoc, add error-handling guide, examples, CHANGELOG
- [ ] **Phase 7: Package Validation** - Run publint + attw, audit exports, enforce zero any, complete strict mode compliance, validate npm pack
- [ ] **Phase 8: CI/CD & Release** - GitHub Actions for CI + integration + release; publish v1.0.0 with npm provenance; GitHub Release

## Phase Details

### Phase 1: Core Hardening
**Goal**: All known serializer, retry, and auth bugs are fixed; coverage enforcement is active from this point forward
**Depends on**: Nothing (first phase)
**Requirements**: CORE-01, CORE-02, CORE-03, CORE-04, CORE-05, CORE-06, CORE-07
**Success Criteria** (what must be TRUE):
  1. Deserializing a Gateway response with TAXAJURO `{ "$": {} }` produces an empty string, not `"[object Object]"` or NaN
  2. Deserializing a row with an extra DHALTER field preserves all expected fields and logs the unknown field, not silently drops data
  3. Token refresh with `expires_in < 60` produces a valid positive TTL (minimum 10 seconds), not negative or zero
  4. Retry on POST/PUT (pedidos, financeiros) does not duplicate mutations — either per-method disabled or guarded by idempotency
  5. `vitest run --coverage` enforces >= 90% thresholds and fails CI if not met
**Plans**: 3 plans
Plans:
- [x] 01-01-PLAN.md — Fix Gateway serializer bugs (TAXAJURO, DHALTER, empty response)
- [x] 01-02-PLAN.md — Fix auth TTL guard, retry jitter, and method-aware retry
- [x] 01-03-PLAN.md — Install coverage provider and configure 90% thresholds

### Phase 2: Read-Path Resource Validation
**Goal**: All read-only resources produce correct TypeScript types and working methods verified against the real Sankhya sandbox
**Depends on**: Phase 1
**Requirements**: RVAL-01, RVAL-02, RVAL-03, RVAL-04, RVAL-05, RVAL-08, RVAL-11
**Success Criteria** (what must be TRUE):
  1. `client.clientes.listar()` returns a typed page of clientes with correct field names from sandbox
  2. `client.produtos.listar()`, `buscar()`, `grupos()` all return typed results matching real API response fields
  3. `client.estoque.porProduto()` and `client.precos.porTabela()` return typed results without any implicit `any`
  4. `client.cadastros.tiposNegociacao()` and `client.cadastros.modelosNota()` (Gateway-only routes) return data from sandbox
  5. TypeScript interfaces for each of the 7 resources in this phase have zero field name mismatches against real API responses
**Plans**: 2 plans
Plans:
- [x] 02-01-PLAN.md — Validate clientes, vendedores, produtos types and add field-level integration tests
- [x] 02-02-PLAN.md — Validate precos, estoque, cadastros types, fix TAXAJURO, add field-level integration tests

### Phase 3: Write-Path & E2E Validation
**Goal**: All write operations are safe against duplicate mutations and verified against sandbox; complete B2B order flow runs end-to-end
**Depends on**: Phase 2
**Requirements**: RVAL-06, RVAL-07, RVAL-09, RVAL-10, RVAL-12
**Success Criteria** (what must be TRUE):
  1. `client.pedidos.criar()` → `adicionarItem()` → `confirmar()` → `faturar()` completes without error against sandbox
  2. `client.financeiros.listarReceitas()` and `criarReceita()` return typed results from sandbox without data corruption
  3. `client.gateway.saveRecord()` persists a record and `loadRecord()` retrieves it with correct field mapping
  4. The complete B2B flow (criar cliente → consultar produto → checar estoque → criar pedido → adicionar itens → confirmar → faturar) executes successfully against sandbox
  5. No write operation retries on timeout without idempotency protection — duplicate entries do not appear in sandbox after a simulated timeout + retry
**Plans**: 3 plans
Plans:
- [ ] 03-01-PLAN.md — Validate pedidos write-path and gateway CRUD against sandbox
- [ ] 03-02-PLAN.md — Type financeiros write methods and validate financeiros + fiscal against sandbox
- [ ] 03-03-PLAN.md — E2E B2B order flow integration test

### Phase 4: Public API Surface
**Goal**: The public API exported from sankhya-sales-sdk is complete, consistent, and stable for v1.0.0 consumers
**Depends on**: Phase 3
**Requirements**: APIS-01, APIS-02, APIS-03, APIS-04, APIS-05, APIS-06
**Success Criteria** (what must be TRUE):
  1. `isSankhyaError(err)`, `isAuthError(err)`, `isApiError(err)`, `isGatewayError(err)`, `isTimeoutError(err)` all narrow the error type correctly in TypeScript
  2. `SankhyaErrorCode` union type is exported and usable in `switch(err.code)` statements with full autocomplete
  3. Every resource with list methods exposes `listarTodos()` returning an AsyncGenerator usable with `for await...of`
  4. `client.pedidos.criar({ ..., idempotencyKey: 'uuid' })` and equivalent financeiros mutations accept optional idempotency keys
  5. Internal utilities (`withRetry`, `createPaginator`, `deserializeRows`) are marked `@internal` and excluded from the public type surface; per-call timeout override works via `RequestOptions`
**Plans**: 3 plans
Plans:
- [ ] 04-01-PLAN.md -- Type guards, SankhyaErrorCode union, RequestOptions interface, export audit
- [ ] 04-02-PLAN.md -- listarTodos() gap fill on all resources + per-call timeout in HttpClient
- [ ] 04-03-PLAN.md -- Idempotency key support for pedidos and financeiros mutations

### Phase 5: Test Coverage Hardening
**Goal**: The entire codebase is covered by >= 90% unit tests plus integration tests for every resource and a verified CJS/ESM dual-format build
**Depends on**: Phase 4
**Requirements**: TEST-01, TEST-02, TEST-03, TEST-04, TEST-05, TEST-06
**Success Criteria** (what must be TRUE):
  1. `npm test` passes with >= 90% line, branch, and function coverage reported by `@vitest/coverage-v8`
  2. `npm run test:integration` runs one integration test per resource against sandbox and all pass
  3. The B2B e2e test (`tests/integration/e2e-pedido-b2b.test.ts`) passes against sandbox
  4. `node -e "const sdk = require('sankhya-sales-sdk'); console.log(sdk.SankhyaClient)"` prints the constructor, proving CJS works and `instanceof` is preserved
  5. `node --input-type=module -e "import { SankhyaClient } from 'sankhya-sales-sdk'; console.log(SankhyaClient)"` prints the constructor, proving ESM works
  6. Unit tests cover TAXAJURO empty object, DHALTER extra field, pagination string values, and TipoPessoa F/J edge cases explicitly
**Plans**: 3 plans
Plans:
- [ ] TBD

### Phase 6: Documentation
**Goal**: Any Node.js developer can use sankhya-sales-sdk within 5 minutes using only the README, TSDoc tooltips in their IDE, and the generated API reference
**Depends on**: Phase 5
**Requirements**: DOCS-01, DOCS-02, DOCS-03, DOCS-04, DOCS-05, DOCS-06
**Success Criteria** (what must be TRUE):
  1. The README has a working quick-start (install → configure OAuth → first API call) that completes under 5 minutes of reading and running
  2. Every exported function, class, and type in `src/index.ts` has a TSDoc comment that appears as an IDE tooltip with param descriptions
  3. `npm run docs` generates navigable HTML API reference with TypeDoc — all public types link-navigable
  4. A developer catching an `ApiError` can find a copy-pasteable try/catch example in the error handling guide that covers all 5 error classes
  5. Running any code file in `examples/` against sandbox produces real API output without modification
  6. CHANGELOG.md exists with a v0.1.0 entry and a v1.0.0-preview entry following Keep a Changelog format
**Plans**: 3 plans
Plans:
- [ ] TBD

### Phase 7: Package Validation
**Goal**: The npm package passes all automated package validators and is structurally correct for every TypeScript and Node.js consumer configuration
**Depends on**: Phase 6
**Requirements**: PKGP-01, PKGP-02, PKGP-03, PKGP-04, PKGP-05, PKGP-06
**Success Criteria** (what must be TRUE):
  1. `npx publint` exits 0 with no errors or warnings against the built package
  2. `npx @arethetypeswrong/cli --pack .` reports no type resolution errors for `node16`, `bundler`, and `node` moduleResolution modes
  3. `npm run prepublishOnly` runs lint + typecheck + test + build + publint in sequence and blocks publish on any failure
  4. `npm pack --dry-run` lists only `dist/`, `README.md`, `CHANGELOG.md`, `LICENSE`, and `package.json` — no source files, test files, or `.planning/` leak into the tarball
  5. `grep -r "any" src/ --include="*.ts"` returns zero matches (excluding comments and type assertions with explanations)
  6. `tsc --noEmit` passes with `strict: true`, `noUncheckedIndexedAccess: true`, and all strict-family flags enabled
**Plans**: 3 plans
Plans:
- [ ] TBD

### Phase 8: CI/CD & Release
**Goal**: Every push to main runs automated quality gates; v1.0.0 is published to npm with provenance attestation and a GitHub Release
**Depends on**: Phase 7
**Requirements**: CICD-01, CICD-02, CICD-03, CICD-04, CICD-05
**Success Criteria** (what must be TRUE):
  1. Opening a PR triggers GitHub Actions `ci.yml` — lint, typecheck, unit tests, and build all pass and are visible as PR checks
  2. Coverage report is posted as a PR comment or visible in the CI run summary showing >= 90% thresholds met
  3. Pushing to main triggers `integration.yml` — integration tests run against sandbox using GitHub Secrets and results are visible
  4. Creating a `v1.0.0` git tag triggers `release.yml` — npm publishes with `--provenance` and the package appears on npmjs.com with a provenance badge
  5. A GitHub Release `v1.0.0` exists with release notes summarizing the v1.0.0 changelog and a link to the published npm package

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Core Hardening | 3/3 | Complete |  |
| 2. Read-Path Resource Validation | 2/2 | Complete   | 2026-04-06 |
| 3. Write-Path & E2E Validation | 0/3 | Planning complete | - |
| 4. Public API Surface | 1/3 | In Progress | - |
| 5. Test Coverage Hardening | 0/TBD | Not started | - |
| 6. Documentation | 0/TBD | Not started | - |
| 7. Package Validation | 0/TBD | Not started | - |
| 8. CI/CD & Release | 0/TBD | Not started | - |
