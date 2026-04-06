# Codebase Concerns

**Analysis Date:** 2026-04-06

## Potential Data Type Coercion Issues

**String-to-Number Conversion in Pagination:**
- Issue: Pagination values (page, total, offset) return as strings from API but are parsed with `Number.parseInt()` which can silently fail
- Files: `src/core/pagination.ts` (lines 19, 21, 41, 43), `src/core/gateway-serializer.ts` (lines 98, 100)
- Impact: If API returns non-numeric strings, `parseInt()` returns `NaN`, falling back to `0` silently. Silent failures could mask API contract violations.
- Fix approach: Add explicit validation before parsing. Throw `ApiError` if pagination values are malformed. Add tests for edge cases (null, undefined, non-numeric strings).

**Implicit Type Coercion in Serializer:**
- Issue: `String()` coercion in `serialize()` function converts any value to string, including objects/arrays that probably shouldn't be sent
- Files: `src/core/gateway-serializer.ts` (lines 20, 15)
- Impact: Complex nested objects get stringified instead of properly serialized. Gateway API may reject or misinterpret stringified objects.
- Fix approach: Add explicit type checking before serialization. Validate input types match expected schema. Add test cases for object/array inputs.

**Deserialization Fallback Without Error:**
- Issue: `deserializeRows()` returns empty rows silently if entities are missing or malformed
- Files: `src/core/gateway-serializer.ts` (lines 74-75, 96-102)
- Impact: Callers can't distinguish between "no results found" and "API response was invalid". Could hide API contract violations.
- Fix approach: Differentiate error cases. Throw explicit error when entities structure is unexpected. Add validation tests.

---

## Security Considerations

**SQL Injection Risk in Gateway Criteria:**
- Issue: User-provided filter expressions are passed directly to Gateway criteria without sanitization
- Files: `src/resources/gateway.ts` (line 30), `src/resources/pedidos.ts` (line 28 uses dataNegociacaoInicio directly)
- Risk: If criteria strings come from user input, malicious expressions could be injected
- Current mitigation: Gateway API may have server-side validation, but SDK provides no client-side protection
- Recommendations: 
  - Document that criteria expressions must be pre-validated by caller
  - Consider adding CriteriaBuilder helper class to safely construct expressions
  - Add input validation wrapper for common filter patterns

**Token Handling in Config:**
- Issue: `xToken` passed as plaintext in config and stored in `SankhyaConfig`
- Files: `src/client.ts` (line 138), `src/core/http.ts` (line 92)
- Risk: If config object is logged/exposed, token is compromised
- Current mitigation: Logger doesn't expose config by default
- Recommendations:
  - Add config serialization guards in logger
  - Document security best practices in auth guide
  - Add warning if logger level is 'debug' when token is present

**Cache Provider Security:**
- Issue: Token cache provider interface has no encryption specification
- Files: `src/types/config.ts` (lines 12-16), `src/core/auth.ts` (line 129)
- Risk: Token stored plaintext in cache (e.g., Redis, localStorage). Caller responsible for encryption.
- Current mitigation: Interface documents responsibility
- Recommendations:
  - Add explicit security guidance in TypeScript docs
  - Provide example cache provider with encryption
  - Warn about browser security implications

---

## Retry Logic Limitations

**No Retry on REST POST/PUT Failures:**
- Issue: `requestWithRetry()` wraps all HTTP methods, but POST/PUT are retried blindly without idempotency checks
- Files: `src/core/http.ts` (lines 78-138), `src/core/retry.ts` (lines 40-62)
- Impact: Retrying POST/PUT on timeout could duplicate operations (create order twice, etc.). Sankhya API has no idempotency keys.
- Fix approach: 
  - Add idempotency flag to config
  - Document non-idempotent operations that should not auto-retry
  - Consider separate retry strategies for GET vs write operations

**Limited Retry Status Codes:**
- Issue: Only retries on 429, 5xx, and specific network errors. No retry on 503 with Retry-After header
- Files: `src/core/retry.ts` (line 11)
- Impact: If API sends Retry-After header, SDK ignores it and uses exponential backoff. Could hammer server during maintenance.
- Fix approach: Parse `Retry-After` header and respect server's requested delay

**No Jitter in Backoff:**
- Issue: Exponential backoff uses deterministic formula: `baseDelay * 2 ** attempt`
- Files: `src/core/retry.ts` (line 56)
- Impact: Multiple concurrent clients retry at exact same times, causing thundering herd. Could overload API.
- Fix approach: Add random jitter: `delay * (0.5 + Math.random())`

---

## Performance Bottlenecks

**No Request Batching:**
- Issue: Resource methods make individual HTTP requests. No built-in batching for bulk operations.
- Files: All resource files (e.g., `src/resources/produtos.ts`, `src/resources/clientes.ts`)
- Problem: Loading 1000 products requires 1000+ requests if paginating with default page size
- Current capacity: API rate limits unknown, but SDK provides no batching help
- Scaling path: Add batch helper methods or consider Gateway batch APIs (if available)

**Synchronous Token Refresh Mutex:**
- Issue: Token refresh uses promise-based mutex but multiple concurrent requests to `getToken()` all await same promise
- Files: `src/core/auth.ts` (lines 41-44, 46-51)
- Impact: If token expires with 10 concurrent requests in-flight, all 10 wait for single refresh. Sequential rather than parallel.
- This is actually correct behavior (prevents thundering herd), but could be slow. Consider: only issue is if refresh itself is slow.

**Pagination Generator Consumes Memory:**
- Issue: `createPaginator()` loads all rows from all pages into memory
- Files: `src/core/pagination.ts` (lines 71-82)
- Limit: For large datasets (10k+ records), async generator still yields individual items but doesn't release memory between pages
- Scaling path: Ensure items are garbage collected between yields (they should be, but verify with profiling)

---

## Fragile Areas

**Gateway Metadata Mapping:**
- Files: `src/core/gateway-serializer.ts` (lines 85-91, 106-141)
- Why fragile: Assumes metadata.fields.field is always array, fieldNames[i] maps to f[i]. If field count mismatches entity field count, mapping breaks silently.
- Safe modification: Add validation that field count equals entity field indices. Add tests with mismatched counts.
- Test coverage: `tests/core/gateway-serializer.test.ts` covers normal case but not mismatch edge cases

**Date Parsing Assumptions:**
- Files: `src/core/date.ts` (if implemented in Phase 4)
- Why fragile: Different date formats (ISO, timestamp, custom) require format-specific parsing. Assumptions about format could fail.
- Current state: Date utilities not yet implemented, but memory notes "YYYYMMDD" format expected in some fields

**Pedidos Status Tracking:**
- Files: `src/resources/pedidos.ts` (lines 62-71, 73-85)
- Why fragile: Confirms and Invoices orders via Gateway, but no status polling. Caller can't know if operation succeeded until next query.
- Safe modification: Add optional polling helper or status check endpoint

---

## Known API Quirks (Not Bugs, But Edge Cases)

**Gateway Returns HTTP 200 on Business Logic Errors:**
- Files: `src/core/http.ts` (line 53)
- Problem: API returns HTTP 200 with `status: '0'` (error) instead of 4xx/5xx. SDK checks `result.status === '0'` and throws, but this violates HTTP semantics.
- Current mitigation: Error handling is present
- Recommendation: Document this quirk in error handling guide. Already noted in memory.

**Missing Fields Mean Zero (No Explicit Null):**
- Files: Memory notes: "Estoque zero não retorna na API (ausência = zero)"
- Problem: Caller must assume missing fields are 0/empty. No way to distinguish missing vs present-but-zero.
- Impact: Hard to detect data model mismatches
- Recommendation: Document assumption. Consider validation schema.

**TAXAJURO Can Return Empty Object:**
- Files: Memory notes: "TAXAJURO pode retornar objeto vazio {} no $"
- Problem: Deserializer must handle `{ $: {} }` (object inside $) vs `{ $: "value" }`
- Current handling: `deserialize()` coerces to `String({})` = "[object Object]"
- Impact: Type errors downstream
- Recommendation: Add explicit type guard for objects inside $. Test case needed.

---

## Test Coverage Gaps

**Type Coercion Edge Cases:**
- What's not tested: `Number.parseInt("abc")` edge cases, `parseInt(null)`, `parseInt(undefined)`
- Files: `src/core/pagination.ts`, `src/core/gateway-serializer.ts`
- Risk: Silent `NaN` → `0` conversions could hide real API errors
- Priority: High — affects all paginated queries

**Error Propagation in Nested Operations:**
- What's not tested: Errors from nested `serialize()` calls in `pedidos.ts` item mapping
- Files: `src/resources/pedidos.ts` (lines 88-96, 123-131)
- Risk: If `serialize()` throws on invalid input, entire request fails without clear error message
- Priority: Medium — affects order operations

**Gateway Metadata Mismatch:**
- What's not tested: Field count mismatch (10 fields declared but 15 in entity)
- Files: `src/core/gateway-serializer.ts` (lines 106-141)
- Risk: Silent data loss — missing mapped fields
- Priority: High — affects all Gateway queries

**AuthManager Concurrent Token Requests:**
- What's not tested: Multiple concurrent `getToken()` calls before any completes
- Files: `src/core/auth.ts` (lines 35-52)
- Risk: Race condition — multiple refreshes could happen if timing is precise
- Current protection: `refreshPromise` mutex, but untested
- Priority: Medium — requires timing control to test

**Cache Provider Failures:**
- What's not tested: What happens if cache provider throws or returns corrupted JSON
- Files: `src/core/auth.ts` (lines 63-84)
- Risk: Corrupted cache could fail all subsequent auth attempts
- Priority: Medium — depends on cache provider quality

---

## Missing Critical Features

**No Status Polling for Async Operations:**
- Problem: `pedidos.confirmar()`, `pedidos.faturar()` are fire-and-forget. No polling helper to track completion.
- Blocks: Workflows that need to wait for confirmation/invoicing
- Impact: High for order processing workflows

**No Bulk Insert/Update:**
- Problem: No batch methods for creating/updating multiple items at once
- Blocks: Efficient bulk imports
- Impact: Medium — most B2B use cases do bulk updates

**No Pagination Helpers for Complex Filtering:**
- Problem: `createPaginator()` only supports simple page iteration. No filtering across pages.
- Blocks: Building search/filter UIs
- Impact: Low — doable at caller level but adds code

**No Retry Control per Request:**
- Problem: Retry config is global. Can't override for specific sensitive operations
- Blocks: Fine-grained retry policy per request
- Impact: Low — retry defaults reasonable for most cases

---

## Dependencies at Risk

**Native Fetch API (Node 18+):**
- Risk: SDK requires Node 18+ for native fetch. Earlier versions need polyfill.
- Impact: Narrows compatible Node versions
- Migration plan: Document minimum Node version. If support needed, add optional node-fetch polyfill.

**No External Dependencies:**
- Positive: Zero dependencies means no supply chain risk, smaller bundle
- Risk: All utilities (retry, date, serialization) built from scratch — more surface area for bugs
- Mitigation: Comprehensive testing (currently 75+ unit tests)

---

## Auth Expiration Edge Case

**Token Cache Safety Margin:**
- Files: `src/core/auth.ts` (line 6)
- Issue: Token invalidation uses 60-second safety margin. If API returns `expires_in: 30`, token invalidates immediately.
- Impact: Continuous re-authentication for short-lived tokens
- Fix approach: Cap safety margin to minimum of (expires_in / 2, 60)

---

## Configuration Validation Weakness

**No URL Validation:**
- Files: `src/client.ts` (line 135)
- Issue: Config validates non-empty string but doesn't validate URL format
- Impact: Invalid URLs fail silently at first request
- Fix approach: Add URL.parse() validation in constructor

**No Timeout Bounds:**
- Files: `src/client.ts` (line 50), `src/types/config.ts` (line 6)
- Issue: Timeout can be set to 0 or negative, causing fetch to fail immediately
- Fix approach: Add min timeout validation (e.g., >= 100ms) and max (e.g., <= 5 minutes)

