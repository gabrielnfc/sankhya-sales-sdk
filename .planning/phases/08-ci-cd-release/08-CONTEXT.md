# Phase 8: CI/CD & Release - Context

**Gathered:** 2026-04-07
**Status:** Ready for planning

<domain>
## Phase Boundary

Configure GitHub Actions for automated quality gates on every push/PR, integration testing on main, and npm publish with provenance on version tags. Create GitHub Release v1.0.0. This phase creates CI/CD infrastructure only — no SDK code changes.

</domain>

<decisions>
## Implementation Decisions

### Workflow Architecture
- **D-01:** Three separate workflow files: `ci.yml` (quality gates), `integration.yml` (sandbox tests), `release.yml` (npm publish + GitHub Release)
- **D-02:** `ci.yml` triggers on push and PR to any branch. Matrix: Node 20 + 22 (current LTS + next). Steps: install → lint → typecheck → test (unit only) → build
- **D-03:** `integration.yml` triggers on push to main only. Node 20 only. Uses GitHub Secrets for sandbox credentials. Runs `npm run test:integration`
- **D-04:** `release.yml` triggers on tag push matching `v*`. Publishes to npm with `--provenance`. Creates GitHub Release with notes from CHANGELOG.md

### Version and Publish Strategy
- **D-05:** Version bump is manual — developer updates package.json from 0.1.0 → 1.0.0, commits, then creates `git tag v1.0.0`
- **D-06:** npm publish uses `--provenance` flag (requires GitHub Actions OIDC, `id-token: write` permission)
- **D-07:** GitHub Release auto-generated from release.yml after successful npm publish, with CHANGELOG.md v1.0.0 section as body

### Secrets Configuration
- **D-08:** Required GitHub Secrets: `NPM_TOKEN`, `SANKHYA_BASE_URL`, `SANKHYA_CLIENT_ID`, `SANKHYA_CLIENT_SECRET`, `SANKHYA_X_TOKEN`
- **D-09:** Integration tests run only on push to main (not on schedule) — sandbox may have downtime, avoid false failures from cron runs

### Coverage Reporting
- **D-10:** Coverage via `@vitest/coverage-v8` (already installed). CI uploads coverage report as GitHub Actions artifact
- **D-11:** Coverage summary visible in GitHub Actions job summary (no PR comment action — keeps deps minimal)
- **D-12:** Coverage threshold enforcement stays in vitest.config.ts (already configured at 90%) — CI fails if threshold not met

### Claude's Discretion
- Exact GitHub Actions versions for actions (checkout, setup-node, etc.) — use latest stable
- Whether to add a coverage badge to README — optional, low priority
- Caching strategy for node_modules in CI (npm cache vs actions/cache)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Package Configuration
- `package.json` — Scripts (lint, typecheck, test, test:integration, test:smoke, test:coverage, build, prepublishOnly), engines, exports map
- `tsup.config.ts` — Build configuration (dual ESM/CJS)
- `vitest.config.ts` — Test configuration, coverage thresholds
- `biome.json` — Linter/formatter configuration

### Prior Phase Artifacts
- `.planning/phases/07-package-validation/07-03-SUMMARY.md` — Validation results confirming package is publish-ready
- `CHANGELOG.md` — v1.0.0 release notes content for GitHub Release

### npm Provenance
- npm provenance requires `id-token: write` and `contents: read` permissions in GitHub Actions
- Package must be published from a GitHub Actions workflow (not local)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `npm run lint` — biome check src/ tests/
- `npm run typecheck` — tsc --noEmit
- `npm run test` — vitest run (unit only, excludes integration/)
- `npm run test:integration` — vitest run tests/integration/
- `npm run test:coverage` — vitest run --coverage
- `npm run test:smoke` — CJS/ESM dual-format smoke tests
- `npm run build` — tsup (ESM + CJS + declarations + sourcemaps)
- `npm run prepublishOnly` — full pipeline (lint + typecheck + test + build + publint)

### Established Patterns
- Zero runtime dependencies — CI installs only devDependencies
- Node >= 20 required — no polyfills needed
- ESM-first (`"type": "module"`) with CJS fallback

### Integration Points
- `.github/workflows/` — new directory, no existing CI configuration
- `package.json` scripts — all CI steps map directly to existing npm scripts
- GitHub Secrets — manual setup required by repository owner

</code_context>

<specifics>
## Specific Ideas

No specific requirements — standard GitHub Actions patterns for npm TypeScript packages. User deferred all decisions to recommended defaults.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 08-ci-cd-release*
*Context gathered: 2026-04-07*
