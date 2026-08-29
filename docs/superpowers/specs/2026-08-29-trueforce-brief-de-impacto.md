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

**Achado 4 (`total` não é censo):** confirmado, com explicação. Em `/estoque/produtos`, `total` e `offset` contam **produtos**, enquanto o array contém **linhas por local de estoque**. Página 0 devolve 422 linhas com `total:"50"`; página 1 devolve 147 linhas com `offset:50`.

**Consequência para a guarda de vocês:** a heurística "censo exato múltiplo de 50 congela o espelho" não mapeia para esse endpoint — o tamanho de página em linhas não é 50 e nem é constante. Vale revisar se ela dispara como esperado ali.

## 3. Dois achados novos que podem afetar vocês

**`clientes.listarTodos()` pula os 50 primeiros clientes.** O paginador começa na página 1, mas o endpoint é 0-based. Medido: o primeiro item iterado é o primeiro item da página 1; a página 0 nunca é visitada. Afeta vocês apenas se usam esse método.

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
