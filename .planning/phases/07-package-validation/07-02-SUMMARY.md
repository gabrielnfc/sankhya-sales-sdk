---
phase: 07-package-validation
plan: 02
subsystem: infra
tags: [typescript, strict-mode, exactOptionalPropertyTypes, tsconfig]

requires:
  - phase: 05-test-coverage-hardening
    provides: complete test suite (256 tests)
provides:
  - exactOptionalPropertyTypes enabled in tsconfig.json
  - All optional property assignments use explicit undefined unions
affects: [07-package-validation]

tech-stack:
  added: []
  patterns: [explicit-undefined-union-for-optional-properties]

key-files:
  created: []
  modified:
    - tsconfig.json
    - src/core/auth.ts
    - src/core/errors.ts
    - src/core/gateway-serializer.ts
    - src/core/http.ts
    - src/core/pagination.ts
    - src/types/common.ts
    - src/types/cadastros.ts

key-decisions:
  - "noPropertyAccessFromIndexSignature intentionally skipped - 45 errors across resource files, low value vs readability cost"
  - "Used explicit undefined union (T | undefined) over optional-only (T?) for properties that receive potentially undefined values"

patterns-established:
  - "Explicit undefined union: optional properties that receive undefined values use `prop?: T | undefined` or `prop: T | undefined`"
  - "Conditional spread: fetch options use `...(value ? { key: value } : {})` instead of `key: value | undefined`"

requirements-completed: [PKGP-06]

duration: 2min
completed: 2026-04-07
---

# Phase 7 Plan 2: exactOptionalPropertyTypes Summary

**Enabled exactOptionalPropertyTypes with 10 type fixes across 7 files for maximum TypeScript strict mode compliance**

## Performance

- **Duration:** 2 min
- **Started:** 2026-04-07T15:01:00Z
- **Completed:** 2026-04-07T15:03:00Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments
- Fixed all 10 exactOptionalPropertyTypes errors across auth, errors, http, pagination, gateway-serializer, and type definitions
- Enabled the flag in tsconfig.json for ongoing strict checking
- All 256 existing tests continue to pass

## Task Commits

Each task was committed atomically:

1. **Task 1: Fix exactOptionalPropertyTypes errors in core modules** - `d5abb83` (fix)
2. **Task 2: Enable exactOptionalPropertyTypes in tsconfig.json** - `6cdba7a` (chore)

## Files Created/Modified
- `src/core/auth.ts` - cacheProvider field uses explicit `TokenCacheProvider | undefined`
- `src/core/errors.ts` - statusCode, tsErrorCode, tsErrorLevel use explicit undefined unions
- `src/core/gateway-serializer.ts` - DeserializedRows.totalRecords allows undefined
- `src/core/http.ts` - Conditional spread for body and signal in fetch() call
- `src/core/pagination.ts` - extractRestData return type allows undefined pagination
- `src/types/common.ts` - PaginatedResult.totalRecords allows undefined
- `src/types/cadastros.ts` - ModeloNota optional number fields allow undefined
- `tsconfig.json` - Added exactOptionalPropertyTypes: true

## Decisions Made
- noPropertyAccessFromIndexSignature intentionally skipped: would cause 45 errors across resource files that use dot notation on `Record<string, string>` from deserialized Gateway responses. Degrades readability with no meaningful safety gain.
- Used explicit `T | undefined` union pattern instead of just `T?` for properties receiving potentially undefined values from function parameters.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- TypeScript strict mode is now maximized (strict + exactOptionalPropertyTypes)
- Ready for package validation and publish steps

---
*Phase: 07-package-validation*
*Completed: 2026-04-07*
