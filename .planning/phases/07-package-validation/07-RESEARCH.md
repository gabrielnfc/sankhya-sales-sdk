# Phase 7: Package Validation - Research

**Researched:** 2026-04-07
**Domain:** npm package validation, TypeScript strict compliance, tarball hygiene
**Confidence:** HIGH

## Summary

Phase 7 is a pure quality-gate phase -- no new features, only validation and fixes. The good news is that **both publint and attw already pass clean** against the current build. The primary work involves: (1) adding `sideEffects: false` to package.json, (2) creating the `prepublishOnly` script pipeline, (3) fixing tarball contents (CHANGELOG.md missing, README.en.md leaking), (4) evaluating additional strict TypeScript flags, and (5) confirming zero `any` types in source.

The `any` audit found only one match: `AbortSignal.any()` in http.ts, which is a native method name, not a type annotation -- this passes the zero-any requirement per decision D-06.

**Primary recommendation:** Focus on the prepublishOnly pipeline and tarball hygiene first, then evaluate strict TS flags. Most validators already pass -- this phase is about codifying the gates, not fixing broken output.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** `files` array in package.json should include `dist/` only. README.md, CHANGELOG.md, LICENSE, and package.json are included automatically by npm.
- **D-02:** No examples/, docs/, .planning/, tests/, or config files should leak into the tarball.
- **D-03:** Pipeline order: `biome check src/ tests/ -> tsc --noEmit -> vitest run (unit only, no integration) -> tsup -> publint`
- **D-04:** Integration tests excluded from prepublishOnly -- they require sandbox env vars and are too slow for publish gate.
- **D-05:** Enable additional strict flags (`exactOptionalPropertyTypes`, `noPropertyAccessFromIndexSignature`, etc.) only if they don't require extensive code changes. Document any that are skipped with justification.
- **D-06:** The `AbortSignal.any()` usage in http.ts is a native API call, not an `any` type -- should pass the zero-any audit.
- **D-07:** Add `"sideEffects": false` to package.json -- SDK is pure, no side effects.

### Claude's Discretion
- Order of fixing any issues found by publint/attw
- Whether to add `noPropertyAccessFromIndexSignature` or skip it based on impact

### Deferred Ideas (OUT OF SCOPE)
None.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PKGP-01 | `sideEffects: false` in package.json for tree-shaking | Simple field addition to package.json -- verified SDK has no side effects |
| PKGP-02 | `publint` and `@arethetypeswrong/cli` passing without errors | **Already passing** -- publint 0.3.18 and attw 0.18.2 both report zero issues |
| PKGP-03 | `prepublishOnly` script configured as gate | Pipeline defined in D-03; research documents exact script commands |
| PKGP-04 | `npm pack` generates clean tarball | Issues found: CHANGELOG.md missing, README.en.md leaking; fix via `.npmignore` or files array |
| PKGP-05 | Zero `any` in source code | Only match is `AbortSignal.any()` method name -- not a type; biome `noExplicitAny: error` already enforces |
| PKGP-06 | TypeScript strict mode compliance total | Current `tsc --noEmit` passes clean; additional flags evaluated below |
</phase_requirements>

## Standard Stack

### Core (already installed)
| Tool | Version | Purpose | Why Standard |
|------|---------|---------|--------------|
| TypeScript | ^5.8.0 | Type checking, strict mode | Already in devDeps |
| tsup | ^8.3.0 | Dual ESM/CJS build | Already in devDeps |
| Biome | ^1.9.0 | Lint + format | Already in devDeps, enforces noExplicitAny |
| Vitest | ^3.0.0 | Unit tests | Already in devDeps |

### Validation Tools (npx, not installed)
| Tool | Version | Purpose | When to Use |
|------|---------|---------|-------------|
| publint | 0.3.18 | Validate package.json exports, files, types | Run via `npx publint` in prepublishOnly |
| @arethetypeswrong/cli | 0.18.2 | Validate type resolution across moduleResolution modes | Run via `npx @arethetypeswrong/cli --pack .` manually or in CI |

**Note on attw in prepublishOnly:** Decision D-03 specifies the pipeline as `biome -> tsc -> vitest -> tsup -> publint`. attw is NOT in the prepublishOnly pipeline. attw requires `--pack` which is slower and more suited for CI than every-publish gate. Run it manually or in CI.

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| npx publint | Install publint as devDep | npx is fine for infrequent use; avoids dependency bloat |
| npx attw | Install @arethetypeswrong/cli as devDep | Same reasoning; CI-only tool |

## Architecture Patterns

### Current Package Structure (verified)
```
package.json         # exports map, files, engines, scripts
tsconfig.json        # strict: true, noUncheckedIndexedAccess, bundler resolution
tsup.config.ts       # ESM + CJS, dts, sourcemap, clean
biome.json           # noExplicitAny: error
.npmignore           # exists -- excludes src/, tests/, docs/, configs
dist/
  index.js           # ESM
  index.cjs          # CJS
  index.d.ts         # ESM types
  index.d.cts        # CJS types
  index.js.map       # ESM sourcemap
  index.cjs.map      # CJS sourcemap
```

### Pattern 1: prepublishOnly as Quality Gate
**What:** npm lifecycle script that runs before `npm publish` and `npm pack`
**When to use:** Always -- prevents publishing broken packages
**Example:**
```json
{
  "scripts": {
    "prepublishOnly": "npm run lint && npm run typecheck && npm run test && npm run build && npx publint"
  }
}
```
Note: `test` script runs `vitest run` which executes unit tests. Integration tests are excluded per D-04.

### Pattern 2: Tarball Content Control
**What:** Use `files` array in package.json plus npm auto-include rules
**When to use:** Always -- controls what ships to consumers
**Current state:**
- `files: ["dist"]` correctly limits to build output
- npm auto-includes: package.json, README.md, LICENSE
- **Issue:** CHANGELOG.md is NOT auto-included by npm 10.x despite documentation claims
- **Issue:** README.en.md IS auto-included because npm matches `README*` pattern

### Anti-Patterns to Avoid
- **Installing publint/attw as devDeps for a one-off check:** npx is sufficient; keeps devDeps lean
- **Adding attw to prepublishOnly:** It's slow (packs the project internally) and better suited for CI
- **Enabling `exactOptionalPropertyTypes` without fixes:** Causes 10 errors across core modules; requires careful `| undefined` additions

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Package exports validation | Manual checks of package.json | `publint` | Catches 40+ export map issues |
| Type resolution validation | Manual testing with different tsconfigs | `@arethetypeswrong/cli` | Tests node10, node16, bundler modes |
| Any-type detection | Manual grep | `biome check` with noExplicitAny | Already configured, catches at lint time |

## Common Pitfalls

### Pitfall 1: CHANGELOG.md Not in Tarball
**What goes wrong:** npm 10.x does not auto-include CHANGELOG.md despite npm docs suggesting it should
**Why it happens:** Known npm CLI issue (#8434) -- only README*, LICENSE*, and package.json are truly auto-included
**How to avoid:** Add `"CHANGELOG.md"` to the `files` array in package.json
**Warning signs:** `npm pack --dry-run` output missing CHANGELOG.md

### Pitfall 2: README.en.md Leaking into Tarball
**What goes wrong:** npm auto-includes anything matching `README*`, so `README.en.md` appears in tarball
**Why it happens:** npm's auto-include pattern is `README*` not just `README.md`
**How to avoid:** Either rename to `docs/README.en.md` (move out of root) or add to `.npmignore`
**Warning signs:** `npm pack --dry-run` shows unexpected README.en.md

### Pitfall 3: exactOptionalPropertyTypes Causing Extensive Changes
**What goes wrong:** Enabling this flag requires `| undefined` additions wherever optional properties are assigned
**Why it happens:** TypeScript's `strict` does NOT include `exactOptionalPropertyTypes` -- it's opt-in
**How to avoid:** Per D-05, only enable if changes are minimal. Current count: **10 errors** across auth.ts, errors.ts, gateway-serializer.ts, http.ts, pagination.ts -- moderate effort
**Warning signs:** `tsc --noEmit --exactOptionalPropertyTypes` shows errors

### Pitfall 4: noPropertyAccessFromIndexSignature Too Invasive
**What goes wrong:** Requires bracket notation for all index-signature property access
**Why it happens:** Gateway deserialized records are `Record<string, string>` accessed with dot notation
**How to avoid:** Per D-05, skip this flag -- **45 errors** across resources is extensive. Document as skipped.
**Warning signs:** Resources heavily use dot notation on deserialized Gateway records

## Code Examples

### prepublishOnly Script
```json
{
  "scripts": {
    "prepublishOnly": "npm run lint && npm run typecheck && npm run test && npm run build && npx publint"
  }
}
```

### files Array Fix (include CHANGELOG.md)
```json
{
  "files": [
    "dist",
    "CHANGELOG.md"
  ]
}
```

### .npmignore Update (exclude README.en.md)
```
# Add to existing .npmignore:
README.en.md
```

### sideEffects Addition
```json
{
  "sideEffects": false
}
```

### Additional Strict Flags (recommended)
```json
{
  "compilerOptions": {
    "noFallthroughCasesInSwitch": true
  }
}
```

### exactOptionalPropertyTypes Fix Pattern
```typescript
// Before (causes error with exactOptionalPropertyTypes):
this.cacheProvider = config.tokenCacheProvider;
// config.tokenCacheProvider is optional, so type is T | undefined
// but this.cacheProvider is typed as T (not T | undefined)

// After:
this.cacheProvider = config.tokenCacheProvider ?? undefined;
// Or: type the field as T | undefined
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Manual exports map review | `publint` automated validation | 2023 | Catches exports/types mismatches automatically |
| Hope types resolve correctly | `@arethetypeswrong/cli` | 2023 | Tests all moduleResolution modes |
| Single format (CJS or ESM) | Dual format with conditional exports | 2022+ | tsup handles this; already configured |

## Strict TypeScript Flags Assessment

### Currently Enabled (via `strict: true`)
- strictNullChecks
- strictFunctionTypes
- strictBindCallApply
- strictPropertyInitialization
- noImplicitAny
- noImplicitThis
- alwaysStrict
- useUnknownInCatchVariables

### Currently Enabled (explicit in tsconfig)
- noUncheckedIndexedAccess
- noUnusedLocals
- noUnusedParameters

### Recommended to Add (zero errors)
| Flag | Errors | Recommendation |
|------|--------|----------------|
| `noFallthroughCasesInSwitch` | 0 | **Add** -- free safety, no changes needed |

### Conditional (per D-05)
| Flag | Errors | Recommendation |
|------|--------|----------------|
| `exactOptionalPropertyTypes` | 10 | **Add with fixes** -- moderate effort, improves type safety for optional fields. Fixes are mechanical (add `| undefined` to field types or use `?? undefined` coercion). 10 errors across 5 files is manageable. |
| `noPropertyAccessFromIndexSignature` | 45 | **Skip** -- extensive changes required across all resource files that access deserialized Gateway `Record<string, string>` with dot notation. Would require converting 45+ `.field` accesses to `['field']` bracket notation, reducing readability. Document as skipped. |

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 3.0.0 |
| Config file | `vitest.config.ts` |
| Quick run command | `npx vitest run` |
| Full suite command | `npx vitest run --coverage` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PKGP-01 | sideEffects: false in package.json | smoke | `node -e "const p=require('./package.json'); process.exit(p.sideEffects===false?0:1)"` | No -- Wave 0 |
| PKGP-02 | publint + attw pass | smoke | `npx publint && npx @arethetypeswrong/cli --pack .` | No -- manual |
| PKGP-03 | prepublishOnly pipeline | smoke | `npm run prepublishOnly` | No -- script itself is the test |
| PKGP-04 | Clean tarball contents | smoke | `npm pack --dry-run 2>&1` + verify file list | No -- Wave 0 |
| PKGP-05 | Zero any in source | lint | `npx biome check src/` (noExplicitAny: error) | Existing -- biome.json |
| PKGP-06 | Strict TS compliance | typecheck | `npx tsc --noEmit` | Existing -- tsconfig.json |

### Sampling Rate
- **Per task commit:** `npm run typecheck && npm run lint`
- **Per wave merge:** `npm run prepublishOnly`
- **Phase gate:** Full prepublishOnly + `npx @arethetypeswrong/cli --pack .` + `npm pack --dry-run` verification

### Wave 0 Gaps
- None -- this phase modifies config files and scripts, not application code. Validation is done by running the tools themselves, not by writing test files.

## Current State Snapshot

### What Already Passes
- `npx publint` -- All good (zero errors, zero warnings)
- `npx @arethetypeswrong/cli --pack .` -- No problems found (node10, node16-CJS, node16-ESM, bundler all green)
- `tsc --noEmit` -- Clean (zero errors)
- `biome check src/` -- noExplicitAny enforced
- `AbortSignal.any()` -- method name, not type; passes any-audit

### What Needs Fixing
1. **package.json:** Add `sideEffects: false`, add `CHANGELOG.md` to files array, add `prepublishOnly` script
2. **Tarball:** CHANGELOG.md missing (add to files array); README.en.md leaking (add to .npmignore)
3. **tsconfig.json:** Add `noFallthroughCasesInSwitch: true`; optionally add `exactOptionalPropertyTypes: true` with code fixes
4. **Source code:** If `exactOptionalPropertyTypes` enabled, fix 10 type errors across 5 files

### What Does NOT Need Fixing
- Exports map -- already correct
- Type resolution -- already correct for all moduleResolution modes
- Build output -- already dual ESM/CJS with .d.ts and .d.cts
- Zero `any` -- already enforced by biome

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Runtime | Yes | 20+ | -- |
| npm | Package management | Yes | 10.8.2 | -- |
| TypeScript | Typecheck | Yes | ^5.8.0 | -- |
| publint | PKGP-02 | Via npx | 0.3.18 | -- |
| @arethetypeswrong/cli | PKGP-02 | Via npx | 0.18.2 | -- |
| Biome | PKGP-05 | Yes | ^1.9.0 | -- |
| tsup | Build | Yes | ^8.3.0 | -- |
| Vitest | Tests | Yes | ^3.0.0 | -- |

**Missing dependencies:** None.

## Open Questions

1. **exactOptionalPropertyTypes: enable or skip?**
   - What we know: 10 errors across 5 files; fixes are mechanical (add `| undefined` to field types)
   - What's unclear: Whether the fixes would break downstream consumer type expectations
   - Recommendation: **Enable** -- 10 fixes is manageable, improves type correctness, and the fix pattern is straightforward. Per D-05, this does NOT qualify as "extensive code changes."

## Sources

### Primary (HIGH confidence)
- Direct tool execution: `npx publint`, `npx @arethetypeswrong/cli --pack .`, `tsc --noEmit`, `npm pack --dry-run` -- all run against actual codebase
- package.json, tsconfig.json, tsup.config.ts, biome.json -- read directly

### Secondary (MEDIUM confidence)
- [npm CLI issue #8434](https://github.com/npm/cli/issues/8434) -- CHANGELOG not auto-included
- [npm Files & Ignores wiki](https://github.com/npm/cli/wiki/Files-&-Ignores) -- auto-include rules

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all tools verified by direct execution
- Architecture: HIGH -- current config files read and validated
- Pitfalls: HIGH -- all issues discovered by running actual tools against codebase
- Strict flags: HIGH -- error counts from actual `tsc` runs

**Research date:** 2026-04-07
**Valid until:** 2026-05-07 (stable domain, tools change slowly)

## Project Constraints (from CLAUDE.md)

- **Zero deps:** No runtime dependencies -- publint/attw must be npx-only or devDeps
- **Zero any:** `noExplicitAny: "error"` in biome.json enforced
- **Strict TypeScript:** `strict: true` already enabled
- **Dual export:** ESM + CJS -- validated by attw
- **Node 20+:** engines field already set
- **Biome:** Linter and formatter (not ESLint/Prettier)
- **Coverage:** >= 90% configured in vitest.config.ts
