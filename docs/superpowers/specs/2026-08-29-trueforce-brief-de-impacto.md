# Brief de impacto — time TrueForce

**De:** mantenedor do sankhya-sales-sdk
**Data:** 2026-08-29
**Assunto:** resposta ao handoff de 29/08 — um achado seu foi reclassificado, e há ação imediata

---

## Resumo

Investigamos os 4 achados do handoff. Todos os 4 se confirmam, mas **um deles tem causa diferente da diagnosticada — mais grave e mais frequente**. Há ação para vocês antes de qualquer release do SDK.

Tudo abaixo foi medido em 29/08 contra o sandbox, primeiro com sondas HTTP diretas e depois rodando o SDK real. Nada é inferência.

## 1. Ação imediata: seu espelho está defasado agora

**O que encontramos.** A API devolve um **objeto** em vez de array quando exatamente 1 registro corresponde ao filtro:

```
{ "produtos": { … }, "pagination": { "total": "1" } }     ← 1 resultado
{ "produtos": [ … ], "pagination": { "total": "50" } }    ← vários
```

O SDK procura um array, não encontra, e devolve lista vazia. Medido rodando o SDK:

```
produtos.listar({ modifiedSince: '14/08/2026 17:01:02' })
  → data.length = 0,  totalRecords = 1
```

O SDK diz "existe 1 registro, aqui estão 0".

**O que isso significa para vocês.** No sync incremental, toda janela em que **exatamente 1 registro mudou** é lida como "nada mudou". Aquele registro nunca sincroniza — fica defasado até cair por acaso numa janela com 2 ou mais alterações. Sem erro, sem log, sem sintoma.

Em job de minutos, "exatamente 1 alteração" não é o caso raro. É o caso comum.

**Ação:** planejem um **resync completo** dos domínios espelhados assim que a 1.5.0 sair. Não dá para identificar quais registros ficaram para trás pelos logs — a falha não deixa rastro.

**Isto é o seu Achado 3 reclassificado.** Vocês reportaram uma "fronteira traiçoeira" do `modifiedSince`: `modifiedSince` = max `dataAlteracao` devolvendo `200 com totalRecords=1 e data VAZIO`. Medimos a fronteira: ela é **inclusiva e se comporta corretamente** — `modifiedSince` = max devolveu 200 com 4 registros. O `data` vazio que vocês viram era o colapso objeto/array acima, que por acaso apareceu numa consulta de borda. A boa notícia: não há quirk de borda a contornar, e a correção resolve o problema em todos os endpoints de uma vez.

## 2. Confirmações dos demais achados

**Achado 1 (corpo degradado indistinguível de vazio):** confirmado, incluindo o encerramento silencioso do generator. Vira sinal programático — detalhes na seção 4.

**Achado 2 (`hasMore` comparado como string):** confirmado, com perda de dados maior que a suposta. Os endpoints `/financeiros/receitas` e `/despesas` usam um contrato de paginação **totalmente diferente** — `hasMore` é booleano, `page` é número e 1-based:

```
{ "page": 1, "pageSize": 50, "total": 519004, "totalPages": 10381, "hasMore": true }
```

Medido: `financeiros.listarTodasReceitas()` emite **50 itens de 519.004** e encerra como se tivesse terminado.

`/precos/*` é um **terceiro** contrato — não tem bloco `pagination` nenhum, usa `pagina`/`numeroRegistros`/`temMaisRegistros` no topo. `precos.todosPorTabela()` também para em 50.

**Achado 4 (`total` não é censo):** confirmado. Em `/estoque/produtos`, página 0 devolve 422 linhas com `total:"50"` e `offset:0`; página 1 devolve 147 linhas com `offset:50`. A leitura mais coerente desses números é que `total`/`offset` contam **produtos** enquanto o array conta **linhas por local de estoque** — isso é interpretação nossa, não confirmação da API.

**Consequência para a guarda de vocês:** a heurística "censo exato múltiplo de 50 congela o espelho" não mapeia para esse endpoint — o tamanho de página em linhas não é 50 e nem é constante. Vale revisar se ela dispara como esperado ali.

## 3. Dois achados novos que podem afetar vocês

**`clientes.listarTodos()` pula os 50 primeiros clientes.** O paginador começa na página 1, mas o endpoint é 0-based. Medido: o primeiro item iterado é o primeiro item da página 1; a página 0 nunca é visitada. Afeta vocês apenas se usam esse método.

**`clientes.listar()` sem argumento devolvia a segunda página.** Não é só a varredura: o default do próprio método era `page: 1` num endpoint 0-based. Qualquer chamada sem parâmetro pulava os primeiros registros. Era o único método REST do SDK com esse default.

**O filtro incremental de clientes tem outro nome.** `clientes.listar` usa **`dataHoraAlteracao`**, não `modifiedSince`. Medimos: comportamento idêntico — exige `dd/MM/yyyy [HH:mm:ss]`, ISO devolve `400 ORA-01861`, e janela sem alteração responde `404 RESOURCE_NOT_FOUND`. Se o job de vocês filtra clientes por data, é esse o parâmetro, e valem as mesmas regras do `modifiedSince`.

**Três métodos devolviam só a primeira página, descartando paginação real.** `cadastros.listarUsuarios()`, `financeiros.listarContasBancarias()` e `produtos.volumes()`. Medido: `/usuarios` responde 50 itens com `hasMore: true` — ou seja, `listarUsuarios()` entregava 50 de N usuários e encerrava, calado. Corrigido na 1.5.0 sem mudar a assinatura: os métodos continuam devolvendo array, mas agora percorrem tudo.

**`modifiedSince` em ISO não funciona.** O JSDoc do SDK documenta "Data ISO", mas a API exige `dd/MM/yyyy [HH:mm:ss]`:

```
'2026-08-14T17:01:02'  → HTTP 400 (ORA-01861)
'14/08/2026 17:01:02'  → HTTP 200
```

Pelo handoff, vocês já usam o formato brasileiro. O aviso é para não regredirem seguindo a documentação.

## 4. O que vem, e em que ordem

**1.5.0 — sem breaking changes, sem migração**

Corrige objeto→array, os três contratos REST divergentes de paginação, o `startPage` de clientes, a iteração do paginador e o JSDoc do `modifiedSince`. Todos fazem o SDK devolver **mais** dado correto onde hoje devolve menos.

Inclui também a **detecção de resposta degradada** — mas apenas como sinal, sem mudar fluxo:

```ts
const r = await sankhya.produtos.listar();
if (r.degraded) { /* não confie nesta resposta */ }
```

Toda degradação também sai em `logger.error`.

Isso é deliberado: vocês adotam a detecção em produção, medem quantas vezes ela dispara com tráfego real e podem aposentar a heurística "múltiplo de 50" — tudo antes de qualquer mudança de fluxo de controle. E podem nos dizer se a detecção tem falso-positivo antes de ela virar exceção.

**2.0.0 — breaking**

`DegradedResponseError` passa a ser lançado por padrão. `onDegradedResponse: 'flag'` mantém o comportamento da 1.5.0 para quem precisar de mais tempo.

## 4b. Duas ressalvas que afetam vocês diretamente

**A sonda de saúde de vocês fica só com log na 1.5.0.** A detecção de degradação precisa de um lugar no retorno para expor a flag. `gateway.loadRecords` devolve `Record<string,string>[]` puro — não tem envelope. Enumeramos a superfície: 20 métodos devolvem envelope e podem carregar `degraded`; 11 devolvem array puro e 15 são geradores — nenhum desses 26 tem onde carregá-la.

Para os métodos de varredura (`listarTodos`, `listarTodasReceitas`, `consultarTodos`) vamos oferecer um callback opcional:

```ts
for await (const p of sankhya.produtos.listarTodos({ onDegraded: info => metrics.inc('sdk.degraded', info) })) { … }
```

Para `loadRecords`, na 1.5.0 o sinal é **apenas log estruturado**, capturável via `logger.custom`. Se a sonda de saúde de vocês depende de detectar degradação programaticamente, é o caminho a usar até a 2.0.0.

**`gateway.loadRecord` passa a lançar em corpo degradado na 2.0.0.** Hoje devolve `null`, indistinguível de "não encontrado". Se o código de vocês trata `null` como "não existe" e age em cima disso, revisem junto com o item da seção 5.

**Volume: a 1.5.0 destrava varreduras hoje truncadas.** Se vocês chamam `listarTodasReceitas()`, ela sai de 50 itens para 519.004 — 10.381 páginas. Um job que hoje termina em segundos passa a fazer dez mil requisições. É correção, mas planejem a capacidade antes de subir.

## 5. Item de risco na 2.0.0 — leiam antes de fazer upgrade

Vocês pediram que o 404 de janela vazia virasse resultado vazio legítimo. Faz sentido e vai ser feito, com guardas: só quando a requisição carregava `modifiedSince`, só quando o corpo traz `error.code: "RESOURCE_NOT_FOUND"` (distinguível de rota inexistente, que devolve `NOT_FOUND`), e só na primeira página da varredura.

**Mas essa é a única mudança do pacote que anda na direção perigosa: converte um erro em sucesso vazio.**

Hoje, toda vez que nada mudou, o SDK lança `ApiError` 404. Depois da 2.0.0, o mesmo cenário devolve lista vazia. **Se o caminho de "lista vazia" no job de vocês escrever no espelho, o incidente de 19/08 reabre — causado pela correção.**

A auditoria desse caminho é pré-requisito de upgrade, não pós.

## 6. Perguntas que precisamos de vocês

1. Usam `financeiros.listarTodasReceitas/Despesas`, `clientes.listarTodos()` ou `precos.todosPorTabela()`? (todos truncam ou pulam dados hoje)
2. O job trata `ApiError` 404 como "pula o tick" ou como "falha"?
3. O caminho de lista vazia escreve no espelho ou é no-op?
4. Conseguem rodar a 1.5.0 em staging com a flag `degraded` instrumentada antes da 2.0.0?

## 7. Fora de escopo, com motivo

`pedidos.consultar` com `modifiedSince` **não recebe** o mapeamento de 404. O sandbox recusa a chamada (`400 — Necessario habilitar o parametro 'LOGTABOPER'`), então não conseguimos medir o comportamento. Preferimos deixar lançando erro a mapear por analogia — mapear errado nessa direção é exatamente como se cria um apagamento silencioso.

Se vocês têm um ambiente com `LOGTABOPER` habilitado, uma medição de vocês destrava esse item.

---

# Apêndice — tudo que mudou de comportamento na 1.5.0

Esta lista existe para vocês auditarem o próprio código sem ler o CHANGELOG inteiro. Procurem por estas chamadas no repositório de vocês.

## A. Métodos que passam a devolver MAIS dados

Se o código de vocês assume a quantidade que recebia antes, revejam.

| Método | Antes | Depois |
|---|---|---|
| `cadastros.listarUsuarios()` | primeira página apenas (50 itens medidos, com `hasMore: true`) | todos os usuários |
| `financeiros.listarContasBancarias()` | primeira página apenas | todas as contas |
| `produtos.volumes(id)` | primeira página apenas | todos os volumes |
| `financeiros.listarTodasReceitas()` | 50 itens e encerrava | 519.004 registros — **10.381 páginas** |
| `financeiros.listarTodasDespesas()` | 50 itens e encerrava | 166.417 registros |
| `precos.todosPorTabela()` | 50 itens e encerrava | tabela inteira |
| `clientes.listarTodos()` | começava na página 1 | começa na página 0 — inclui os ~50 registros que faltavam |
| `clientes.listar()` sem argumento | devolvia a **segunda** página | devolve a primeira |
| Qualquer `listar*` cujo filtro case com **exatamente 1 registro** | lista vazia | o registro |

A última linha é a mais importante e a mais difícil de detectar: valia para **todos** os endpoints de lista, não só os citados acima.

## B. Métodos que passam a fazer MAIS requisições HTTP

Os mesmos das varreduras destravadas na tabela A. Um job que terminava em segundos pode passar a fazer milhares de chamadas.

Varreduras acima de **100 páginas** emitem `logger.warn` uma vez — usem isso para achar as que surpreendem.

## C. Métodos que ganharam parâmetro opcional `onDegraded`

Aditivo. Nada quebra se vocês não usarem. São os 15 métodos de varredura:

```
clientes.listarTodos          estoque.listarTodos           produtos.listarTodos
vendedores.listarTodos        pedidos.consultarTodos        precos.todosPorTabela
cadastros.listarTodosTiposOperacao       cadastros.listarTodasNaturezas
cadastros.listarTodosProjetos            cadastros.listarTodosCentrosResultado
cadastros.listarTodasEmpresas            financeiros.listarTodasReceitas
financeiros.listarTodosTiposPagamento    financeiros.listarTodasDespesas
financeiros.listarTodasMoedas
```

Uso:

```ts
for await (const p of sankhya.produtos.listarTodos({
  onDegraded: (info) => metrics.inc('sdk.degraded', { motivo: info.reason, pagina: info.page }),
})) { … }
```

## D. Superfície nova

| O quê | Onde | Observação |
|---|---|---|
| `degraded?: boolean` | em todo `PaginatedResult` | opcional no tipo, **sempre presente** no retorno do SDK |
| `onDegradedResponse?: 'flag'` | `SankhyaConfig` | só `'flag'` nesta versão; o default vira `'throw'` na 2.0.0 |
| `DegradedInfo` | tipo exportado | `reason` obrigatório; `expectedKey`, `receivedKeys`, `page` opcionais |
| `FinanceiroPagination`, `PrecosPagination`, `PaginationContract` | tipos exportados | documentam os contratos divergentes da API |

`RestPagination` **não** mudou — verificamos com `tsc` que alterá-la quebraria código de vocês.

## E. Documentação que estava errada

| Item | Dizia | É |
|---|---|---|
| `modifiedSince` | "Data ISO" | `dd/MM/yyyy [HH:mm:ss]`; ISO devolve `400 ORA-01861` |
| `dataHoraAlteracao` (clientes) | "Data ISO" | idem |
| `totalRecords` em `/estoque/produtos` | sem nota | conta **produtos**; o array conta **linhas por local** — página 0 devolve 422 linhas com `total: "50"` |
| `totalRecords` em `/financeiros/*` | sem nota | é censo real — a exceção; nos demais endpoints conta só a página |

Filtros de data são **inclusivos** (`>=`), e janela sem alteração devolve `404 RESOURCE_NOT_FOUND` — não lista vazia.

## F. O que NÃO mudou, e por quê

Registramos porque parecem inconsistências e não são:

- **`estoque.porProduto(id)`** continua devolvendo só o que a API manda. Medimos: `/estoque/produtos/{id}` genuinamente não traz bloco `pagination`. Não há o que paginar.
- **`precos.todosPorTabela` continua começando na página 1.** Medimos: `/precos/tabela/{t}?pagina=0` devolve HTTP 400. Esse endpoint é 1-based de verdade, ao contrário dos demais.
- **`pedidos.consultar` com `modifiedSince`** ficou sem tratamento de janela vazia. O sandbox recusa a chamada (`400 — Necessario habilitar o parametro 'LOGTABOPER'`), então não conseguimos medir. Preferimos deixar lançando erro a mapear por analogia. **Se vocês tiverem ambiente com `LOGTABOPER` habilitado, uma medição de vocês destrava esse item.**

## G. Checklist de upgrade

1. [ ] Subir para 1.5.0 em staging
2. [ ] Instrumentar `result.degraded` e/ou `onDegraded` nos jobs de espelho
3. [ ] Rodar um ciclo completo e medir quantas vezes a degradação dispara com tráfego real
4. [ ] Conferir capacidade dos jobs que usam as varreduras da tabela A
5. [ ] **Fazer resync completo** dos domínios espelhados — o bug do resultado único deixou registros defasados sem rastro em log
6. [ ] Aposentar heurísticas locais de detecção que existiam para contornar o problema
7. [ ] Antes da 2.0.0: auditar o caminho de "lista vazia" — ele passa a receber vazio onde hoje recebe `ApiError` 404

## H. Como chegamos a estes números

Nada aqui é inferência. Todos os valores foram medidos em 29/08/2026 contra o sandbox, em duas camadas independentes: sondas HTTP diretas contra a API, e um harness executando o SDK real. As afirmações sobre tipos foram provadas com `tsc` sobre fixtures de consumidor, e as afirmações sobre extensão de superfície vieram de enumeração scriptada, não de leitura.

O cenário do incidente de vocês — janela com exatamente 1 alteração — tem teste de integração próprio, executado contra o sandbox, que deriva a janela em tempo de execução em vez de usar data fixa.
