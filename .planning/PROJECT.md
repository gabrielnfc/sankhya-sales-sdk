# sankhya-sales-sdk

## What This Is

SDK TypeScript independente para as APIs comerciais do Sankhya ERP, focado em vendas B2B. Expoe CRUD completo (consulta, criacao, atualizacao, cancelamento) para todos os dominios de vendas via REST v1 e Gateway. Pacote npm publico para a comunidade Sankhya.

## Core Value

Qualquer desenvolvedor Node.js consegue integrar com o Sankhya ERP sem precisar estudar a documentacao da API — o SDK abstrai as peculiaridades (formatos Gateway, paginacao inconsistente, campos string-tipados) e entrega tipos seguros e metodos intuitivos.

## Requirements

### Validated

- Autenticacao OAuth 2.0 com token cache, mutex e refresh — existing (Fase 3)
- Cliente HTTP com interceptors, retry e timeout — existing (Fase 3)
- Hierarquia de erros tipada (SankhyaError, AuthError, ApiError, GatewayError, TimeoutError) — existing (Fase 3)
- Logger injetavel — existing (Fase 3)
- Gateway serializer (deserializeRows, serialize) — existing (Fase 4)
- Paginacao normalizada (REST + Gateway) com AsyncGenerator — existing (Fase 4)
- Retry com exponential backoff (429, 5xx, ECONNRESET) — existing (Fase 4)
- Conversao de formatos de data — existing (Fase 4)
- SankhyaClient entry point com lazy-loading de resources — existing (Fase 4)
- 10 resources implementados (clientes, vendedores, produtos, precos, estoque, pedidos, financeiros, cadastros, fiscal, gateway) — existing (Fase 5 parcial)
- 75 testes unitarios + 15 testes de integracao passando — existing (curadoria)
- Serializer hardening (TAXAJURO, DHALTER, empty responses) — validated (Fase 1)
- Auth TTL lower-bound guard (minimum 10s) — validated (Fase 1)
- Retry com full jitter e method-awareness (POST/PUT safe) — validated (Fase 1)
- Coverage enforcement >= 90% com @vitest/coverage-v8 — validated (Fase 1)
- Read-path resources validados contra sandbox: clientes, vendedores, produtos, precos, estoque, cadastros — validated (Fase 2)
- TypeScript interfaces alinhadas com campos reais da API (18+ campos descobertos/corrigidos) — validated (Fase 2)
- TAXAJURO parse dinâmico no Gateway (antes hardcoded-to-0) — validated (Fase 2)
- 168 testes passando (22 de integração field-level) — validated (Fase 2)

### Active

- [ ] Validacao e2e do core (auth, http, retry, pagination) contra sandbox real
- [ ] Validacao e2e de cada resource contra sandbox real — CRUD completo (write-path pendente)
- [ ] Auditoria critica dos resources: metodos faltantes, tipagem, edge cases
- [x] Cobertura de testes >= 90% em todo o SDK — Validated in Phase 1: Core Hardening
- [ ] Documentacao completa (README, API reference, exemplos)
- [ ] Publicacao npm (v1.0.0) com exports corretos (ESM + CJS)
- [ ] Zero `any` no codigo fonte
- [ ] Types exportados corretamente para IDE (autocomplete)
- [ ] CHANGELOG.md
- [ ] GitHub Release

### Out of Scope

- Integracao Salesforce — consumidor futuro, projeto separado
- Interface grafica / CLI — SDK e library-only
- Suporte a auth legado (descontinuado 30/04/2026) — somente OAuth 2.0
- Websockets / eventos real-time — API Sankhya nao suporta
- Cache de dados em disco — responsabilidade do consumidor
- Suporte a versoes Sankhya < 4.34

## Context

- O SDK ja tem implementacao funcional do core e dos 10 resources (769 linhas de resources)
- Fases 1-4 foram construidas e passaram por curadoria contra o sandbox
- 15 testes de integracao ja validaram formatos reais da API (paginacao string, campos indexados Gateway, etc.)
- Existem peculiaridades documentadas: HTTP 200 em erros de negocio, TipoPessoa F/J, campos numericos como string, TAXAJURO objeto vazio, DHALTER extra no Gateway
- Sandbox esta disponivel para testes — podemos bater a vontade
- Endpoints lentos no sandbox: estoque/produtos, vendas/pedidos, financeiros/receitas, financeiros/despesas
- Doc oficial bloqueada para scraping — conhecimento foi extraido manualmente

**Brownfield state:**
- Build funcional: `npm run build` gera ESM + CJS via tsup
- Lint: Biome configurado
- Test: Vitest configurado com 163 testes (90 originais + 73 da Fase 1)
- CI: nao configurado ainda

## Constraints

- **Runtime**: Node 20+ (fetch nativo, sem polyfills)
- **Zero deps**: Nenhuma dependencia de runtime (apenas devDeps)
- **Versao Sankhya**: >= 4.34
- **Auth**: OAuth 2.0 exclusivo (legado descontinuado)
- **Qualidade**: Zero `any`, strict TypeScript, >= 90% coverage
- **Publish**: npm publico, ESM + CJS dual export

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Zero runtime dependencies | SDK leve, sem conflitos de versao para consumidores | Validado |
| OAuth 2.0 only | Auth legado descontinuado em 30/04/2026 | Validado |
| REST v1 + Gateway dual | Alguns dominios so existem no Gateway (tipos negociacao, modelos nota) | Validado |
| Lazy-loading de resources | Nao instanciar resources nao utilizados | Validado |
| AsyncGenerator para paginacao | Iteracao transparente sem gerenciar paginas manualmente | Validado |
| Nomes em portugues nos resources | Alinhado com dominio Sankhya (CODPROD, NUNOTA, CODPARC) e publico-alvo brasileiro | Validado |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd:transition`):
1. Requirements invalidated? -> Move to Out of Scope with reason
2. Requirements validated? -> Move to Validated with phase reference
3. New requirements emerged? -> Add to Active
4. Decisions to log? -> Add to Key Decisions
5. "What This Is" still accurate? -> Update if drifted

**After each milestone** (via `/gsd:complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-04-07 after Phase 7 completion — package validated: publint, attw, zero-any, tarball clean, strict TS, prepublishOnly gate*
