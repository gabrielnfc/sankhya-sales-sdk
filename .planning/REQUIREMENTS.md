# Requirements: sankhya-sales-sdk

**Defined:** 2026-04-06
**Core Value:** Qualquer dev Node.js integra com Sankhya ERP sem estudar a API — tipos seguros, métodos intuitivos, peculiaridades abstraídas.

## v1 Requirements

### Core Hardening

- [x] **CORE-01**: Serializer Gateway trata `TAXAJURO {}` sem produzir `"[object Object]"`
- [x] **CORE-02**: Serializer Gateway trata campos extras (DHALTER) sem dropar dados silenciosamente
- [x] **CORE-03**: Serializer Gateway rejeita/loga retornos vazios em vez de silenciar erros de contrato
- [x] **CORE-04**: Token refresh tem lower-bound guard para TTLs curtos (ambientes não-produção)
- [x] **CORE-05**: Retry inclui jitter para prevenir thundering herd
- [x] **CORE-06**: Coverage enforcement >= 90% configurado com `@vitest/coverage-v8`
- [x] **CORE-07**: Retry em POST/PUT mutações (pedidos, financeiros) é seguro — idempotency ou desabilitado

### Resource Validation

- [x] **RVAL-01**: Resource `clientes` — CRUD completo validado contra sandbox (listar, criar, atualizar, contatos)
- [x] **RVAL-02**: Resource `vendedores` — leitura validada contra sandbox (listar, buscar)
- [x] **RVAL-03**: Resource `produtos` — leitura validada contra sandbox (listar, buscar, componentes, volumes, grupos)
- [x] **RVAL-04**: Resource `precos` — leitura validada contra sandbox (porProduto, porTabela, contextualizado)
- [x] **RVAL-05**: Resource `estoque` — leitura validada contra sandbox (porProduto, listar, locais, detalhesGateway)
- [x] **RVAL-06**: Resource `pedidos` — fluxo completo validado contra sandbox (criar → item → confirmar → faturar)
- [ ] **RVAL-07**: Resource `financeiros` — CRUD validado contra sandbox (tipos pagamento, receitas, despesas, moedas, contas, TEF)
- [x] **RVAL-08**: Resource `cadastros` — leitura validada contra sandbox (TOPs, naturezas, projetos, centros, empresas, usuarios, tiposNegociacao, modelosNota)
- [ ] **RVAL-09**: Resource `fiscal` — validado contra sandbox (calcularImpostos, importarNfse)
- [x] **RVAL-10**: Resource `gateway` — CRUD genérico validado contra sandbox (loadRecords, loadRecord, saveRecord)
- [x] **RVAL-11**: Tipos TypeScript de cada resource correspondem exatamente aos campos retornados pela API real
- [x] **RVAL-12**: Fluxo e2e completo de pedido B2B validado no sandbox (criar cliente → consultar produto → checar estoque → criar pedido → adicionar itens → confirmar → faturar)

### API Surface

- [ ] **APIS-01**: Type guard helpers exportados: `isSankhyaError()`, `isAuthError()`, `isApiError()`, `isGatewayError()`, `isTimeoutError()`
- [ ] **APIS-02**: Union type `SankhyaErrorCode` exportado com todos os códigos de erro possíveis
- [x] **APIS-03**: `listarTodos()` AsyncGenerator disponível em todos os resources com listagem paginada
- [x] **APIS-04**: Mutations em `pedidos` e `financeiros` aceitam `idempotencyKey` opcional para prevenir duplicações
- [ ] **APIS-05**: Exports públicos auditados — utilitários internos marcados como `@internal` e não expostos na API pública
- [x] **APIS-06**: Per-call timeout override disponível via `RequestOptions` opcional em cada método

### Testing

- [x] **TEST-01**: Testes unitários cobrindo >= 90% de todo o código fonte
- [x] **TEST-02**: Testes de integração para cada resource contra sandbox real
- [x] **TEST-03**: Teste e2e do fluxo completo de pedido B2B contra sandbox real
- [x] **TEST-04**: Smoke test CJS — `require('sankhya-sales-sdk')` funciona e `instanceof` preservado
- [x] **TEST-05**: Smoke test ESM — `import { SankhyaClient } from 'sankhya-sales-sdk'` funciona
- [x] **TEST-06**: Testes de edge cases documentados (TAXAJURO vazio, campo extra, paginação string, TipoPessoa F/J)

### Documentation

- [ ] **DOCS-01**: README com quick-start (< 5 min para primeira chamada) incluindo auth, install, exemplo
- [ ] **DOCS-02**: TSDoc em todos os métodos e tipos públicos
- [ ] **DOCS-03**: TypeDoc gerando API reference navegável
- [ ] **DOCS-04**: Guia de error handling mostrando try/catch com cada classe de erro
- [ ] **DOCS-05**: Exemplos de código funcionais (`examples/`) cobrindo cada resource principal
- [ ] **DOCS-06**: CHANGELOG.md com formato Keep a Changelog

### Package & Publishing

- [ ] **PKGP-01**: `sideEffects: false` no package.json para tree-shaking
- [ ] **PKGP-02**: `publint` e `@arethetypeswrong/cli` passando sem erros
- [ ] **PKGP-03**: `prepublishOnly` script configurado como gate (lint + test + build + publint)
- [ ] **PKGP-04**: `npm pack` gera pacote limpo com apenas arquivos necessários
- [ ] **PKGP-05**: Zero `any` no código fonte
- [ ] **PKGP-06**: TypeScript strict mode compliance total

### CI/CD & Release

- [x] **CICD-01**: GitHub Actions rodando lint, typecheck, test (unit), build em todo push/PR
- [x] **CICD-02**: GitHub Actions rodando testes de integração (com secrets) em push para main
- [x] **CICD-03**: Coverage report gerado e visível no CI
- [ ] **CICD-04**: `npm publish --provenance` via GitHub Actions release workflow
- [ ] **CICD-05**: GitHub Release v1.0.0 com release notes

## v2 Requirements

### Developer Experience

- **DX-01**: Sandbox mode flag (`config.mode: 'sandbox'`) auto-ajusta base URL
- **DX-02**: Structured log context em cada request (resource, method, attempt, durationMs)
- **DX-03**: Mock factory helpers (`createMockSankhyaClient()`) para consumidores testarem
- **DX-04**: Request/response hooks (`onRequest`, `onResponse`) para telemetria
- **DX-05**: `RateLimitError` com `retryAfterMs` extraído do header `Retry-After`

### Extended Resources

- **EXT-01**: Typed return para serviços Gateway customizados comuns
- **EXT-02**: `modifiedSince` delta sync consistente em todos os resources

## Out of Scope

| Feature | Reason |
|---------|--------|
| Integração Salesforce | Consumidor futuro, projeto separado |
| Runtime validation (Zod/Yup) | Adiciona dep runtime, dobra bundle, quebras silenciosas |
| Cache de respostas no SDK | Invalidação é domínio do consumidor |
| CLI tooling | SDK é library-only |
| Webhook verification | Sankhya não emite webhooks no REST v1/OAuth |
| Multi-tenant auth | Cada SankhyaClient = 1 tenant; consumidor instancia múltiplos |
| Auto-pagination em list methods | listar() + listarTodos() dão controle total |
| GraphQL / query DSL | API é REST + Gateway; abstração sem ganho |
| Retry em erros de negócio | Gateway HTTP 200 errors (CNPJ errado, estoque indisponível) não devem ser retentados |
| Node < 20 polyfills | Zero deps, fail fast se fetch undefined |
| Auth legado (user/password) | Descontinuado 30/04/2026 |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| CORE-01 | Phase 1 | Complete |
| CORE-02 | Phase 1 | Complete |
| CORE-03 | Phase 1 | Complete |
| CORE-04 | Phase 1 | Complete |
| CORE-05 | Phase 1 | Complete |
| CORE-06 | Phase 1 | Complete |
| CORE-07 | Phase 1 | Complete |
| RVAL-01 | Phase 2 | Complete |
| RVAL-02 | Phase 2 | Complete |
| RVAL-03 | Phase 2 | Complete |
| RVAL-04 | Phase 2 | Complete |
| RVAL-05 | Phase 2 | Complete |
| RVAL-08 | Phase 2 | Complete |
| RVAL-11 | Phase 2 | Complete |
| RVAL-06 | Phase 3 | Complete |
| RVAL-07 | Phase 3 | Pending |
| RVAL-09 | Phase 3 | Pending |
| RVAL-10 | Phase 3 | Complete |
| RVAL-12 | Phase 3 | Complete |
| APIS-01 | Phase 4 | Pending |
| APIS-02 | Phase 4 | Pending |
| APIS-03 | Phase 4 | Complete |
| APIS-04 | Phase 4 | Complete |
| APIS-05 | Phase 4 | Pending |
| APIS-06 | Phase 4 | Complete |
| TEST-01 | Phase 5 | Complete |
| TEST-02 | Phase 5 | Complete |
| TEST-03 | Phase 5 | Complete |
| TEST-04 | Phase 5 | Complete |
| TEST-05 | Phase 5 | Complete |
| TEST-06 | Phase 5 | Complete |
| DOCS-01 | Phase 6 | Pending |
| DOCS-02 | Phase 6 | Pending |
| DOCS-03 | Phase 6 | Pending |
| DOCS-04 | Phase 6 | Pending |
| DOCS-05 | Phase 6 | Pending |
| DOCS-06 | Phase 6 | Pending |
| PKGP-01 | Phase 7 | Pending |
| PKGP-02 | Phase 7 | Pending |
| PKGP-03 | Phase 7 | Pending |
| PKGP-04 | Phase 7 | Pending |
| PKGP-05 | Phase 7 | Pending |
| PKGP-06 | Phase 7 | Pending |
| CICD-01 | Phase 8 | Complete |
| CICD-02 | Phase 8 | Complete |
| CICD-03 | Phase 8 | Complete |
| CICD-04 | Phase 8 | Pending |
| CICD-05 | Phase 8 | Pending |

**Coverage:**
- v1 requirements: 48 total (header said 40 — 8 were added after initial count; all 48 mapped)
- Mapped to phases: 48
- Unmapped: 0

---
*Requirements defined: 2026-04-06*
*Last updated: 2026-04-06 after roadmap creation — traceability populated*
