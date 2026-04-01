# Roadmap de Implementação

## Fases

### Fase 1 — Projeto e Documentação

**Status:** Em andamento

**Entregáveis:**
- [x] Documentação da API Sankhya (migrada para docs/api-reference/)
- [ ] Documentação completa do SDK (22 arquivos)
- [ ] Definição de tipos e interfaces
- [ ] Decisões de arquitetura documentadas

**Critérios de aceite:**
- Todos os 55 endpoints REST v1 documentados
- Todos os 12 serviços Gateway documentados
- Todas as 45 interfaces/types definidas
- README com quick start funcional

---

### Fase 2 — Setup do Projeto

**Status:** Pendente

**Entregáveis:**
- [ ] `package.json` configurado (name: `sankhya-sales-sdk`)
- [ ] TypeScript strict mode (`tsconfig.json`)
- [ ] Build system (tsup — ESM + CJS)
- [ ] Biome (lint + format)
- [ ] Vitest configurado
- [ ] `.gitignore`, `.npmignore`, `.env.example`
- [ ] GitHub Actions CI (lint → test → build)

**Critérios de aceite:**
- `npm run build` gera ESM + CJS sem erros
- `npm run lint` passa com zero warnings
- `npm run test` executa (mesmo sem testes ainda)
- CI roda no push/PR

---

### Fase 3 — Core: Auth + HTTP + Errors

**Status:** Pendente

**Entregáveis:**
- [ ] `core/auth.ts` — OAuth 2.0, token cache, mutex, refresh
- [ ] `core/http.ts` — Cliente HTTP com fetch, headers, interceptors
- [ ] `core/errors.ts` — SankhyaError, AuthError, ApiError, GatewayError, TimeoutError
- [ ] `core/logger.ts` — Logger injetável
- [ ] `client.ts` — SankhyaClient (entry point)
- [ ] Types: config, auth, common
- [ ] Testes unitários para auth, http, errors

**Critérios de aceite:**
- Autenticação funcional com token cache
- Mutex previne refresh duplicado
- Token cache provider injetável (interface)
- Hierarquia de erros com `instanceof`
- 90%+ coverage no core

---

### Fase 4 — Core: Gateway + Paginação + Utilities

**Status:** Pendente

**Entregáveis:**
- [ ] `core/gateway-serializer.ts` — Serializar/deserializar formato Gateway
- [ ] `core/pagination.ts` — Normalização dos 3 padrões
- [ ] `core/retry.ts` — Exponential backoff
- [ ] `core/date.ts` — Conversão de formatos de data
- [ ] Testes unitários

**Critérios de aceite:**
- Gateway serializer converte `{ "$": "valor" }` ↔ valor plano
- Paginação normalizada: page/pagina/offsetPage → PaginatedResult
- AsyncGenerator para iteração automática
- Retry em 429, 5xx, ECONNRESET
- 90%+ coverage

---

### Fase 5 — Resources: Clientes + Vendedores + Cadastros

**Status:** Pendente

**Entregáveis:**
- [ ] `resources/clientes.ts` — 5 métodos (listar, criar, atualizar, incluirContato, atualizarContato)
- [ ] `resources/vendedores.ts` — 2 métodos (listar, buscar)
- [ ] `resources/cadastros.ts` — 11 métodos (TOPs, naturezas, projetos, centros, empresas, usuários, tiposNegociacao, modelosNota)
- [ ] Types: clientes, vendedores, cadastros
- [ ] Testes unitários

**Critérios de aceite:**
- Todos os endpoints documentados implementados
- Tipos corretos de input/output
- Paginação normalizada
- Testes com mocking do HTTP

---

### Fase 6 — Resources: Produtos + Preços + Estoque

**Status:** Pendente

**Entregáveis:**
- [ ] `resources/produtos.ts` — 9 métodos (listar, buscar, componentes, alternativos, volumes, listarVolumes, buscarVolume, grupos, buscarGrupo)
- [ ] `resources/precos.ts` — 4 métodos (porProdutoETabela, porProduto, porTabela, contextualizado)
- [ ] `resources/estoque.ts` — 5 métodos (porProduto, listar, listarLocais, buscarLocal, detalhesGateway)
- [ ] Types: produtos, precos, estoque
- [ ] Testes unitários

**Critérios de aceite:**
- Preço contextualizado com tipagem completa
- Estoque via REST v1 e Gateway
- Consulta de catálogo via Gateway
- 90%+ coverage

---

### Fase 7 — Resources: Pedidos (CRÍTICO)

**Status:** Pendente

**Entregáveis:**
- [ ] `resources/pedidos.ts` — 9 métodos:
  - REST: criar, atualizar, cancelar, consultar
  - Gateway: incluirNota, incluirAlterarItem, excluirItem, confirmar, faturar
- [ ] Types: pedidos
- [ ] Testes unitários

**Critérios de aceite:**
- Fluxo completo: criar → confirmar → faturar
- Divergência `CACSP.confirmarNota` / `ServicosNfeSP.confirmarNota` tratada
- Simulação de impostos via Gateway
- Todos os tipos de faturamento suportados
- Testes para cada etapa do fluxo

---

### Fase 8 — Resources: Financeiros + Fiscal + Gateway Genérico

**Status:** Pendente

**Entregáveis:**
- [ ] `resources/financeiros.ts` — 13 métodos (tiposPagamento, receitas, despesas, moedas, contas, TEF)
- [ ] `resources/fiscal.ts` — 2 métodos (calcularImpostos, importarNfse)
- [ ] `resources/gateway.ts` — 3 métodos genéricos (loadRecords, loadRecord, saveRecord)
- [ ] Types: financeiros, fiscal, gateway
- [ ] Testes unitários

**Critérios de aceite:**
- Todos os sub-tipos de pagamento tipados
- CRUD Gateway genérico funcional
- Cálculo fiscal com tipos de impostos
- 90%+ coverage

---

### Fase 9 — Finalização e Publicação

**Status:** Pendente

**Entregáveis:**
- [ ] Testes de integração (opcional, requer ambiente Sankhya)
- [ ] 100% dos exports verificados
- [ ] README final revisado
- [ ] CHANGELOG.md
- [ ] `npm publish` (v0.1.0)
- [ ] GitHub Release

**Critérios de aceite:**
- `npm pack` gera pacote limpo
- Imports funcionam: `import { SankhyaClient } from 'sankhya-sales-sdk'`
- Tipos expostos corretamente no IDE
- Zero `any` no código fonte
- Documentação sincronizada com código

## Priorização

```
Fase 1 ──▶ Fase 2 ──▶ Fase 3 ──▶ Fase 4 ──▶ Fase 5 ──▶ Fase 6 ──▶ Fase 7 ──▶ Fase 8 ──▶ Fase 9
 docs       setup      auth+http   gateway    clientes   produtos   pedidos    financeiro  publish
                                   +pagina    +vendedor  +precos    (CRÍTICO)  +fiscal
                                              +cadastros +estoque              +gateway
```

A **Fase 7 (Pedidos)** é a mais crítica — representa o core do fluxo de vendas B2B e envolve tanto REST v1 quanto Gateway com peculiaridades específicas (divergência de serviceName, clientEventList, tipos de faturamento).
