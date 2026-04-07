# Phase 7: Package Validation - Context

**Gathered:** 2026-04-07
**Status:** Ready for planning

<domain>
## Phase Boundary

Ensure the npm package passes all automated validators (publint, attw) and is structurally correct for every TypeScript and Node.js consumer configuration. No new features — pure packaging quality.

</domain>

<decisions>
## Implementation Decisions

### Tarball Contents
- **D-01:** `files` array in package.json should include `dist/` only. README.md, CHANGELOG.md, LICENSE, and package.json are included automatically by npm.
- **D-02:** No examples/, docs/, .planning/, tests/, or config files should leak into the tarball.

### prepublishOnly Pipeline
- **D-03:** Pipeline order: `biome check src/ tests/ → tsc --noEmit → vitest run (unit only, no integration) → tsup → publint`
- **D-04:** Integration tests excluded from prepublishOnly — they require sandbox env vars and are too slow for publish gate.

### Strict TypeScript Flags
- **D-05:** Enable additional strict flags (`exactOptionalPropertyTypes`, `noPropertyAccessFromIndexSignature`, etc.) only if they don't require extensive code changes. Document any that are skipped with justification.
- **D-06:** The `AbortSignal.any()` usage in http.ts is a native API call, not an `any` type — should pass the zero-any audit.

### sideEffects
- **D-07:** Add `"sideEffects": false` to package.json — SDK is pure, no side effects.

### Claude's Discretion
- Order of fixing any issues found by publint/attw
- Whether to add `noPropertyAccessFromIndexSignature` or skip it based on impact

</decisions>

<canonical_refs>
## Canonical References

No external specs — requirements fully captured in ROADMAP.md success criteria and decisions above.

### Package Standards
- `package.json` — current exports map, files array, scripts
- `tsconfig.json` — current strict mode configuration
- `tsup.config.ts` — dual format build configuration

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `tsup.config.ts`: Already configured for dual ESM/CJS with sourcemaps and .d.ts
- `biome.json`: Already enforces `noExplicitAny: "error"`
- `vitest.config.ts`: Already has coverage thresholds configured

### Established Patterns
- Dual format output: ESM (.js, .d.ts) + CJS (.cjs, .d.cts)
- `files: ["dist"]` already limits package contents
- `engines: { "node": ">=20.0.0" }` already set

### Integration Points
- `package.json` scripts section — needs prepublishOnly addition
- `tsconfig.json` compilerOptions — may need additional strict flags
- `.gitignore` — already excludes dist/ and docs/api/

</code_context>

<specifics>
## Specific Ideas

No specific requirements — all success criteria are literal commands from ROADMAP.md.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 07-package-validation*
*Context gathered: 2026-04-07*
