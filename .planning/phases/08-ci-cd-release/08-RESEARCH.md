# Phase 8: CI/CD & Release - Research

**Researched:** 2026-04-07
**Domain:** GitHub Actions CI/CD, npm publishing with provenance, OIDC trusted publishing
**Confidence:** HIGH

## Summary

Phase 8 creates three GitHub Actions workflows (ci.yml, integration.yml, release.yml) and publishes v1.0.0 to npm with provenance attestation. All CI steps map directly to existing npm scripts -- no new tooling is needed beyond GitHub Actions configuration.

**Critical discovery:** npm classic tokens were permanently revoked on December 9, 2025. The user decision D-08 lists `NPM_TOKEN` as a required GitHub Secret, but this is no longer viable. npm now requires OIDC Trusted Publishing for provenance attestation. This eliminates the need for `NPM_TOKEN` entirely but requires: (1) configuring trusted publishing per-package on npmjs.com, (2) using npm CLI >= 11.5.1, and (3) `id-token: write` permission in the workflow. The publish job should use Node 24.x (ships with npm 11 natively) or Node 22 with `npm install -g npm@latest`.

**Second critical discovery:** `package.json` is missing the `repository` field, which is required for npm provenance attestation to work. This must be added before publishing.

**Primary recommendation:** Use OIDC Trusted Publishing (no NPM_TOKEN), Node 24 for the release job, Node 20+22 matrix for CI, and add the `repository` field to package.json.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- D-01: Three separate workflow files: `ci.yml` (quality gates), `integration.yml` (sandbox tests), `release.yml` (npm publish + GitHub Release)
- D-02: `ci.yml` triggers on push and PR to any branch. Matrix: Node 20 + 22. Steps: install -> lint -> typecheck -> test (unit only) -> build
- D-03: `integration.yml` triggers on push to main only. Node 20 only. Uses GitHub Secrets for sandbox credentials. Runs `npm run test:integration`
- D-04: `release.yml` triggers on tag push matching `v*`. Publishes to npm with `--provenance`. Creates GitHub Release with notes from CHANGELOG.md
- D-05: Version bump is manual -- developer updates package.json, commits, then creates `git tag v1.0.0`
- D-06: npm publish uses `--provenance` flag (requires GitHub Actions OIDC, `id-token: write` permission)
- D-07: GitHub Release auto-generated from release.yml after successful npm publish, with CHANGELOG.md v1.0.0 section as body
- D-08: Required GitHub Secrets: `NPM_TOKEN`, `SANKHYA_BASE_URL`, `SANKHYA_CLIENT_ID`, `SANKHYA_CLIENT_SECRET`, `SANKHYA_X_TOKEN` -- **NOTE: NPM_TOKEN is obsolete, see research findings below**
- D-09: Integration tests run only on push to main (not on schedule)
- D-10: Coverage via `@vitest/coverage-v8` (already installed). CI uploads coverage report as GitHub Actions artifact
- D-11: Coverage summary visible in GitHub Actions job summary (no PR comment action)
- D-12: Coverage threshold enforcement stays in vitest.config.ts (already configured at 90%)

### Claude's Discretion
- Exact GitHub Actions versions for actions (checkout, setup-node, etc.)
- Whether to add a coverage badge to README
- Caching strategy for node_modules in CI

### Deferred Ideas (OUT OF SCOPE)
None
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CICD-01 | GitHub Actions running lint, typecheck, test (unit), build on every push/PR | ci.yml workflow with Node 20+22 matrix, maps to existing npm scripts |
| CICD-02 | GitHub Actions running integration tests (with secrets) on push to main | integration.yml workflow with sandbox secrets as environment variables |
| CICD-03 | Coverage report generated and visible in CI | vitest `json-summary` reporter + GitHub Actions job summary step |
| CICD-04 | `npm publish --provenance` via GitHub Actions release workflow | OIDC Trusted Publishing (no NPM_TOKEN), Node 24 for publish step |
| CICD-05 | GitHub Release v1.0.0 with release notes | `softprops/action-gh-release` or `gh release create` after npm publish |
</phase_requirements>

## Standard Stack

### Core (GitHub Actions)
| Action | Version | Purpose | Why Standard |
|--------|---------|---------|--------------|
| actions/checkout | v6 | Checkout repository | Official GitHub action, latest stable |
| actions/setup-node | v6 | Setup Node.js runtime | Official, supports npm cache, registry-url |
| actions/upload-artifact | v4 | Upload coverage artifacts | Official artifact storage |
| softprops/action-gh-release | v2 | Create GitHub Release | Most popular community action for releases |

### Supporting
| Tool | Version | Purpose | When to Use |
|------|---------|---------|-------------|
| npm CLI | >= 11.5.1 | Publish with OIDC provenance | Required for trusted publishing in release job |
| Node.js 24.x | LTS | Release job runtime | Ships with npm 11 natively, avoids manual npm upgrade |
| Node.js 20 + 22 | LTS | CI matrix | Test on current and next LTS |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| softprops/action-gh-release | `gh release create` CLI | CLI works but action is more declarative, better error handling |
| Node 24 for publish | Node 22 + `npm install -g npm@latest` | Extra step, slower, potential version mismatch |
| OIDC Trusted Publishing | Granular access tokens (90-day) | Tokens require rotation, 2FA setup, less secure |

## Architecture Patterns

### Recommended Project Structure
```
.github/
  workflows/
    ci.yml            # Quality gates (push/PR)
    integration.yml   # Sandbox tests (main only)
    release.yml       # npm publish + GitHub Release (tag v*)
```

### Pattern 1: CI Quality Gates (ci.yml)
**What:** Matrix build running lint, typecheck, test, build on Node 20+22
**When to use:** Every push and PR to any branch
**Example:**
```yaml
name: CI

on:
  push:
    branches: ['**']
  pull_request:
    branches: ['**']

jobs:
  quality:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        node-version: [20, 22]
    steps:
      - uses: actions/checkout@v6
      - uses: actions/setup-node@v6
        with:
          node-version: ${{ matrix.node-version }}
          cache: 'npm'
      - run: npm ci
      - run: npm run lint
      - run: npm run typecheck
      - run: npm run test
      - run: npm run build

  coverage:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v6
      - uses: actions/setup-node@v6
        with:
          node-version: 22
          cache: 'npm'
      - run: npm ci
      - run: npm run test:coverage -- --reporter=json-summary --reporter=default
      # Parse coverage-summary.json and write to job summary
```

### Pattern 2: Integration Tests (integration.yml)
**What:** Run integration tests against Sankhya sandbox using GitHub Secrets
**When to use:** Push to main only
**Example:**
```yaml
name: Integration Tests

on:
  push:
    branches: [main]

jobs:
  integration:
    runs-on: ubuntu-latest
    env:
      SANKHYA_BASE_URL: ${{ secrets.SANKHYA_BASE_URL }}
      SANKHYA_CLIENT_ID: ${{ secrets.SANKHYA_CLIENT_ID }}
      SANKHYA_CLIENT_SECRET: ${{ secrets.SANKHYA_CLIENT_SECRET }}
      SANKHYA_X_TOKEN: ${{ secrets.SANKHYA_X_TOKEN }}
    steps:
      - uses: actions/checkout@v6
      - uses: actions/setup-node@v6
        with:
          node-version: 20
          cache: 'npm'
      - run: npm ci
      - run: npm run test:integration
```

### Pattern 3: Release with OIDC Trusted Publishing (release.yml)
**What:** Publish to npm with provenance via OIDC, then create GitHub Release
**When to use:** Tag push matching `v*`
**Critical:** Do NOT set NODE_AUTH_TOKEN -- OIDC handles authentication automatically
**Example:**
```yaml
name: Release

on:
  push:
    tags: ['v*']

jobs:
  publish:
    runs-on: ubuntu-latest
    permissions:
      contents: write   # For GitHub Release creation
      id-token: write   # For npm OIDC provenance
    steps:
      - uses: actions/checkout@v6
      - uses: actions/setup-node@v6
        with:
          node-version: 24
          registry-url: https://registry.npmjs.org/
      - run: npm ci
      - run: npm run prepublishOnly
      - run: npm publish --provenance --access public

      - name: Extract changelog for release
        id: changelog
        run: |
          # Extract version section from CHANGELOG.md
          VERSION=${GITHUB_REF#refs/tags/v}
          # sed/awk to extract the relevant section

      - uses: softprops/action-gh-release@v2
        with:
          body: ${{ steps.changelog.outputs.notes }}
          generate_release_notes: false
```

### Anti-Patterns to Avoid
- **Setting NODE_AUTH_TOKEN with OIDC:** Do NOT set this env var when using trusted publishing -- it forces npm to use token auth instead of OIDC
- **Using classic npm tokens:** Permanently revoked since Dec 9, 2025
- **Running prepublishOnly in release without checking CI passed:** The tag workflow should run its own verification OR require CI to have passed
- **Hardcoding npm version:** Use Node 24 which ships with npm 11 natively; avoid `npm install -g npm@11`

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| GitHub Release creation | Manual API calls / gh CLI scripts | softprops/action-gh-release@v2 | Handles asset upload, markdown body, draft/prerelease flags |
| npm cache in CI | Manual ~/.npm cache management | actions/setup-node `cache: 'npm'` | Built-in, uses package-lock.json hash |
| OIDC token generation | Custom token exchange code | GitHub Actions `id-token: write` permission | Native OIDC provider, zero config |
| Coverage report parsing | Custom JSON parsing scripts | vitest built-in `json-summary` reporter | Standard format, reliable output |

## Common Pitfalls

### Pitfall 1: Missing `repository` field in package.json
**What goes wrong:** `npm publish --provenance` fails with an error about missing repository information
**Why it happens:** npm needs to link the provenance attestation to a specific repository
**How to avoid:** Add `"repository": { "type": "git", "url": "git+https://github.com/gabrielnfc/sankhya-sales-sdk.git" }` to package.json
**Warning signs:** Provenance attestation step fails even though OIDC token is generated successfully

### Pitfall 2: Setting NODE_AUTH_TOKEN with OIDC
**What goes wrong:** npm falls back to token-based auth and fails because no valid token exists
**Why it happens:** NODE_AUTH_TOKEN presence overrides OIDC flow
**How to avoid:** Never set NODE_AUTH_TOKEN in the publish job. The `registry-url` in setup-node configures .npmrc but OIDC handles auth
**Warning signs:** 403 or 401 errors during publish despite id-token permission being set

### Pitfall 3: npm version too old for OIDC
**What goes wrong:** `npm publish --provenance` fails with cryptic errors or falls back to token auth
**Why it happens:** npm < 11.5.1 doesn't support the OIDC handshake protocol
**How to avoid:** Use Node 24.x (ships with npm 11) for the publish job. Node 20 ships with npm 10 which does NOT support OIDC
**Warning signs:** 404 errors during publish, "npm notice Access token expired" messages

### Pitfall 4: Trusted publishing not configured on npmjs.com
**What goes wrong:** OIDC token is generated but npm rejects the publish
**Why it happens:** Each package must have trusted publishing enabled in its npmjs.com access settings
**How to avoid:** Before first publish, go to `https://www.npmjs.com/package/sankhya-sales-sdk/access` and configure trusted publisher for the GitHub repository
**Warning signs:** This is a manual step that cannot be automated in the workflow

### Pitfall 5: Coverage thresholds in CI vs vitest.config.ts
**What goes wrong:** CI appears to pass but coverage is actually below threshold
**Why it happens:** Running `vitest run --coverage` without the config may use different settings
**How to avoid:** vitest.config.ts already has thresholds configured. `npm run test:coverage` uses this config. The CI step just needs to run `npm run test:coverage`
**Warning signs:** Coverage numbers differ between local and CI runs

### Pitfall 6: Tag trigger runs before CI completes
**What goes wrong:** A tag is pushed and release.yml publishes a broken package
**Why it happens:** Tag push doesn't wait for the push event's CI to complete
**How to avoid:** release.yml should run its own quality checks (lint, typecheck, test, build) before publishing, or the `prepublishOnly` script handles this
**Warning signs:** Published package has build errors

### Pitfall 7: CHANGELOG.md section extraction
**What goes wrong:** GitHub Release body is empty or contains wrong version's notes
**Why it happens:** Fragile parsing of CHANGELOG.md headings
**How to avoid:** Use a simple awk/sed pattern that extracts content between `## [X.Y.Z]` headings. Test the extraction logic locally first
**Warning signs:** Release notes showing "[Unreleased]" content or multiple version sections

## Code Examples

### Coverage Summary in Job Summary
```yaml
- name: Generate coverage report
  run: npx vitest run --coverage --reporter=default --reporter=json-summary --outputFile.json-summary=coverage/coverage-summary.json

- name: Coverage summary
  if: always()
  run: |
    echo "## Coverage Report" >> $GITHUB_STEP_SUMMARY
    echo "" >> $GITHUB_STEP_SUMMARY
    node -e "
      const c = require('./coverage/coverage-summary.json');
      const t = c.total;
      console.log('| Category | Coverage |');
      console.log('|----------|----------|');
      for (const [k, v] of Object.entries(t)) {
        console.log('| ' + k + ' | ' + v.pct + '% |');
      }
    " >> $GITHUB_STEP_SUMMARY
```

### CHANGELOG Section Extraction
```bash
VERSION=${GITHUB_REF#refs/tags/v}
NOTES=$(awk "/^## \[${VERSION}\]/{flag=1; next} /^## \[/{flag=0} flag" CHANGELOG.md)
echo "notes<<EOF" >> $GITHUB_OUTPUT
echo "$NOTES" >> $GITHUB_OUTPUT
echo "EOF" >> $GITHUB_OUTPUT
```

### package.json repository field (MUST ADD)
```json
{
  "repository": {
    "type": "git",
    "url": "git+https://github.com/gabrielnfc/sankhya-sales-sdk.git"
  }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| npm classic tokens (NPM_TOKEN) | OIDC Trusted Publishing | Dec 2025 (revoked) | No long-lived tokens needed; OIDC handles auth |
| `npm publish --provenance` with token | Automatic provenance with trusted publishing | Jul 2025 (GA) | Provenance is automatic with OIDC, --provenance flag optional but recommended |
| actions/checkout@v4 | actions/checkout@v6 | Jan 2026 | Updated to node24 runner |
| actions/setup-node@v4 | actions/setup-node@v6 | 2026 | Node24 runner support |
| Granular access tokens (90-day) | OIDC (zero tokens) | 2025-2026 | No rotation needed, no secret management |

**Deprecated/outdated:**
- npm classic tokens: permanently revoked Dec 9, 2025
- NPM_TOKEN secret: no longer needed for publish workflows using OIDC
- actions/checkout@v4, actions/setup-node@v4: superseded by v6

## Open Questions

1. **npmjs.com Trusted Publishing Setup**
   - What we know: Must be configured per-package in npmjs.com UI before first publish
   - What's unclear: Whether the package must already exist on npmjs.com or if first publish creates it
   - Recommendation: Document as a manual prerequisite step. The package owner must configure this before triggering the release workflow

2. **CHANGELOG.md v1.0.0 section**
   - What we know: Current CHANGELOG has `[1.0.0-preview]` and `[0.1.0]` sections. No `[1.0.0]` section yet
   - What's unclear: Whether CHANGELOG should be updated to `[1.0.0]` as part of this phase or a prior manual step
   - Recommendation: Include a task to update CHANGELOG.md from `1.0.0-preview` to `1.0.0` with the release date, as part of the version bump process

3. **D-08 Conflict: NPM_TOKEN**
   - What we know: User decision D-08 lists `NPM_TOKEN` as required. Classic tokens are revoked. OIDC replaces token auth
   - What's unclear: Whether user specifically wants token-based auth or just wants publish to work
   - Recommendation: Planner should note the conflict and implement OIDC (the working approach). Remove `NPM_TOKEN` from required secrets. Sandbox secrets (SANKHYA_*) are still needed for integration.yml

## Environment Availability

> This phase creates GitHub Actions workflows (YAML files). The workflows run on GitHub-hosted runners, not locally. No local environment dependencies needed beyond git.

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| GitHub Actions (remote) | All workflows | Assumed (GitHub repo) | N/A | N/A |
| Node.js 20 (CI runner) | ci.yml matrix | Yes (GitHub runner) | ubuntu-latest has it | N/A |
| Node.js 22 (CI runner) | ci.yml matrix | Yes (GitHub runner) | ubuntu-latest has it | N/A |
| Node.js 24 (CI runner) | release.yml publish | Yes (GitHub runner) | ubuntu-latest has it | Node 22 + npm upgrade |
| npmjs.com account | release.yml | Assumed | N/A | Cannot publish without it |

**Missing dependencies with no fallback:**
- npmjs.com trusted publishing configuration (manual step by package owner)

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 3.0.0 with @vitest/coverage-v8 |
| Config file | `vitest.config.ts` |
| Quick run command | `npm run test` |
| Full suite command | `npm run prepublishOnly` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CICD-01 | CI runs lint+typecheck+test+build on push/PR | manual (workflow YAML review) | Push branch, check GitHub Actions tab | N/A |
| CICD-02 | Integration tests run on push to main | manual (workflow YAML review) | Push to main, check Actions tab | N/A |
| CICD-03 | Coverage visible in CI | manual | Check job summary after CI run | N/A |
| CICD-04 | npm publish with provenance | manual | Create tag, check npmjs.com for provenance badge | N/A |
| CICD-05 | GitHub Release v1.0.0 | manual | Check github.com/releases after tag push | N/A |

### Sampling Rate
- **Per task commit:** YAML lint validation (optional: `actionlint` if available)
- **Per wave merge:** Push to branch and verify CI triggers
- **Phase gate:** Full manual verification after all workflows are pushed

### Wave 0 Gaps
None -- this phase produces workflow YAML files, not testable code. Validation is manual (push and observe GitHub Actions runs).

## Sources

### Primary (HIGH confidence)
- [npm Trusted Publishing docs](https://docs.npmjs.com/trusted-publishers/) - OIDC setup requirements
- [npm Provenance Statements](https://docs.npmjs.com/generating-provenance-statements/) - provenance flag and requirements
- [actions/checkout releases](https://github.com/actions/checkout/releases) - v6.0.2 latest
- [actions/setup-node](https://github.com/actions/setup-node) - v6 with registry-url support

### Secondary (MEDIUM confidence)
- [Bootstrapping NPM Provenance with GitHub Actions](https://www.thecandidstartup.org/2026/01/26/bootstrapping-npm-provenance-github-actions.html) - Node 24 requirement, complete workflow example
- [Things you need to do for npm trusted publishing to work](https://philna.sh/blog/2026/01/28/trusted-publishing-npm/) - npm 11.5.1 requirement, registry-url necessity
- [From Deprecated npm Classic Tokens to OIDC](https://dev.to/zhangjintao/from-deprecated-npm-classic-tokens-to-oidc-trusted-publishing-a-cicd-troubleshooting-journey-4h8b) - Classic token revocation Dec 9 2025

### Tertiary (LOW confidence)
- actions/setup-node@v6 runner requirement (v2.327.1+) -- may affect self-hosted runners, not GitHub-hosted

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - GitHub Actions versions verified from releases pages, npm OIDC docs are official
- Architecture: HIGH - Three-workflow pattern is well-established for npm packages
- Pitfalls: HIGH - Multiple sources confirm classic token revocation and OIDC requirements

**Research date:** 2026-04-07
**Valid until:** 2026-05-07 (stable domain, slow-changing)
