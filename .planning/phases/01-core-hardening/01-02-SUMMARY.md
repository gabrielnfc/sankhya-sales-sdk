---
phase: 01-core-hardening
plan: 02
subsystem: core
tags: [auth, retry, bugfix, security]
dependency_graph:
  requires: []
  provides: [ttl-guard, retry-jitter, method-aware-retry]
  affects: [src/core/auth.ts, src/core/retry.ts]
tech_stack:
  added: []
  patterns: [full-jitter-backoff, method-safe-retry]
key_files:
  created: []
  modified:
    - src/core/auth.ts
    - src/core/retry.ts
    - tests/core/auth.test.ts
    - tests/core/retry.test.ts
decisions:
  - "Full jitter (Math.random * delay) chosen over equal jitter for simpler implementation and proven effectiveness (AWS recommendation)"
  - "MINIMUM_TTL_SECONDS=10 chosen as floor — enough for at least one request cycle even with very short expires_in"
  - "SAFE_METHODS whitelist (GET/HEAD/OPTIONS) rather than unsafe blacklist — safer default, new methods fail closed"
metrics:
  duration: 2m32s
  completed: 2026-04-06T15:20:45Z
  tasks: 2
  files: 4
---

# Phase 01 Plan 02: Auth TTL Guard + Retry Hardening Summary

JWT TTL lower-bound guard (MINIMUM_TTL_SECONDS=10) prevents negative cache expiry; full jitter on retry backoff prevents thundering herd; method-aware retry skips POST/PUT/PATCH/DELETE by default with forceRetry opt-in.

## What Was Done

### Task 1: TDD RED — Regression tests for CORE-04, CORE-05, CORE-07
- Added 2 tests in `tests/core/auth.test.ts` for TTL guard (expires_in=30 and expires_in=10)
- Added 1 test in `tests/core/retry.test.ts` for jitter verification (mocked Math.random)
- Added 4 tests in `tests/core/retry.test.ts` for method-aware retry (POST skip, GET compat, forceRetry, no-method compat)
- All 7 new tests confirmed FAILING against unpatched code
- Commit: `51953ef`

### Task 2: TDD GREEN — Fix auth.ts and retry.ts
- **CORE-04**: Added `MINIMUM_TTL_SECONDS = 10` constant; wrapped TTL computation in `Math.max(expires_in - SAFETY_MARGIN, MINIMUM_TTL_SECONDS)`
- **CORE-05**: Replaced `baseDelay * 2 ** attempt` with `Math.random() * baseDelay * 2 ** attempt` (full jitter)
- **CORE-07**: Extended `RetryOptions` with `method?: string` and `forceRetry?: boolean`; added `SAFE_METHODS` set; replaced `maxRetries` with `effectiveMaxRetries` that floors to 0 for unsafe methods
- All 82 unit tests pass, 0 type errors, 0 lint errors
- Commit: `d246eb9`

## Verification Results

- `npx vitest run tests/core/auth.test.ts tests/core/retry.test.ts` — 24/24 pass
- `npx biome check src/core/auth.ts src/core/retry.ts` — clean
- `npx tsc --noEmit` — no errors
- `npx vitest run` — 82 pass, 72 skipped (integration), 0 failures

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None.

## Decisions Made

1. **Full jitter over equal jitter**: Simpler (single multiplication vs min/max), proven effective per AWS architecture blog
2. **MINIMUM_TTL_SECONDS=10**: Conservative floor — even very short-lived tokens get cached briefly to avoid auth loops
3. **Whitelist SAFE_METHODS**: GET/HEAD/OPTIONS explicitly safe; everything else (POST/PUT/PATCH/DELETE) treated as unsafe by default — fails closed for new HTTP methods

## Commits

| Task | Commit | Message |
|------|--------|---------|
| 1 | `51953ef` | test(01-02): add failing regression tests for CORE-04, CORE-05, CORE-07 |
| 2 | `d246eb9` | fix(01-02): TTL lower-bound guard, retry jitter, method-aware retry |

## Self-Check: PASSED

All 4 files exist. Both commits verified in git log.
