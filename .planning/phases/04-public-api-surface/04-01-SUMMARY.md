---
phase: 04-public-api-surface
plan: 01
subsystem: public-api
tags: [type-guards, error-handling, api-surface, exports]
dependency_graph:
  requires: []
  provides: [type-guards, SankhyaErrorCode, RequestOptions, clean-exports]
  affects: [04-02, 04-03]
tech_stack:
  added: []
  patterns: [type-guard-instanceof, exhaustive-switch-union]
key_files:
  created:
    - tests/api-surface.test.ts
  modified:
    - src/core/errors.ts
    - src/types/config.ts
    - src/types/index.ts
    - src/index.ts
    - tests/core/errors.test.ts
decisions:
  - Type guards use instanceof (simple, standard, works with class hierarchy)
  - SankhyaErrorCode as explicit string literal union (enables exhaustive switch)
  - RequestOptions with timeout, signal, idempotencyKey (per APIS-06 contract)
metrics:
  duration: 2m54s
  completed: 2026-04-06
  tasks_completed: 2
  tasks_total: 2
  tests_added: 22
  files_changed: 5
---

# Phase 04 Plan 01: Public API Surface - Type Guards and Export Audit Summary

Type guards for error hierarchy with SankhyaErrorCode union, RequestOptions interface, and clean public API surface removing 14 internal utility exports.

## Task Results

### Task 1: Type Guards, SankhyaErrorCode, and RequestOptions (TDD)

- **Commit (RED):** `06a32be` - Failing tests for type guards
- **Commit (GREEN):** `11e9584` - Implementation passing all tests
- Added 5 type guard functions to `src/core/errors.ts`: `isSankhyaError`, `isAuthError`, `isApiError`, `isGatewayError`, `isTimeoutError`
- Added `SankhyaErrorCode` union type for exhaustive switch handling
- Added `RequestOptions` interface to `src/types/config.ts` with `timeout`, `signal`, `idempotencyKey`
- 12 new tests covering all guards with correct/wrong instances, null, undefined, string, plain objects
- 1 exhaustive switch compilation test for `SankhyaErrorCode`

### Task 2: Export Audit and Surface Test

- **Commit:** `032491e` - Clean exports and api-surface test
- Removed 14 internal utility exports from `src/index.ts`:
  - `createLogger`, `serialize`, `deserialize`, `deserializeRows`
  - `normalizeRestPagination`, `normalizeGatewayPagination`, `extractRestData`, `createPaginator`
  - `FetchPage`, `withRetry`, `RetryOptions`
  - `toSankhyaDate`, `toSankhyaDateTime`, `toISODate`
- Added new public exports: 5 type guards, `SankhyaErrorCode`, `RequestOptions`
- Created `tests/api-surface.test.ts` with 10 tests validating export boundary
- All 98 tests pass (72 integration skipped)

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

None - all implementations are complete and wired.

## Verification

- `npx vitest run tests/core/errors.test.ts` - 20 tests pass
- `npx vitest run tests/api-surface.test.ts` - 10 tests pass
- `npx vitest run` - 98 tests pass, 72 skipped (integration)

## Self-Check: PASSED
