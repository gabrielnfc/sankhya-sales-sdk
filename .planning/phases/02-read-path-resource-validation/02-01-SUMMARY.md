---
phase: 02-read-path-resource-validation
plan: 01
subsystem: resources-types-validation
tags: [validation, sandbox, types, integration-tests]
dependency_graph:
  requires: []
  provides: [validated-clientes-types, validated-vendedores-types, validated-produtos-types, field-level-integration-tests]
  affects: [src/types/clientes.ts, src/types/vendedores.ts, src/types/produtos.ts, src/resources/vendedores.ts, src/resources/produtos.ts, tests/integration/resources.test.ts]
tech_stack:
  added: []
  patterns: [response-unwrapping-for-buscar-endpoints]
key_files:
  created: []
  modified:
    - src/types/clientes.ts
    - src/types/vendedores.ts
    - src/types/produtos.ts
    - src/resources/vendedores.ts
    - src/resources/produtos.ts
    - tests/integration/resources.test.ts
decisions:
  - "Cliente.codigoCliente typed as number|string - sandbox returns string"
  - "Cliente.limiteCredito typed as number|string - sandbox returns string"
  - "Vendedor nullable fields (comissaoGerencia, comissaoVenda, codigoEmpresa) - sandbox returns null"
  - "Vendedor.tipo typed as TipoVendedor|number|string - sandbox returns empty string for some entries"
  - "Produto interface extended with 12 new optional fields from sandbox (homepage, metroCubico, etc.)"
  - "buscar() methods for vendedores and produtos now unwrap { resource: {...} } wrapper from API"
  - "Produto 'dataAlteracao:' key with trailing colon is a Sankhya API quirk - both forms in interface"
metrics:
  duration: 3m12s
  completed: 2026-04-06
  tasks: 2
  files: 6
---

# Phase 02 Plan 01: Clientes/Vendedores/Produtos Validation Summary

SDK type interfaces and resource methods for clientes, vendedores, and produtos validated and corrected against live Sankhya sandbox, with field-level integration tests proving type accuracy.

## What Was Done

### Task 1: Discovery and Type Fixes (82ae83c)

Ran discovery scripts against the real Sankhya sandbox API to capture actual response shapes for all 3 resources. Compared every field against TypeScript interfaces and fixed all mismatches.

**Clientes findings:**
- `codigoCliente` returned as string ("169"), not number -- type changed to `number | string`
- `limiteCredito` returned as string ("" or value), not number -- type changed to `number | string`
- Fields `email`, `codigoVendedor`, `contatos`, `dataAlteracao` not returned by listar() -- correctly optional in interface

**Vendedores findings:**
- `tipo` returned as string (can be empty ""), not TipoVendedor enum -- type widened to `TipoVendedor | number | string`
- `comissaoGerencia`, `comissaoVenda`, `codigoEmpresa` can be `null` -- added `| null` to types
- 6 new fields discovered: `nomeParceiro`, `nomeGerente`, `codigoFuncionario`, `nomeFuncionario`, `codigoCentroResultado`, `nomeCentroResultado` -- added as optional
- **Bug fix:** `buscar()` returned `{ vendedores: {...} }` wrapper instead of unwrapped Vendedor object

**Produtos findings:**
- 12 new fields discovered: `homepage`, `grupoDesconto`, `referenciaFornecedor`, `cnae`, `metroCubico`, `altura`, `largura`, `espessura`, `unidadeMedida`, `utilizaBalanca`, `codigoPais` -- added as optional
- `dataAlteracao:` key has trailing colon in API response -- added both `dataAlteracao` and `'dataAlteracao:'` to interface
- Several fields (`agrupamentoMinimo`, `quantidadeEmbalagem`, `estoqueMaximo`, `estoqueMinimo`, `cest`) can be `null` -- added `| null`
- **Bug fix:** `buscar()` returned `{ produtos: {...} }` wrapper instead of unwrapped Produto object

**GrupoProduto findings:**
- New field `grupoIcms` (nullable string) discovered -- added as optional

### Task 2: Field-Level Integration Tests (60f4c3b)

Added field-level assertions to all 3 resource test suites plus 2 new test cases:

- `clientes.listar()`: asserts codigoCliente, nome (string), tipo (F/J), cnpjCpf (string), endereco (object), pagination
- `vendedores.listar()`: asserts codigoVendedor (number), nome (string), ativo (boolean), tipo
- `vendedores.buscar()`: **NEW** -- uses code from listar(), verifies unwrapped response
- `produtos.listar()`: asserts codigoProduto (number), nome (string), volume (string), ativo (boolean)
- `produtos.buscar()`: **NEW** -- uses code from listar(), verifies unwrapped response
- `produtos.listarGrupos()`: asserts codigoGrupoProduto (number), nome (string), analitico (boolean), ativo (boolean)

All 19 integration tests pass against the sandbox.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] vendedores.buscar() returns wrapped object**
- **Found during:** Task 1 discovery
- **Issue:** API returns `{ vendedores: { ...fields } }` but resource method returned the wrapper directly
- **Fix:** Added unwrapping logic in `VendedoresResource.buscar()` to extract inner object
- **Files modified:** `src/resources/vendedores.ts`
- **Commit:** 82ae83c

**2. [Rule 1 - Bug] produtos.buscar() returns wrapped object**
- **Found during:** Task 1 discovery
- **Issue:** API returns `{ produtos: { ...fields } }` but resource method returned the wrapper directly
- **Fix:** Added unwrapping logic in `ProdutosResource.buscar()` to extract inner object
- **Files modified:** `src/resources/produtos.ts`
- **Commit:** 82ae83c

**3. [Rule 2 - Missing fields] 18 missing fields across 3 interfaces**
- **Found during:** Task 1 discovery
- **Issue:** TypeScript interfaces were missing fields that the API actually returns
- **Fix:** Added all missing fields as optional properties with correct types
- **Files modified:** `src/types/clientes.ts`, `src/types/vendedores.ts`, `src/types/produtos.ts`
- **Commit:** 82ae83c

## Known Stubs

None -- all types are validated against real sandbox data.

## Verification

- `npx tsc --noEmit` passes with zero errors
- `npx vitest run tests/integration/resources.test.ts` -- 19/19 tests pass
- Field assertions cover: clientes (codigoCliente, nome, tipo, cnpjCpf, endereco), vendedores (codigoVendedor, nome, ativo, tipo), produtos (codigoProduto, nome, volume, ativo), grupos (codigoGrupoProduto, nome, analitico, ativo)
- New tests exist for vendedores.buscar() and produtos.buscar()

## Self-Check: PASSED

All 6 modified files exist. Both commit hashes (82ae83c, 60f4c3b) verified. SUMMARY.md created.
