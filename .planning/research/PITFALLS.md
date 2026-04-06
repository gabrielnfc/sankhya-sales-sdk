# Domain Pitfalls

**Domain:** TypeScript SDK for ERP integration (Sankhya) — prototype-to-production phase
**Researched:** 2026-04-06
**Confidence:** HIGH (based on direct codebase analysis + known API behavior from sandbox findings)

---

## Critical Pitfalls

Mistakes that cause rewrites, silent data corruption, or blocked npm publishes.

---

### Pitfall 1: Exports Map Missing `types` Condition — Breaks Consumer TypeScript

**What goes wrong:** The `package.json` exports field has `types` nested inside `import` and `require` conditions. Some TypeScript versions and bundlers (webpack 4, Jest with ts-jest, older Vite versions) either ignore the nested `types` condition entirely or resolve types from the wrong format. Consumers get `Could not find a declaration file for module 'sankhya-sales-sdk'` or, worse, silently get `any` for every import.

**Why it happens:** The dual-format type declaration setup (`index.d.ts` for ESM, `index.d.cts` for CJS) is correct for TypeScript 5+, but the resolution logic requires `moduleResolution: "bundler"` or `"node16"` in the consumer's tsconfig. Projects using `"node"` resolution fall through to the top-level `"types"` field, which only points to `index.d.ts`. CJS consumers get ESM types, which causes subtle issues when default exports differ between formats.

**Warning signs:**
- `tsc --noEmit` passes in the SDK repo but fails in a test consumer project
- IDE autocomplete works in dev but breaks after `npm install` in a fresh project
- `require('sankhya-sales-sdk')` in CJS context shows wrong types
- `npm pack` tarball does not include both `.d.ts` and `.d.cts` files

**Prevention:**
- Run `npm pack --dry-run` and verify the file list includes `dist/index.d.ts`, `dist/index.d.cts`, `dist/index.js`, `dist/index.cjs`
- Create a minimal consumer test project (`test-consumer/`) with `"moduleResolution": "node16"` and `"moduleResolution": "bundler"`, verifying types resolve correctly in both
- Add `"typesVersions"` field as a fallback for older TypeScript: `{ "*": { "*": ["./dist/index.d.ts"] } }`
- Validate with `npx publint` before every publish — it catches exports misconfiguration automatically

**Phase:** npm publish validation phase

---

### Pitfall 2: Non-Idempotent Retries on POST/PUT — Duplicate Orders in Production

**What goes wrong:** `withRetry()` is applied to all HTTP methods uniformly (including POST and PUT). The Sankhya API has no idempotency keys. A network timeout on `POST /v1/vendas/pedidos` causes the SDK to retry — but the first request may have succeeded server-side. The consumer gets a `TimeoutError` but the order was created. On retry, a duplicate order is created. This is invisible in sandbox testing because sandbox is single-threaded and timeouts are rare.

**Why it happens:** The retry logic correctly identifies `TIMEOUT_ERROR` as retryable (line 25, `retry.ts`). The `HttpClient` wraps all methods uniformly in `requestWithRetry()`. There is no per-method or per-operation idempotency check.

**Warning signs:**
- Sandbox tests pass but production reports duplicate orders after network instability
- `pedidos.criar()`, `financeiros.criarReceita()`, `clientes.criar()` called during flaky network events
- Retry counter increments visible in logs but final response is success (means first attempt succeeded and retry also succeeded = duplicate)

**Prevention:**
- Document clearly in README and JSDoc that `pedidos.criar()`, `financeiros.criarReceita()`, `financeiros.criarDespesa()`, `clientes.criar()` are NOT safe to retry on timeout — callers must query-then-create
- Add optional `retry: false` per-request override in `SankhyaConfig` (or as a method option)
- Consider: do not apply `withRetry()` to POST/PUT by default — only retry GET and DELETE (which are idempotent in this API)
- Add CONCERNS entry and prominent JSDoc `@warning` on all write methods

**Phase:** E2E validation + resource audit phase

---

### Pitfall 3: `TAXAJURO` Empty Object `{}` Causes `"[object Object]"` in Deserialized Rows

**What goes wrong:** The Gateway returns `{ "TAXAJURO": { "$": {} } }` for certain financial records. The current `deserializeRows()` handles this via `JSON.stringify(raw)` at line 121 of `gateway-serializer.ts`, converting it to the string `"{}"`. Downstream code comparing `TAXAJURO` to `"0"` or `""` silently gets wrong results. Any numeric parsing of this field returns `NaN`.

**Why it happens:** The `$` wrapper can contain either a string scalar or an empty object — Sankhya's API is inconsistent. The serializer assumes scalar values inside `$` but silently falls through to `JSON.stringify` for non-strings.

**Warning signs:**
- Financial records with zero interest rate show `TAXAJURO: "{}"` instead of `TAXAJURO: "0"` or `TAXAJURO: ""`
- `Number.parseFloat("{}")` returns `NaN` — silent arithmetic errors in interest calculations
- Integration tests pass because sandbox data may not have the zero-interest edge case

**Prevention:**
- Add explicit guard in `deserializeRows()`: if `typeof raw === 'object'` and the object is empty (`Object.keys(raw).length === 0`), return `""` or `"0"` — not `JSON.stringify`
- Add a test case with the exact fixture: `{ "TAXAJURO": { "$": {} } }` expecting empty string output
- Document this quirk in the Gateway section of the README

**Phase:** Core e2e validation / resource audit phase

---

### Pitfall 4: Token Safety Margin Breaks Short-Lived Tokens

**What goes wrong:** `SAFETY_MARGIN_SECONDS = 60` is subtracted from `expires_in` unconditionally. If the Sankhya sandbox or a non-production environment issues tokens with `expires_in < 60` (observed with some OAuth proxy setups), `ttlSeconds` becomes negative or zero. The token is stored with `expiresAt` in the past, so every request triggers a full re-authentication roundtrip. Under load, the mutex protects against thundering herd but causes sequential queuing of all requests.

**Why it happens:** Hard-coded constant at line 6 of `auth.ts`. No lower-bound guard on `ttlSeconds`.

**Warning signs:**
- Auth logs show "Autenticando..." on every single request
- `refreshPromise` is never null when inspected during debugging
- Integration tests slow down dramatically when token TTL is short

**Prevention:**
- Add guard: `const ttlSeconds = Math.max(10, data.expires_in - SAFETY_MARGIN_SECONDS)` — guarantee at least 10 seconds of validity
- Or: use `Math.min(SAFETY_MARGIN_SECONDS, Math.floor(data.expires_in / 2))` to scale the margin relative to TTL
- Add a unit test with `expires_in: 30` asserting `expiresAt` is meaningfully in the future

**Phase:** Core e2e validation phase

---

### Pitfall 5: npm Publish Includes Test Files or `.env` — Credential Leak

**What goes wrong:** `package.json` uses `"files": ["dist"]` which is correct. However, if a `.npmignore` is absent and `files` is the only guard, any accidental addition to `dist/` (test artifacts, sourcemap references to absolute paths containing local paths) can leak sensitive information. More critically: if the build step is accidentally skipped before publish, `dist/` may be stale or contain debug builds.

**Why it happens:** `npm publish` without CI enforcement has no gate between `build` and `publish`. Developers sometimes run `npm publish` directly after code changes without rebuilding.

**Warning signs:**
- `npm pack --dry-run` shows unexpected files
- `dist/` contains files from a previous build with different source
- Sourcemaps in published package reference absolute Windows paths (`C:\Users\gabri\...`) — not a security leak but exposes dev environment and makes consumers' stack traces noisy

**Prevention:**
- Add `"prepublishOnly": "npm run build && npm run typecheck && npm test"` to `package.json` scripts — this runs automatically before `npm publish`
- Add `.npmignore` explicitly listing: `.env`, `.env.*`, `tests/`, `*.test.ts`, `tsconfig.json`, `biome.json`, `vitest.config.ts`
- Verify sourcemap paths are relative, not absolute (tsup defaults to relative — verify this is the case)
- Run `npx publint` as part of the publish checklist

**Phase:** npm publish phase

---

## Moderate Pitfalls

---

### Pitfall 6: Sandbox Endpoints Are Slow — Tests Appear Flaky at 30s Timeout

**What goes wrong:** The sandbox has known slow endpoints: `estoque/produtos`, `vendas/pedidos`, `financeiros/receitas`, `financeiros/despesas`. Integration tests with `testTimeout: 30_000` can hit the boundary under sandbox load. Tests that pass consistently in isolation fail when run as a full suite (because earlier tests hold the auth token and the sandbox queues requests).

**Why it happens:** 30-second Vitest timeout is at the test level, not the HTTP level. The SDK's own HTTP timeout defaults to 30 seconds. This means a slow sandbox response can consume the entire test timeout budget leaving no room for assertion and cleanup.

**Prevention:**
- Set Vitest `testTimeout: 60_000` for integration test files specifically (use separate vitest config or `vi.setConfig` per describe block)
- Set SDK timeout to `60_000` in integration test config
- Mark slow tests with explicit comment: `// SLOW: sandbox endpoint, ~10-25s`
- Consider separating slow integration tests into a dedicated `test:integration:slow` script

**Phase:** E2E validation phase

---

### Pitfall 7: `deserializeRows()` Silent Empty Return Masks API Contract Violations

**What goes wrong:** When `entities` is present but `entity` is absent (empty result set vs malformed response), `deserializeRows()` returns `{ rows: [], hasMore: false, page: 0 }` in both cases. Callers cannot distinguish "no results" from "the API returned a malformed response". This hides Gateway API changes that remove or restructure the `entity` key.

**Why it happens:** Lines 94-102 in `gateway-serializer.ts` return an empty result with `totalRecords` populated but no `rows`, which is identical to a genuine empty result set.

**Prevention:**
- Add a `responseValid: boolean` field to `DeserializedRows` (or throw a typed `GatewayError` when `entities` is present but structure is unexpected)
- At minimum, log a warning when `entities` exists but `entity` is missing — makes debugging API changes much faster

**Phase:** Core e2e validation phase

---

### Pitfall 8: No Jitter in Backoff — Thundering Herd During API Maintenance

**What goes wrong:** `delay = baseDelay * 2 ** attempt` is deterministic. If the Sankhya API returns 503 during a maintenance window and multiple SDK instances (multiple microservices, lambda invocations) all started at approximately the same time, they all retry at exactly the same intervals (1s, 2s, 4s, 8s). This creates synchronized retry storms that extend the maintenance window for all callers.

**Why it happens:** `retry.ts` line 56 uses pure exponential formula with no random component.

**Prevention:**
- Change to: `const delay = baseDelay * 2 ** attempt * (0.5 + Math.random() * 0.5)` — adds ±50% jitter
- This is a one-line fix with no breaking API changes
- Existing test for retry delay timing will need to use `toBeGreaterThan`/`toBeLessThan` range assertions instead of exact values

**Phase:** Core e2e validation phase (quick fix, do first)

---

### Pitfall 9: Gateway `loadRecords` Field Count Mismatch Causes Silent Data Loss

**What goes wrong:** `deserializeRows()` maps `f0→fieldNames[0]`, `f1→fieldNames[1]` etc. If the Sankhya API returns more entity fields than declared in metadata (the `DHALTER` extra field issue noted in memory), the extra fields have no name and are silently dropped. Conversely, if metadata declares more fields than the entity has, field names beyond the last entity field are mapped to `undefined` and skipped.

**Why it happens:** The mapping loop runs up to `fieldNames.length`, stopping before checking if entity has more `f{n}` keys beyond that index. The DHALTER quirk (documented in MEMORY.md) proves this happens in the real API.

**Prevention:**
- After mapping known fields, add a loop to capture unmapped `f{n}` keys beyond `fieldNames.length` and include them as `f{n}` (preserving data even without names)
- Add a test fixture with 3 metadata fields but 4 entity fields — assert the 4th field is captured (not dropped)
- Add a `debug` level log warning when entity field count exceeds metadata count

**Phase:** Core e2e validation phase

---

### Pitfall 10: Versioning and CHANGELOG Skipped — Breaking Changes Undocumented

**What goes wrong:** Going from v0.1.0 to v1.0.0 without a CHANGELOG means consumers cannot determine what changed between versions. Since this SDK abstracts ERP-specific quirks, even minor changes to type names (e.g., renaming `TipoPessoa` values or changing `DeserializedRows` shape) are breaking for consumers. Without semver discipline, v1.0.1 can ship breaking changes.

**Why it happens:** CHANGELOG is listed as a project requirement (`Active` state in PROJECT.md) but not yet created. The natural pressure to "just ship" skips changelog discipline.

**Warning signs:**
- git log shows type renames or method signature changes without corresponding semver bump
- `CHANGELOG.md` file absent when `npm publish` runs
- Version stays at `0.1.0` for months

**Prevention:**
- Create `CHANGELOG.md` before v1.0.0 — document all changes from v0.1.0
- Adopt [Keep a Changelog](https://keepachangelog.com) format (simple, community-standard)
- Add changelog update to the `prepublishOnly` checklist (not automated — manual review is intentional)
- Use PR description to track breaking changes during development

**Phase:** Documentation + npm publish phase

---

### Pitfall 11: `any` Creep in Resource Layer Bypasses Type Safety Guarantee

**What goes wrong:** The project constraint "Zero `any` in source code" is enforced by Biome (`no-explicit-any: error`). However, implicit `any` through `as unknown as SomeType` casts (already present in test factories) or through untyped REST response coercions can satisfy Biome while still being semantically untyped. The resources receive raw API responses and cast them to typed interfaces — if the API adds a field or renames one, the cast succeeds silently but the typed interface diverges from reality.

**Why it happens:** TypeScript structural typing means `response as Produto` succeeds even when `response` is missing half the `Produto` fields. No runtime validation exists between the API response and the TypeScript type.

**Prevention:**
- For critical read paths (especially `pedidos`, `clientes`), add lightweight runtime field validation (not a full schema library — just `if (!row.CODPARC) throw new ApiError(...)` guards)
- During the resource audit phase, cross-check every exported type's fields against sandbox responses field-by-field
- Add a comment `// validated against sandbox YYYY-MM-DD` in each resource file after verification

**Phase:** Resource audit + e2e validation phase

---

## Minor Pitfalls

---

### Pitfall 12: URL Validation Fails Silently at First Request

**What goes wrong:** `SankhyaClient` constructor validates that `baseUrl` is a non-empty string but does not validate URL format. `new SankhyaClient({ baseUrl: "localhost" })` constructs successfully but `authenticate()` fails with an unhelpful `TypeError: Failed to fetch` or `ECONNREFUSED`. The error message does not indicate the URL is malformed.

**Prevention:**
- Add `new URL(config.baseUrl)` in the constructor — throws `TypeError` immediately with `Invalid URL` if malformed
- Catch and rethrow as `SankhyaError` with clear message: `"baseUrl inválida: deve ser uma URL completa (ex: https://api.sankhya.com.br)"`

**Phase:** Config validation (quick fix, add to e2e phase)

---

### Pitfall 13: Integration Tests Skip Silently When `.env` is Missing — False Confidence

**What goes wrong:** Integration tests use `describe.skipIf(!has)` which silently skips the entire suite when sandbox credentials are absent. In CI without sandbox credentials, the test suite reports "all passed" with 0 integration tests run. This creates false confidence — CI green does not mean integration tests passed.

**Prevention:**
- Add a CI job that explicitly checks if integration tests were skipped and reports it (not a failure, but a visible annotation)
- In the test output summary, add a `console.warn` when skipping: `"[sankhya-sdk] Testes de integração ignorados — variáveis de sandbox ausentes"`
- Document in README which tests require sandbox credentials

**Phase:** CI/CD setup phase

---

### Pitfall 14: `npm version` Without Git Tag — GitHub Release Disconnected from npm

**What goes wrong:** Publishing to npm without creating a corresponding git tag means the GitHub Release cannot be automatically linked to the correct commit. If `npm publish` is run manually from a dirty working directory, the published version does not correspond to any reviewable git state.

**Prevention:**
- Always use `npm version patch|minor|major` (not manual edit) — this creates a git commit AND tag atomically
- Add `"release": "npm version minor && git push --follow-tags && npm publish"` to package.json scripts
- GitHub Release should reference the git tag — create it from the tag, not from a branch

**Phase:** npm publish phase

---

### Pitfall 15: `sideEffects: false` Not Set — Tree-Shaking Broken for Bundler Consumers

**What goes wrong:** The package.json does not declare `"sideEffects": false`. Bundlers (webpack, Rollup, esbuild) assume modules may have side effects and cannot safely tree-shake unused exports. A consumer importing only `SankhyaClient` may end up bundling the entire SDK including `GatewayResource`, all resource files, and all types — even if they only use two resources. For serverless or edge deployments, bundle size matters.

**Why it happens:** `sideEffects: false` is not set by default. The SDK has no actual side effects (no module-level state mutations, no global registrations).

**Prevention:**
- Add `"sideEffects": false` to `package.json` — one-line change, zero risk for this SDK architecture
- Verify that lazy-loading via getters in `SankhyaClient` is compatible with tree-shaking (getters on class instances are not tree-shaken, but the resource classes themselves are)

**Phase:** npm publish phase (quick fix)

---

## ERP-Specific Pitfalls

---

### Pitfall 16: Sankhya REST v1 is Not Semantically Stable Across ERP Versions

**What goes wrong:** The SDK documents `>= 4.34` as minimum Sankhya version, but REST v1 endpoint behavior can change between minor Sankhya versions without notice. Fields added to responses silently (no SDK breakage), fields removed (TypeScript types diverge from reality), or pagination key names changed (breaks `extractRestData()` which looks for resource-specific keys like `produtos`, `clientes`).

**Why it happens:** Sankhya's official documentation is behind authentication (noted in MEMORY.md as blocked for scraping). Version changelog is not publicly accessible. SDK was built against sandbox which may not represent the oldest supported version (4.34).

**Warning signs:**
- Consumers on Sankhya < 4.40 report missing fields or `undefined` pagination
- `extractRestData()` returns empty because response uses a different resource key name
- Auth fails because token format changed in a Sankhya minor update

**Prevention:**
- Add `sankhyaVersion` field to `SankhyaConfig` (optional, informational) so SDK can log which version was tested
- Document in README which Sankhya version the sandbox tests were validated against
- Treat every Sankhya update notification as requiring a sandbox regression test run
- `extractRestData()` should log a warning when the expected resource key is not found — helps consumers diagnose version mismatches

**Phase:** Documentation phase + ongoing maintenance

---

### Pitfall 17: OAuth 2.0 Auth Deadline (30/04/2026) — Legacy Auth Removal Breaking Consumers

**What goes wrong:** Legacy authentication is discontinued on 30/04/2026. The SDK is already OAuth 2.0 only, which is correct. The risk is that consumers who wrote their own Sankhya integration using legacy auth (not using this SDK) may pin to this SDK version and misunderstand the OAuth requirement. Additionally, if any Sankhya sandbox environment still accepts legacy auth during development, the OAuth flow may behave differently in production.

**Why it happens:** SDK constraint is validated, but consumers may not be aware or may have mixed environments.

**Prevention:**
- Add a prominent "Authentication Requirements" section to the README with the 2026-04-30 deadline
- Add a check in `AuthManager.authenticate()` to log a warning if today's date is approaching the deadline and the client is misconfigured
- Test OAuth flow specifically against a production-proxied environment before v1.0.0 release

**Phase:** Documentation phase

---

### Pitfall 18: Rate Limiting — API Limits Unknown, No Client-Side Throttling

**What goes wrong:** The Sankhya API rate limits are not publicly documented. The SDK has retry logic for `429 Too Many Requests` but no proactive rate limiting. A consumer doing bulk operations (iterating `createPaginator()` across 10,000 products and calling a write method per item) can hit rate limits and trigger the retry storm described in Pitfall 8. Worse, if the API uses a per-token rate limit and the SDK is used in multiple parallel processes sharing the same credentials, they collectively exhaust the limit faster than any single instance can detect.

**Prevention:**
- Document explicitly in README: "Rate limits are enforced server-side. Do not run concurrent bulk write loops."
- Add `Retry-After` header parsing to `retry.ts` — when the API responds with `Retry-After: 30`, respect that value instead of exponential backoff
- Consider optional `requestsPerSecond` throttle parameter in `SankhyaConfig` for consumers doing bulk operations

**Phase:** E2e validation phase (discover rate limits empirically during sandbox testing)

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| E2e auth validation | Token safety margin breaks on short TTL (Pitfall 4) | Fix TTL guard before running full e2e suite |
| E2e core validation | Jitter-free retry causes synchronized test retries (Pitfall 8) | Add jitter first — one-line fix |
| Resource CRUD audit | Non-idempotent POST retry creates duplicate records (Pitfall 2) | Document + add retry override before testing write paths |
| Resource CRUD audit | TAXAJURO `{}` causes `"[object Object]"` in financial resources (Pitfall 3) | Fix deserializer guard before financial resource tests |
| Resource CRUD audit | Field count mismatch silently drops DHALTER and other extra fields (Pitfall 9) | Add unmapped-field capture loop before Gateway resource tests |
| Test coverage 90% | Implicit `any` via cast bypasses Biome but not semantic coverage (Pitfall 11) | Add runtime field guards during resource audit |
| npm publish | Exports map breaks CJS consumers' types (Pitfall 1) | Run `npx publint` + consumer test project before publish |
| npm publish | Missing `sideEffects: false` (Pitfall 15) | Add before publish — one-line, zero risk |
| npm publish | `prepublishOnly` gate absent (Pitfall 5) | Add before first npm publish |
| npm publish | No CHANGELOG (Pitfall 10) | Create before v1.0.0 |
| CI/CD setup | Integration tests skip silently in CI (Pitfall 13) | Add skip-detection in CI job |
| Documentation | Auth deadline and version compatibility undocumented (Pitfalls 16, 17) | Address in README before publish |
| Ongoing maintenance | Sankhya REST v1 semantic changes break field mappings (Pitfall 16) | Add version logging + regression test hook |

---

## Sources

**Confidence assessment:**
- Pitfalls 1–15: HIGH — derived from direct analysis of `src/`, `package.json`, `tests/`, and `.planning/codebase/CONCERNS.md`
- Pitfalls 16–18: MEDIUM — derived from sandbox findings documented in `MEMORY.md` and known ERP integration patterns; Sankhya changelog is not publicly accessible for independent verification

**Key source files analyzed:**
- `src/core/retry.ts` — Pitfalls 2, 8, 18
- `src/core/auth.ts` — Pitfall 4, 17
- `src/core/gateway-serializer.ts` — Pitfalls 3, 7, 9
- `src/index.ts` + `package.json` — Pitfalls 1, 5, 10, 15
- `.planning/codebase/CONCERNS.md` — Pitfalls 2, 3, 4, 7, 9, 11, 12
- `.planning/codebase/TESTING.md` — Pitfall 13
- `MEMORY.md` (project memory) — Pitfalls 16, 17, 18
