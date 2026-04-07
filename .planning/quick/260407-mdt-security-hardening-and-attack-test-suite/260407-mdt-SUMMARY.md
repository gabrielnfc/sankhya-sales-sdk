---
phase: quick-security-hardening
plan: 01
subsystem: core, resources
tags: [security, testing, hardening]
dependency_graph:
  requires: []
  provides: [safeParseNumber, PK-field-validation, auth-race-fix, error-sanitization]
  affects: [auth, http, pagination, gateway, cadastros, pedidos]
tech_stack:
  added: []
  patterns: [safe-parse-utility, field-name-blocklist, auth-retry-depth-counter, error-body-sanitization]
key_files:
  created:
    - src/core/parse-utils.ts
    - tests/security/attack-injection.test.ts
    - tests/security/race-condition.test.ts
    - tests/security/atomic-operations.test.ts
    - tests/security/input-validation.test.ts
  modified:
    - src/core/auth.ts
    - src/core/http.ts
    - src/core/pagination.ts
    - src/resources/gateway.ts
    - src/resources/cadastros.ts
    - src/resources/pedidos.ts
decisions:
  - BLOCKED_FIELD_NAMES blocklist added for __proto__/constructor/prototype since regex alone cannot catch valid-identifier prototype pollution
  - authRetryDepth counter produces 5 getToken calls total (initial + 2x(invalidate+retry)), not 3 as originally estimated
metrics:
  duration: 5m46s
  completed: 2026-04-07
  tasks: 3
  files: 11
---

# Quick Task 260407-mdt: Security Hardening and Attack Test Suite Summary

SDK hardened against 8 critical vulnerabilities (SQL injection, prototype pollution, auth race conditions, infinite retry loops, unsafe numeric coercion, cache poisoning, error info leakage, AbortSignal compatibility) with 34 new security tests proving each fix.

## Tasks Completed

| Task | Name | Commit | Key Changes |
|------|------|--------|-------------|
| 1 | Fix 8 critical/high security vulnerabilities | 8f05a32 | safeParseNumber, PK validation, auth race fix, error sanitization, AbortSignal fallback |
| 2 | Write comprehensive security test suite | ff5d2f3 | 4 test files, 34 tests covering injection, race conditions, atomic ops, input validation |
| 3 | Full pipeline verification | (verification only) | tsc, vitest (286 pass), lint all green |

## Vulnerability Fixes

1. **SQL Injection in Gateway PK fields** -- VALID_FIELD_NAME regex + BLOCKED_FIELD_NAMES set in gateway.ts
2. **Token refresh race condition** -- getToken() wraps entire flow (cache check + authenticate) in single refreshPromise via _doGetToken
3. **Infinite 401 retry loop** -- authRetryDepth counter (max 2) replaces boolean isRetry
4. **Error info leakage** -- sanitizeErrorBody truncates to 500 chars and strips stack traces
5. **Unsafe numeric coercion** -- safeParseNumber rejects NaN/Infinity, replaces Number(x)||0
6. **Prototype pollution** -- Explicit blocklist for __proto__, constructor, prototype in PK field names
7. **AbortSignal.any compatibility** -- typeof feature detection fallback for older runtimes
8. **Cache poisoning** -- TokenData validation (accessToken is string, expiresAt is number) before use

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] __proto__ passes regex validation**
- **Found during:** Task 2
- **Issue:** `__proto__` and `constructor` match `[A-Za-z_][A-Za-z0-9_]*` regex
- **Fix:** Added BLOCKED_FIELD_NAMES Set with explicit blocklist
- **Files modified:** src/resources/gateway.ts
- **Commit:** ff5d2f3

**2. [Rule 1 - Bug] authRetryDepth produces 5 getToken calls, not 3**
- **Found during:** Task 2
- **Issue:** Each retry depth calls getToken twice (once at top + once after invalidate)
- **Fix:** Updated test expectation to match actual behavior (5 getToken, 2 invalidateToken)
- **Files modified:** tests/security/race-condition.test.ts
- **Commit:** ff5d2f3

**3. [Rule 1 - Bug] __proto__ object literal absorbed by JS engine**
- **Found during:** Task 2
- **Issue:** `{ __proto__: '1' }` does not set the key via Object.keys()
- **Fix:** Used Object.create(null) to create prototype-free object for test
- **Files modified:** tests/security/attack-injection.test.ts
- **Commit:** ff5d2f3

## Test Results

- **Before:** 252 unit tests passing
- **After:** 286 unit tests passing (+34 security tests)
- **Security test files:** 4 (attack-injection: 10, race-condition: 6, atomic-operations: 6, input-validation: 12)
- **No regressions** in existing tests

## Known Stubs

None -- all security fixes are fully wired with corresponding test coverage.

## Self-Check: PASSED
