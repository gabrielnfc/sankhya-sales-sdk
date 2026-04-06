# Phase 2: Read-Path Resource Validation - Research

**Researched:** 2026-04-06
**Domain:** TypeScript SDK resource layer validation against live Sankhya ERP sandbox
**Confidence:** HIGH

## Summary

Phase 2 validates that all read-only resource methods produce correct TypeScript types and return real data from the Sankhya sandbox. The 7 resources in scope are: clientes, vendedores, produtos, precos, estoque, cadastros (including Gateway-only tiposNegociacao and modelosNota). The resource classes and type interfaces already exist and follow consistent patterns -- this phase is about **validation and correction**, not greenfield implementation.

The core risk is field name mismatches between the TypeScript interfaces (written from documentation) and the actual API response fields. The existing integration test file (`tests/integration/resources.test.ts`) already covers basic "does the call succeed" assertions for most resources, but lacks **structural assertions** that verify field names and types match the interfaces. The work is: (1) run each resource method against sandbox, (2) capture real response shapes, (3) compare to current TypeScript interfaces, (4) fix any mismatches, (5) add structural integration tests.

**Primary recommendation:** Run each read method against the sandbox, snapshot the response shapes, diff against current TypeScript interfaces, fix mismatches, then add integration tests that assert on field presence and type correctness.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| RVAL-01 | Resource `clientes` -- read-path validated against sandbox (listar) | Existing `ClientesResource.listar()` calls `GET /v1/parceiros/clientes`; `Cliente` interface has 13 fields. Integration test exists but lacks field assertions. |
| RVAL-02 | Resource `vendedores` -- read-path validated against sandbox (listar, buscar) | Existing `VendedoresResource` with `listar()` and `buscar()`. Type has 13 fields including enum `TipoVendedor`. Integration test exists. |
| RVAL-03 | Resource `produtos` -- read-path validated against sandbox (listar, buscar, grupos) | Existing `ProdutosResource` with 8 methods. `Produto` has 18 fields. Integration tests for `listar()` and `listarGrupos()` exist. |
| RVAL-04 | Resource `precos` -- read-path validated against sandbox (porProduto, porTabela, contextualizado) | Existing `PrecosResource` with 4 methods. `Preco` has 6 fields. Integration test for `porTabela()` exists (with 404 fallback). |
| RVAL-05 | Resource `estoque` -- read-path validated against sandbox (porProduto, listar, locais) | Existing `EstoqueResource` with 4 methods. `Estoque` has 5 fields. Integration test for `listarLocais()` exists. |
| RVAL-08 | Resource `cadastros` -- read-path validated including Gateway-only tiposNegociacao and modelosNota | Existing `CadastrosResource` with 12 methods. Gateway methods use `deserializeRows()`. Integration tests for TOPs, naturezas, empresas, usuarios, centros, tiposNegociacao exist. **Missing:** `listarModelosNota()` integration test. |
| RVAL-11 | TypeScript interfaces for each resource have zero field name mismatches against real API responses | Current interfaces written from docs -- must be validated against real sandbox responses. Key risk: fields that exist in API but are missing from interfaces, or interface fields that don't map to real API keys. |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Vitest | 3.0.x | Test runner for integration tests | Already configured in project |
| TypeScript | 5.8.x | Type checking and compilation | Already configured in project |
| Biome | 1.9.x | Linting and formatting | Already configured in project |

### Supporting
No new libraries needed. This phase uses only existing project infrastructure.

**Installation:** No new packages required.

## Architecture Patterns

### Existing Resource Pattern (DO NOT CHANGE)
Every resource follows this established pattern:
```
src/resources/{resource}.ts  -- Resource class with methods
src/types/{resource}.ts      -- TypeScript interfaces
tests/integration/resources.test.ts  -- Integration tests
```

### Resource Method Patterns

**REST v1 list methods:**
```typescript
async listar(params?): Promise<PaginatedResult<T>> {
  const query: Record<string, string> = { page: String(params?.page ?? 0) };
  const raw = await this.http.restGet<Record<string, unknown>>('/path', query);
  const { data, pagination } = extractRestData<T>(raw);
  return normalizeRestPagination(data, pagination);
}
```

**REST v1 single-item methods:**
```typescript
async buscar(id: number): Promise<T> {
  return this.http.restGet(`/path/${id}`);
}
```

**Gateway methods (cadastros.listarTiposNegociacao, cadastros.listarModelosNota):**
```typescript
async listarTiposNegociacao(): Promise<TipoNegociacao[]> {
  const result = await this.http.gatewayCall<Record<string, unknown>>('mge', 'CRUDServiceProvider.loadRecords', {
    dataSet: { rootEntity: 'TipoNegociacao', ... }
  });
  const { rows } = deserializeRows(result);
  return rows.map(row => ({ /* field mapping */ }));
}
```

### Validation Test Pattern
Each resource integration test should follow this structure:
```typescript
it('resource.method() -- field validation', async () => {
  const result = await sankhya.resource.method();
  // Assert data exists
  expect(result.data.length).toBeGreaterThan(0);
  // Assert field names match interface
  const first = result.data[0];
  expect(first).toHaveProperty('fieldName');
  // Assert field types
  expect(typeof first.fieldName).toBe('expectedType');
});
```

### Anti-Patterns to Avoid
- **Blind type assertion:** Casting `as T` without verifying the API actually returns those fields. The whole point of this phase is to verify that the cast is correct.
- **Testing only happy path:** Must also verify that optional fields are genuinely optional (not always present) and required fields are always present.
- **Modifying types without sandbox evidence:** Every type change must be justified by actual sandbox response data.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Pagination normalization | Custom page parsing | `extractRestData()` + `normalizeRestPagination()` | Already handles string-typed pagination, varying resource keys |
| Gateway deserialization | Manual field mapping from f0/f1 | `deserializeRows()` | Handles metadata-based field mapping, DHALTER extras, TAXAJURO edge case |
| HTTP with auth | Manual fetch + token management | `HttpClient.restGet()` / `.gatewayCall()` | Auto-retries on 401, token refresh, timeout handling |

## Common Pitfalls

### Pitfall 1: Pagination page index inconsistency
**What goes wrong:** Some endpoints start at page 0 (produtos, vendedores, cadastros), while clientes starts at page 1. Using wrong start page returns empty or duplicated data.
**Why it happens:** Sankhya API is inconsistent across endpoints.
**How to avoid:** Check each resource's existing `listar()` default -- clientes uses `params?.page ?? 1`, all others use `params?.page ?? 0`. Precos uses `pagina` (not `page`).
**Warning signs:** Empty first page, or getting the same data on page 0 and page 1.

### Pitfall 2: String-typed numeric fields
**What goes wrong:** API returns `"123"` (string) for fields typed as `number` in the interface. The `as T` cast doesn't coerce types -- the runtime value is still a string.
**Why it happens:** REST v1 pagination fields are all strings. Some entity fields may also be strings where we expect numbers.
**How to avoid:** For pagination, `normalizeRestPagination()` already handles string-to-number. For entity fields, integration tests must verify `typeof field` and fix type interfaces or add coercion if needed.
**Warning signs:** `typeof result.data[0].codigoProduto === 'string'` when interface says `number`.

### Pitfall 3: TipoPessoa returns 'F'/'J' not 'PF'/'PJ'
**What goes wrong:** Documentation says `'PF' | 'PJ'` but API returns `'F' | 'J'`.
**Why it happens:** Documented in MEMORY.md as a known quirk.
**How to avoid:** Current type `TipoPessoa = 'F' | 'J'` is already correct. However, the docs in `clientes.md` say `'PF' | 'PJ'` -- this doc discrepancy should be noted but the code type is correct.
**Warning signs:** Type mismatch if someone "fixes" the type to match the documentation.

### Pitfall 4: Gateway fields with TAXAJURO edge case
**What goes wrong:** TipoNegociacao has a `taxaJuro` field that can return `{}` (empty object) as the `$` value in Gateway format.
**Why it happens:** Sankhya returns `{ "$": {} }` for null/empty numeric fields in some entities.
**How to avoid:** The `unwrapDollarValue()` function in gateway-serializer already handles this (returns empty string for objects). The cadastros resource currently hardcodes `taxaJuro: 0` -- should verify if TAXAJURO field is actually available and what it returns.
**Warning signs:** NaN or `[object Object]` in taxaJuro values.

### Pitfall 5: Estoque zero not returned
**What goes wrong:** Products with zero stock don't appear in the API response. Absence means zero, not "unknown".
**Why it happens:** Sankhya API design choice -- documented in MEMORY.md.
**How to avoid:** Integration test for `estoque.porProduto()` should test with a product known to have stock. Test cannot assert on zero-stock products since they won't be returned.
**Warning signs:** Empty array for a product that exists but has zero stock is correct behavior, not a bug.

### Pitfall 6: Missing CODTAB field in TipoNegociacao
**What goes wrong:** The `TipoNegociacao` interface has `taxaJuro: number` but the Gateway query only requests `CODTIPVENDA,DESCRTIPVENDA,ATIVO` -- TAXAJURO is not in the fieldset list.
**Why it happens:** The cadastros resource `listarTiposNegociacao()` hardcodes `taxaJuro: 0` because the field is not requested from Gateway.
**How to avoid:** Either add TAXAJURO to the fieldset list and parse it from the response, or document that taxaJuro is always 0 in the current implementation. Validate against sandbox which approach is correct.
**Warning signs:** `taxaJuro` always being 0 even when the real value is non-zero.

## Code Examples

### Integration Test Structure for Field Validation
```typescript
// Source: project pattern from tests/integration/resources.test.ts
it('clientes.listar() -- typed fields', async () => {
  const result = await sankhya.clientes.listar({ page: 1 });
  expect(result.data.length).toBeGreaterThan(0);

  const cliente = result.data[0]!;
  // Required fields must exist
  expect(cliente.codigoCliente).toBeDefined();
  expect(typeof cliente.codigoCliente).toBe('number');
  expect(cliente.nome).toBeDefined();
  expect(typeof cliente.nome).toBe('string');
  expect(cliente.tipo).toBeDefined();
  expect(['F', 'J']).toContain(cliente.tipo);
  expect(cliente.cnpjCpf).toBeDefined();

  // Pagination
  expect(typeof result.hasMore).toBe('boolean');
  expect(typeof result.page).toBe('number');
});
```

### Snapshot-Based Field Discovery
```typescript
// For finding fields the API actually returns (discovery step)
it('DISCOVERY: clientes raw response shape', async () => {
  const http = sankhya.getHttpClient();
  const raw = await http.restGet<Record<string, unknown>>('/parceiros/clientes', { page: '1' });
  console.log('Response keys:', Object.keys(raw));
  const { data } = extractRestData(raw);
  if (data.length > 0) {
    console.log('First item keys:', Object.keys(data[0] as Record<string, unknown>));
    console.log('First item:', JSON.stringify(data[0], null, 2));
  }
});
```

### Gateway Discovery for Missing ModeloNota Test
```typescript
it('cadastros.listarModelosNota() -- field validation', async () => {
  const result = await sankhya.cadastros.listarModelosNota();
  expect(result.length).toBeGreaterThan(0);

  const modelo = result[0]!;
  expect(modelo.numeroModelo).toBeDefined();
  expect(typeof modelo.numeroModelo).toBe('number');
  expect(modelo.descricao).toBeDefined();
  expect(typeof modelo.codigoTipoOperacao).toBe('number');
  expect(typeof modelo.codigoEmpresa).toBe('number');
});
```

## Inventory of Resources in Scope

### Resource Coverage Matrix

| Resource | Methods in Scope | API Layer | Existing Integration Test | Field Assertions |
|----------|-----------------|-----------|--------------------------|-----------------|
| clientes | `listar()` | REST v1 | Yes (basic) | No |
| vendedores | `listar()`, `buscar()` | REST v1 | Yes (basic) | No |
| produtos | `listar()`, `buscar()`, `listarGrupos()` | REST v1 | Yes (basic) | No |
| precos | `porTabela()`, `porProduto()` | REST v1 | Yes (with 404 fallback) | No |
| estoque | `porProduto()`, `listarLocais()` | REST v1 | `listarLocais()` only | No |
| cadastros (REST) | TOPs, naturezas, projetos, centros, empresas, usuarios | REST v1 | Yes (basic) | No |
| cadastros (Gateway) | `listarTiposNegociacao()`, `listarModelosNota()` | Gateway | `tiposNegociacao` only | No |

### Known Gaps

1. **No `listarModelosNota()` integration test** -- must be added
2. **No `estoque.porProduto()` integration test** -- must be added (need a product code with known stock)
3. **No `precos.porProduto()` integration test** -- must be added
4. **No `vendedores.buscar()` integration test** -- must be added
5. **No `produtos.buscar()` integration test** -- must be added
6. **No field-level assertions in any existing test** -- all tests only check `length > 0` or `toBeDefined()`
7. **TipoNegociacao.taxaJuro always hardcoded to 0** -- TAXAJURO not in Gateway fieldset

### Type Interface Field Counts

| Interface | Required Fields | Optional Fields | Total |
|-----------|----------------|----------------|-------|
| Cliente | 5 (codigoCliente, tipo, cnpjCpf, nome, endereco) | 7 | 12 |
| Vendedor | 9 (codigoVendedor, nome, ativo, tipo, comissoes, email, empresa, parceiro) | 3 | 12 |
| Produto | 4 (codigoProduto, nome, volume, ativo) | 14 | 18 |
| Preco | 4 (codigoProduto, unidade, codigoTabela, valor) | 2 | 6 |
| Estoque | 4 (codigoProduto, codigoEmpresa, codigoLocal, estoque) | 1 | 5 |
| TipoOperacao | 4 (codigoTipoOperacao, nome, tipoMovimento, ativo) | 0 | 4 |
| Natureza | 2 | 0 | 2 |
| Projeto | 2 | 0 | 2 |
| CentroResultado | 2 | 0 | 2 |
| Empresa | 2 | 0 | 2 |
| Usuario | 2 | 0 | 2 |
| TipoNegociacao | 4 (codigo, descricao, taxaJuro, ativo) | 0 | 4 |
| ModeloNota | 5 (numero, descricao, TOP, tipNeg, empresa) | 2 | 7 |
| GrupoProduto | 4 (codigo, nome, analitico, ativo) | 2 | 6 |
| LocalEstoque | 3 (codigoLocal, nome, ativo) | 0 | 3 |

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 3.0.x |
| Config file | `vitest.config.ts` |
| Quick run command | `npx vitest run tests/integration/resources.test.ts` |
| Full suite command | `npx vitest run` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| RVAL-01 | clientes.listar() returns typed page with correct fields | integration | `npx vitest run tests/integration/resources.test.ts -t "clientes"` | Partial (no field assertions) |
| RVAL-02 | vendedores.listar(), buscar() return typed results | integration | `npx vitest run tests/integration/resources.test.ts -t "vendedores"` | Partial (listar only, no field assertions) |
| RVAL-03 | produtos.listar(), buscar(), grupos() return typed results | integration | `npx vitest run tests/integration/resources.test.ts -t "produtos"` | Partial (no buscar, no field assertions) |
| RVAL-04 | precos.porTabela(), porProduto() return typed results | integration | `npx vitest run tests/integration/resources.test.ts -t "precos"` | Partial (porTabela only with 404 fallback) |
| RVAL-05 | estoque.porProduto(), listarLocais() return typed results | integration | `npx vitest run tests/integration/resources.test.ts -t "estoque"` | Partial (listarLocais only) |
| RVAL-08 | cadastros including Gateway tiposNegociacao and modelosNota | integration | `npx vitest run tests/integration/resources.test.ts -t "cadastros"` | Partial (missing modelosNota) |
| RVAL-11 | TypeScript interfaces have zero field mismatches | integration | All field assertion tests combined | No (no field assertions exist) |

### Sampling Rate
- **Per task commit:** `npx vitest run tests/integration/resources.test.ts`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] Add field-level assertions to all existing integration tests in `tests/integration/resources.test.ts`
- [ ] Add missing integration tests: `vendedores.buscar()`, `produtos.buscar()`, `precos.porProduto()`, `estoque.porProduto()`, `cadastros.listarModelosNota()`
- [ ] Consider adding TAXAJURO to TipoNegociacao Gateway fieldset

## Workflow for Validation

The recommended workflow for each resource:

1. **Discovery:** Run the method against sandbox, capture raw JSON response, log all field names and values
2. **Compare:** Diff captured fields against TypeScript interface -- identify mismatches (missing fields, extra fields, wrong types)
3. **Fix types:** Update `src/types/{resource}.ts` to match real API response
4. **Fix resource:** If any resource method needs changes (field mapping, query params, etc.), update `src/resources/{resource}.ts`
5. **Add assertions:** Update integration test with field-presence and type assertions
6. **Verify:** Run integration test against sandbox

## Open Questions

1. **TAXAJURO in TipoNegociacao**
   - What we know: Current implementation hardcodes `taxaJuro: 0` and does not request TAXAJURO from Gateway
   - What's unclear: Does the sandbox TipoNegociacao entity have TAXAJURO? What format does it return?
   - Recommendation: Add TAXAJURO to the Gateway fieldset, parse it, and handle the `{}` edge case. If it adds no value, document why it's 0.

2. **Precos tabela availability in sandbox**
   - What we know: Existing test uses `codigoTabela: 1` with a 404 fallback, suggesting this table may not exist
   - What's unclear: Which price table IDs exist in the sandbox?
   - Recommendation: During discovery, list available tabelas by querying a known product's prices first, then use a valid tabela ID.

3. **REST v1 field names vs. internal Sankhya field names**
   - What we know: REST v1 returns camelCase JSON keys (e.g., `codigoProduto`), while Gateway returns Sankhya internal names (e.g., `CODPROD`)
   - What's unclear: Do REST v1 keys exactly match our interface property names, or does the API use slightly different casing/naming?
   - Recommendation: The discovery step will resolve this. Log `Object.keys(data[0])` for each resource.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Sankhya Sandbox (env vars) | All integration tests | Conditional (`.env` file) | -- | Tests skip via `describe.skipIf(!hasCredentials)` |
| Node.js | Runtime | Yes | >= 20 | -- |
| Vitest | Test execution | Yes | 3.0.x | -- |

**Missing dependencies with no fallback:**
- Sankhya sandbox credentials in `.env` -- without these, integration tests cannot run and field validation cannot be performed. The planner must ensure sandbox access is available during execution.

## Sources

### Primary (HIGH confidence)
- Existing source code: `src/resources/*.ts`, `src/types/*.ts` -- current implementation
- Existing tests: `tests/integration/resources.test.ts`, `tests/integration/sandbox.test.ts` -- current test coverage
- Project documentation: `docs/api-reference/*.md` -- API surface documentation
- `CLAUDE.md` -- project constraints and conventions

### Secondary (MEDIUM confidence)
- MEMORY.md notes on API quirks (TipoPessoa F/J, TAXAJURO {}, estoque zero absence) -- based on prior sandbox exploration

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- no new libraries, using existing project infrastructure
- Architecture: HIGH -- resource pattern is established and consistent across all 10 resources
- Pitfalls: HIGH -- documented from prior sandbox exploration in MEMORY.md and code comments

**Research date:** 2026-04-06
**Valid until:** 2026-05-06 (stable -- Sankhya API versioned, no breaking changes expected)
