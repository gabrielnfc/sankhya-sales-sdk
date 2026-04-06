---
phase: 05-test-coverage-hardening
plan: 01
subsystem: testing
tags: [vitest, unit-tests, resources, client-facade, tipopessoa]

requires:
  - phase: 04-developer-experience
    provides: Resource classes and SankhyaClient facade implementation

provides:
  - 7 unit test files covering 6 resource classes and SankhyaClient facade
  - 64 total unit tests with TipoPessoa F/J edge case coverage (TEST-06)
  - createMockHttp() test pattern for resource testing

affects: [05-test-coverage-hardening, coverage-thresholds]

tech-stack:
  added: []
  patterns: [createMockHttp mock factory for resource tests, restGet/restPost/restPut mock pattern]

key-files:
  created:
    - tests/resources/clientes.test.ts
    - tests/resources/vendedores.test.ts
    - tests/resources/produtos.test.ts
    - tests/resources/precos.test.ts
    - tests/resources/estoque.test.ts
    - tests/resources/fiscal.test.ts
    - tests/resources/client.test.ts
  modified: []

key-decisions:
  - "PrecosResource has 4 methods (not 5) - todosPorTabela does not exist in implementation, tested actual API surface"
  - "SankhyaClient authenticate/invalidateToken tested as callable functions (not mocked at fetch level) to avoid fragile internal coupling"

patterns-established:
  - "createMockHttp(): factory returning mock HttpClient with restGet/restPost/restPut/gatewayCall vi.fn() mocks"
  - "Resource tests verify endpoint path and query params via toHaveBeenCalledWith"
  - "listarTodos() tested by consuming AsyncGenerator with for-await-of"

requirements-completed: [TEST-01, TEST-06]

duration: 17min
completed: 2026-04-06
---

# Phase 05 Plan 01: Resource & Client Unit Tests Summary

**64 unit tests across 7 files covering all public methods of 6 resource classes and SankhyaClient facade, with explicit TipoPessoa F/J edge case validation**

## Performance

- **Duration:** 17 min
- **Started:** 2026-04-06T20:34:41Z
- **Completed:** 2026-04-06T20:51:37Z
- **Tasks:** 2
- **Files created:** 7

## Accomplishments
- Complete unit test coverage for ClientesResource (11 tests), VendedoresResource (5), ProdutosResource (11), PrecosResource (7), EstoqueResource (6), FiscalResource (2)
- SankhyaClient facade tests: config validation (5), lazy-load getters with singleton verification (11), internal getters (4), public methods (2)
- TipoPessoa F/J edge case explicitly tested - validates Sankhya returns 'F'/'J' single-char codes, not 'PF'/'PJ'

## Task Commits

Each task was committed atomically:

1. **Task 1: Unit tests for clientes, vendedores, produtos, precos, estoque, fiscal** - `4c9d579` (test)
2. **Task 2: Unit tests for SankhyaClient facade** - `d64918d` (test)

## Files Created/Modified
- `tests/resources/clientes.test.ts` - ClientesResource unit tests with TipoPessoa F/J edge case (11 tests)
- `tests/resources/vendedores.test.ts` - VendedoresResource unit tests (5 tests)
- `tests/resources/produtos.test.ts` - ProdutosResource unit tests including volumes and grupos (11 tests)
- `tests/resources/precos.test.ts` - PrecosResource unit tests (7 tests)
- `tests/resources/estoque.test.ts` - EstoqueResource unit tests (6 tests)
- `tests/resources/fiscal.test.ts` - FiscalResource unit tests (2 tests)
- `tests/resources/client.test.ts` - SankhyaClient facade unit tests (22 tests)

## Decisions Made
- PrecosResource has 4 methods (porTabela, porProduto, porProdutoETabela, contextualizado) not 5 as plan estimated - todosPorTabela does not exist in implementation
- SankhyaClient authenticate/invalidateToken tested as callable functions rather than mocking internal fetch to avoid fragile coupling to implementation details

## Deviations from Plan

None - plan executed exactly as written (minor correction: PrecosResource has 4 methods not 5).

## Issues Encountered
- Initial vendedores buscar() test failed because createMockHttp override pattern used Partial spread incorrectly - fixed by resetting mock return value directly via cast
- Initial fiscal importarNfse() test failed for same reason - same fix applied

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Resource test infrastructure established with reusable createMockHttp pattern
- Ready for 05-02 (pedidos, financeiros, cadastros, gateway tests) and 05-03 (coverage thresholds)

---
## Self-Check: PASSED

- All 7 test files exist
- Commit 4c9d579 found (Task 1)
- Commit d64918d found (Task 2)
- All 64 tests pass green

---
*Phase: 05-test-coverage-hardening*
*Completed: 2026-04-06*
