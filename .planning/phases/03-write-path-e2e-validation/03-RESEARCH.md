# Phase 3: Write-Path & E2E Validation - Research

**Researched:** 2026-04-06
**Domain:** Sankhya ERP write operations (pedidos, financeiros, fiscal, gateway CRUD) + B2B E2E flow
**Confidence:** MEDIUM

## Summary

Phase 3 validates all write operations against the Sankhya sandbox and runs a complete B2B order flow end-to-end. The codebase already has all resource classes implemented (`PedidosResource`, `FinanceirosResource`, `FiscalResource`, `GatewayResource`) with their methods defined, but several write methods have weak typing (`Record<string, unknown>` inputs, `unknown` returns) and none have been tested against the real API.

The critical finding is that the HTTP client's `requestWithRetry` only retries on 401 (token expiry) -- the `withRetry` utility with SAFE_METHODS protection exists but is NOT integrated into the HTTP layer. This means POST/PUT mutations currently do NOT retry on transient errors at all (no 429/5xx retry). This is actually safe for write operations (no duplicate risk from retry), but the success criteria explicitly requires verifying that "no write operation retries on timeout without idempotency protection." The current implementation satisfies this by accident -- mutations never retry. The `withRetry` function is only exported as a public utility, not used internally.

A secondary finding is the naming mismatch: the success criteria references `criarReceita()` but the code has `registrarReceita()`. The financeiros write methods (`registrarReceita`, `registrarDespesa`, `atualizarReceita`, `atualizarDespesa`, `baixarReceita`, `baixarDespesa`) all accept untyped `Record<string, unknown>` and return `unknown`. These need proper input types and return types for validation.

**Primary recommendation:** Focus on three work streams: (1) type the untyped write methods in financeiros/fiscal, (2) write integration tests for each write path against sandbox, (3) build the E2E B2B flow test that chains all operations together. Do NOT wire `withRetry` into the HTTP client for mutations -- the current behavior (no retry on POST/PUT) is the correct safe default.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| RVAL-06 | Resource `pedidos` -- fluxo completo validado contra sandbox (criar -> item -> confirmar -> faturar) | PedidosResource has all methods implemented. criar() uses REST POST, confirmar() uses Gateway ServicosNfeSP.confirmarNota, faturar() uses Gateway SelecaoDocumentoSP.faturar. Needs sandbox integration test. |
| RVAL-07 | Resource `financeiros` -- CRUD validado contra sandbox (tipos pagamento, receitas, despesas, moedas, contas, TEF) | Read methods validated in Phase 2. Write methods (registrarReceita, registrarDespesa, atualizarReceita, atualizarDespesa, baixarReceita, baixarDespesa) need typing and sandbox validation. |
| RVAL-09 | Resource `fiscal` -- validado contra sandbox (calcularImpostos, importarNfse) | calcularImpostos() has proper types. importarNfse() has untyped input/output. Both need sandbox validation. |
| RVAL-10 | Resource `gateway` -- CRUD generico validado contra sandbox (loadRecords, loadRecord, saveRecord) | loadRecords validated in Phase 2. loadRecord and saveRecord need sandbox validation. saveRecord does INSERT when PK absent, UPDATE when present. |
| RVAL-12 | Fluxo e2e completo de pedido B2B validado no sandbox | All individual methods exist. Need to chain: criar cliente -> consultar produto -> checar estoque -> criar pedido -> adicionar itens -> confirmar -> faturar. |
</phase_requirements>

## Architecture Patterns

### Current Write-Path Architecture

The write path uses two distinct protocols:

**REST v1 writes** (`restPost`/`restPut`):
- `pedidos.criar()` -- POST /v1/vendas/pedidos
- `pedidos.atualizar()` -- PUT /v1/vendas/pedidos/{id}
- `pedidos.cancelar()` -- POST /v1/vendas/pedidos/{id}/cancela
- `financeiros.registrarReceita()` -- POST /v1/financeiros/receitas
- `financeiros.atualizarReceita()` -- PUT /v1/financeiros/receitas/{id}
- `financeiros.baixarReceita()` -- POST /v1/financeiros/receitas/baixa
- `fiscal.calcularImpostos()` -- POST /v1/fiscal/impostos/calculo
- `fiscal.importarNfse()` -- POST /v1/fiscal/servicos-tomados/nfse

**Gateway writes** (`gatewayCall`):
- `pedidos.confirmar()` -- ServicosNfeSP.confirmarNota (mgecom)
- `pedidos.faturar()` -- SelecaoDocumentoSP.faturar (mgecom)
- `pedidos.incluirNotaGateway()` -- CACSP.incluirNota (mgecom)
- `pedidos.incluirAlterarItem()` -- CACSP.incluirAlterarItemNota (mgecom)
- `pedidos.excluirItem()` -- CACSP.excluirItemNota (mgecom)
- `gateway.saveRecord()` -- CRUDServiceProvider.saveRecord (mge)

### Retry Safety Analysis (CORE-07)

**Current state:** The `withRetry` utility in `src/core/retry.ts` has a SAFE_METHODS whitelist (`GET`, `HEAD`, `OPTIONS`). When method is POST/PUT/PATCH/DELETE and `forceRetry` is not set, `effectiveMaxRetries` is forced to 0. However, this function is NOT used by `HttpClient.requestWithRetry()`. The HTTP client only retries on 401 (token refresh) -- it does NOT retry on transient errors (429, 5xx, timeout).

**Implication for Phase 3:** Write operations are already safe against duplicate mutations because:
1. The HTTP layer never retries POST/PUT on transient errors
2. The `withRetry` utility, if a consumer uses it directly, blocks unsafe method retries by default
3. The only "retry" that happens is 401 token refresh, which replays the same request -- this could theoretically cause duplicates, but token expiry between two identical requests is an edge case the Sankhya API handles server-side

**What to verify in sandbox:** Confirm that a POST /v1/vendas/pedidos called twice with identical data produces two separate pedidos (proving the API itself has no idempotency). This validates that the SDK's no-retry behavior is essential.

### Integration Test Pattern (from Phase 2)

Phase 2 established the integration test pattern in `tests/integration/resources.test.ts`:

```typescript
const config = {
  baseUrl: process.env.SANKHYA_BASE_URL ?? '',
  clientId: process.env.SANKHYA_CLIENT_ID ?? '',
  clientSecret: process.env.SANKHYA_CLIENT_SECRET ?? '',
  xToken: process.env.SANKHYA_X_TOKEN ?? '',
  timeout: 30_000,
  logger: { level: 'silent' as const },
};

const has = config.baseUrl && config.clientId && config.clientSecret && config.xToken;

describe.skipIf(!has)('Resource Tests', () => {
  let sankhya: SankhyaClient;
  beforeAll(async () => {
    sankhya = new SankhyaClient(config);
    await sankhya.authenticate();
  });
  // ... tests
});
```

Key pattern: `describe.skipIf(!has)` allows tests to pass without credentials (CI without sandbox access).

### B2B E2E Flow Sequence

The complete B2B flow from RVAL-12 requires this exact sequence:

```
1. client.clientes.criar()           -- Create/find a test client (REST)
2. client.produtos.listar()          -- Find a product with stock (REST)
3. client.estoque.porProduto()       -- Verify stock availability (REST)
4. client.pedidos.criar()            -- Create order with items + financeiros (REST)
5. client.pedidos.incluirAlterarItem() -- Optional: add more items (Gateway)
6. client.pedidos.confirmar()        -- Confirm order (Gateway)
7. client.pedidos.faturar()          -- Invoice order (Gateway)
```

**Critical dependencies:**
- Step 4 requires `notaModelo` (get from cadastros.listarModelosNota or use known value)
- Step 4 requires `codigoTipoOperacao` (get from cadastros.listarTiposOperacao)
- Step 6 requires the order to be in "A CONFIRMAR" status
- Step 7 requires the order to be confirmed and a valid faturamento TOP
- Steps 6-7 are Gateway calls (POST) that cannot be undone

### Sandbox Considerations

From project memory and STATE.md:
- Slow endpoints: estoque/produtos, vendas/pedidos, financeiros/receitas, financeiros/despesas
- Gateway returns HTTP 200 on business errors (check `status` field)
- Write operations create real data in sandbox -- tests should use identifiable test data
- TipoPessoa returns 'F'/'J' (not 'PF'/'PJ')
- Pedidos are created with status "A CONFIRMAR" always
- Faturados cannot be canceled via REST v1

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Gateway serialization | Manual `{ "$": value }` wrapping | `serialize()` from gateway-serializer.ts | Already handles arrays, nested objects, null values |
| Gateway deserialization | Manual f0/f1 field mapping | `deserializeRows()` from gateway-serializer.ts | Handles metadata mapping, extra fields (DHALTER), TAXAJURO edge case |
| Retry safety for mutations | Custom retry guard per resource | Current HttpClient behavior (no retry on POST/PUT) | Already safe by design -- withRetry SAFE_METHODS exists if needed later |
| Test data cleanup | Manual DELETE calls after tests | Sandbox tolerance -- use identifiable prefixes | Sankhya API has limited DELETE support; sandbox data is disposable |

## Common Pitfalls

### Pitfall 1: Untyped Write Methods
**What goes wrong:** `registrarReceita(dados: Record<string, unknown>)` and similar methods accept anything at compile time, leading to runtime 400/500 errors from the API when fields are missing or wrong.
**Why it happens:** Initial implementation left write methods untyped pending sandbox validation.
**How to avoid:** Before testing, define proper input types based on API documentation and sandbox response analysis. Update method signatures.
**Warning signs:** Methods returning `Promise<unknown>` or accepting `Record<string, unknown>`.

### Pitfall 2: Gateway Business Errors Look Like Success
**What goes wrong:** Gateway calls return HTTP 200 even when the business operation fails (e.g., confirming an order with insufficient stock).
**Why it happens:** Gateway wraps business logic errors in `{ status: '0', statusMessage: '...' }`.
**How to avoid:** The HttpClient.gatewayCall already checks `result.status === '0'` and throws GatewayError. Integration tests should verify this error path works correctly.
**Warning signs:** Tests that only assert "no error thrown" without verifying the operation actually succeeded.

### Pitfall 3: E2E Test Order Matters
**What goes wrong:** Running confirmar() or faturar() before the order is in the correct state throws GatewayError.
**Why it happens:** Sankhya ERP enforces strict state machine: A CONFIRMAR -> Confirmada -> Faturada.
**How to avoid:** E2E test must follow exact sequence. Each step should verify the previous step's result before proceeding.
**Warning signs:** GatewayError with messages about "nota nao encontrada" or "nota ja confirmada".

### Pitfall 4: Success Criteria Names vs Code Names
**What goes wrong:** Success criteria says `criarReceita()` but code has `registrarReceita()`. If we rename the method, existing docs break. If we don't, validation report looks wrong.
**Why it happens:** Documentation was written with different naming than implementation.
**How to avoid:** Decide on canonical name. Recommendation: keep `registrarReceita` (matches REST verb "registrar") or add alias. The success criteria can reference the actual method name.

### Pitfall 5: Sandbox Rate Limits on Write Operations
**What goes wrong:** Rapid sequential write operations (create + confirm + invoice) may hit undocumented rate limits.
**Why it happens:** Sandbox has rate limiting that is not documented (noted in STATE.md blockers).
**How to avoid:** Add small delays between E2E steps if needed. Use `testTimeout: 60_000` for write tests.
**Warning signs:** Unexpected 429 responses or connection timeouts.

### Pitfall 6: Date Format Sensitivity
**What goes wrong:** Sankhya REST v1 expects dates as `dd/mm/aaaa` for pedidos, but Gateway uses different formats.
**Why it happens:** Two different API protocols with different date conventions.
**How to avoid:** Always use `dd/mm/aaaa` for REST v1 pedidos dates. Verify actual format expected by each endpoint against sandbox.
**Warning signs:** 400 errors mentioning "data invalida" or silent date parsing errors.

## Code Examples

### Pedido Write Flow (from existing code)
```typescript
// Source: src/resources/pedidos.ts
// Step 1: Create order via REST
const { codigoPedido } = await client.pedidos.criar({
  notaModelo: 1,
  data: '06/04/2026',
  hora: '10:00:00',
  codigoCliente: 123,
  valorTotal: 100,
  itens: [{ codigoProduto: 1001, quantidade: 1, valorUnitario: 100, unidade: 'UN' }],
  financeiros: [{ codigoTipoPagamento: 1, valor: 100, dataVencimento: '06/05/2026', numeroParcela: 1 }],
});

// Step 2: Confirm via Gateway
await client.pedidos.confirmar({ codigoPedido });

// Step 3: Invoice via Gateway
await client.pedidos.faturar({
  codigoPedido,
  codigoTipoOperacao: 167,
  dataFaturamento: '06/04/2026',
});
```

### Gateway saveRecord (from existing code)
```typescript
// Source: src/resources/gateway.ts
const saved = await client.gateway.saveRecord({
  entity: 'Parceiro',
  fields: 'CODPARC,NOMEPARC,TIPPESSOA',
  data: {
    NOMEPARC: 'Test Partner SDK',
    TIPPESSOA: 'J',
    CGC_CPF: '12345678000199',
    ATIVO: 'S',
    CLIENTE: 'S',
  },
});
// saved: Record<string, string> with returned field values
```

### Financeiros Write (needs typing)
```typescript
// Source: src/resources/financeiros.ts -- CURRENTLY UNTYPED
// Current: registrarReceita(dados: Record<string, unknown>): Promise<unknown>
// Should become something like:
// registrarReceita(dados: RegistrarReceitaInput): Promise<{ codigoFinanceiro: number }>
```

## Key Findings for Planner

### Methods Needing Type Improvements

| Resource | Method | Current Input | Current Return | Action |
|----------|--------|---------------|----------------|--------|
| financeiros | registrarReceita | `Record<string, unknown>` | `unknown` | Type input + output after sandbox discovery |
| financeiros | atualizarReceita | `Record<string, unknown>` | `unknown` | Type input + output after sandbox discovery |
| financeiros | baixarReceita | `Record<string, unknown>` | `unknown` | Type input + output after sandbox discovery |
| financeiros | registrarDespesa | `Record<string, unknown>` | `unknown` | Type input + output after sandbox discovery |
| financeiros | atualizarDespesa | `Record<string, unknown>` | `unknown` | Type input + output after sandbox discovery |
| financeiros | baixarDespesa | `Record<string, unknown>` | `unknown` | Type input + output after sandbox discovery |
| fiscal | importarNfse | `Record<string, unknown>` | `unknown` | Type input + output after sandbox discovery |

### Methods Already Well-Typed (Just Need Sandbox Validation)

| Resource | Method | Status |
|----------|--------|--------|
| pedidos | criar | Typed (PedidoVendaInput -> { codigoPedido }) |
| pedidos | atualizar | Typed (PedidoVendaInput -> { codigoPedido }) |
| pedidos | cancelar | Typed (CancelarPedidoInput -> { codigoPedido }) |
| pedidos | confirmar | Typed (ConfirmarPedidoInput -> void) |
| pedidos | faturar | Typed (FaturarPedidoInput -> void) |
| pedidos | incluirNotaGateway | Typed (IncluirNotaGatewayInput -> { codigoPedido }) |
| pedidos | incluirAlterarItem | Typed (ItemNotaGatewayInput[] -> void) |
| pedidos | excluirItem | Typed (number, number -> void) |
| fiscal | calcularImpostos | Typed (CalculoImpostoInput -> ResultadoCalculoImposto[]) |
| gateway | loadRecords | Typed and validated in Phase 2 |
| gateway | loadRecord | Typed, needs sandbox validation |
| gateway | saveRecord | Typed (SaveRecordParams -> Record<string, string>) |

### Retry/Idempotency Verification Plan

The success criteria #5 states: "No write operation retries on timeout without idempotency protection."

Current state analysis:
1. `HttpClient.requestWithRetry()` only retries on 401 -- NOT on timeout/5xx/429
2. `withRetry()` utility exists but is NOT wired into HTTP layer
3. `withRetry()` already blocks POST/PUT retry via SAFE_METHODS when used directly

**Verification approach:** Write a unit test that confirms HttpClient does NOT retry POST/PUT on TimeoutError. Then verify in sandbox that the E2E flow does not produce duplicates. No code changes needed -- the current behavior is already correct.

### Coverage Configuration Note

The vitest config currently EXCLUDES resources and client from coverage:
```typescript
exclude: ['src/types/**/*.ts', 'src/index.ts', 'src/resources/**/*.ts', 'src/client.ts'],
```
This was intentional (Phase 1 decision: "Resources and client.ts excluded from coverage until Phase 5 test hardening"). Phase 3 should NOT change this exclusion -- it validates sandbox behavior, not coverage.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 3.0.0 |
| Config file | `vitest.config.ts` |
| Quick run command | `npx vitest run tests/core/ --reporter=verbose` |
| Full suite command | `npx vitest run --reporter=verbose` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| RVAL-06 | Pedidos full flow (criar -> confirmar -> faturar) | integration | `npx vitest run tests/integration/write-pedidos.test.ts -x` | No - Wave 0 |
| RVAL-07 | Financeiros CRUD (receitas, despesas) | integration | `npx vitest run tests/integration/write-financeiros.test.ts -x` | No - Wave 0 |
| RVAL-09 | Fiscal (calcularImpostos, importarNfse) | integration | `npx vitest run tests/integration/write-fiscal.test.ts -x` | No - Wave 0 |
| RVAL-10 | Gateway CRUD (loadRecord, saveRecord) | integration | `npx vitest run tests/integration/write-gateway.test.ts -x` | No - Wave 0 |
| RVAL-12 | E2E B2B flow | integration | `npx vitest run tests/integration/e2e-pedido-b2b.test.ts -x` | No - Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run tests/core/ --reporter=verbose` (existing unit tests stay green)
- **Per wave merge:** `npx vitest run --reporter=verbose` (full suite including integration if credentials available)
- **Phase gate:** All integration tests pass against sandbox

### Wave 0 Gaps
- [ ] `tests/integration/write-pedidos.test.ts` -- covers RVAL-06
- [ ] `tests/integration/write-financeiros.test.ts` -- covers RVAL-07
- [ ] `tests/integration/write-fiscal.test.ts` -- covers RVAL-09
- [ ] `tests/integration/write-gateway.test.ts` -- covers RVAL-10
- [ ] `tests/integration/e2e-pedido-b2b.test.ts` -- covers RVAL-12
- [ ] Typed input interfaces for financeiros write methods (`src/types/financeiros.ts`)

## Open Questions

1. **What fields does POST /v1/financeiros/receitas actually require?**
   - What we know: The endpoint exists, the method is `registrarReceita(dados: Record<string, unknown>)`
   - What's unclear: Exact required fields, response shape. Official docs are blocked for scraping.
   - Recommendation: Treat sandbox as primary research -- call the endpoint with minimal data, observe errors, iteratively discover required fields. Type the interface based on discovered fields.

2. **What does POST /v1/fiscal/servicos-tomados/nfse require?**
   - What we know: `importarNfse()` exists with untyped input/output
   - What's unclear: Whether the sandbox even supports this endpoint. NFS-e import may require municipality-specific configuration.
   - Recommendation: Attempt a sandbox call. If it fails with configuration error, document as sandbox limitation and mark RVAL-09 partially complete (calcularImpostos validated, importarNfse documented as requiring specific config).

3. **What notaModelo and codigoTipoOperacao values exist in sandbox?**
   - What we know: E2E flow needs these values. Models exist via Gateway ModeloNota entity.
   - What's unclear: Which specific values are configured in the test sandbox.
   - Recommendation: First step of E2E test should discover these values via `cadastros.listarModelosNota()` and `cadastros.listarTiposOperacao()`.

4. **Can the sandbox handle order confirmation and invoicing?**
   - What we know: These are Gateway operations that modify ERP state significantly.
   - What's unclear: Whether the sandbox's fiscal/inventory configuration supports the full flow.
   - Recommendation: If confirmar/faturar fail with business rule errors (GatewayError), document the specific error and adjust test expectations. The code itself is correct -- the sandbox may lack required fiscal configuration.

## Project Constraints (from CLAUDE.md)

- **Runtime:** Node 20+ (fetch nativo, sem polyfills)
- **Zero deps:** Nenhuma dependencia de runtime (apenas devDeps)
- **Auth:** OAuth 2.0 exclusivo
- **Qualidade:** Zero `any`, strict TypeScript, >= 90% coverage
- **Naming:** camelCase functions, PascalCase types, Input suffix for input types
- **Error handling:** Custom error hierarchy (SankhyaError, AuthError, ApiError, GatewayError, TimeoutError)
- **Imports:** Always use `.js` extension in imports
- **Comments:** JSDoc for public API, inline for non-obvious logic
- **Functions:** Under 30 lines preferred, single responsibility
- **Tests:** Vitest 3.0.0, 30s timeout, .env loaded via vitest.config.ts
- **Linter:** Biome -- line width 100, single quotes, trailing commas, no-explicit-any error

## Sources

### Primary (HIGH confidence)
- Project source code: `src/resources/pedidos.ts`, `financeiros.ts`, `fiscal.ts`, `gateway.ts`
- Project source code: `src/core/http.ts`, `src/core/retry.ts`
- Project types: `src/types/pedidos.ts`, `financeiros.ts`, `fiscal.ts`, `gateway.ts`
- Project docs: `docs/api-reference/pedidos.md`, `financeiros.md`, `fiscal.md`, `gateway-crud.md`
- Project docs: `docs/guia/fluxo-venda-completo.md`
- Phase 2 integration tests: `tests/integration/resources.test.ts`
- Project state: `.planning/STATE.md`, `.planning/REQUIREMENTS.md`, `.planning/ROADMAP.md`

### Secondary (MEDIUM confidence)
- CLAUDE.md project memory: Sandbox behavior observations from previous phases
- API behavior expectations from docs (not yet validated for write paths)

### Tertiary (LOW confidence)
- Exact field requirements for financeiros write endpoints (needs sandbox discovery)
- NFS-e import requirements (needs sandbox validation)
- Sandbox fiscal/inventory configuration for full E2E flow (needs runtime verification)

## Metadata

**Confidence breakdown:**
- Architecture: HIGH - all resource code exists and is readable; patterns are clear from Phase 2
- Retry safety: HIGH - code analysis confirms no mutation retry; CORE-07 was addressed in Phase 1
- Write method typing: MEDIUM - we know which methods need typing but exact fields need sandbox discovery
- E2E flow feasibility: MEDIUM - code exists for all steps but sandbox configuration is unknown
- Fiscal/NFS-e: LOW - importarNfse has no typed interface and sandbox support is uncertain

**Research date:** 2026-04-06
**Valid until:** 2026-04-20 (sandbox behavior could change with Sankhya updates)
