---
phase: 04-public-api-surface
plan: 02
subsystem: public-api
tags: [request-options, async-generators, pagination, timeout]
dependency_graph:
  requires: [04-01]
  provides: [RequestOptions-threading, listarTodos-complete]
  affects: [04-03]
tech_stack:
  added: []
  patterns: [AbortSignal.any-combined-signals, per-call-timeout-override, async-generator-pagination]
key_files:
  created: []
  modified:
    - src/core/http.ts
    - src/types/config.ts
    - src/resources/pedidos.ts
    - src/resources/financeiros.ts
    - src/resources/cadastros.ts
    - src/resources/precos.ts
    - tests/core/http.test.ts
decisions:
  - AbortSignal.any combines internal timeout with external signal (Node 20+ native)
  - RequestOptions added to config.ts as dependency (was expected from 04-01 but missing in worktree)
  - Per-call timeout uses options.timeout ?? this.timeout fallback pattern
metrics:
  duration: 4m52s
  completed: 2026-04-06
  tasks_completed: 2
  tasks_total: 2
  tests_added: 6
  files_changed: 7
---

# Phase 04 Plan 02: RequestOptions Threading and listarTodos AsyncGenerators Summary

Per-call timeout/signal/idempotency via RequestOptions on all HttpClient methods, plus 10 new AsyncGenerator methods across 4 resources for complete paginated iteration.

## Task Results

### Task 1: Thread RequestOptions through HttpClient methods (TDD)

- **Commit (RED):** `633fc05` - Failing tests for RequestOptions on HttpClient
- **Commit (GREEN):** `be46ebf` - Implementation passing all tests
- Updated all 4 public methods (restGet, restPost, restPut, gatewayCall) to accept optional `RequestOptions`
- `requestWithRetry` uses `options?.timeout ?? this.timeout` for per-call timeout override
- `AbortSignal.any()` combines internal timeout signal with user-provided signal
- `X-Idempotency-Key` header forwarded when `idempotencyKey` provided
- 401 retry passes options through to recursive call
- 6 new tests covering timeout override, external signal abort, idempotency key header, and options on all methods

### Task 2: Add listarTodos/consultarTodos to all resources

- **Commit:** `1c0e5ab` - 10 new AsyncGenerator methods across 4 resources
- **pedidos.ts**: `consultarTodos()` - page starts at 0
- **financeiros.ts**: `listarTodosTiposPagamento()`, `listarTodasDespesas()`, `listarTodasMoedas()` - page starts at 0
- **cadastros.ts**: `listarTodosTiposOperacao()`, `listarTodasNaturezas()`, `listarTodosProjetos()`, `listarTodosCentrosResultado()`, `listarTodasEmpresas()` - page starts at 0
- **precos.ts**: `todosPorTabela()` - uses `pagina` param, starts at 1
- All use `createPaginator` with correct page start values

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added RequestOptions interface to config.ts**
- **Found during:** Task 1
- **Issue:** RequestOptions interface was expected to exist from 04-01 but was not present in this worktree (worktree has single squashed commit without 04-01 changes)
- **Fix:** Added `RequestOptions` interface to `src/types/config.ts` with `timeout`, `signal`, `idempotencyKey` fields
- **Files modified:** `src/types/config.ts`
- **Commit:** `633fc05`

## Known Stubs

None - all implementations are complete and wired.

## Verification

- `npx tsc --noEmit` - compiles cleanly
- `npx vitest run tests/core/http.test.ts` - 16 tests pass
- `npx vitest run` - 81 tests pass, 72 skipped (integration)

## Self-Check: PASSED
