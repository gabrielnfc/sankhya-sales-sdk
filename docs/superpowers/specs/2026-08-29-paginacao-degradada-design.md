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

**Zero trust.** Toda afirmação **comportamental sobre o SDK** foi medida de duas formas:

1. **Sondas HTTP diretas** contra o sandbox (8 rodadas, somente leitura) — mediram o comportamento da API.
2. **Harness rodando o SDK real** (`src/`, via tsx) contra o mesmo sandbox — mediu o comportamento do SDK. 8 afirmações, 8 confirmadas.

Afirmações sobre **superfície de tipos** foram provadas com `tsc` sobre fixtures de consumidor (D3). Afirmações sobre **extensão da superfície** (quais métodos, quais call sites) foram provadas por enumeração scriptada, não por leitura.

O que **não** teve essas garantias está isolado em §10, e §3.6 e §3.7 vêm apenas de leitura de código — estão marcados como tal.

Uma conclusão intermediária foi **refutada** por esse método e descartada (ver §4). Os scripts de medição estão descritos em §9.

**Lição de processo, registrada porque mudou o método:** as afirmações executadas saíram corretas; as derivadas apenas de raciocínio — tabelas-resumo, classificação de breaking, extensão da superfície — concentraram todos os erros pegos em revisão. Por isso os critérios de aceite de §7 são escritos como testes executáveis **antes** da implementação, e não como prosa.

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

O SDK informa literalmente "existe 1 registro, aqui estão 0". Para sync incremental com janelas curtas, "exatamente 1 alteração" é o caso comum, não o raro.

**Escopo da medição:** confirmado em dois endpoints de contratos diferentes — `/produtos` (chave própria, filtrado por `modifiedSince`) e `/projetos` (chave genérica `data`, total=1 natural) — mais `/produtos/{id}`, que devolve objeto sob a mesma chave `produtos`. Que o comportamento valha para *todos* os endpoints é **inferência**, não medição. A correção (D2) é uniforme e não depende dessa generalização estar certa; a classificação por call site (§10) confirma caso a caso.

### 3.2 Quatro contratos de paginação, um só normalizador

| Contrato | Endpoints | Forma | Base | Como foi apurado |
|---|---|---|---|---|
| REST padrão | produtos, grupos-produto, vendedores, parceiros/clientes, estoque/*, tipos-operacao, naturezas, projetos, centros-resultado, empresas, usuarios, volumes-produtos, financeiros/{tipos-pagamento,moedas,contas-bancaria} | `pagination{page,offset,total,hasMore}` — todos string | 0 | **forma medida nos 16 endpoints**; **base medida em `/produtos` e `/parceiros/clientes`** (páginas 0/1/2 com dados distintos). Base dos demais: inferida |
| Financeiros | financeiros/receitas, financeiros/despesas | `pagination{page,pageSize,total,totalPages,hasMore}` — número e boolean | 1 | forma e base medidas (`page=0` e `page=1` devolvem o mesmo conjunto; echo sempre `1`) |
| Preços | precos/tabela/{t}, precos/produto/{p} | **sem bloco `pagination`**; `pagina`/`numeroRegistros`/`temMaisRegistros` no topo; param de página chamado `pagina` | 1 | forma e base medidas (`pagina=0` → HTTP 400) |
| Gateway | loadRecords | `entities{total,hasMoreResult,offsetPage}` — string | 0 | **não medido** — apenas leitura de `gateway-serializer.ts`. Ver §10 |

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

**E não é só a varredura.** `clientes.ts:71` usa `page: String(params?.page ?? 1)` — o **default do próprio `listar()`** é a página 1. Quem chama `clientes.listar()` sem argumento acredita estar na primeira página e está na segunda. Enumeração dos defaults confirma que `clientes` é o único método REST com default 1; todos os outros usam 0, e `precos` usa 1 corretamente por ser 1-based.

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

**O filtro incremental não se chama `modifiedSince` em todo lugar.** Enumeração dos parâmetros de query — não leitura — mostrou que `clientes.listar` usa **`dataHoraAlteracao`**. Um grep por `modifiedSince` nunca o encontraria, e foi assim que ele ficou fora do escopo original. Medido: comportamento idêntico — formato BR obrigatório (ISO devolve `400 ORA-01861`) e janela vazia devolve `404 RESOURCE_NOT_FOUND` (`Nenhum registro da entidade Parceiro…`). Entra no escopo de D6.

Superfície completa de filtro incremental, por enumeração: `modifiedSince` em `produtos.listar`, `produtos.listarGrupos`, `vendedores.listar` e `pedidos.consultar`; `dataHoraAlteracao` em `clientes.listar`.

### 3.5 `pagination.total` tem significados diferentes

- Financeiros: censo real (519004 receitas, 166417 despesas).
- Demais endpoints: quantidade de registros **desta página**, limitada a 50 — `"50"` quando a página está cheia, o total real quando o conjunto inteiro cabe numa página (`locais` `"48"`, `volumes` `"26"`, `contas-bancaria` `"25"`, `moedas` `"8"`, `empresas` `"4"`). Nunca é censo quando `hasMore` é verdadeiro.
- `/estoque/produtos`: página 0 devolve **422 linhas** com `total:"50"` e `offset:0`; página 1 devolve **147 linhas** com `offset:50`. `total` e `offset` contam **produtos**; o array conta **linhas por local de estoque**. Que a unidade seja "produtos" é a leitura mais coerente dos números medidos, não uma confirmação da API.

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

**Tabela de decisão completa** para o valor sob a chave declarada — sem ela, o implementador escolhe por conta própria:

| Valor sob a chave | Resultado |
|---|---|
| array | `data` = o array |
| objeto | `data` = `[objeto]` |
| chave ausente | degradado |
| `null` / `undefined` | degradado |
| string, número, booleano | degradado |
| array vazio | `data` = `[]`, **não** degradado |

### D3 — Um tipo por contrato; `RestPagination` não é alargada

O contrato Gateway não passa por `extractRestData` — é tratado em `deserializeRows`, e só muda no que §3.6 descreve. O descritor de D1 cobre os três contratos REST.

**Decisão: cada contrato medido ganha seu próprio tipo.** `RestPagination` permanece exatamente como está e passa a documentar apenas o contrato REST-padrão. Contratos novos:

```ts
interface FinanceiroPagination { page: number; pageSize: number; total: number; totalPages: number; hasMore: boolean }
interface PrecosPagination    { pagina: number; numeroRegistros: number; temMaisRegistros: boolean }
```

**Por que não alargar `RestPagination`** — provado, não suposto. `RestPagination` é exportada em `src/index.ts:67`. Alargar `total: string` para `string | number` foi testado com `tsc --strict` sobre uma fixture de consumidor:

```
error TS2322: Type 'string | number' is not assignable to type 'string'.       (const total: string = p.total)
error TS2345: Argument of type 'string | number' is not assignable to ...       (Number.parseInt(p.total, 10))
```

Quebra o consumidor **e** o código interno do SDK. Um tipo por contrato evita as duas quebras e ainda substitui um tipo frouxo cobrindo três formatos incompatíveis por três tipos exatos.

Normalização por contrato declarado:

- Contrato `rest`: como hoje, comparando strings.
- Contrato `financeiro`: `hasMore` booleano, `total`/`page` numéricos, base 1.
- Contrato `precos`: lê `temMaisRegistros`, `numeroRegistros` e `pagina` do topo do corpo, base 1.
- Ausência de bloco `pagination` só é sinal de degradação nos contratos que **declaram** tê-lo.

`PaginatedResult` continua sendo o tipo único de saída — a divergência morre na normalização.

### D4 — Iteração por contador local

`createPaginator` deixa de derivar a próxima página do echo do servidor (`result.page + 1`) e passa a usar contador próprio a partir de `startPage`. O echo continua sendo reportado em `PaginatedResult.page`.

**Por quê:** com contratos e bases de página divergentes, o echo é entrada não confiável para controle de fluxo. Hoje `parseInt(pagination.page) || 0` mascara ausência como zero, o que — combinado com `startPage: 1` — pode fixar a iteração numa página só.

`startPage` correto por endpoint, medido: `/parceiros/clientes` = 0; `/precos/tabela` = 1.

**Condição de parada.** Hoje o generator para com `hasMore && data.length > 0`. Remover a segunda condição junto com o echo abriria laço infinito quando o servidor mantém `hasMore` verdadeiro numa página vazia. Portanto:

- **1.5.0:** página vazia com `hasMore` verdadeiro **para a iteração** (comportamento atual preservado) **e** marca `degraded: true` com `logger.error`. Sem laço infinito, sem mudança de fluxo.
- **2.0.0:** o mesmo caso lança `DegradedResponseError`.

### D5 — Degradação: flag sempre, exceção como política

- `PaginatedResult<T>` ganha `degraded?: boolean`. **Opcional no tipo, sempre presente no retorno do SDK.** A opcionalidade existe porque consumidores constroem `PaginatedResult` em mocks e testes; campo obrigatório quebraria essas construções. Quem lê o retorno do SDK pode contar que o campo está lá.
- `DegradedResponseError extends SankhyaError`, `code: 'DEGRADED_RESPONSE'`, com `endpoint`, `expectedKey`, `receivedKeys` e `page` para diagnóstico.
- Política via `SankhyaConfig.onDegradedResponse: 'throw' | 'flag'`. Global, não por chamada: a política é postura de segurança da aplicação, e um override por chamada seria o caminho natural para silenciar caso a caso — exatamente o que este trabalho existe para impedir.

#### D5.1 — O canal do sinal depende da forma de retorno

Enumeração scriptada da superfície pública (não leitura):

| Forma de retorno | Qtd | Canal para `degraded` |
|---|---|---|
| `Promise<PaginatedResult<T>>` | 20 | campo `degraded` no envelope |
| `Promise<T[]>` | 11 | **nenhum** — sem envelope |
| `AsyncGenerator<T>` | 14 | **nenhum** — emite item a item |

Os 11 de array puro incluem `gateway.loadRecords`, `estoque.porProduto`, `produtos.componentes/alternativos/volumes`, `cadastros.listarUsuarios/listarModelosNota`, `financeiros.listarContasBancarias`, `precos.contextualizado`, `fiscal.calcularImpostos`, `metadata.listFields`.

**Consequência para o runway.** Sem envelope, esses 25 métodos só teriam log na 1.5.0 e exceção na 2.0.0 — pulando o degrau de observação que é a razão de existir do faseamento. E o pior caso é justo o caminho que mais importa: as 14 varreduras.

**Decisão:** os métodos de varredura aceitam um callback opcional:

```ts
listarTodos({ onDegraded: (info: DegradedInfo) => void })
```

Aditivo, opt-in, e devolve canal programático para quem itera. Mesma opção nos métodos de array puro que aceitam objeto de parâmetros.

Onde nem isso couber (métodos sem objeto de parâmetros, como `gateway.loadRecords`), o sinal na 1.5.0 é **apenas log estruturado** — capturável via `logger.custom`, que o SDK já suporta. Isso está declarado como limitação conhecida, não resolvido por omissão. `gateway.loadRecords` é a sonda de saúde do consumidor conhecido; a limitação vai no brief.

**Por que lançar (na 2.0.0):** flag pura é segurança opt-in, e quem esquece de checar é exatamente quem se queimou. Erro não tratado mata o job; job morto não apaga espelho.

**Por que manter o knob:** o SDK suporta Sankhya >= 4.34, uma faixa larga. Sem escape hatch, uma instalação com formato divergente força fork ou pin em major antigo.

**Salvaguarda:** em modo `'flag'`, toda degradação sai em `logger.error` — nunca `warn`, nunca silêncio. Um knob que silencia reconstrói o bug original.

### D6 — 404 de janela vazia com guarda tripla

Mapear para resultado vazio legítimo **apenas** quando as três valem:

1. a requisição carregava `modifiedSince`,
2. o corpo traz `error.code === 'RESOURCE_NOT_FOUND'` (match por campo JSON, não substring),
3. `page === startPage` do endpoint (0 para `produtos`, `grupos-produto` e `vendedores`).

A condição 3 precisa dessa forma operacional porque **o resource não sabe se está dentro de um paginador** — só conhece o parâmetro `page` que recebeu. Consequência declarada: uma chamada direta a `listar({ page: 5, modifiedSince })` que devolva 404 **continua lançando `ApiError`**. Isso é intencional: 404 numa página adiantada não é "nada mudou", é anomalia.

**Por que a guarda:** converter 404 em "vazio" anda na direção perigosa — transforma erro em sucesso. Sem (1) e (2), uma base URL errada ou rota removida viraria "nada mudou", reintroduzindo a classe de bug que este trabalho existe para matar. Sem (3), um 404 no meio de uma varredura encerraria o generator em silêncio.

O resultado vazio sai com `degraded: false` — é vazio legítimo.

Aplicado aos métodos com filtro incremental **medido**: `produtos.listar`, `produtos.listarGrupos`, `vendedores.listar` (via `modifiedSince`) e `clientes.listar` (via `dataHoraAlteracao`). **Não** aplicado a `pedidos.consultar` (não testável no sandbox, §3.4).

### D7 — `PaginatedResult.page` permanece sendo o echo do servidor

Consequência: o campo tem bases diferentes por recurso — 0-based no contrato REST, 1-based em financeiros e preços. Um consumidor que persista ou logue esse valor vê semânticas distintas dependendo do recurso.

**Decisão: documentar, não normalizar.** Normalizar para 0-based mudaria silenciosamente um valor que consumidores podem estar persistindo, e a mudança seria invisível em tipo — a pior categoria de breaking. Se virar necessário, é item de 2.0.0 com nota própria, não efeito colateral desta correção.

Registrado aqui porque a omissão anterior deixava a decisão para quem implementasse.

### D8 — Escopo de documentação

- JSDoc de `modifiedSince` corrigido para `dd/MM/yyyy [HH:mm:ss]`, com nota de inclusividade.
- Semântica de `pagination.total` documentada por contrato, incluindo a divergência produtos-vs-linhas de `/estoque/produtos`.
- Sem campo novo tipo `totalIsPageSize`: o consumidor precisa saber que não pode confiar, não de mais um campo para interpretar errado.

## 6. Corte de release

Fatiado por **breaking-ness**, não por tema. Metade dos achados é perda de dados ativa que não exige major; segurar isso atrás de uma migração seria manter gente perdendo dado sem motivo.

### 1.5.0 — sem breaking changes

| Item | Achado |
|---|---|
| Normalização objeto→array | §3.1 |
| Tipos próprios por contrato (`RestPagination` intocada) | D3 |
| `onDegraded` opcional nas varreduras e nos métodos com objeto de params | D5.1 |
| Contrato `precos` (`temMaisRegistros`) | §3.2 |
| `startPage` de `clientes.listarTodos` → 0 **e** default de `clientes.listar` → 0 | §3.3 |
| Iteração por contador local | D4 |
| Descritor de contrato nos call sites (interno) | D1 |
| Flag `degraded` populada + `logger.error` — **sem lançar** | D5 |
| `total: "0"` normaliza para `0`, não `undefined` | §3.5 |
| `deserializeRows` consistente entre seus dois retornos de `totalRecords` | §3.6 |
| JSDoc de `modifiedSince` | §3.4 |
| Página vazia com `hasMore` verdadeiro ⇒ para e marca `degraded` | D4 |
| Documentação de `total` por endpoint | §3.5 |

Todos fazem o SDK devolver **mais** dado correto onde hoje devolve menos, ou anexar sinal onde hoje não há.

Duas ressalvas de precisão, já que "sem breaking" é uma afirmação forte:

- `PaginatedResult<T>` ganha o campo opcional `degraded`. É mudança de superfície pública, mas **aditiva** — nenhum consumidor existente deixa de compilar ou de funcionar.
- `clientes.listarTodos()` passa a visitar a página 0, e as varreduras de financeiros e preços passam da primeira página. Consumidores recebem **mais itens** do que antes. É correção de perda de dados, não quebra de contrato — mas quem dimensionou batch por contagem observada deve saber. Vai nas notas de release.

Nenhuma assinatura pública muda de forma incompatível. Nenhuma exceção nova é lançada. `RestPagination` não é tocada (D3).

**Risco operacional da 1.5.0 — precisa de nota de release própria.**

As varreduras hoje truncadas passam a percorrer o conjunto inteiro. `listarTodasReceitas()` sai de 50 itens para 519.004 — **10.381 páginas**. Um job que hoje termina em segundos passa a fazer dez mil requisições.

É correção de perda de dados, não regressão. Mas para quem já roda esse código em produção é uma mudança de custo e duração que chega sem aviso. Mitigação: a nota de release destaca o item, e o paginador emite `logger.warn` ao ultrapassar 100 páginas numa varredura — visibilidade sem impor política.

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

**Os que podiam ser escritos hoje já foram** — `tests/core/pagination-contracts.test.ts` e `tests/resources/clientes-pagination.test.ts`, commitados antes da implementação. Usam `it.fails`, que executa o teste e exige que ele falhe: o bug fica verificado como presente, a suíte segue verde, e quando a correção entrar o `it.fails` passa a falhar, obrigando a virar `it`. Payloads copiados das medições, não inventados.

Escrever esses testes já corrigiu o spec uma vez: um critério que eu tinha derivado (`numeroRegistros` alimentar `totalRecords` no contrato de preços) mostrou-se **vazio** — `normalizeRestPagination` já usa `data.length` quando não há bloco `pagination`, e `numeroRegistros` sempre igualou o tamanho do array nas medições. O critério não testava nada. Só a execução revelou.

Os critérios que dependem de API inexistente (`DegradedResponseError`, `onDegraded`, descritor de contrato) não compilam contra a 1.4.0 e ficam para TDD dentro do plano, tarefa a tarefa.

**1.5.0**

1. Um caso por linha da tabela de decisão de D2: array, objeto, chave ausente, `null`, escalar, array vazio.
1b. `RestPagination` permanece byte-a-byte igual — teste de tipo com fixture de consumidor sob `tsc --strict`, verde antes e depois.
2. `pagination.hasMore` booleano `true` ⇒ `hasMore: true`.
3. `pagination` com `total`/`page` numéricos ⇒ normalizados sem perda.
4. Corpo de contrato `precos` com `temMaisRegistros: true` ⇒ `hasMore: true`.
5. `clientes.listarTodos()` emite o primeiro item da página 0.
6. `createPaginator` com `startPage: 1` e echo de página ausente ⇒ visita 1, 2, 3 (não repete).
7. `total: "0"` ⇒ `totalRecords: 0`, não `undefined` — em `normalizeRestPagination` e nos dois retornos de `deserializeRows`.
8. Corpo sem `pagination` num contrato que a declara ⇒ `degraded: true` e `logger.error`, sem lançar.
9. Contrato `precos` sem bloco `pagination` ⇒ `degraded: false`.
10. Integração: `produtos.listar({modifiedSince})` numa janela de exatamente 1 alteração ⇒ 1 item. **O timestamp é derivado em runtime** — busca a página 0, ordena `dataAlteracao:`, toma o máximo e reconsulta até isolar 1 registro. Nunca hardcoded: o dado do sandbox muda, e um valor fixo faz o teste validar outra coisa ou falhar sem motivo. Se a janela não render exatamente 1, o teste é pulado com mensagem explícita, nunca aprovado por omissão.
10b. Página vazia com `hasMore` verdadeiro no meio da varredura ⇒ generator encerra (como hoje), `degraded: true`, `logger.error`, **sem laço infinito e sem lançar**.
10c. `onDegraded` é chamado uma vez por página degradada durante uma varredura, com `endpoint` e `page` preenchidos.
10d. Varredura que ultrapassa 100 páginas emite `logger.warn` uma única vez.

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
- Campo derivado para semântica de `total` — documentação apenas (D8).
- Normalizar a base de `PaginatedResult.page` entre contratos (D7).
- Override de `onDegradedResponse` por chamada (D5).
- Refatorar `deserializeRows` além das saídas de degradação.
- Alterar a superfície pública de resources além do campo `degraded`.

## 9. Reprodução

Sondas HTTP diretas e harness do SDK executados em 2026-08-29 contra o sandbox configurado em `.env` do repositório. Somente leitura, nenhuma escrita.

- Sondas HTTP: chaves por endpoint, contratos de paginação, `modifiedSince` (formato, janela vazia, fronteira), base de página por endpoint, semântica de `total`.
- Harness do SDK (`tsx`, importando `src/`): 8 afirmações comportamentais, 8 confirmadas — as listadas em §3.1, §3.2, §3.3 e §3.4.

Gotcha operacional: `.env` com CRLF quebra a autenticação com `401 invalid_client`; os scripts removem `\r` ao ler.

## 10. Lacunas conhecidas — a fechar no plano, antes de codificar

Este documento distingue medido de inferido. Medições complementares em
[`2026-08-29-medicoes-complementares.md`](./2026-08-29-medicoes-complementares.md) fecharam a
maior parte do que estava listado abaixo. Status atualizado:

1. **Classificação dos call sites que não paginam.** ⚠️ **Parcialmente fechada** — ver
   [medições complementares §Lacuna 1 e 5](./2026-08-29-medicoes-complementares.md#lacuna-1-e-5--classificação-dos-call-sites-sem-paginação--chave-de-sub-recursos).
   `produtos.volumes` (o método real é `volumes`, não `volumesDoProduto`), `estoque.porProduto`,
   `cadastros.listarUsuarios` e `financeiros.listarContasBancarias` foram medidos — e três deles
   (`produtos.volumes`, `cadastros.listarUsuarios`, `financeiros.listarContasBancarias`) revelaram
   que o endpoint **devolve um bloco `pagination` real que o call site descarta**, contrariando a
   suposição original de "legitimamente sem paginação". `produtos.componentes` e
   `produtos.alternativos` seguem **NÃO MEDIDOS**: 9 produtos testados, todos `404
   RESOURCE_NOT_FOUND` — o sandbox não tem produto com kit/alternativos cadastrado.
   `precos.contextualizado` segue **NÃO MEDIDO**: usa `POST` com corpo de negociação, fora do
   alcance de uma sonda somente-leitura.

2. **Base de página dos endpoints REST não sondados.** ✅ **Fechada para os 13 endpoints
   sondados** — ver [medições complementares §Lacuna 2](./2026-08-29-medicoes-complementares.md#lacuna-2--base-de-página-dos-endpoints-rest-não-sondados).
   Todos 0-based (7 com evidência forte de dados distintos entre páginas, 4 com evidência mais
   fraca por dataset pequeno). `financeiros/receitas` reconfirma o contrato Financeiros já
   descrito acima. Fora desta sonda, `projetos`, `financeiros/despesas` e a base específica de
   `financeiros/contas-bancaria` continuam sem medição direta.

3. **Contrato Gateway.** ✅ **Fechada** — ver [medições complementares §Lacuna 3](./2026-08-29-medicoes-complementares.md#lacuna-3--contrato-gateway-loadrecords).
   `loadRecords` exercitado contra o servidor real com resultado único e resultado vazio. O
   colapso objeto/array de `entities.entity` foi confirmado e já está coberto pelo guard
   existente em `deserializeRows`. A saída silenciosa "`entities` presente, `entity` ausente"
   também foi confirmada como alcançável e correta (retorna `total: 0`, sem degradação).

4. **`pedidos.consultar` + `modifiedSince`.** ❌ **Continua aberta.** Bloqueado pelo sandbox
   (§3.4, `LOGTABOPER` desabilitado). Permanece não-objetivo até que exista medição.

5. **Chave de resposta dos endpoints de sub-recurso.** ⚠️ **Parcialmente fechada** — mesma
   medição da Lacuna 1: `produtos.volumes` → chave `volumesProduto`; `estoque.porProduto` →
   chave `estoque`; `pedidos.consultar` (`/vendas/pedidos`) → chave `pedido` (singular).
   `produtos.componentes` e `produtos.alternativos` seguem sem chave conhecida — não medido,
   mesmo motivo do item 1.

6. **Deriva entre descritor e endpoint.** Não é uma lacuna de medição — é orientação de
   implementação (um `const` de descritores por módulo de resource, colocado junto do path).
   Nenhuma sonda se aplica; segue como está, a ser seguido na implementação.

Itens 1 e 5 (para `componentes`/`alternativos`/`contextualizado`) e o restante do item 2
(`projetos`, `financeiros/despesas`, base de `financeiros/contas-bancaria`) continuam
bloqueando a **implementação** do trecho correspondente — a Task 3 trata essas células como
bloqueio explícito, não como suposição. Os demais itens estão liberados para codificar.

## 11. Impacto em consumidores

O consumidor conhecido (TrueForce) espelha catálogo, estoque, vendedores e TOPs com sync incremental via `modifiedSince`.

- **Hoje:** §3.1 está degradando o espelho — janelas com exatamente 1 alteração são lidas como "nada mudou". Há registros defasados sem rastro. Exige resync completo após a 1.5.0.
- **1.5.0:** ganho direto, sem migração. A flag `degraded` permite aposentar heurísticas locais de detecção.
- **2.0.0, item de risco:** D6 converte um erro em sucesso vazio. Um consumidor que hoje depende do `ApiError` 404 para pular o tick passará a receber lista vazia. Se o caminho de "lista vazia" escrever no espelho, o incidente de 19/08 reabre pela correção. Auditoria do tratamento de vazio é pré-requisito de upgrade, não pós.
