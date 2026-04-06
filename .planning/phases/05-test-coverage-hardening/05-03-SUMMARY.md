---
phase: 05-test-coverage-hardening
plan: 03
subsystem: testing
tags: [coverage, vitest, smoke-tests, cjs, esm, npm-scripts]
dependency_graph:
  requires:
    - phase: 05-test-coverage-hardening
      plan: 01
      provides: Resource unit tests (64 tests)
    - phase: 05-test-coverage-hardening
      plan: 02
      provides: Complex resource unit tests (62 tests)
  provides:
    - Coverage enforcement with resources and client included
    - CJS and ESM smoke test scripts
    - test:integration and test:smoke npm scripts
  affects: [ci-pipeline, package-quality]
tech_stack:
  added: ["@vitest/coverage-v8"]
  patterns: [dual-format-smoke-testing, coverage-threshold-enforcement]
key_files:
  created:
    - tests/smoke/cjs.cjs
    - tests/smoke/esm.mjs
  modified:
    - vitest.config.ts
    - package.json
decisions:
  - "Branch coverage threshold kept at 85% per Phase 1 decision -- resource optional-param guards make 90% expensive without meaningful benefit"
  - "@vitest/coverage-v8 version pinned to ^3.2.4 to match vitest ^3.0.0 (v4.x incompatible)"
  - "test:integration uses positional filter 'vitest run tests/integration/' since vitest v3 removed --include flag"
metrics:
  duration: "8min"
  completed: "2026-04-06T21:14:10Z"
  tasks_completed: 2
  tasks_total: 2
  files_created: 2
  files_modified: 2
requirements: [TEST-01, TEST-02, TEST-03, TEST-04, TEST-05]
---

# Phase 05 Plan 03: Coverage Config and Smoke Tests Summary

Coverage thresholds enforced with resources+client included (96.55% stmts, 90% branches, 92.4% funcs), dual-format CJS/ESM smoke tests validating require()/import and instanceof preservation, plus test:integration and test:smoke npm scripts

## Changes Made

### Task 1: Update vitest.config.ts coverage and add npm scripts

- Removed `src/resources/**/*.ts` and `src/client.ts` from coverage exclude list
- Only `src/types/**/*.ts` and `src/index.ts` remain excluded (type-only and re-exports)
- Added `@vitest/coverage-v8` as devDependency (v3.2.4, matching vitest v3)
- Added `test:integration` script: `vitest run tests/integration/`
- Added `test:smoke` script: `tsup && node tests/smoke/cjs.cjs && node tests/smoke/esm.mjs`
- All coverage thresholds pass: 96.55% statements, 90.02% branches, 92.4% functions, 96.55% lines

**Commit:** 5a100e2

### Task 2: Create CJS and ESM smoke test scripts

- Created `tests/smoke/cjs.cjs` -- CommonJS require() validation (35 lines)
- Created `tests/smoke/esm.mjs` -- ESM import validation (31 lines)
- Both scripts verify: SankhyaClient, ApiError, AuthError, GatewayError, TimeoutError exports
- Both verify instanceof preservation (ApiError instanceof ApiError + instanceof Error)
- CJS test additionally verifies SankhyaClient is a class via toString()
- `npm run test:smoke` passes: builds then runs both scripts successfully

**Commit:** b675ec1

### Deviation Fix: test:integration script flag

- vitest v3 does not support `--include` flag (removed in v3)
- Changed from `vitest run --include='tests/integration/**'` to `vitest run tests/integration/` (positional filter)

**Commit:** bc32639

## Coverage Results

| Metric     | Result  | Threshold |
|------------|---------|-----------|
| Statements | 96.55%  | 90%       |
| Branches   | 90.02%  | 85%       |
| Functions  | 92.40%  | 90%       |
| Lines      | 96.55%  | 90%       |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] @vitest/coverage-v8 version mismatch**
- **Found during:** Task 1
- **Issue:** npm installed @vitest/coverage-v8 v4.1.2 which is incompatible with vitest v3.2.4 (missing BaseCoverageProvider export)
- **Fix:** Pinned to `@vitest/coverage-v8@^3.2.4` matching installed vitest major version
- **Files modified:** package.json, package-lock.json

**2. [Rule 1 - Bug] vitest --include flag removed in v3**
- **Found during:** Task 1 verification
- **Issue:** `vitest run --include='tests/integration/**'` throws CACError: Unknown option `--include`
- **Fix:** Changed to positional filter `vitest run tests/integration/`
- **Files modified:** package.json
- **Commit:** bc32639

## Known Stubs

None.

## Self-Check: PASSED

- tests/smoke/cjs.cjs: FOUND
- tests/smoke/esm.mjs: FOUND
- Commit 5a100e2: FOUND
- Commit b675ec1: FOUND
- Commit bc32639: FOUND
- npm run test:smoke: PASS
- npx vitest run --coverage: PASS (all thresholds met)
