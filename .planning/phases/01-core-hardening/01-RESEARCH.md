# Phase 1: Core Hardening - Research

**Researched:** 2026-04-06
**Domain:** Gateway serializer, OAuth token management, retry logic, coverage enforcement
**Confidence:** HIGH

## Summary

Phase 1 addresses seven concrete bugs and configuration gaps in the SDK's core layer. All issues were confirmed by reading the current source code -- every bug is reproducible from the code as written. No external library research was needed; this is entirely a fix-and-harden phase on existing code.

The serializer has two distinct bugs: `deserialize()` produces `"[object Object]"` when `$` contains an empty object (TAXAJURO), and `deserializeRows()` silently drops extra fields returned by the Gateway (DHALTER). The auth manager computes a negative TTL when `expires_in < 60`. The retry utility lacks jitter and has no HTTP-method awareness. Coverage enforcement is not configured.

**Primary recommendation:** Fix each bug with a targeted edit, add tests that reproduce the exact failure scenario first (regression-proof), then configure coverage thresholds as the final gating step.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CORE-01 | Serializer Gateway trata `TAXAJURO {}` sem produzir `"[object Object]"` | Bug confirmed in `deserialize()` line 33 and `deserializeRows()` line 123 -- two code paths need fixing |
| CORE-02 | Serializer Gateway trata campos extras (DHALTER) sem dropar dados silenciosamente | Bug confirmed in `deserializeRows()` lines 110-125 -- only f0..fN mapped, extra keys ignored with no logging |
| CORE-03 | Serializer Gateway rejeita/loga retornos vazios em vez de silenciar erros de contrato | Confirmed in `deserializeRows()` lines 73-82 -- empty/malformed input returns empty result with no logging |
| CORE-04 | Token refresh tem lower-bound guard para TTLs curtos | Bug confirmed in `auth.ts` line 122 -- `expires_in - 60` can go negative, causing immediate token expiry loop |
| CORE-05 | Retry inclui jitter para prevenir thundering herd | Confirmed in `retry.ts` line 56 -- pure exponential backoff with no randomization |
| CORE-06 | Coverage enforcement >= 90% configurado com `@vitest/coverage-v8` | Confirmed missing -- no `@vitest/coverage-v8` in devDependencies, no coverage config in vitest.config.ts |
| CORE-07 | Retry em POST/PUT mutacoes e seguro -- idempotency ou desabilitado | `withRetry()` has no HTTP-method parameter; resources don't use it internally, but it's exported for consumers. `requestWithRetry` in http.ts only retries on 401 (safe for auth refresh). Risk is consumer misuse. |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

- **Zero runtime dependencies** -- all fixes must use native Node.js APIs only
- **Zero `any`** -- strict TypeScript, `noExplicitAny: "error"` in Biome
- **Single quotes, trailing commas, 100-char line width** -- Biome enforced
- **ES module imports with `.js` extension** -- always `from './file.js'`
- **Functions under 30 lines** -- extract helpers when needed
- **Error hierarchy** -- SankhyaError > AuthError/ApiError/GatewayError/TimeoutError
- **Logger interface** -- use injected logger for warnings/debug, never `console.log` directly
- **Test framework** -- Vitest 3.x, tests in `tests/` directory
- **Coverage target** -- >= 90% (project constraint from CLAUDE.md)

## Standard Stack

### Core (already installed)
| Library | Version (local) | Purpose | Note |
|---------|-----------------|---------|------|
| vitest | 3.2.4 | Test runner | Already installed |
| typescript | 5.8.x | Type checking | Already installed |
| @biomejs/biome | 1.9.x | Linter/formatter | Already installed |

### To Install
| Library | Registry Version | Purpose | Why |
|---------|-----------------|---------|-----|
| @vitest/coverage-v8 | 3.2.4 | Coverage provider for vitest | Must match vitest major.minor; required for CORE-06 |

**Important:** `@vitest/coverage-v8` version must match the installed `vitest` version. Since local vitest is 3.2.4, install `@vitest/coverage-v8@^3.2.4` (NOT the latest 4.x which matches vitest 4.x in the registry).

**Installation:**
```bash
npm install -D @vitest/coverage-v8@^3.2.4
```

## Architecture Patterns

### Bug Fix Pattern (for this phase)
Each fix follows the same structure:
1. Write a failing test that reproduces the exact bug scenario
2. Fix the minimal code path
3. Verify the test passes
4. Verify existing tests still pass

### Pattern 1: Defensive Deserialization
**What:** When deserializing Gateway `{ "$": value }` fields, check the type of `value.$` before calling `String()`.
**When to use:** Any place that unwraps `$` values.
**Example:**
```typescript
// BEFORE (buggy): String({}) => "[object Object]"
result[key] = String((value as Record<string, unknown>).$);

// AFTER (safe): detect object/null/undefined and handle appropriately
const raw = (value as Record<string, unknown>).$;
if (raw === null || raw === undefined) {
  result[key] = '';
} else if (typeof raw === 'object') {
  // TAXAJURO returns { "$": {} } -- empty object means empty value
  result[key] = '';
} else {
  result[key] = String(raw);
}
```

### Pattern 2: TTL Lower Bound Guard
**What:** Ensure token TTL never goes below a minimum positive value.
**When to use:** When computing `expiresAt` from `expires_in`.
**Example:**
```typescript
const MINIMUM_TTL_SECONDS = 10;
const SAFETY_MARGIN_SECONDS = 60;

const ttlSeconds = Math.max(
  data.expires_in - SAFETY_MARGIN_SECONDS,
  MINIMUM_TTL_SECONDS,
);
```

### Pattern 3: Jitter in Exponential Backoff
**What:** Add random jitter to retry delays to prevent thundering herd.
**When to use:** Any retry loop with fixed exponential backoff.
**Example:**
```typescript
// Full jitter: random value between 0 and exponential ceiling
const exponentialDelay = baseDelay * 2 ** attempt;
const delay = Math.random() * exponentialDelay;

// OR equal jitter (more predictable): half fixed + half random
const delay = exponentialDelay / 2 + Math.random() * (exponentialDelay / 2);
```
**Recommendation:** Use full jitter -- it is the AWS-recommended approach and provides the best spread. See AWS Architecture Blog "Exponential Backoff And Jitter".

### Pattern 4: Method-Aware Retry
**What:** `withRetry` should accept an HTTP method hint so consumers can opt out of retry for unsafe methods.
**When to use:** Exported retry utility that consumers may wrap around mutations.
**Example:**
```typescript
export interface RetryOptions {
  maxRetries?: number;
  baseDelay?: number;
  /** HTTP method hint -- POST/PUT/PATCH/DELETE skip retry by default */
  method?: string;
  /** Force retry even for unsafe methods (consumer explicitly opts in) */
  forceRetry?: boolean;
}

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export async function withRetry<T>(fn: () => Promise<T>, options?: RetryOptions): Promise<T> {
  const method = options?.method?.toUpperCase();
  const maxRetries = (method && !SAFE_METHODS.has(method) && !options?.forceRetry)
    ? 0
    : (options?.maxRetries ?? DEFAULT_MAX_RETRIES);
  // ...
}
```

### Anti-Patterns to Avoid
- **Silent data loss:** Never return empty results without logging when the input was non-empty. The current `deserializeRows` swallows malformed responses silently.
- **String coercion on objects:** Never call `String(x)` on a value that could be an object. Always type-check first.
- **Negative TTL:** Never subtract a fixed margin from a TTL without a lower bound guard. Non-production environments may return very short `expires_in` values.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Coverage measurement | Custom coverage scripts | `@vitest/coverage-v8` with thresholds in vitest.config.ts | Accurate V8-based instrumentation, integrates with vitest natively |
| Jitter algorithm | Custom random delay | AWS full-jitter formula: `Math.random() * baseDelay * 2^attempt` | Well-studied algorithm, proven to minimize contention |

## Common Pitfalls

### Pitfall 1: @vitest/coverage-v8 Version Mismatch
**What goes wrong:** Installing `@vitest/coverage-v8@latest` (4.x) with vitest 3.x causes runtime errors -- the coverage provider API changed between major versions.
**Why it happens:** npm defaults to latest when no version range is specified.
**How to avoid:** Always pin `@vitest/coverage-v8` to match the installed vitest major.minor: `npm install -D @vitest/coverage-v8@^3.2.4`.
**Warning signs:** `Error: Failed to load coverage provider` at test runtime.

### Pitfall 2: Jitter Makes Tests Non-Deterministic
**What goes wrong:** Tests for retry timing become flaky because jitter introduces randomness.
**Why it happens:** `Math.random()` is called inside the delay calculation.
**How to avoid:** In tests, mock `Math.random` to return a fixed value (e.g., 0.5), OR set `baseDelay: 0` in test options so jitter is irrelevant, OR test behavior (number of retries) rather than timing.
**Warning signs:** Tests pass locally but fail intermittently in CI.

### Pitfall 3: deserialize() vs deserializeRows() Are Separate Code Paths
**What goes wrong:** Fixing the TAXAJURO bug in only one function leaves the other broken.
**Why it happens:** `deserialize()` (line 33) and `deserializeRows()` (line 119) both unwrap `$` but with different code. `deserializeRows` already handles objects with `JSON.stringify`, but `deserialize` uses `String()`.
**How to avoid:** Fix BOTH functions. Extract a shared helper `unwrapDollarValue(raw: unknown): string` used by both.
**Warning signs:** Tests for `deserializeRows` pass but `deserialize` still produces `"[object Object]"`.

### Pitfall 4: Token Refresh Loop with Low TTL
**What goes wrong:** When `expires_in` is small (e.g., 30s), `ttlSeconds` becomes negative, `expiresAt` is in the past, and every `getToken()` call triggers a new auth request.
**Why it happens:** `SAFETY_MARGIN_SECONDS = 60` is subtracted unconditionally.
**How to avoid:** Add `Math.max(ttlSeconds, MINIMUM_TTL_SECONDS)` with a floor of 10 seconds.
**Warning signs:** Excessive auth requests in logs, especially in sandbox/dev environments.

### Pitfall 5: 401 Retry on POST is Actually Safe
**What goes wrong:** Over-correcting CORE-07 by disabling the 401 retry in `requestWithRetry` for POST/PUT methods.
**Why it happens:** Confusing the two retry mechanisms. `requestWithRetry` retries on 401 (expired token) -- this is safe because the first request was rejected, no mutation occurred. `withRetry` retries on 429/5xx (the request may have been processed).
**How to avoid:** Only modify `withRetry` (exported utility) for method awareness. Leave `requestWithRetry`'s 401 handling untouched.

## Code Examples

### Fix CORE-01: Shared Unwrap Helper
```typescript
/**
 * Unwraps a Gateway "$" value safely.
 * Handles: string, number, boolean, null, undefined, empty object (TAXAJURO).
 */
function unwrapDollarValue(raw: unknown): string {
  if (raw === null || raw === undefined) return '';
  if (typeof raw === 'object') return ''; // e.g., TAXAJURO { "$": {} }
  return String(raw);
}
```

### Fix CORE-02: Log Extra Fields in deserializeRows
```typescript
// Inside the entity mapping loop, after processing f0..fN:
// Check for extra fields beyond fN and _rmd
for (const key of Object.keys(entity)) {
  if (key === '_rmd') continue;
  if (key.startsWith('f') && /^f\d+$/.test(key)) {
    const idx = Number.parseInt(key.slice(1), 10);
    if (idx >= fieldNames.length) {
      // Extra field not in metadata -- log it
      logger.warn(`Campo extra no Gateway: ${key} (indice ${idx} alem de ${fieldNames.length} campos no metadata)`);
    }
  }
}
```
**Note:** `deserializeRows` currently does not receive a logger. The function signature will need to accept an optional logger parameter, or use a module-level approach. Recommendation: add optional `logger` parameter to `deserializeRows` to maintain the injection pattern used elsewhere.

### Fix CORE-03: Log Empty/Malformed Responses
```typescript
export function deserializeRows(responseBody: unknown, logger?: Logger): DeserializedRows {
  if (!responseBody || typeof responseBody !== 'object') {
    logger?.warn('deserializeRows: responseBody vazio ou invalido');
    return { rows: [], totalRecords: 0, hasMore: false, page: 0 };
  }

  const body = responseBody as { entities?: GatewayEntities<Record<string, unknown>> };
  const entities = body.entities;

  if (!entities) {
    logger?.warn('deserializeRows: campo "entities" ausente na resposta');
    return { rows: [], totalRecords: 0, hasMore: false, page: 0 };
  }
  // ...
}
```

### Fix CORE-06: Vitest Coverage Config
```typescript
// vitest.config.ts
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    testTimeout: 30_000,
    env: loadEnv(),
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/types/**/*.ts', 'src/index.ts'],
      thresholds: {
        lines: 90,
        functions: 90,
        branches: 90,
        statements: 90,
      },
    },
  },
});
```

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 3.2.4 |
| Config file | `vitest.config.ts` |
| Quick run command | `npx vitest run tests/core/` |
| Full suite command | `npx vitest run` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CORE-01 | TAXAJURO `{ "$": {} }` produces empty string | unit | `npx vitest run tests/core/gateway-serializer.test.ts -t "TAXAJURO"` | Needs new test cases |
| CORE-02 | Extra DHALTER field preserved + logged | unit | `npx vitest run tests/core/gateway-serializer.test.ts -t "DHALTER"` | Needs new test cases |
| CORE-03 | Empty/malformed response logs warning | unit | `npx vitest run tests/core/gateway-serializer.test.ts -t "vazio"` | Partial -- empty case exists but no log assertion |
| CORE-04 | Low TTL produces valid positive TTL | unit | `npx vitest run tests/core/auth.test.ts -t "TTL"` | Needs new test case |
| CORE-05 | Retry delay includes jitter | unit | `npx vitest run tests/core/retry.test.ts -t "jitter"` | Needs new test case |
| CORE-06 | Coverage >= 90% enforced | config | `npx vitest run --coverage` | Needs config + devDep |
| CORE-07 | POST/PUT mutations not retried by withRetry | unit | `npx vitest run tests/core/retry.test.ts -t "POST"` | Needs new test case |

### Sampling Rate
- **Per task commit:** `npx vitest run tests/core/`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** `npx vitest run --coverage` (must pass 90% thresholds)

### Wave 0 Gaps
- [ ] `@vitest/coverage-v8@^3.2.4` -- must be installed before coverage enforcement works
- [ ] New test cases for CORE-01 through CORE-07 (listed above)
- [ ] No missing framework config -- vitest.config.ts exists, just needs coverage section added

## Open Questions

1. **CORE-02: Should extra fields be included in output or just logged?**
   - What we know: DHALTER is an extra field the API returns that is not in metadata. Currently silently dropped.
   - What's unclear: Whether consumers want these extra fields in the result or just want to know they exist.
   - Recommendation: Log a warning AND include extra fields in the row (preserving data is safer than dropping). Use the raw field key (e.g., `f5`) as the field name if no metadata mapping exists, or skip it and just log. Safest: log + skip, since unmapped field names (f5) are useless to consumers.

2. **CORE-07: How aggressive should mutation safety be?**
   - What we know: `withRetry` is exported for consumers. Resources don't use it internally. `requestWithRetry` only retries 401 (safe).
   - What's unclear: Whether to make `withRetry` refuse mutations by default (breaking change) or just document the risk.
   - Recommendation: Add `method` parameter, default to skip retry for unsafe methods. This is backward-compatible since it's a new optional parameter, but changes default behavior for consumers who pass `method: 'POST'`. Since v1 hasn't been published yet, this is safe.

## Sources

### Primary (HIGH confidence)
- Source code: `src/core/gateway-serializer.ts` -- confirmed TAXAJURO and DHALTER bugs by reading code
- Source code: `src/core/auth.ts` -- confirmed TTL negative value bug on line 122
- Source code: `src/core/retry.ts` -- confirmed no jitter on line 56
- Source code: `src/core/http.ts` -- confirmed requestWithRetry only handles 401, resources don't use withRetry
- Source code: `vitest.config.ts` + `package.json` -- confirmed no coverage provider or thresholds
- npm registry: `@vitest/coverage-v8@3.2.4` (verified via `npm view`)
- npm registry: `vitest@3.2.4` (locally installed, verified via `npm ls`)

### Secondary (MEDIUM confidence)
- AWS Architecture Blog "Exponential Backoff And Jitter" -- full jitter formula is industry standard

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all libraries already in use except coverage-v8, which is a direct vitest companion
- Architecture: HIGH -- all fixes are to existing code with clear bug reproduction paths
- Pitfalls: HIGH -- derived from direct code reading, not external research

**Research date:** 2026-04-06
**Valid until:** 2026-05-06 (stable -- internal bug fixes, no external API changes)
