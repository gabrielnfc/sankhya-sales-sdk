# Paginação degradada e contratos divergentes — design

**Data:** 2026-08-29
**Versão base:** sankhya-sales-sdk 1.4.0
**Origem:** handoff da sessão TrueForce de 29/08/2026
**Status:** desenho aprovado, aguardando plano de implementação

---

## 1. Problema

O SDK colapsa três situações distintas num único retorno:

- lista legitimamente vazia,
- resposta degradada (corpo sem os campos esperados),
- resposta bem-sucedida cujo formato o SDK não sabe ler.

As três viram `{ data: [], hasMore: false }`. O consumidor não tem como separá-las, e um job de espelhamento lê "nada existe" onde deveria ler "não sei".

O caso concreto que originou o trabalho: em 19/08/2026 o TrueForce zerou as flags de foto de 230 produtos em staging porque interpretou uma resposta degradada como lista vazia legítima.

## 2. Método

**Zero trust.** Nenhuma afirmação deste documento vem de leitura de código isolada ou de raciocínio por analogia. Cada uma foi medida de duas formas:

1. **Sondas HTTP diretas** contra o sandbox (8 rodadas, somente leitura) — mediram o comportamento da API.
2. **Harness rodando o SDK real** (`src/`, via tsx) contra o mesmo sandbox — mediu o comportamento do SDK. 8 afirmações, 8 confirmadas.

Uma conclusão intermediária foi **refutada** por esse método e descartada (ver §4). Os scripts de medição estão descritos em §9.

**Baseline no momento do desenho:** `npm test` = 404 testes verdes; `npm run typecheck` limpo.

## 3. Achados medidos

### 3.1 Resultado único colapsa para objeto — perda de dados ativa

A API devolve `{ "produtos": { … } }` quando exatamente 1 registro corresponde ao filtro, e `{ "produtos": [ … ] }` quando são vários. `extractRestData` procura um array, não encontra, e devolve `[]`.

Medido via SDK:

```
produtos.listar({ modifiedSince: '14/08/2026 17:01:02' })
  → data.length = 0, totalRecords = 1, hasMore = false

cadastros.listarProjetos()
  → data.length = 0, totalRecords = 1, hasMore = false
```

O SDK informa literalmente "existe 1 registro, aqui estão 0". É sistêmico, não específico de endpoint — atinge qualquer listagem que filtre até um único resultado. Para sync incremental com janelas curtas, "exatamente 1 alteração" é o caso comum.

### 3.2 Quatro contratos de paginação, um só normalizador

| Contrato | Endpoints | Forma | Base | Medido |
|---|---|---|---|---|
| REST padrão | produtos, grupos-produto, vendedores, parceiros/clientes, estoque/*, tipos-operacao, naturezas, projetos, centros-resultado, empresas, usuarios, volumes-produtos, financeiros/{tipos-pagamento,moedas,contas-bancaria} | `pagination{page,offset,total,hasMore}` — todos string | 0 | sim |
| Financeiros | financeiros/receitas, financeiros/despesas | `pagination{page,pageSize,total,totalPages,hasMore}` — número e boolean | 1 | sim |
| Preços | precos/tabela/{t}, precos/produto/{p} | **sem bloco `pagination`**; `pagina`/`numeroRegistros`/`temMaisRegistros` no topo; param de página chamado `pagina` | 1 | sim |
| Gateway | loadRecords | `entities{total,hasMoreResult,offsetPage}` — string | 0 | sim |

`normalizeRestPagination` compara `pagination.hasMore === 'true'`. Nos financeiros o campo é o booleano `true`, então a comparação dá `false`. Nos preços não existe bloco `pagination`, então o caminho `if (!pagination)` devolve `hasMore: false`.

Consequência medida:

```
financeiros.listarReceitas()      → hasMore = false, totalRecords = 519004
financeiros.listarTodasReceitas() → emitiu 50 itens e encerrou

precos.porTabela({codigoTabela:0})      → hasMore = false
precos.todosPorTabela({codigoTabela:0}) → emitiu 50 itens e encerrou
```

**50 de 519.004 registros**, sem erro, sem aviso.

### 3.3 `clientes.listarTodos()` pula os 50 primeiros clientes

`clientes.ts:185` passa `startPage: 1`, mas `/parceiros/clientes` é 0-based (páginas 0, 1 e 2 medidas com dados distintos).

```
1º item de listarTodos()      = 290694
1º item de listar({page: 0})  = 1000000000
1º item de listar({page: 1})  = 290694
```

A página 0 nunca é visitada.

**Contraste importante:** `precos.todosPorTabela` também usa `startPage: 1` — e está **correto**, porque `/precos/tabela/{t}?pagina=0` devolve HTTP 400. O endpoint é genuinamente 1-based. Corrigir os dois por simetria teria introduzido um bug.

### 3.4 `modifiedSince` — formato e janela vazia

O JSDoc em `src/types/common.ts:136` documenta *"Data ISO"*. Medido:

```
modifiedSince = '2026-08-14T17:01:02'  → HTTP 400, ORA-01861 (formato inválido)
modifiedSince = '14/08/2026 17:01:02'  → HTTP 200
```

A API exige `dd/MM/yyyy [HH:mm:ss]`. A documentação do SDK ensina o formato errado.

Janela sem alteração devolve **404**, e o código do erro distingue o caso:

```
janela vazia          → error.code = "RESOURCE_NOT_FOUND"  (corpo ~190 chars)
rota inexistente      → error.code = "NOT_FOUND"
```

Ambos cabem folgados no corte de 500 chars do `sanitizeErrorBody`, então o match pode ser feito por campo JSON.

`/vendas/pedidos` com `modifiedSince` **não é testável neste sandbox** (`400 — Necessario habilitar o parametro 'LOGTABOPER'`). Fica fora do mapeamento.

### 3.5 `pagination.total` tem significados diferentes

- Financeiros: censo real (519004 receitas, 166417 despesas).
- Demais endpoints: tamanho da página (`"50"` fixo).
- `/estoque/produtos`: página 0 devolve **422 linhas** com `total:"50"` e `offset:0`; página 1 devolve **147 linhas** com `offset:50`. `total` e `offset` contam **produtos**; o array conta **linhas por local de estoque**.

`totalRecords` não serve para verificar completude de varredura, exceto nos financeiros.

### 3.6 Silêncios equivalentes no Gateway

`deserializeRows` tem três saídas com `rows: []`:

1. `responseBody` ausente ou não-objeto → `logger.warn`
2. `entities` ausente → `logger.warn`
3. `entity` ausente com `entities` presente → **sem aviso nenhum**

As duas primeiras são degradação; a terceira é página vazia legítima. Hoje as três são indistinguíveis para o chamador — `warn` não é sinal programático.

### 3.7 `extractRestRecordOrThrow` reporta degradação como NOT_FOUND

Corpo degradado num `buscar*` produz `SankhyaError('NOT_FOUND')`. Um consumidor com regra "não encontrado ⇒ remove registro local" sofre o mesmo dano do incidente de 19/08, por outro caminho.

### 3.8 A suíte de testes fixa o comportamento errado

Os 404 testes passam. Todos os mocks de paginação usam `page: '0'`, `hasMore` string e arrays — ou seja, codificam como contrato exatamente as suposições que a medição derrubou. Nenhum bug de §3.1 a §3.3 é detectável pela suíte atual.

## 4. O que foi refutado

O handoff descreve uma *"fronteira traiçoeira"* no `modifiedSince`: `modifiedSince` igual ao max `dataAlteracao` produziria `200 com totalRecords=1 e data VAZIO`, e o mesmo valor +1s produziria 404.

Medição: o filtro é **inclusivo (`>=`) e se comporta corretamente**. `modifiedSince` = max devolveu 200 com 4 registros; `modifiedSince` = min devolveu 200 com 50.

O sintoma relatado (`totalRecords=1` com `data` vazio) é real, mas a causa é §3.1 — o colapso singular→objeto. Não há quirk de fronteira a tratar. **Isso muda o fix**: nenhuma lógica especial de borda é necessária, e a correção certa (normalizar objeto→array) resolve o sintoma em todos os endpoints de uma vez, não só na borda.

## 5. Decisões de design

### D1 — O call site declara seu contrato

`extractRestData` passa a exigir um descritor explícito por chamada:

```ts
extractRestData<T>(response, {
  resourceKey: 'produtos',        // chave real, medida
  contract: 'rest' | 'financeiro' | 'precos',
  expectPagination: boolean,
})
```

**Por quê:** a ambiguidade existe porque o SDK descarta a expectativa do chamador e depois tenta adivinhá-la. Heurística não resolve — ela adivinha exatamente a informação que foi jogada fora. Com quatro contratos divergentes medidos (§3.2), inferir é impossível: o SDK atende quatro APIs diferentes fingindo que é uma.

Parâmetro obrigatório no tipo faz `tsc --noEmit` apontar todo call site esquecido. Falha em compilação, não em produção no cliente.

**Chaves reais medidas** (§3.2) — nenhuma foi derivada de mock ou suposição.

`extractRestData`, `normalizeRestPagination` e `createPaginator` **não são exportados** em `src/index.ts`. Mudar suas assinaturas não quebra consumidor nenhum.

### D2 — Normalizar objeto→array na extração

Quando a chave declarada contém um objeto em vez de array, o SDK embrulha em array de um elemento. Mesmo tratamento que `deserializeRows` já dá a `entities.entity`.

Resolve §3.1 em todos os endpoints simultaneamente.

### D3 — Reconhecer os quatro contratos

Normalização por contrato declarado:

- `hasMore`: aceita `true` e `'true'`.
- `total`/`page`: aceita número e string.
- Contrato `precos`: lê `temMaisRegistros`, `numeroRegistros` e `pagina` do topo do corpo.
- Ausência de bloco `pagination` só é sinal de degradação nos contratos que **declaram** tê-lo.

### D4 — Iteração por contador local

`createPaginator` deixa de derivar a próxima página do echo do servidor (`result.page + 1`) e passa a usar contador próprio a partir de `startPage`. O echo continua sendo reportado em `PaginatedResult.page`.

**Por quê:** com quatro contratos e bases de página divergentes, o echo é entrada não confiável para controle de fluxo. Hoje `parseInt(pagination.page) || 0` mascara ausência como zero, o que — combinado com `startPage: 1` — pode fixar a iteração numa página só.

`startPage` correto por endpoint, medido: `/parceiros/clientes` = 0; `/precos/tabela` = 1.

### D5 — Degradação: flag sempre, exceção como política

- `PaginatedResult<T>` ganha `degraded?: boolean`, **sempre populado**. Aditivo; não quebra tipo existente.
- `DegradedResponseError extends SankhyaError`, `code: 'DEGRADED_RESPONSE'`, com `endpoint`, `expectedKey`, `receivedKeys` e `page` para diagnóstico.
- Política via `SankhyaConfig.onDegradedResponse: 'throw' | 'flag'`.

**Por que lançar (na 2.0.0):** flag pura é segurança opt-in, e quem esquece de checar é exatamente quem se queimou. Erro não tratado mata o job; job morto não apaga espelho.

**Por que manter o knob:** o SDK suporta Sankhya >= 4.34, uma faixa larga. Sem escape hatch, uma instalação com formato divergente força fork ou pin em major antigo.

**Salvaguarda:** em modo `'flag'`, toda degradação sai em `logger.error` — nunca `warn`, nunca silêncio. Um knob que silencia reconstrói o bug original.

### D6 — 404 de janela vazia com guarda tripla

Mapear para resultado vazio legítimo **apenas** quando as três valem:

1. a requisição carregava `modifiedSince`,
2. o corpo traz `error.code === 'RESOURCE_NOT_FOUND'` (match por campo JSON, não substring),
3. é a **primeira** página da varredura.

**Por que a guarda:** converter 404 em "vazio" anda na direção perigosa — transforma erro em sucesso. Sem (1) e (2), uma base URL errada ou rota removida viraria "nada mudou", reintroduzindo a classe de bug que este trabalho existe para matar. Sem (3), um 404 no meio de uma varredura encerraria o generator em silêncio.

O resultado vazio sai com `degraded: false` — é vazio legítimo.

Aplicado aos métodos com `modifiedSince` **medidos**: `produtos.listar`, `produtos.listarGrupos`, `vendedores.listar`. **Não** aplicado a `pedidos.consultar` (não testável no sandbox, §3.4).

### D7 — Escopo de documentação

- JSDoc de `modifiedSince` corrigido para `dd/MM/yyyy [HH:mm:ss]`, com nota de inclusividade.
- Semântica de `pagination.total` documentada por contrato, incluindo a divergência produtos-vs-linhas de `/estoque/produtos`.
- Sem campo novo tipo `totalIsPageSize`: o consumidor precisa saber que não pode confiar, não de mais um campo para interpretar errado.

## 6. Corte de release

Fatiado por **breaking-ness**, não por tema. Metade dos achados é perda de dados ativa que não exige major; segurar isso atrás de uma migração seria manter gente perdendo dado sem motivo.

### 1.5.0 — sem breaking changes

| Item | Achado |
|---|---|
| Normalização objeto→array | §3.1 |
| `hasMore` aceita booleano; `total`/`page` aceitam número | §3.2 |
| Contrato `precos` (`temMaisRegistros`) | §3.2 |
| `startPage` de `clientes.listarTodos` → 0 | §3.3 |
| Iteração por contador local | D4 |
| Descritor de contrato nos call sites (interno) | D1 |
| Flag `degraded` populada + `logger.error` — **sem lançar** | D5 |
| `total: "0"` normaliza para `0`, não `undefined` | §3.5 |
| `deserializeRows` consistente entre seus dois retornos de `totalRecords` | §3.6 |
| JSDoc de `modifiedSince` | §3.4 |
| Documentação de `total` por endpoint | §3.5 |

Todos fazem o SDK devolver **mais** dado correto onde hoje devolve menos. Nenhum altera assinatura pública nem fluxo de controle.

### 2.0.0 — breaking

| Item | Achado |
|---|---|
| `onDegradedResponse` default vira `'throw'` | D5 |
| `DegradedResponseError` exportado; `SankhyaErrorCode` alargado | D5 |
| `extractRestRecordOrThrow` distingue degradação de not-found | §3.7 |
| `deserializeRows` lança nas saídas 1 e 2, preserva a 3 | §3.6 |
| 404 de janela vazia ⇒ vazio legítimo | D6 |

**Runway de depreciação:** o sinal chega no minor, o default vira no major. O consumidor adota a detecção em produção, mede quantas vezes dispara com tráfego real e só então enfrenta a mudança de fluxo de controle. Quando a 2.0.0 chegar, ele já sabe exatamente o que vai lançar.

Alargar `SankhyaErrorCode` quebra `switch` exaustivo — mais uma razão para o major.

## 7. Critérios de aceite

Cada item é um teste. Os de §3.1–§3.3 devem **falhar** contra a 1.4.0.

**1.5.0**

1. Resposta com chave declarada contendo objeto ⇒ `data` com 1 elemento, não `[]`.
2. `pagination.hasMore` booleano `true` ⇒ `hasMore: true`.
3. `pagination` com `total`/`page` numéricos ⇒ normalizados sem perda.
4. Corpo de contrato `precos` com `temMaisRegistros: true` ⇒ `hasMore: true`.
5. `clientes.listarTodos()` emite o primeiro item da página 0.
6. `createPaginator` com `startPage: 1` e echo de página ausente ⇒ visita 1, 2, 3 (não repete).
7. `total: "0"` ⇒ `totalRecords: 0`, não `undefined` — em `normalizeRestPagination` e nos dois retornos de `deserializeRows`.
8. Corpo sem `pagination` num contrato que a declara ⇒ `degraded: true` e `logger.error`, sem lançar.
9. Contrato `precos` sem bloco `pagination` ⇒ `degraded: false`.
10. Integração: `produtos.listar({modifiedSince})` numa janela de exatamente 1 alteração ⇒ 1 item.

**2.0.0**

11. Corpo sem `pagination` num contrato que a declara ⇒ `DegradedResponseError`.
12. Página vazia com `hasMore` verdadeiro no meio da varredura ⇒ `DegradedResponseError`, não fim de generator.
13. `deserializeRows` sem `responseBody`/`entities` ⇒ lança; sem `entity` mas com `entities` ⇒ página vazia legítima.
14. `extractRestRecordOrThrow` com corpo degradado ⇒ `DegradedResponseError`, não `NOT_FOUND`.
15. 404 `RESOURCE_NOT_FOUND` **com** `modifiedSince` na primeira página ⇒ resultado vazio, `degraded: false`.
16. 404 `NOT_FOUND` (rota inexistente) ⇒ `ApiError`, sempre.
17. 404 `RESOURCE_NOT_FOUND` **sem** `modifiedSince` ⇒ `ApiError`.
18. 404 no meio de varredura ⇒ `DegradedResponseError`.
19. `onDegradedResponse: 'flag'` ⇒ não lança, popula flag, emite `logger.error`.

**Transversal**

20. Mocks existentes revisados: os que fixam `page: '0'` e arrays deixam de representar o contrato real (§3.8).

## 8. Não-objetivos

- Mapear 404 em `pedidos.consultar` — sem medição (§3.4).
- Campo derivado para semântica de `total` — documentação apenas (D7).
- Refatorar `deserializeRows` além das saídas de degradação.
- Alterar a superfície pública de resources além do campo `degraded`.

## 9. Reprodução

Sondas HTTP diretas e harness do SDK executados em 2026-08-29 contra o sandbox configurado em `.env` do repositório. Somente leitura, nenhuma escrita.

- Sondas HTTP: chaves por endpoint, contratos de paginação, `modifiedSince` (formato, janela vazia, fronteira), base de página por endpoint, semântica de `total`.
- Harness do SDK (`tsx`, importando `src/`): 8 afirmações comportamentais, 8 confirmadas — as listadas em §3.1, §3.2, §3.3 e §3.4.

Gotcha operacional: `.env` com CRLF quebra a autenticação com `401 invalid_client`; os scripts removem `\r` ao ler.

## 10. Impacto em consumidores

O consumidor conhecido (TrueForce) espelha catálogo, estoque, vendedores e TOPs com sync incremental via `modifiedSince`.

- **Hoje:** §3.1 está degradando o espelho — janelas com exatamente 1 alteração são lidas como "nada mudou". Há registros defasados sem rastro. Exige resync completo após a 1.5.0.
- **1.5.0:** ganho direto, sem migração. A flag `degraded` permite aposentar heurísticas locais de detecção.
- **2.0.0, item de risco:** D6 converte um erro em sucesso vazio. Um consumidor que hoje depende do `ApiError` 404 para pular o tick passará a receber lista vazia. Se o caminho de "lista vazia" escrever no espelho, o incidente de 19/08 reabre pela correção. Auditoria do tratamento de vazio é pré-requisito de upgrade, não pós.
