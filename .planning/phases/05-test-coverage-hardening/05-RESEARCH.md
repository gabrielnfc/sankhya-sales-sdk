# Phase 5: Test Coverage Hardening - Research

**Researched:** 2026-04-06
**Domain:** Vitest testing, coverage enforcement, CJS/ESM dual-format smoke tests
**Confidence:** HIGH

## Summary

Phase 5 requires closing the coverage gap created by the deliberate exclusion of `src/resources/**/*.ts`, `src/client.ts`, and `src/index.ts` from coverage during Phases 1-4. Currently, coverage is at 98% for core modules only (auth, http, pagination, retry, logger, errors, gateway-serializer, date), but the 10 resource classes (~850 lines total) and the client facade (~140 lines) have zero unit test coverage -- they are explicitly excluded in `vitest.config.ts`. The phase also requires formalizing the integration tests (already written across Phases 2-3) under a single `npm run test:integration` script, adding CJS/ESM smoke tests, and ensuring edge case coverage for documented API quirks.

The existing test infrastructure is mature: Vitest 3.0 with `@vitest/coverage-v8` 3.2.4 is installed, 129 unit tests pass in ~1s, and 11 integration test files already exist under `tests/integration/`. The primary work is (1) writing unit tests for all 10 resource classes + client using mock HttpClient, (2) removing the coverage exclusions, (3) adding the `test:integration` script, and (4) writing CJS/ESM smoke test scripts.

**Primary recommendation:** Use the existing `createMockHttp()` pattern from `pedidos-idempotency.test.ts` as the template for all resource unit tests -- mock the HttpClient methods (restGet, restPost, restPut, gatewayCall) and verify each resource method calls the correct endpoint with correct parameters and transforms the response correctly.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| TEST-01 | Unit tests >= 90% coverage on all source code | Remove exclusions from vitest.config.ts, write unit tests for 10 resources + client.ts; existing core tests already at 98% |
| TEST-02 | Integration tests for each resource against sandbox | 11 integration test files already exist; need `npm run test:integration` script and audit for completeness |
| TEST-03 | E2E B2B flow test passes against sandbox | `tests/integration/e2e-pedido-b2b.test.ts` already exists and covers the full flow |
| TEST-04 | CJS smoke test -- require() works and instanceof preserved | Write `tests/smoke/cjs.cjs` script; run with `node tests/smoke/cjs.cjs` after build |
| TEST-05 | ESM smoke test -- import works | Write `tests/smoke/esm.mjs` script; run with `node tests/smoke/esm.mjs` after build |
| TEST-06 | Edge case tests for TAXAJURO, DHALTER, pagination strings, TipoPessoa F/J | TAXAJURO and DHALTER already covered in gateway-serializer.test.ts; pagination strings covered in pagination.test.ts; need explicit TipoPessoa F/J test in resource tests |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

- **Runtime**: Node 20+ (fetch nativo, sem polyfills)
- **Zero deps**: No runtime dependencies; only devDeps
- **Quality**: Zero `any`, strict TypeScript, >= 90% coverage
- **Test framework**: Vitest 3.0 with `@vitest/coverage-v8`
- **Linter**: Biome (line width 100, single quotes, trailing commas)
- **Build**: tsup dual ESM/CJS output
- **Imports**: Always use `.js` extension in imports
- **Comments language**: Portuguese for inline, JSDoc for API
- **Naming**: camelCase for files/functions, PascalCase for types/classes

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| vitest | ^3.0.0 | Test runner | Already installed and configured |
| @vitest/coverage-v8 | ^3.2.4 | Coverage provider | Already installed; v8 is fastest for Node |
| tsup | ^8.3.0 | Build for smoke tests | Already installed; produces dist/ for CJS/ESM validation |

### Supporting
No additional libraries needed. All testing uses Vitest's built-in mocking (`vi.fn()`, `vi.mock()`). No additional test utilities required.

## Architecture Patterns

### Test File Structure
```
tests/
  core/              # Existing -- 8 files, 129 tests (KEEP)
  resources/         # NEW -- 10 resource unit test files + client
    clientes.test.ts
    vendedores.test.ts
    produtos.test.ts
    precos.test.ts
    estoque.test.ts
    pedidos.test.ts          # Expand from pedidos-idempotency.test.ts
    financeiros.test.ts
    cadastros.test.ts
    fiscal.test.ts
    gateway.test.ts
    client.test.ts
  integration/       # Existing -- 11 files (KEEP, add script)
  smoke/             # NEW -- CJS/ESM validation
    cjs.cjs
    esm.mjs
```

### Pattern 1: Mock HttpClient for Resource Unit Tests
**What:** Create a lightweight mock HttpClient that stubs `restGet`, `restPost`, `restPut`, `gatewayCall` and returns controlled data. Each test verifies: (a) correct endpoint path, (b) correct query params, (c) correct response transformation.
**When to use:** Every resource unit test.
**Example:**
```typescript
// Pattern from existing pedidos-idempotency.test.ts
function createMockHttp() {
  return {
    restGet: vi.fn().mockResolvedValue({
      clientes: [{ codigoCliente: 1, nome: 'Test' }],
      pagination: { page: '0', total: '1', hasMore: 'false', offset: '0' },
    }),
    restPost: vi.fn().mockResolvedValue({ codigoCliente: 1 }),
    restPut: vi.fn().mockResolvedValue({ codigoCliente: 1 }),
    gatewayCall: vi.fn().mockResolvedValue({}),
  } as unknown as HttpClient;
}
```

### Pattern 2: CJS/ESM Smoke Test Scripts
**What:** Standalone Node scripts (not Vitest tests) that `require()` or `import()` the built package and verify the exports work.
**When to use:** After `npm run build`, run these scripts to validate the dual-format output.
**Example:**
```javascript
// tests/smoke/cjs.cjs
const sdk = require('../../dist/index.cjs');
const { SankhyaClient, ApiError } = sdk;

// Verify constructor exists
if (typeof SankhyaClient !== 'function') {
  console.error('FAIL: SankhyaClient is not a function');
  process.exit(1);
}

// Verify instanceof works (class identity preserved across CJS)
const err = new ApiError('test', '/test', 'GET', 400);
if (!(err instanceof ApiError)) {
  console.error('FAIL: instanceof ApiError broken in CJS');
  process.exit(1);
}

console.log('PASS: CJS smoke test');
```

```javascript
// tests/smoke/esm.mjs
import { SankhyaClient, ApiError } from '../../dist/index.js';

if (typeof SankhyaClient !== 'function') {
  console.error('FAIL: SankhyaClient is not a function');
  process.exit(1);
}

const err = new ApiError('test', '/test', 'GET', 400);
if (!(err instanceof ApiError)) {
  console.error('FAIL: instanceof ApiError broken in ESM');
  process.exit(1);
}

console.log('PASS: ESM smoke test');
```

### Pattern 3: Gateway Response Mocking for Cadastros/Gateway Resources
**What:** Resources using `gatewayCall` + `deserializeRows` need mock responses in the Gateway format with metadata/entity structure.
**When to use:** CadastrosResource (tiposNegociacao, modelosNota), GatewayResource.
**Example:**
```typescript
// Mock Gateway loadRecords response
const gatewayResponse = {
  entities: {
    total: '2',
    hasMoreResult: 'false',
    offsetPage: '0',
    metadata: {
      fields: {
        field: [{ name: 'CODTIPVENDA' }, { name: 'DESCRTIPVENDA' }, { name: 'TAXAJURO' }, { name: 'ATIVO' }],
      },
    },
    entity: [
      { f0: { $: '1' }, f1: { $: 'A VISTA' }, f2: { $: '0' }, f3: { $: 'S' } },
      { f0: { $: '2' }, f1: { $: 'PARCELADO' }, f2: { $: {} }, f3: { $: 'S' } },
    ],
  },
};
```

### Anti-Patterns to Avoid
- **Mocking internal functions directly:** Do not mock `extractRestData` or `normalizeRestPagination` inside resource tests. Mock only `HttpClient` and let the real transformation code run -- this tests the full path.
- **Testing HTTP layer in resource tests:** Resource tests should NOT verify retry, timeout, or auth behavior. That belongs in `http.test.ts`.
- **Using real API in unit tests:** Integration tests use sandbox; unit tests use mocks only.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Coverage measurement | Custom line counter | `@vitest/coverage-v8` (already installed) | V8's native coverage is accurate and fast |
| Test mocking | Manual stub objects | `vi.fn()` from Vitest | Tracks calls, supports assertions, type-safe |
| CJS/ESM validation | Custom loader scripts | Simple require/import scripts + tsup build | tsup already generates correct output |

## Common Pitfalls

### Pitfall 1: Coverage Exclusions Still Active
**What goes wrong:** Tests pass but coverage stays at 98% for core only because `src/resources/**/*.ts`, `src/client.ts`, `src/index.ts` are excluded in vitest.config.ts.
**Why it happens:** Phase 1 deliberately excluded these files (CORE-06 decision).
**How to avoid:** Remove the `exclude` array from coverage config (keep only `src/types/**/*.ts` excluded since those are type-only files).
**Warning signs:** Coverage report shows no resource files in the table.

### Pitfall 2: Integration Tests Running in Unit Suite
**What goes wrong:** `npm test` tries to hit the sandbox, fails without env vars, or takes 60s+.
**Why it happens:** All tests are in `tests/**/*.test.ts` which vitest.config.ts includes.
**How to avoid:** Integration tests already use `describe.skipIf(!has)` pattern. But the `test:integration` script should explicitly include only `tests/integration/**`. Consider adding a separate vitest config or using `--include` flag.
**Warning signs:** `npm test` takes >5s or shows sandbox connection errors.

### Pitfall 3: CJS Smoke Test Requires Built Package
**What goes wrong:** Smoke test fails because `dist/` doesn't exist or is stale.
**Why it happens:** Smoke tests reference `../../dist/index.cjs` which requires `npm run build` first.
**How to avoid:** Add a `test:smoke` script that runs `tsup && node tests/smoke/cjs.cjs && node tests/smoke/esm.mjs`.
**Warning signs:** "Cannot find module" errors in smoke tests.

### Pitfall 4: Branch Coverage Below 90% After Including Resources
**What goes wrong:** Resources have conditional branches (optional params, if/else on params) that drop overall branch coverage below 90%.
**Why it happens:** Many resource methods have 3-8 optional query params each with `if` guards.
**How to avoid:** Test each resource method with and without optional params to cover both branches. Current branch threshold is 85% (set in Phase 1 as a deliberate decision). May need to keep 85% for branches or write thorough tests.
**Warning signs:** Coverage report shows `branches: 84%` and fails threshold.

### Pitfall 5: PedidosResource serialize() Calls Not Covered
**What goes wrong:** `incluirNotaGateway()` and `incluirAlterarItem()` use `serialize()` internally -- if test mocks skip response transformation, coverage misses these lines.
**Why it happens:** The mock returns a pre-serialized response, but the resource still calls `serialize()` on input.
**How to avoid:** Ensure mock tests call the real method (not skip it) -- the `serialize()` call happens before the HTTP call, so mocking HTTP is sufficient.

## Code Examples

### Resource Unit Test Template (verified pattern from existing code)
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ClientesResource } from '../../src/resources/clientes.js';
import type { HttpClient } from '../../src/core/http.js';

function createMockHttp(overrides?: Partial<Record<string, ReturnType<typeof vi.fn>>>) {
  return {
    restGet: vi.fn().mockResolvedValue({
      clientes: [{ codigoCliente: 1, nome: 'ACME' }],
      pagination: { page: '0', total: '1', hasMore: 'false', offset: '0' },
    }),
    restPost: vi.fn().mockResolvedValue({ codigoCliente: 1 }),
    restPut: vi.fn().mockResolvedValue({ codigoCliente: 1 }),
    gatewayCall: vi.fn().mockResolvedValue({}),
    ...overrides,
  } as unknown as HttpClient;
}

describe('ClientesResource', () => {
  let http: ReturnType<typeof createMockHttp>;
  let clientes: ClientesResource;

  beforeEach(() => {
    http = createMockHttp();
    clientes = new ClientesResource(http as unknown as HttpClient);
  });

  it('listar() calls restGet with correct path and default page', async () => {
    const result = await clientes.listar();
    expect(http.restGet).toHaveBeenCalledWith('/parceiros/clientes', { page: '1' });
    expect(result.data).toHaveLength(1);
    expect(result.data[0].nome).toBe('ACME');
  });

  it('listar() passes dataHoraAlteracao filter', async () => {
    await clientes.listar({ page: 2, dataHoraAlteracao: '2026-01-01' });
    expect(http.restGet).toHaveBeenCalledWith('/parceiros/clientes', {
      page: '2',
      dataHoraAlteracao: '2026-01-01',
    });
  });

  it('criar() calls restPost with input', async () => {
    const input = { nome: 'Test', cnpjCpf: '12345' };
    await clientes.criar(input);
    expect(http.restPost).toHaveBeenCalledWith('/parceiros/clientes', input);
  });
});
```

### SankhyaClient Unit Test Template
```typescript
import { describe, it, expect } from 'vitest';
import { SankhyaClient } from '../../src/client.js';
import { ClientesResource } from '../../src/resources/clientes.js';

const validConfig = {
  baseUrl: 'https://api.test.com',
  clientId: 'test-id',
  clientSecret: 'test-secret',
  xToken: 'test-token',
};

describe('SankhyaClient', () => {
  it('creates instance with valid config', () => {
    const client = new SankhyaClient(validConfig);
    expect(client).toBeInstanceOf(SankhyaClient);
  });

  it('throws on missing baseUrl', () => {
    expect(() => new SankhyaClient({ ...validConfig, baseUrl: '' }))
      .toThrow('baseUrl');
  });

  it('lazy-loads clientes resource', () => {
    const client = new SankhyaClient(validConfig);
    expect(client.clientes).toBeInstanceOf(ClientesResource);
    // Same instance on second access
    expect(client.clientes).toBe(client.clientes);
  });
});
```

### Edge Case Test for TipoPessoa F/J
```typescript
it('listar() returns clientes with TipoPessoa F or J', async () => {
  http = createMockHttp({
    restGet: vi.fn().mockResolvedValue({
      clientes: [
        { codigoCliente: 1, nome: 'Pessoa Fisica', tipo: 'F' },
        { codigoCliente: 2, nome: 'Pessoa Juridica', tipo: 'J' },
      ],
      pagination: { page: '0', total: '2', hasMore: 'false', offset: '0' },
    }),
  });
  clientes = new ClientesResource(http as unknown as HttpClient);
  const result = await clientes.listar();
  expect(result.data[0].tipo).toBe('F');  // Not 'PF'
  expect(result.data[1].tipo).toBe('J');  // Not 'PJ'
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Coverage excluded resources | Include all src/ except types/ | Phase 5 | Raises bar from core-only to full-codebase coverage |
| No test:integration script | Explicit vitest config for integration | Phase 5 | Enables `npm run test:integration` command |
| Manual CJS/ESM check | Automated smoke scripts | Phase 5 | Prevents publish of broken dual-format builds |

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 3.0.0 with @vitest/coverage-v8 3.2.4 |
| Config file | `vitest.config.ts` |
| Quick run command | `npx vitest run --exclude='tests/integration/**'` |
| Full suite command | `npx vitest run --coverage` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| TEST-01 | >= 90% coverage all source | unit | `npx vitest run --coverage` | Partially (core yes, resources no) |
| TEST-02 | Integration test per resource | integration | `npx vitest run --include='tests/integration/**'` | Mostly (11 files exist) |
| TEST-03 | E2E B2B test passes | integration | `npx vitest run tests/integration/e2e-pedido-b2b.test.ts` | Yes |
| TEST-04 | CJS require() works | smoke | `node tests/smoke/cjs.cjs` | No -- Wave 0 |
| TEST-05 | ESM import works | smoke | `node tests/smoke/esm.mjs` | No -- Wave 0 |
| TEST-06 | Edge cases covered | unit | `npx vitest run -t 'TAXAJURO\|DHALTER\|TipoPessoa\|pagination'` | Partially (TAXAJURO/DHALTER yes, TipoPessoa no) |

### Sampling Rate
- **Per task commit:** `npx vitest run --exclude='tests/integration/**'`
- **Per wave merge:** `npx vitest run --coverage`
- **Phase gate:** Full suite green + coverage >= 90% before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `tests/resources/clientes.test.ts` -- covers ClientesResource unit tests
- [ ] `tests/resources/vendedores.test.ts` -- covers VendedoresResource unit tests
- [ ] `tests/resources/produtos.test.ts` -- covers ProdutosResource unit tests
- [ ] `tests/resources/precos.test.ts` -- covers PrecosResource unit tests
- [ ] `tests/resources/estoque.test.ts` -- covers EstoqueResource unit tests
- [ ] `tests/resources/financeiros.test.ts` -- covers FinanceirosResource unit tests
- [ ] `tests/resources/cadastros.test.ts` -- covers CadastrosResource unit tests
- [ ] `tests/resources/fiscal.test.ts` -- covers FiscalResource unit tests
- [ ] `tests/resources/gateway.test.ts` -- covers GatewayResource unit tests
- [ ] `tests/resources/client.test.ts` -- covers SankhyaClient unit tests
- [ ] `tests/smoke/cjs.cjs` -- CJS smoke test
- [ ] `tests/smoke/esm.mjs` -- ESM smoke test
- [ ] vitest.config.ts coverage.exclude update -- remove resources/client exclusions

## Current State Analysis

### Coverage Before Phase 5
```
File               | % Stmts | % Branch | % Funcs | % Lines |
All files (core)   |   98.02 |    89.04 |     100 |   98.02 |
```

**Excluded from coverage (must be included):**
- `src/resources/**/*.ts` -- 10 files, ~850 lines, 0% coverage
- `src/client.ts` -- 1 file, ~140 lines, 0% coverage
- `src/index.ts` -- 1 file, ~124 lines (re-exports only, may stay excluded)

**Already covered (keep):**
- `src/types/**/*.ts` -- type-only files, correctly excluded

### Resource Method Count (must be unit tested)
| Resource | Methods | Lines | Complexity |
|----------|---------|-------|------------|
| ClientesResource | 6 (listar, criar, atualizar, incluirContato, atualizarContato, listarTodos) | 56 | Low -- all REST |
| VendedoresResource | 3 (listar, buscar, listarTodos) | 30 | Low -- REST + unwrap |
| ProdutosResource | 9 (listar, buscar, componentes, alternativos, volumes, listarVolumes, buscarVolume, listarGrupos, buscarGrupo, listarTodos) | 85 | Low -- REST + unwrap |
| PrecosResource | 5 (porTabela, porProduto, porProdutoETabela, todosPorTabela, contextualizado) | 51 | Low -- REST |
| EstoqueResource | 5 (porProduto, listar, listarLocais, buscarLocal, listarTodos) | 38 | Low -- REST |
| PedidosResource | 9 (consultar, consultarTodos, criar, atualizar, cancelar, confirmar, faturar, incluirNotaGateway, incluirAlterarItem, excluirItem) | 158 | Medium -- REST + Gateway + serialize |
| FinanceirosResource | 12 (listarTiposPagamento, buscarTipoPagamento, listarReceitas, registrarReceita, atualizarReceita, baixarReceita, listarDespesas, registrarDespesa, atualizarDespesa, baixarDespesa, listarMoedas, buscarMoeda, listarContasBancarias, buscarContaBancaria, + 4 iterators) | 147 | Medium -- many methods |
| CadastrosResource | 13 (listarTiposOperacao, buscarTipoOperacao, listarNaturezas, buscarNatureza, listarProjetos, buscarProjeto, listarCentrosResultado, buscarCentroResultado, listarEmpresas, buscarEmpresa, listarUsuarios, + 5 iterators, tiposNegociacao, modelosNota) | 187 | High -- REST + Gateway |
| FiscalResource | 2 (calcularImpostos, importarNfse) | 14 | Low -- REST POST only |
| GatewayResource | 3 (loadRecords, loadRecord, saveRecord) | 74 | Medium -- Gateway + serialize/deserialize |
| SankhyaClient | 14 (constructor, 10 getters, authenticate, invalidateToken, validateConfig, internal getters) | 140 | Low -- facade |

### Existing Integration Tests (already written)
| File | Resource Coverage |
|------|------------------|
| resources.test.ts | clientes, vendedores, produtos, precos, estoque, cadastros |
| curadoria.test.ts | Gateway raw calls, deserializeRows |
| curadoria-v2.test.ts | REST pagination, Gateway tiposNegociacao |
| write-pedidos.test.ts | pedidos write-path |
| write-financeiros.test.ts | financeiros write-path |
| write-fiscal.test.ts | fiscal |
| write-gateway.test.ts | gateway CRUD |
| e2e-pedido-b2b.test.ts | Full B2B flow |
| sandbox.test.ts | Auth + basic connectivity |
| paths-validation.test.ts | All REST paths |

### Key Config Changes Required
1. **vitest.config.ts** -- Remove `src/resources/**/*.ts` and `src/client.ts` from coverage.exclude. Keep `src/types/**/*.ts` excluded.
2. **package.json** -- Add scripts:
   - `"test:integration": "vitest run --include='tests/integration/**'"` (or separate config)
   - `"test:smoke": "tsup && node tests/smoke/cjs.cjs && node tests/smoke/esm.mjs"`
3. **Branch threshold** -- Currently 85%. Resource methods with many optional params may require keeping at 85% or writing comprehensive branch tests.

## Open Questions

1. **Branch coverage threshold: 85% or 90%?**
   - What we know: Phase 1 set branches to 85% deliberately. Resources add many `if (param) query.param = param` branches.
   - What's unclear: Whether thorough testing of optional params can reach 90% branches.
   - Recommendation: Keep 85% for branches (current setting), enforce 90% for lines/functions/statements. If tests naturally reach 90% branches, raise the threshold.

2. **Should src/index.ts be included in coverage?**
   - What we know: It's purely re-exports. No logic to test. Currently excluded.
   - Recommendation: Keep excluded -- it has no testable logic, and `api-surface.test.ts` already validates the exports.

3. **Integration test runner isolation**
   - What we know: Integration tests use `describe.skipIf(!has)` so they skip without env vars. But they still get collected and show as skipped.
   - Recommendation: Add `test:integration` script with explicit include pattern. Unit tests remain the default `npm test`.

## Sources

### Primary (HIGH confidence)
- Codebase analysis: `vitest.config.ts`, `package.json`, all `src/resources/*.ts` files, all `tests/**/*.test.ts` files
- Existing test patterns: `tests/resources/pedidos-idempotency.test.ts` (verified mock pattern)
- Coverage output: `npx vitest run --coverage` (actual run, 2026-04-06)

### Secondary (MEDIUM confidence)
- Vitest documentation: coverage configuration, include/exclude patterns (from training data, Vitest 3.x)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All tools already installed and configured
- Architecture: HIGH - Patterns proven by existing pedidos-idempotency.test.ts
- Pitfalls: HIGH - Coverage exclusion issue identified from actual vitest.config.ts analysis
- Edge cases: HIGH - TAXAJURO/DHALTER already tested; TipoPessoa gap clearly identified

**Research date:** 2026-04-06
**Valid until:** 2026-05-06 (stable -- no dependency changes expected)
