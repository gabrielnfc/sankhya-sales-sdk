---
phase: 04-public-api-surface
plan: 03
subsystem: public-api
tags: [idempotency, request-options, mutation-methods, pedidos, financeiros]
dependency_graph:
  requires: [04-01]
  provides: [idempotency-key-threading]
  affects: []
tech_stack:
  added: []
  patterns: [optional-options-last-parameter, idempotency-key-header-forwarding]
key_files:
  created:
    - tests/resources/pedidos-idempotency.test.ts
  modified:
    - src/resources/pedidos.ts
    - src/resources/financeiros.ts
    - src/types/config.ts
    - src/core/http.ts
    - src/types/index.ts
    - src/index.ts
decisions:
  - RequestOptions added to config.ts as prerequisite (worktree missing 04-02 changes)
  - HttpClient methods threaded with RequestOptions including AbortSignal.any for combined signals
  - X-Idempotency-Key header set when idempotencyKey provided in options
metrics:
  duration: 3m30s
  completed: 2026-04-06
  tasks_completed: 2
  tasks_total: 2
  tests_added: 9
  files_changed: 7
---

# Phase 04 Plan 03: Idempotency Key Threading for Mutation Methods Summary

Optional RequestOptions (timeout, signal, idempotencyKey) on all 14 mutation methods across pedidos and financeiros resources, with X-Idempotency-Key header forwarding via HttpClient.

## Task Results

### Task 1: Add RequestOptions to pedidos mutation methods (TDD)

- **Commit (RED):** `6dcfae3` - 9 failing tests for idempotency key forwarding
- **Commit (GREEN):** `1b55080` - Implementation passing all tests
- Added `options?: RequestOptions` as last parameter to all 8 mutation methods:
  - `criar`, `atualizar`, `cancelar`, `confirmar`, `faturar`, `incluirNotaGateway`, `incluirAlterarItem`, `excluirItem`
- Options forwarded to `restPost`, `restPut`, and `gatewayCall` respectively
- Read-only `consultar` method unchanged
- 9 tests verify forwarding and backward compatibility

### Task 2: Add RequestOptions to financeiros mutation methods

- **Commit:** `3cbee15` - 6 mutation methods with RequestOptions
- Added `options?: RequestOptions` to all 6 mutation methods:
  - `registrarReceita`, `atualizarReceita`, `baixarReceita`, `registrarDespesa`, `atualizarDespesa`, `baixarDespesa`
- Options forwarded to `restPost` and `restPut` calls
- Read-only methods unchanged: `listarTiposPagamento`, `buscarTipoPagamento`, `listarReceitas`, `listarDespesas`, `listarMoedas`, `buscarMoeda`, `listarContasBancarias`, `buscarContaBancaria`, `listarTodasReceitas`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added RequestOptions interface and HttpClient threading**
- **Found during:** Task 1
- **Issue:** Worktree has single squashed commit without 04-02 changes; RequestOptions interface and HttpClient threading were missing
- **Fix:** Added `RequestOptions` interface to `config.ts`, threaded through all HttpClient methods (restPost, restPut, gatewayCall), added `X-Idempotency-Key` header support, `AbortSignal.any` for combined signals, per-call timeout override
- **Files modified:** `src/types/config.ts`, `src/core/http.ts`, `src/types/index.ts`, `src/index.ts`
- **Commit:** `1b55080`

## Known Stubs

None - all implementations are complete and wired.

## Verification

- `npx tsc --noEmit` - compiles cleanly
- `npx vitest run tests/resources/pedidos-idempotency.test.ts` - 9 tests pass
- `npx vitest run` - 84 tests pass, 72 skipped (integration)
- Acceptance criteria: 8 RequestOptions in pedidos.ts, 6 in financeiros.ts

## Self-Check: PASSED
