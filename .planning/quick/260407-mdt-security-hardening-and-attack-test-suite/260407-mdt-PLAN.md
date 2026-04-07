---
phase: quick-security-hardening
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/core/auth.ts
  - src/core/http.ts
  - src/core/pagination.ts
  - src/core/parse-utils.ts
  - src/resources/gateway.ts
  - src/resources/cadastros.ts
  - src/resources/pedidos.ts
  - tests/security/attack-injection.test.ts
  - tests/security/race-condition.test.ts
  - tests/security/atomic-operations.test.ts
  - tests/security/input-validation.test.ts
autonomous: true
requirements: [SEC-01, SEC-02, SEC-03, SEC-04, SEC-05, SEC-06, SEC-07, SEC-08]

must_haves:
  truths:
    - "Gateway loadRecord rejects SQL injection and prototype pollution in PK field names"
    - "Concurrent getToken() calls coalesce into a single authenticate() call"
    - "Auth retry depth is bounded at 2 to prevent infinite 401 loops"
    - "Error responses are truncated and sanitized before surfacing"
    - "Parallel async generators maintain independent page state"
    - "Number parsing uses safe utility that rejects NaN/Infinity"
    - "AbortSignal.any has runtime feature detection fallback"
    - "Cached TokenData is validated before use"
  artifacts:
    - path: "src/core/parse-utils.ts"
      provides: "safeParseNumber utility"
      exports: ["safeParseNumber"]
    - path: "tests/security/attack-injection.test.ts"
      provides: "SQL injection and prototype pollution tests"
      min_lines: 80
    - path: "tests/security/race-condition.test.ts"
      provides: "Concurrent token and auth retry tests"
      min_lines: 80
    - path: "tests/security/atomic-operations.test.ts"
      provides: "Parallel generator and abort cleanup tests"
      min_lines: 60
    - path: "tests/security/input-validation.test.ts"
      provides: "NaN, Infinity, invalid cache data tests"
      min_lines: 60
  key_links:
    - from: "src/resources/gateway.ts"
      to: "src/core/errors.ts"
      via: "throws SankhyaError on invalid PK field names"
      pattern: "VALID_FIELD_NAME"
    - from: "src/core/auth.ts"
      to: "refreshPromise"
      via: "single promise covers cache check + authenticate"
      pattern: "_doGetToken"
    - from: "src/resources/cadastros.ts"
      to: "src/core/parse-utils.ts"
      via: "safeParseNumber replaces Number(x) || 0"
      pattern: "safeParseNumber"
---

<objective>
Fix 8 critical/high security vulnerabilities across auth, HTTP, pagination, gateway, and serialization layers. Then write a comprehensive attack/race-condition/atomic-operation/input-validation test suite proving the fixes work and guarding against regressions.

Purpose: Harden SDK against injection attacks, race conditions, infinite retry loops, and unsafe numeric coercion before public npm release.
Output: Hardened source files + 4 new security test files in tests/security/.
</objective>

<execution_context>
@.planning/quick/260407-mdt-security-hardening-and-attack-test-suite/260407-mdt-PLAN.md
</execution_context>

<context>
@src/core/auth.ts
@src/core/http.ts
@src/core/retry.ts
@src/core/pagination.ts
@src/core/gateway-serializer.ts
@src/core/errors.ts
@src/resources/gateway.ts
@src/resources/cadastros.ts
@src/resources/pedidos.ts
@tests/core/auth.test.ts
@tests/core/http.test.ts
@tests/resources/gateway.test.ts

<interfaces>
From src/core/errors.ts:
```typescript
export class SankhyaError extends Error { readonly code: string; readonly statusCode: number | undefined; readonly details?: unknown; }
export class AuthError extends SankhyaError { override readonly code = 'AUTH_ERROR' as const; }
export class ApiError extends SankhyaError { override readonly code = 'API_ERROR' as const; readonly endpoint: string; readonly method: string; }
export class GatewayError extends SankhyaError { override readonly code = 'GATEWAY_ERROR' as const; }
export class TimeoutError extends SankhyaError { override readonly code = 'TIMEOUT_ERROR' as const; }
```

From src/types/auth.ts (inferred):
```typescript
export interface TokenData { accessToken: string; expiresAt: number; }
export interface AuthResponse { access_token: string; expires_in: number; }
```

From src/core/pagination.ts:
```typescript
export type FetchPage<T> = (page: number) => Promise<PaginatedResult<T>>;
export async function* createPaginator<T>(fetchFn: FetchPage<T>, startPage?: number): AsyncGenerator<T>;
```

From src/core/http.ts:
```typescript
export class HttpClient {
  async restGet<T>(path: string, params?: Record<string, string>, options?: RequestOptions): Promise<T>;
  async gatewayCall<T>(modulo: string, serviceName: string, requestBody: Record<string, unknown>, options?: RequestOptions): Promise<T>;
}
```
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Fix 8 critical/high security vulnerabilities</name>
  <files>src/core/parse-utils.ts, src/core/auth.ts, src/core/http.ts, src/core/pagination.ts, src/resources/gateway.ts, src/resources/cadastros.ts, src/resources/pedidos.ts</files>
  <action>
**1. Create `src/core/parse-utils.ts` — safe numeric parser utility:**

```typescript
import { SankhyaError } from './errors.js';

/**
 * Safely parses a value to a number. Rejects NaN and Infinity.
 * @param value - The value to parse
 * @param fieldName - Field name for error context
 * @returns Parsed number
 * @throws {SankhyaError} If value cannot be safely parsed to a finite number
 */
export function safeParseNumber(value: unknown, fieldName: string): number {
  if (value === null || value === undefined || value === '') {
    return 0;
  }
  const n = Number(value);
  if (!Number.isFinite(n)) {
    throw new SankhyaError(
      `Valor numerico invalido para campo '${fieldName}': ${String(value).slice(0, 50)}`,
      'PARSE_ERROR',
    );
  }
  return n;
}
```

Export from `src/index.ts` if desired (optional — internal utility).

**2. `src/resources/gateway.ts` — Validate PK field names in `loadRecord`:**

Add a field name validation constant and check at the top of `loadRecord`:

```typescript
const VALID_FIELD_NAME = /^[A-Za-z_][A-Za-z0-9_]*$/;
```

Inside `loadRecord`, before building `expression`, add:

```typescript
for (const key of Object.keys(params.primaryKey)) {
  if (!VALID_FIELD_NAME.test(key)) {
    throw new SankhyaError(
      `Nome de campo invalido na primaryKey: '${key}'. Apenas letras, numeros e underscore sao permitidos.`,
      'VALIDATION_ERROR',
    );
  }
}
```

Import `SankhyaError` from `../core/errors.js`.

**3. `src/core/auth.ts` — Fix token refresh race condition:**

Restructure `getToken()` and add `_doGetToken()`:

```typescript
async getToken(): Promise<string> {
  if (this.refreshPromise) {
    this.logger.debug('Aguardando refresh em andamento');
    return this.refreshPromise;
  }
  this.refreshPromise = this._doGetToken();
  try {
    return await this.refreshPromise;
  } finally {
    this.refreshPromise = null;
  }
}

private async _doGetToken(): Promise<string> {
  const cached = await this.getCachedToken();
  if (cached) return cached;
  return this.authenticate();
}
```

Also add TokenData validation in `getCachedToken()`. After `const data: TokenData = JSON.parse(cached);`, add:

```typescript
if (typeof data.accessToken !== 'string' || typeof data.expiresAt !== 'number') {
  this.logger.warn('Token em cache com formato invalido, ignorando');
  await this.cacheProvider.del(TOKEN_CACHE_KEY);
  return null;
}
```

This covers both fix 2 (race condition) and fix 8 (cache validation).

**4. `src/core/http.ts` — Add maxAuthRetries counter and error sanitization:**

Change `requestWithRetry` signature to accept `authRetryDepth` (default 0) instead of the boolean `isRetry`:

```typescript
private async requestWithRetry<T>(
  url: string,
  method: string,
  path: string,
  body?: unknown,
  authRetryDepth = 0,
  options?: RequestOptions,
): Promise<T> {
```

Replace the 401 handling block (lines ~175-189):

```typescript
if (response.status === 401 && authRetryDepth < 2) {
  this.logger.warn('Token expirado, renovando...');
  await this.auth.invalidateToken();
  const newToken = await this.auth.getToken();
  if (newToken === token) {
    throw new ApiError(
      'API error: HTTP 401 — token refresh retornou o mesmo token',
      path, method, 401, '',
    );
  }
  return this.requestWithRetry<T>(url, method, path, body, authRetryDepth + 1, options);
}
```

For non-ok responses, sanitize the error body. Replace the `!response.ok` block (~lines 192-200):

```typescript
if (!response.ok) {
  let text = await response.text().catch(() => '');
  text = sanitizeErrorBody(text);
  throw new ApiError(
    `API error: HTTP ${response.status} — ${text || response.statusText}`,
    path, method, response.status, text,
  );
}
```

Add a private helper function at the bottom of the file (or before the class):

```typescript
const MAX_ERROR_BODY_LENGTH = 500;

function sanitizeErrorBody(body: string): string {
  let sanitized = body.slice(0, MAX_ERROR_BODY_LENGTH);
  // Strip potential stack trace lines
  sanitized = sanitized.replace(/^\s*at .+$/gm, '').replace(/\n{2,}/g, '\n').trim();
  if (body.length > MAX_ERROR_BODY_LENGTH) {
    sanitized += '... [truncated]';
  }
  return sanitized;
}
```

**5. Add AbortSignal.any feature detection in `requestWithRetry`:**

Replace line 118 (`const combinedSignal = signals.length === 1 ? signals[0] : AbortSignal.any(signals);`):

```typescript
const combinedSignal =
  signals.length === 1
    ? signals[0]
    : typeof AbortSignal.any === 'function'
      ? AbortSignal.any(signals)
      : internalController.signal;
```

**6. `src/core/pagination.ts` — Immutable page state before yield:**

In `createPaginator`, capture state in local consts before yielding:

```typescript
export async function* createPaginator<T>(fetchFn: FetchPage<T>, startPage = 0): AsyncGenerator<T> {
  let currentPage = startPage;
  let hasMore = true;

  while (hasMore) {
    const result = await fetchFn(currentPage);
    const pageData = result.data;
    const nextPage = result.page + 1;
    const continueIterating = result.hasMore && result.data.length > 0;

    for (const item of pageData) {
      yield item;
    }

    hasMore = continueIterating;
    currentPage = nextPage;
  }
}
```

**7. `src/resources/cadastros.ts` — Replace `Number(x) || 0` with `safeParseNumber`:**

Add import: `import { safeParseNumber } from '../core/parse-utils.js';`

In `listarTiposNegociacao` return mapper (~line 288-293):
```typescript
return rows.map((row) => ({
  codigoTipoNegociacao: safeParseNumber(row.CODTIPVENDA, 'CODTIPVENDA'),
  descricao: row.DESCRTIPVENDA ?? '',
  taxaJuro: row.TAXAJURO ? safeParseNumber(row.TAXAJURO, 'TAXAJURO') : 0,
  ativo: row.ATIVO === 'S',
}));
```

In `listarModelosNota` return mapper (~line 327-335):
```typescript
return rows.map((row) => ({
  numeroModelo: safeParseNumber(row.CODMODELANOTA, 'CODMODELANOTA'),
  descricao: row.DESCRICAO ?? '',
  codigoTipoOperacao: safeParseNumber(row.CODTIPOPER, 'CODTIPOPER'),
  codigoTipoNegociacao: safeParseNumber(row.CODTIPVENDA, 'CODTIPVENDA'),
  codigoEmpresa: safeParseNumber(row.CODEMP, 'CODEMP'),
  codigoNatureza: row.CODNAT ? safeParseNumber(row.CODNAT, 'CODNAT') : undefined,
  codigoCentroResultado: row.CODCENCUS ? safeParseNumber(row.CODCENCUS, 'CODCENCUS') : undefined,
}));
```

**8. `src/resources/pedidos.ts` — Replace `Number(nunota) || 0`:**

Add import: `import { safeParseNumber } from '../core/parse-utils.js';`

Find line 225: `return { codigoPedido: Number(nunota) || 0 };`
Replace with: `return { codigoPedido: safeParseNumber(nunota, 'NUNOTA') };`

After all changes, ensure `npx tsc --noEmit` passes (no type errors introduced).
  </action>
  <verify>
    <automated>cd "C:/Users/gabri/OneDrive/Desktop/projetos_true/sankhya_kit" && npx tsc --noEmit && npx vitest run tests/core/auth.test.ts tests/core/http.test.ts tests/core/pagination.test.ts tests/resources/gateway.test.ts tests/resources/cadastros.test.ts</automated>
  </verify>
  <done>
    - `src/core/parse-utils.ts` exists with exported `safeParseNumber`
    - gateway.ts throws on invalid PK field names (regex: /^[A-Za-z_][A-Za-z0-9_]*$/)
    - auth.ts getToken wraps entire flow in single refreshPromise via _doGetToken
    - auth.ts getCachedToken validates TokenData shape before use
    - http.ts uses authRetryDepth counter (max 2) instead of boolean isRetry
    - http.ts sanitizeErrorBody truncates to 500 chars and strips stack traces
    - http.ts AbortSignal.any has typeof feature detection
    - pagination.ts captures page state in local consts before yield
    - cadastros.ts and pedidos.ts use safeParseNumber instead of Number(x) || 0
    - All existing tests still pass
  </done>
</task>

<task type="auto">
  <name>Task 2: Write comprehensive security test suite</name>
  <files>tests/security/attack-injection.test.ts, tests/security/race-condition.test.ts, tests/security/atomic-operations.test.ts, tests/security/input-validation.test.ts</files>
  <action>
Create `tests/security/` directory and 4 test files. Use the existing test patterns from `tests/core/auth.test.ts` (vi.fn mocks, createAuthManager factory, mockFetchSuccess).

**File 1: `tests/security/attack-injection.test.ts`**

```typescript
import { describe, expect, it, vi } from 'vitest';
import { GatewayResource } from '../../src/resources/gateway.js';
import type { HttpClient } from '../../src/core/http.js';

function createMockHttp(): HttpClient {
  return {
    restGet: vi.fn(),
    restPost: vi.fn(),
    restPut: vi.fn(),
    restDelete: vi.fn(),
    gatewayCall: vi.fn().mockResolvedValue({
      entities: { total: '0', hasMoreResult: 'false', entity: [] },
    }),
  } as unknown as HttpClient;
}
```

Tests:
1. `"rejects SQL injection in PK field names"` — call `loadRecord({ entity: 'Parceiro', fields: 'CODPARC', primaryKey: { "CODPARC' OR '1'='1": '123' } })` -> expect throw with message containing "invalido"
2. `"rejects prototype pollution key __proto__"` — primaryKey `{ __proto__: '1' }` -> throw
3. `"rejects prototype pollution key constructor"` — primaryKey `{ constructor: '1' }` -> throw
4. `"rejects field name with semicolon"` — primaryKey `{ 'FIELD;DROP': '1' }` -> throw
5. `"rejects field name with spaces"` — primaryKey `{ 'FIELD NAME': '1' }` -> throw
6. `"rejects field name with dashes"` — primaryKey `{ 'FIELD-NAME': '1' }` -> throw
7. `"rejects field name starting with number"` — primaryKey `{ '0FIELD': '1' }` -> throw
8. `"accepts valid Sankhya field names"` — primaryKey `{ CODPARC: '123' }` -> no throw (gatewayCall mock resolves)
9. `"accepts field with underscore"` — primaryKey `{ COD_PARC: '123' }` -> no throw
10. `"error body is sanitized and truncated"` — Import `ApiError` and verify: construct an ApiError with a 1000-char body containing stack traces (`at Object.run (/path/file.js:10:5)\n`), verify the sanitizeErrorBody function behavior by checking that the http module limits error body size. This test should call requestWithRetry indirectly through `restGet` using a mocked fetch that returns a non-ok response with a large body. Verify the thrown ApiError details string length <= 520 (500 + "... [truncated]").

**File 2: `tests/security/race-condition.test.ts`**

```typescript
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthManager } from '../../src/core/auth.js';
import type { Logger } from '../../src/types/config.js';
```

Use the same `createAuthManager` and `mockFetchSuccess` factory from `tests/core/auth.test.ts`.

Tests:
1. `"10 concurrent getToken() calls produce only 1 authenticate()"` — Create AuthManager with mocked fetch. Call `Promise.all(Array.from({ length: 10 }, () => auth.getToken()))`. Verify `globalThis.fetch` called exactly once.
2. `"concurrent getToken() all receive same token"` — Same setup. Verify all 10 results are the same token string.
3. `"invalidateToken() during active getToken() does not crash"` — Start getToken (slow mock with 100ms delay). Call invalidateToken() immediately after. Both should resolve without error.
4. `"second batch after invalidate triggers new authenticate()"` — Get token (fetch called once). Invalidate. Get token again (fetch called twice total).
5. `"token refresh covers cache check (no race window)"` — Use a cacheProvider mock that returns valid cached token on first call but null on second. Call getToken 5 times concurrently. The cache should be checked exactly once (inside the single refreshPromise), not 5 times.
6. `"requestWithRetry stops at maxAuthRetries=2"` — Create HttpClient with mocked auth that always returns a different token, and mocked fetch that always returns 401. Call restGet. Verify it throws ApiError with 401. Verify auth.getToken was called <= 3 times (initial + 2 retries).

**File 3: `tests/security/atomic-operations.test.ts`**

```typescript
import { describe, expect, it, vi } from 'vitest';
import { createPaginator } from '../../src/core/pagination.js';
import type { PaginatedResult } from '../../src/types/common.js';
```

Tests:
1. `"two parallel AsyncGenerators maintain independent page state"` — Create two generators from same fetchFn (mock returns page 0 data, then page 1 data based on input page param). Advance gen1 one item, advance gen2 two items, advance gen1 again. Verify each receives correct items independently.
2. `"generator yields all items before mutating page state"` — Mock fetchFn that returns 3 items on page 0, 2 on page 1. Collect all items. Verify order is [item0, item1, item2, item3, item4].
3. `"generator stops when hasMore is false"` — fetchFn returns hasMore false on page 0. Generator yields page 0 items only.
4. `"generator stops when data is empty"` — fetchFn returns empty data array with hasMore true. Generator yields nothing.
5. `"AbortController timeout is cleared after successful request"` — This is more of an integration concern; verify by mocking setTimeout/clearTimeout that clearTimeout is called after fetch resolves. Use vi.spyOn(globalThis, 'setTimeout') and vi.spyOn(globalThis, 'clearTimeout').
6. `"AbortController abort propagates TimeoutError"` — Create HttpClient with fetch that hangs (never resolves within timeout). Set timeout to 50ms. Expect TimeoutError thrown.

**File 4: `tests/security/input-validation.test.ts`**

```typescript
import { describe, expect, it } from 'vitest';
import { safeParseNumber } from '../../src/core/parse-utils.js';
```

Tests:
1. `"safeParseNumber parses valid number string"` — `safeParseNumber('42', 'test')` -> 42
2. `"safeParseNumber parses zero"` — `safeParseNumber('0', 'test')` -> 0
3. `"safeParseNumber returns 0 for empty string"` — `safeParseNumber('', 'test')` -> 0
4. `"safeParseNumber returns 0 for null"` — `safeParseNumber(null, 'test')` -> 0
5. `"safeParseNumber returns 0 for undefined"` — `safeParseNumber(undefined, 'test')` -> 0
6. `"safeParseNumber throws for NaN"` — `safeParseNumber('abc', 'CAMPO')` -> throws with message matching /invalido.*CAMPO/
7. `"safeParseNumber throws for Infinity"` — `safeParseNumber('Infinity', 'CAMPO')` -> throws
8. `"safeParseNumber throws for -Infinity"` — `safeParseNumber('-Infinity', 'CAMPO')` -> throws
9. `"safeParseNumber parses negative numbers"` — `safeParseNumber('-5', 'test')` -> -5
10. `"safeParseNumber parses decimal numbers"` — `safeParseNumber('3.14', 'test')` -> 3.14
11. `"invalid TokenData from cache is rejected"` — Create AuthManager with cacheProvider that returns `JSON.stringify({ accessToken: 123, expiresAt: 'not-a-number' })`. Call getToken(). Verify it calls authenticate() (fetch) rather than using the invalid cached data.
12. `"huge string field value in safeParseNumber"` — `safeParseNumber('1'.repeat(1_000_000), 'test')` -> throws (result is Infinity or NaN for huge numbers, both non-finite)

Each test file should use `describe('Security: ...')` grouping. Follow existing test patterns: import from vitest, use vi.fn() for mocks.
  </action>
  <verify>
    <automated>cd "C:/Users/gabri/OneDrive/Desktop/projetos_true/sankhya_kit" && npx vitest run tests/security/ --reporter=verbose</automated>
  </verify>
  <done>
    - tests/security/attack-injection.test.ts has 9+ tests, all pass
    - tests/security/race-condition.test.ts has 6+ tests, all pass
    - tests/security/atomic-operations.test.ts has 6+ tests, all pass
    - tests/security/input-validation.test.ts has 10+ tests, all pass
    - No test uses `any` type
  </done>
</task>

<task type="auto">
  <name>Task 3: Full pipeline verification</name>
  <files></files>
  <action>
Run the full verification pipeline in sequence:

1. `npx tsc --noEmit` — must exit 0 (no type errors)
2. `npx vitest run` — must exit 0 (all tests pass, including new security tests)
3. `npm run lint` — must exit 0 (Biome passes)
4. Compare test count: run `npx vitest run --reporter=verbose 2>&1 | tail -5` and verify total test count increased by ~30+ from the new security tests.

If any step fails, fix the issue in the relevant source or test file and re-run. Common issues to watch for:
- Biome may flag import order or trailing commas in new test files
- TypeScript may flag missing `.js` extensions in imports (always use `.js`)
- safeParseNumber may need `as const` on error code if Biome flags it
- Existing tests in cadastros.test.ts or gateway.test.ts may need adjustment if they relied on `Number(x) || 0` behavior for edge cases (e.g., NaN returning 0 silently)
  </action>
  <verify>
    <automated>cd "C:/Users/gabri/OneDrive/Desktop/projetos_true/sankhya_kit" && npx tsc --noEmit && npx vitest run && npm run lint</automated>
  </verify>
  <done>
    - `npx tsc --noEmit` exits 0
    - `npx vitest run` exits 0 with all tests passing
    - `npm run lint` exits 0
    - Total test count increased by 30+ (security suite)
    - No regressions in existing test files
  </done>
</task>

</tasks>

<verification>
After all 3 tasks complete:
1. `npx tsc --noEmit` — zero type errors
2. `npx vitest run` — all tests green
3. `npm run lint` — clean
4. `grep -r "VALID_FIELD_NAME" src/resources/gateway.ts` — field validation exists
5. `grep -r "_doGetToken" src/core/auth.ts` — race-safe token flow exists
6. `grep -r "authRetryDepth" src/core/http.ts` — bounded retry exists
7. `grep -r "sanitizeErrorBody" src/core/http.ts` — error sanitization exists
8. `grep -r "safeParseNumber" src/core/parse-utils.ts` — utility exists
9. `grep -r "safeParseNumber" src/resources/cadastros.ts` — utility in use
10. `ls tests/security/*.test.ts | wc -l` — equals 4
</verification>

<success_criteria>
- All 8 vulnerability fixes implemented with concrete code changes
- 4 new security test files with 30+ total tests
- Full pipeline (tsc + vitest + lint) passes green
- No regressions in existing 75+ unit tests
- Zero `any` types in new code
</success_criteria>

<output>
After completion, create `.planning/quick/260407-mdt-security-hardening-and-attack-test-suite/260407-mdt-SUMMARY.md`
</output>
