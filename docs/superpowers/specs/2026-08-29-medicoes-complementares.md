# Medições complementares — lacunas do §10 (2026-08-29-paginacao-degradada-design.md)

Sondas HTTP diretas contra o sandbox configurado em `.env` do repositório, executadas em
2026-08-29. Somente leitura (GET), exceto a chamada ao Gateway `loadRecords`, que é
semanticamente uma leitura (POST no transporte, sem efeito colateral — mesmo padrão já
usado pelo SDK em `gatewayCall(..., idempotent=true)`). Nenhuma escrita foi feita.

Script: salvo no diretório de scratchpad da sessão (fora do repo, não versionado —
conteúdo reproduzido nas notas de cada seção abaixo, com uma correção de formato na
Lacuna 3 documentada ali). Saída bruta capturada em arquivo `.txt` no mesmo diretório
durante a execução.

**Contexto operacional:** o sandbox é compartilhado com um worker de staging (app de força
de vendas em desenvolvimento) que também faz apenas leitura. Por isso a sonda usa retry (até
3 tentativas, backoff 1s/2s/4s) para status transientes (429/502/503/504) e um intervalo de
150ms entre chamadas. Nenhuma tentativa desta execução precisou de retry — não houve status
transiente em nenhuma chamada.

**Convenção de honestidade:** toda célula marcada `NÃO MEDIDO` significa que a sonda não
produziu uma resposta 200 utilizável para aquele call site específico — nunca que o valor foi
inferido de um endpoint parecido.

---

## Lacuna 1 e 5 — classificação dos call sites sem paginação + chave de sub-recursos

Entrada literal da Task 3: para cada call site que usa `extractRestData` sem repassar o bloco
`pagination`, o trio `resourceKey` / `contract` / `expectPagination`.

| Call site | Path | resourceKey | contract | expectPagination | Evidência |
|---|---|---|---|---|---|
| `produtos.componentes` | `/produtos/{id}/componentes` | **NÃO MEDIDO** | **NÃO MEDIDO** | **NÃO MEDIDO** | Testado com produto `10398` e mais 8 códigos da primeira página de `/produtos` (`10439, 10799, 10412, 10266, 10404, 10615, 10235`). Todos os 9 devolveram `HTTP 404 RESOURCE_NOT_FOUND` — `"Nenhum registro da entidade ItemComposicaoProduto com o identificador informado!"`. O sandbox aparenta não ter nenhum produto com composição de kit cadastrada. Isso bate com `tests/integration/read-coverage.test.ts:80-84`, que já trata esse endpoint como "sandbox sem dado" (skip em `ApiError`/`GatewayError`). Não há como medir a forma do 200 sem um produto-kit real. |
| `produtos.alternativos` | `/produtos/{id}/alternativos` | **NÃO MEDIDO** | **NÃO MEDIDO** | **NÃO MEDIDO** | Mesmos 9 produtos testados. Todos `HTTP 404 RESOURCE_NOT_FOUND` — `"Nenhum registro da entidade ProdutoAlternativo com o identificador informado!"`. Mesma situação de `produtos.componentes`: sandbox sem produto com alternativos cadastrados. |
| `produtos.volumes` (método real; design doc chama de `volumesDoProduto`, mas o nome em `src/resources/produtos.ts:100` é `volumes`) | `/produtos/{id}/volumes` | `volumesProduto` | `rest` | **true** | `GET /produtos/10398/volumes` → HTTP 200, chaves `["volumesProduto","pagination"]`, `temPagination=true`. **O endpoint devolve um bloco `pagination` real que o call site (`produtos.ts:100-105`) descarta hoje** — a suposição do §10 estava errada para este endpoint: não é "legitimamente sem pagination", é paginação sendo jogada fora. |
| `estoque.porProduto` | `/estoque/produtos/{id}` | `estoque` | `rest` | **false** | `GET /estoque/produtos/10398` → HTTP 200, chaves `["estoque"]`, array em `estoque`, `temPagination=false`. Confirma a suposição do §10: este endpoint legitimamente não tem bloco `pagination`. |
| `cadastros.listarUsuarios` | `/usuarios` | `usuarios` | `rest` | **true** | `GET /usuarios?page=0` → HTTP 200, chaves `["usuarios","pagination"]`, `temPagination=true`. **Mesmo caso de `produtos.volumes`: o endpoint pagina de verdade e o call site (`cadastros.ts:210-213`) descarta o bloco.** A tabela §3.2 já listava "usuarios" como contrato REST padrão medido — aqui está confirmado que o *call site* que ignora paginação é esse mesmo endpoint, não um endpoint de sub-recurso à parte. |
| `financeiros.listarContasBancarias` | `/financeiros/contas-bancaria` | `data` | `rest` | **true** | `GET /financeiros/contas-bancaria?page=0` → HTTP 200, chaves `["data","pagination"]`, `temPagination=true`. Mesmo padrão: endpoint pagina, call site (`financeiros.ts:369-372`) descarta. |
| `precos.contextualizado` | `/precos/contextualizado` | **NÃO MEDIDO** | **NÃO MEDIDO** | **NÃO MEDIDO** | Este endpoint usa `POST` com corpo de negociação (`input: PrecoContextualizadoInput`) — não é um `GET` simples e a sonda do brief não inclui uma chamada para ele. Não inventei uma sonda de escrita para fechar esta lacuna (regra: só leitura verificável sem efeito colateral, e a natureza exata do endpoint — cálculo vs. persistência — não foi confirmada). **Nota importante:** o brief inclui `GET /precos/produto/10398` na mesma lista (`SUB`), mas esse é o endpoint de `precos.porProduto` — um call site *diferente*, que já destrutura `pagination` no código (`precos.ts:53`) e não faz parte desta lacuna. Medi esse endpoint porque a sonda pedia (ver resultado abaixo), mas **não usei o resultado para preencher a linha de `contextualizado`** — seria exatamente o preenchimento por analogia que este documento existe para evitar. |

**Resultado observado de `/precos/produto/10398?pagina=1` (não é `contextualizado`, registrado à parte para não ser confundido):** HTTP 200, chaves `["codigo","pagina","numeroRegistros","temMaisRegistros","tipo","mensagem","produtos"]`, array em `produtos`, sem bloco `pagination` (contrato "Preços" do §3.2, consistente com o que já era esperado para esse call site).

**Lacuna 5, item adicional (`pedidos.consultar`):** `GET /vendas/pedidos?page=0&codigoEmpresa=1` → HTTP 200, chaves `["pedido","pagination"]` (chave singular `pedido`, não `pedidos`), `temPagination=true`. `pedidos.ts:71` já destrutura `pagination` normalmente — não é um call site degradado, mas a chave real (`pedido`) ficava sem documentação explícita. Fechado.

---

## Lacuna 2 — base de página dos endpoints REST não sondados

Comparação de `page=0` vs. `page=1`. Uma base 0-based mostra dados diferentes e válidos nas
duas páginas (evidência direta e forte). Quando `page=1` estoura o dataset (HTTP 404 por
esgotamento, não por índice inválido), a base fica com evidência mais fraca: só se confirma
que `page=0` é um índice válido — que responde com dados reais, não um erro — o que já
descarta o padrão 1-based (que rejeita a página fora do intervalo do lado baixo, como
`precos.tabela` faz com `pagina=0 → HTTP 400`, fato já medido antes desta task).

| Endpoint | `page=0` (1º item) | `page=1` (1º item) | Base | Força da evidência |
|---|---|---|---|---|
| `/grupos-produto` | `codigoGrupoProduto=0` "\<SEM GRUPO\>" | `codigoGrupoProduto=101070300` "COLÁGENO" | **0-based** | Forte — dados distintos nas duas páginas |
| `/vendedores` | `codigoVendedor=0` "\<SEM VENDEDOR\>" | `codigoVendedor=66` "BEATRIZ DAMACENA" | **0-based** | Forte |
| `/tipos-operacao` | `codigoTipoOperacao=1418` | `codigoTipoOperacao=1900` | **0-based** | Forte |
| `/naturezas` | `codigoNatureza=1010000` | `codigoNatureza=1050101` | **0-based** | Forte |
| `/centros-resultado` | `codigoCentroResultado=0` "\<SEM CENTRO DE RESULTADO\>" | `codigoCentroResultado=106001` "ESTOQUE B2B" | **0-based** | Forte |
| `/usuarios` | `codigoUsuario=1` "COTACAOB2B" | `codigoUsuario=80` "ALEX CARVALHO" | **0-based** | Forte |
| `/estoque/produtos` | `codigoProduto=10398` | `codigoProduto=10040` | **0-based** | Forte |
| `/empresas` | `codigoEmpresa=1` (dataset ~4 registros, §3.5) | `HTTP 404 RESOURCE_NOT_FOUND` (Empresa) | **0-based** | Fraca — `page=1` estoura o dataset; `page=0` responde com dados válidos (não é rejeitado como `precos` rejeita `pagina=0`) |
| `/estoque/locais` | `codigoLocal=0` "\<SEM LOCAL\>" (dataset ~48, §3.5) | `HTTP 404 RESOURCE_NOT_FOUND` (Local) | **0-based** | Fraca — mesmo padrão acima |
| `/volumes-produtos` | `codigoVolume="ML"` "MILILITRO" | `HTTP 404 RESOURCE_NOT_FOUND` (Volume) | **0-based** | Fraca — mesmo padrão acima |
| `/financeiros/moedas` | `codigoMoeda=1` "Dólar" (dataset ~8, §3.5) | `HTTP 404 RESOURCE_NOT_FOUND` (Moeda) | **0-based** | Fraca — mesmo padrão acima |
| `/financeiros/tipos-pagamento` | `codigoTipoPagamento=2` "DINHEIRO" | `codigoTipoPagamento=233` "ELO CREDITO 3X T.E.F" | **0-based** | Forte |
| `/financeiros/receitas` | `codigoFinanceiro=-866265`, mesma `dataNego...` | idêntico ao de `page=0` | **Não é REST padrão** — reconfirma §3.2: contrato Financeiros ignora o parâmetro de página ou faz echo fixo. Não é uma nova medição de base, é reprodução do achado já registrado. | — |

**Fechamento da lacuna:** 12 dos 13 endpoints sondados no brief têm base 0-based (7 com
evidência forte, 4 com evidência mais fraca por dataset pequeno — mas ainda assim uma medição
real, não inferência). `/financeiros/receitas` confirma o comportamento já descrito em §3.2 e
não é um novo dado. **Endpoints REST padrão fora desta sonda** (`projetos`,
`financeiros/despesas`, `financeiros/contas-bancaria` — a base especificamente, não a
chave/pagination já medida na Lacuna 1) **continuam sem base confirmada por medição direta**;
não foram incluídos no brief e não os testei por conta própria para não extrapolar o escopo
pedido.

---

## Lacuna 3 — contrato Gateway (`loadRecords`)

**Rota usada:** `POST {BASE}/gateway/v1/mge/service.sbr?serviceName=CRUDServiceProvider.loadRecords&outputType=json`.
Confirmada contra `src/core/http.ts` (`gatewayCall`, que monta `/gateway/v1/${modulo}/service.sbr`)
e `src/resources/gateway.ts` / `src/resources/cadastros.ts`, que chamam `loadRecords` com
`modulo='mge'`. A rota do brief já batia.

**Correção necessária no corpo da sonda:** o brief usava
`criteria: { expression: 'this.CODPARC = ?', parameters: [{ $: '1' }] }` — um formato de
parâmetros posicionais que **não é o formato real usado pelo SDK**. `src/resources/gateway.ts:88`
(`loadRecord`) e `:44` (`loadRecords`) mostram que o SDK sempre envia
`criteria: { expression: { $: '<expressão SQL já com o valor interpolado>' } }`, sem array de
`parameters` separado. Rodando a sonda como estava no brief, os dois cenários (`CODPARC=1` e
`CODPARC=-999999999`) devolveram **a mesma resposta idêntica** (top 50 registros de Parceiro,
sem filtro nenhum) — evidência de que o critério mal-formado foi silenciosamente ignorado pelo
servidor. Corrigi a sonda para `criteria: { expression: { $: "this.CODPARC = '1'" } }` (mesmo
padrão de `gateway.ts`) antes de registrar qualquer medição.

| Cenário | Critério | HTTP | `entities.total` | `hasMoreResult` | `entities.entity` | Observação |
|---|---|---|---|---|---|---|
| Resultado único | `this.CODPARC = '1'` | 200 | `"1"` | `"false"` | **objeto único** `{"f0":{"$":"1"},"f1":{"$":"TRUE BRANDS DISTRIBUIDORA DE PRODUTOS SAUDAVEIS S.A."}}` — não é array | Confirma o colapso objeto/array também no Gateway, análogo ao §3.1 do REST. **`deserializeRows` (`src/core/gateway-serializer.ts:117`) já trata isso**: `const entityArray = Array.isArray(rawEntities) ? rawEntities : [rawEntities];`. A resposta real bate com o que o código já assume — não há bug aqui, o guard existente cobre o caso medido. |
| Resultado vazio | `this.CODPARC = '-999999999'` | 200 | `"0"` | `"false"` | **chave `entity` ausente** (só `total`, `hasMoreResult`, `offsetPage`, `offset`, `metadata`) | Confirma que a 3ª saída silenciosa do §3.6 (`entities` presente, `entity` ausente, sem `logger.warn`) é **alcançável de fato via uma query real**, não só uma leitura teórica do código. `deserializeRows` retorna `rows: [], totalRecords: 0, hasMore: false` — correto, porque `total` também é `"0"`: não há degradação aqui, o resultado vazio é genuinamente vazio. |

**Fechamento da lacuna:** as duas saídas relevantes de §3.6 que dependiam de confirmação contra
o servidor real (colapso objeto único, e `entity` ausente com `entities` presente) foram
reproduzidas e batem com o que o código já trata. A 1ª saída do §3.6 (`responseBody`
ausente/inválido) e a 2ª (`entities` ausente) não foram re-testadas aqui — são caminhos de
erro de transporte/protocolo mais difíceis de provocar deliberadamente sem literalmente quebrar
a chamada, e o §3.6 já as classifica como tratadas com aviso (`logger.warn`), o que não estava
em disputa.

---

## Lacuna 4 — `pedidos.consultar` + `modifiedSince`

**Não medido nesta task — fora de escopo por decisão já tomada antes desta medição.** O
brief resolve explicitamente essa ambiguidade: "o filtro `modifiedSince` de pedidos... é
intestável neste sandbox (`LOGTABOPER` desabilitado) e continua fora de escopo." Nenhuma
sonda nova foi tentada para este item; a linha `/vendas/pedidos` do brief testa apenas a
chave de resposta (Lacuna 5), sem o parâmetro `modifiedSince`. Continua bloqueado pelo
sandbox, como já registrado em §3.4 do spec original.

---

## Lacuna 6 — deriva entre descritor e endpoint

Não é uma lacuna de **medição**: é uma recomendação de estrutura de código (um `const` de
descritores por módulo de resource, junto do path). Não há sonda HTTP que meça isso — é
uma decisão de implementação que a Task de código correspondente deve seguir. Sem ação
nesta task.

---

## Resumo

| Lacuna | Status | Nota |
|---|---|---|
| 1 — classificação dos call sites sem paginação | **Parcialmente fechada** | 4 de 7 call sites medidos (`volumes`, `estoque.porProduto`, `listarUsuarios`, `listarContasBancarias` — todos com resultado real, 3 deles revelando descarte de paginação real). `componentes` e `alternativos` ficam **NÃO MEDIDO** por ausência de dado no sandbox (9 produtos testados, todos 404). `contextualizado` fica **NÃO MEDIDO** por exigir POST com corpo de negociação, fora da sonda do brief. |
| 2 — base de página REST | **Fechada para os 13 endpoints sondados** | 12 confirmam 0-based (7 fortes, 4 fracas por dataset pequeno); 1 (`financeiros/receitas`) reconfirma o contrato Financeiros já descrito em §3.2. Endpoints REST padrão fora desta lista (`projetos`, `financeiros/despesas`, base de `financeiros/contas-bancaria`) continuam sem medição direta. |
| 3 — contrato Gateway | **Fechada** | Colapso objeto único e saída silenciosa "entity ausente" confirmados contra o servidor real; ambos já cobertos pelo código atual. |
| 4 — `pedidos.consultar` + `modifiedSince` | **Continua aberta** | Bloqueada pelo sandbox (`LOGTABOPER`), decisão já tomada, nenhuma tentativa nova. |
| 5 — chave de sub-recursos | **Parcialmente fechada** | Mesma tabela da Lacuna 1: `volumes`→`volumesProduto`, `estoque.porProduto`→`estoque`, `pedidos.consultar`→`pedido` (singular) confirmados. `componentes`/`alternativos` seguem sem chave conhecida — não medido. |
| 6 — deriva descritor/endpoint | **Não aplicável a medição** | É orientação de implementação, não um fato a apurar em sandbox. |
