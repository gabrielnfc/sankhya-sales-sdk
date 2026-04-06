# Technology Stack

**Project:** sankhya-sales-sdk
**Researched:** 2026-04-06
**Mode:** Subsequent milestone — taking functional TypeScript SDK to production-ready npm package

---

## Context

The SDK already has a working build system (tsup, Vitest, Biome, TypeScript 5.8). This research focuses on the **gaps** for production readiness:

1. Coverage enforcement — threshold config missing
2. E2e / integration test separation — no `.env.ci` strategy, no test project
3. Documentation generation — TypeDoc not configured
4. Package validation — `publint` / `@arethetypeswrong/cli` not present
5. CI/CD — no GitHub Actions workflows
6. npm publishing — no provenance, no release automation

---

## Recommended Stack

### Core Framework (existing — keep as-is)

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| TypeScript | ^5.8.0 | Language | Strict mode already configured; `noUncheckedIndexedAccess` + `noUnusedLocals` are production-grade settings. No change needed. |
| tsup | ^8.3.0 | Build bundler | Produces ESM + CJS dual output with `.d.ts` and `.d.cts` — correct for modern npm. Already configured. |
| Vitest | ^3.0.0 | Test runner | Fast, native ESM, built-in fetch mocking, `vi.spyOn`. Already used. |
| Biome | ^1.9.0 | Lint + format | Single tool replaces ESLint + Prettier. Already configured. |

**Confidence:** HIGH — all are current major versions as of mid-2025.

---

### Coverage Enforcement (add to existing Vitest setup)

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| @vitest/coverage-v8 | ^3.0.0 (match Vitest) | Coverage provider | V8 is the correct provider for Node 20+ — no instrumentation overhead, no Istanbul transform needed. Faster than `coverage-istanbul` for this stack. |

**What to add to `vitest.config.ts`:**
```ts
coverage: {
  provider: 'v8',
  reporter: ['text', 'lcov', 'html'],
  thresholds: {
    lines: 90,
    functions: 90,
    branches: 85,   // Gateway conditional paths lower threshold — realistic
    statements: 90,
  },
  exclude: ['tests/**', 'dist/**', 'src/index.ts'],
},
```

**Why NOT `coverage-istanbul`:** Istanbul requires babel transform to instrument; in a pure ESM + Node 20 project with zero deps, V8 coverage is simpler, faster, and equally accurate.

**Confidence:** HIGH — `@vitest/coverage-v8` is the Vitest-recommended provider for Node environments since Vitest 1.x.

---

### Test Separation Strategy (no new libraries — Vitest config)

The current setup mixes unit and integration tests under a single `vitest run`. For a production SDK with sandbox credentials, this creates fragility in CI.

**Recommended pattern — Vitest projects (built-in, no new dependency):**

```ts
// vitest.config.ts
export default defineConfig({
  test: {
    projects: [
      {
        name: 'unit',
        include: ['tests/core/**/*.test.ts'],
        environment: 'node',
      },
      {
        name: 'integration',
        include: ['tests/integration/**/*.test.ts'],
        testTimeout: 60_000,
        environment: 'node',
      },
    ],
  },
});
```

Then in CI: `vitest run --project unit` (no credentials needed), `vitest run --project integration` (sandbox secrets required, separate job).

**Confidence:** HIGH — Vitest projects API is stable since Vitest 2.x.

---

### E2E Test Approach (minimal — no new framework)

For the "validate CRUD end-to-end against sandbox" requirement, the existing integration test pattern (`describe.skipIf(!has)`) is already correct. Extend it with dedicated e2e files under `tests/e2e/`:

- No Playwright or Cypress — those are browser tools, irrelevant here.
- No dedicated e2e framework (like `jest-circus`) — Vitest handles async API calls natively.
- Pattern: one file per resource domain, testing the full lifecycle: `criar → consultar → atualizar → cancelar`.

**Why NOT a separate e2e framework:** The "e2e" for an API SDK means calling real HTTP endpoints, not simulating user interactions. Vitest with `describe.skipIf` already handles this cleanly.

**Confidence:** HIGH — this is the established pattern for API SDKs.

---

### Documentation Generation (add)

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| typedoc | ^0.27.x | API reference HTML | Reads TSDoc comments and `.d.ts` output, generates searchable HTML site. De-facto standard for TypeScript libraries. |
| typedoc-plugin-markdown | ^4.x | Markdown output | Optional — generates `.md` files instead of HTML, useful for embedding in GitHub Wiki or READMEs. Only add if docs will live in a wiki rather than a dedicated site. |

**Why TypeDoc over alternatives:**
- **TSDoc + api-extractor (Microsoft):** `api-extractor` is powerful but adds `api-extractor.json` config complexity and is overkill for a single-package SDK without monorepo. TypeDoc is simpler.
- **jsdoc:** Does not natively understand TypeScript types — requires workarounds. Ruled out.
- **Docusaurus:** Full documentation site generator, too heavy for an SDK whose docs live on npm and a README.

**Minimal TypeDoc config (`typedoc.json`):**
```json
{
  "entryPoints": ["src/index.ts"],
  "out": "docs",
  "readme": "README.md",
  "name": "sankhya-sales-sdk",
  "includeVersion": true,
  "excludePrivate": true,
  "excludeInternal": true,
  "plugin": []
}
```

**Confidence:** MEDIUM — TypeDoc ^0.27.x version is from training data (August 2025). Verify exact version on npm before pinning.

---

### Package Validation (add — critical for npm publishing)

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| publint | ^0.2.x | Package.json exports validation | Catches broken `exports` fields, missing files, wrong `types` paths before consumers encounter them. Run as part of `prepack` script. |
| @arethetypeswrong/cli | ^0.17.x | TypeScript types compatibility check | Validates that `.d.ts` and `.d.cts` are correctly resolvable for both ESM and CJS consumers using `moduleResolution: node16`, `bundler`, etc. Critical for dual-format packages. |

**Why both tools:**
- `publint` catches package.json structural issues (missing `main`, wrong `files` glob, etc.)
- `attw` (`@arethetypeswrong/cli`) catches TypeScript-specific resolution failures that `publint` misses — specifically whether CJS consumers get `.d.cts` and ESM consumers get `.d.ts` correctly under different `moduleResolution` settings.

**Current `package.json` exports look correct**, but `attw` will catch edge cases (e.g., whether `moduleResolution: node` consumers can use the package — spoiler: they may get resolution errors with the current setup, which is a known tradeoff that should be documented).

**Scripts to add:**
```json
"check:exports": "publint && attw --pack ."
```

**Confidence:** MEDIUM — versions are from training data. Both tools are established in the TypeScript ecosystem (publint by Evan You's team; attw by Andrew Branch at Microsoft).

---

### CI/CD (add — GitHub Actions)

No new npm dependencies. GitHub Actions workflows only.

**Recommended workflow structure:**

#### `.github/workflows/ci.yml` — runs on every push/PR

```yaml
jobs:
  unit-tests:
    # Node 20, npm ci, vitest run --project unit
    # No secrets needed

  typecheck:
    # tsc --noEmit

  lint:
    # biome check src/ tests/

  check-exports:
    # npm run build && publint && attw --pack .
```

#### `.github/workflows/release.yml` — runs on tag push `v*`

```yaml
jobs:
  publish:
    # npm ci, npm run build, npm publish --provenance
    # Requires NPM_TOKEN secret
    # Uses: actions/checkout@v4, actions/setup-node@v4
```

**Key CI decisions:**
- **Integration tests are NOT in CI by default** — they require sandbox credentials and are slow (30-60s per resource). Add as a separate `integration.yml` that runs on schedule (e.g., nightly) or manually, with sandbox credentials as GitHub Secrets.
- **Provenance (`--provenance`)** — npm 9+ supports SLSA provenance attestation via `--provenance` flag. This is free, links the published package to the GitHub Actions run, and is a 2025 best practice for open-source packages.
- **No `npm version` automation** — manage version bumps manually (`npm version patch/minor/major`) to keep CHANGELOG authorship intentional.

**Why NOT semantic-release or changesets:**
- `semantic-release` requires conventional commits discipline from day one — good for teams, overkill for a single-author SDK.
- `changesets` is excellent for monorepos — not needed for a single package.
- Manual `npm version` + GitHub Release is simpler and more controllable.

**Confidence:** HIGH — GitHub Actions `actions/setup-node@v4` + `npm publish --provenance` is well-documented and current.

---

### npm Publishing Checklist (no new tools — config)

**Required `package.json` additions before v1.0.0:**

```json
{
  "repository": {
    "type": "git",
    "url": "https://github.com/gabrielnfc/sankhya-sales-sdk.git"
  },
  "bugs": {
    "url": "https://github.com/gabrielnfc/sankhya-sales-sdk/issues"
  },
  "homepage": "https://github.com/gabrielnfc/sankhya-sales-sdk#readme",
  "publishConfig": {
    "access": "public"
  }
}
```

**`files` field review:** Currently `["dist"]`. This is correct — do NOT include `src/`, `tests/`, `.env.example`, or config files in the published package.

**`.npmignore` vs `files` field:** The `files` field whitelist approach (already used) is superior to `.npmignore` blacklist — it's explicit and doesn't accidentally include new files.

**`sideEffects: false`** — add to `package.json`. Tells bundlers (webpack, rollup, esbuild) the package has no side effects, enabling tree-shaking. An SDK with no global mutations qualifies.

**Confidence:** HIGH — these are stable npm best practices.

---

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| Coverage | @vitest/coverage-v8 | @vitest/coverage-istanbul | Istanbul requires babel transform; V8 is native to Node, simpler setup |
| Documentation | typedoc | api-extractor + api-documenter | api-extractor adds significant config complexity, designed for monorepos |
| Documentation | typedoc | jsdoc | jsdoc doesn't understand TypeScript types natively |
| Release automation | Manual npm version | semantic-release | Requires conventional commit discipline; overkill for single-author SDK |
| Release automation | Manual npm version | changesets | Monorepo tool; no benefit for single package |
| E2E framework | Vitest (existing) | Playwright/Cypress | Those are browser automation tools; API SDK e2e = HTTP calls |
| Package validation | publint + attw | Manual testing | Manual testing misses moduleResolution edge cases |
| CI | GitHub Actions | CircleCI / Jenkins | GitHub Actions is free for public repos, no additional account needed |

---

## Complete devDependencies After Milestone

```json
{
  "devDependencies": {
    "@biomejs/biome": "^1.9.0",
    "@types/node": "^20.17.0",
    "@vitest/coverage-v8": "^3.0.0",
    "@arethetypeswrong/cli": "^0.17.0",
    "publint": "^0.2.0",
    "tsup": "^8.3.0",
    "typedoc": "^0.27.0",
    "typescript": "^5.8.0",
    "vitest": "^3.0.0"
  }
}
```

**New additions:** `@vitest/coverage-v8`, `@arethetypeswrong/cli`, `publint`, `typedoc`.

**Stays zero runtime dependencies** — all additions are `devDependencies`.

---

## Complete Scripts After Milestone

```json
{
  "scripts": {
    "build": "tsup",
    "dev": "tsup --watch",
    "test": "vitest run",
    "test:unit": "vitest run --project unit",
    "test:integration": "vitest run --project integration",
    "test:e2e": "vitest run --project e2e",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage",
    "lint": "biome check src/ tests/",
    "lint:fix": "biome check --write src/ tests/",
    "typecheck": "tsc --noEmit",
    "docs": "typedoc",
    "check:exports": "publint && attw --pack .",
    "prepack": "npm run build && npm run check:exports"
  }
}
```

---

## Sources

- Project files: `package.json`, `vitest.config.ts`, `tsup.config.ts`, `tsconfig.json` — read directly
- Existing codebase analysis: `.planning/codebase/STACK.md`, `.planning/codebase/TESTING.md` — read directly
- Vitest coverage docs, TypeDoc, publint, attw — **training data (August 2025 cutoff)**. Web verification was blocked during this research session.

---

## Confidence Assessment

| Area | Confidence | Reason |
|------|------------|--------|
| Core stack (TypeScript, tsup, Vitest, Biome) | HIGH | Already validated in project, versions confirmed from package.json |
| Coverage (@vitest/coverage-v8) | HIGH | Vitest-official package, recommended provider for Node 20+ |
| Test separation (Vitest projects) | HIGH | Stable Vitest API since v2.x |
| E2e approach (extend existing Vitest) | HIGH | Established pattern for API SDK testing |
| Documentation (TypeDoc) | MEDIUM | De-facto standard, but version (^0.27.x) from training — verify before install |
| Package validation (publint, attw) | MEDIUM | Both tools well-established, versions from training — verify before install |
| CI/CD (GitHub Actions) | HIGH | Standard, official actions are version-stable |
| npm publishing (provenance, sideEffects) | HIGH | Documented npm/GitHub Actions feature |

---

*Research generated: 2026-04-06. Web access was restricted during this session — version numbers for new additions (typedoc, publint, @arethetypeswrong/cli) should be verified against npm registry before pinning.*
