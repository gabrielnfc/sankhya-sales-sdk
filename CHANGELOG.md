# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.6.0] - 2026-09-11

> **Sobre o número da versão.** O texto abaixo descreve a entrega; **1.6.0 × 2.0.0 é decisão do dono na hora da tag** e o conteúdo vale para os dois. Há uma quebra de compatibilidade deliberada (a guarda de host), documentada em **BREAKING (segurança)** com o passo a passo de migração. Enquanto a tag não sai, `package.json` continua em `1.5.0`.
>
> Toda linha cita a medição de origem: `Mn` = fato medido no sandbox Sankhya (`docs/superpowers/specs/2026-09-05-diagnostico-separatrue-v3.md`, com os payloads brutos em `spike-raw/`), `RD-n` = ruling desta entrega, `D-n` = item de backlog.
>
> Por convenção deste repositório, nenhum documento escreve o host de produção por extenso: ele é a constante exportada `PRODUCTION_HOSTS` (`src/core/environment-guard.ts:22`).

### BREAKING (segurança)

- **`SankhyaClient` passou a ter allowlist de host, fail-closed (D3, REQ-SEC-3).** Até a 1.5.0 o cliente subia calado contra **qualquer** host, produção inclusive — um `.env` com o bloco de produção nas mesmas chaves do bloco de sandbox já apontou uma suíte inteira para produção sem um único aviso. Agora a decisão acontece no construtor, **antes** de `AuthManager`/`HttpClient` existirem, nesta ordem (`src/core/environment-guard.ts:81-112`):

  | Host | Sobe? |
  |---|---|
  | produção (qualquer host de `PRODUCTION_HOSTS`, e subdomínios) | **só com `allowProduction: true`**, e sai um `logger.warn` citando **só o host**. Nem `allowedHosts`, nem um subdomínio com `sandbox` no nome liberam produção — produção é avaliada primeiro |
  | host que contém `sandbox` (ex.: `api.sandbox.sankhya.com.br`) | sim, sem aviso e **sem precisar de `allowedHosts`** |
  | host declarado em `allowedHosts` (host exato, comparação case-insensitive, sem subdomínio implícito) | sim, sem aviso |
  | qualquer outro host, e `baseUrl` que não parseia como URL | **aborta** |

  Erros: `SankhyaError` com `code: 'PRODUCTION_BLOCKED'` para produção sem a flag, e `code: 'VALIDATION_ERROR'` para host fora da allowlist ou `baseUrl` inválida. Nenhuma mensagem ecoa a `baseUrl` crua — ela pode carregar `user:senha@`; o erro cita apenas o host.

  **Como migrar de 1.5:**

  ```ts
  // 1.5 — subia contra qualquer host, calado.
  // 1.6 — host de sandbox continua passando sozinho: nada a fazer.
  new SankhyaClient({ baseUrl: 'https://api.sandbox.sankhya.com.br', /* ... */ });

  // 1.6 — host que não é sandbox nem produção: declare-o.
  new SankhyaClient({
    baseUrl: 'https://erp.interno.example.local',
    allowedHosts: ['erp.interno.example.local'],
    /* ... */
  });

  // 1.6 — produção: decisão explícita de quem chama, e fica no log.
  new SankhyaClient({
    baseUrl: urlDeProducao,  // host que consta de PRODUCTION_HOSTS
    allowProduction: true,   // emite logger.warn citando só o host
    /* ... */
  });
  ```

  Uma trava de repo (`tests/security/allow-production-flag.test.ts`) reprova qualquer arquivo de `src/`, `tests/` ou `.github/` que ligue a flag — exceto a suíte do próprio guard.

- **`validateFaturarPedidoInput` passou a exigir INTEIRO** em `codigoPedido` e `codigoTipoOperacao` (antes: qualquer número finito) — `src/core/validators.ts:323-333`. É export público, então é aperto de contrato: `faturar({ codigoPedido: 1.5 })` agora lança `VALIDATION_ERROR` antes da rede. NUNOTA fracionário nunca existiu no ERP; o que existia era o SDK deixar `'1.5'` chegar ao payload (D-11). `requireNumber`, usado por outros validadores, **não** mudou.

- **`estoque.porLote`, `produtos.setTipoControle` e `produtos.volumesProduto` exigem dependências injetadas.** `EstoqueResource` e `ProdutosResource` passaram a aceitar um 2º parâmetro opcional de deps — `new EstoqueResource(http, { dbExplorer })`, `new ProdutosResource(http, { dataset, dbExplorer })` — que o `SankhyaClient` sempre injeta. **`new ProdutosResource(http)` continua válido** (é export público) e todos os métodos antigos seguem funcionando; só os três acima lançam `VALIDATION_ERROR` nomeando a dep faltante. Quem usa `sankhya.produtos` / `sankhya.estoque` não muda nada.

### Corrigido

- **`gateway.saveRecord` mandava os campos no lugar errado (M34).** O SDK enviava os valores direto em `dataSet.entity`; o formato que o ERP aceita põe chave e campos em `dataSet.dataRow.{key, localFields}`. `SaveRecordParams` ganhou `primaryKey?: Record<string,string>` — presente, vira `dataRow.key`; ausente, a chave é omitida. `primaryKey: {}` é **recusada** com `VALIDATION_ERROR`: omita para inserir. Nomes de campo fora de `[A-Za-z_][A-Za-z0-9_]*`, e `__proto__`/`constructor`/`prototype`, são recusados antes da rede.
- **`pedidos.incluirNotaGateway` não montava o payload do 4midware (M34/M46).** O corpo aceito leva `NUNOTA: {}` (objeto vazio, **não** `{ $: '' }`) no cabeçalho **e em cada item**, e `itens.INFORMARPRECO` como a STRING `'True'`/`'False'`, fora do serializador. Campos novos no input: `statusNota` (`'A' | 'L'` → `STATUSNOTA`), `numeroPedidoExterno` (→ `AD_NUMPEDIDO`), `informarPreco` (default `true`) e `camposExtras`. O NUNOTA de retorno é lido em `pk.NUNOTA.$` → `nota.NUNOTA.$` → raiz `NUNOTA`; ausente nos três, **lança** em vez de devolver `0`.
- **O item de `incluirNotaGateway` ia sem `PERCDESC` e sem `VLRTOT`, e o ERP recusava (D1.2b, 5ª execução do spike D4, 2026-09-11).** Sem o percentual, `CACSP.incluirNota` responde `O campo 'Perc. desconto' deve ser informado.` (`CORE_E03235`) — medido duas vezes, e a recusa **sobreviveu** a `PERCDESC` no cabeçalho: o campo é do **item**. O item aceito em 06/09 (`spike-raw/faturamento/ped.ts:6`, `S2_INCLUIR_P1.json`) tem 8 chaves, com `PERCDESC` e `VLRTOT`. Agora `ItemNotaGatewayInput` tem `percentualDesconto` (default **0**, faixa [0, 100]) e `valorTotal` (default `valorUnitario × quantidade` **calculado em centavos**). O arredondamento é deliberado: `1.01 × 3` em ponto flutuante serializa como `'3.0300000000000002'`, e 19,17% dos pares medidos (preço de 2 casas entre R$1 e R$500 × quantidade 1–20) passavam de 2 casas — e a reação do ERP a uma 17ª casa num campo de dinheiro é **desconhecida**. Implicações declaradas: meio centavo sobe (`0.005 × 1` → `'0.01'`), preço abaixo de meio centavo colapsa em `'0'`, e `VLRUNIT` vai cru — logo `VLRUNIT × QTDNEG` pode diferir do `VLRTOT` em até 1 centavo. Informe `valorTotal` quando precisar dos dois coerentes.
- **O cabeçalho tipado de `incluirNotaGateway` não basta na prática (D-14).** O SDK tipa **11** chaves de cabeçalho; o cabeçalho que o ERP aceitou em 2026-09-06 tem **29** (`spike-raw/faturamento/ped.ts:8`). A lane de integração mediu que pelo menos `CODNAT` é exigido (`CORE_E00899`, parâmetro `EXIGNATCFR` ligado; valor aceito medido `01010101`) — a premissa "mínimo = 11 chaves" foi **REFUTADA**, 2 de 2 chamadas recusadas. Use `camposExtras` para o resto do cabeçalho: é a passagem crua, serializada como qualquer outro campo. `camposExtras` **lança** se citar qualquer uma das 11 chaves tipadas (`NUNOTA`, `CODPARC`, `DTNEG`, `CODTIPOPER`, `CODTIPVENDA`, `CODVEND`, `CODEMP`, `TIPMOV`, `OBSERVACAO`, `STATUSNOTA`, `AD_NUMPEDIDO`) — inclusive quando o campo tipado correspondente foi omitido, para que nada seja contrabandeado em silêncio.
- **`pedidos.faturar` mandava um payload que o wizard recusa (M51/M49/M82).** Faltavam `notasComMoeda`, `serie` e `ehWizardFaturamento`; `nota` ia como objeto e o aceito é **array** de `{ $: '<NUNOTA>' }`; `faturarTodosItens` é a **string** `'true'`, não booleano. O corpo passou a ser montado por `buildFaturarWizardPayload` (`src/core/faturamento-payload.ts`), fonte única das **16 chaves** medidas em `spike-raw/faturamento/S2_FATURAR_1.json` + `attempts.ndjson` (`ok: true`, 06/09 12:03) — o que derrubou o D-10, que supunha 7 chaves sem medição. `faturarTodosItens: false` **lança antes da rede**: faturamento parcial não existe no wizard (M82, 0 de 4 formas geraram a 1101).
- **`produtos.volumesProduto` lê `TGFVOA` por SQL, não por Gateway (RD-7).** O REST `/produtos/{id}/volumes` devolve `[]` no sandbox mesmo com `TGFVOA` populado (M54), e `CRUDServiceProvider.loadRecords` com `rootEntity: 'VolumeProduto'` — que era **premissa, nunca medida** — devolveu `GatewayError: Erro interno (NPE)` nas 2 de 2 tentativas da lane (transactionId `B13E2C8D39AEA4CE10EAE94BCF73F6FC`), com 0 linhas e 0 colunas. O caminho é `dbExplorer.query` sobre `TGFVOA`, com `ORDER BY CODVOL`. Medido verde na lane em 2026-09-11: `CODPROD 13609` devolve `{ quantidade: 72, lastro: 12, camadas: 4 }`. Cadastro incompleto é o caso comum (M57: só 38,4% dos PA ativos com `QUANTIDADE > 1`), então `QUANTIDADE`/`LASTRO`/`CAMADAS` vazios viram **0** e produto sem volume devolve `[]` **sem lançar** — e `quantidade: 0` é indistinguível de "sem cadastro": a decisão é do consumidor (REQ-CNT-5, D-05). `CODPROD` vazio, não numérico ou `<= 0` **lança** `PARSE_ERROR`: `0` ali seria um produto inventado.
- **`dataset.save` não sabia ler a resposta real do `DatasetSP` (RD-8).** Cada linha de `result` vem com N células dos `fields` **mais uma célula final** `{"_rmd": {"provider": …, "<CAMPO>": {"decVlr": …}}}` — metadata de renderização para a tela do ERP, medida em `spike-raw/faturamento/S1_DS_ITENS_1813.json` e `S1_DS_ESTOQUE_DATAS.json` (06/09). Ela é **descartada** e `result` traz só as células dos campos. O reconhecimento é pela chave `_rmd` (objeto com exatamente essa chave), não pela posição: excedente de outra forma continua reprovando, porque resposta inesperada de fronteira externa não vira silêncio.

### Adicionado

- **`gateway.call<T>(modulo, serviceName, body, options?)`** — escape hatch para serviço do Gateway sem método dedicado. Devolve o `responseBody` cru, sem transformação, e **nunca** é retentado automaticamente.
- **`dbExplorer.query<T>(sql, options?)`** e `sankhya.dbExplorer` — consulta somente-leitura via `DbExplorerSP.executeQuery`. Recusa, **antes da rede**, tudo que não comece com `SELECT` e tudo que contenha `;` (o DbExplorer aceita mais de um comando por chamada). Casa `rows[i][j]` com `fieldsMetadata[j].name`; linha com número de colunas diferente lança `DB_EXPLORER_ROW_MISMATCH` em vez de devolver objeto parcial. Limites declarados (G9 — é guarda sintática, não parser de SQL): CTE (`WITH … SELECT`) e comentário antes do `SELECT` são recusados (falso negativo aceito), e `SELECT … FOR UPDATE` ou `SELECT f_com_efeito()` **não** são impedidos — e como o serviço está na allowlist de idempotentes, seriam reexecutados até 3×.
- **`dataset.save` / `dataset.removeRecord` / `dataset.load`**, `sankhya.dataset` e o helper **`datasetRecord(fields, { pk?, set })`** — escrita e leitura tipadas sobre o `DatasetSP` (M36/M88/M113). `values` é indexado pela **posição** em `fields`, não pelo nome: `datasetRecord` resolve o índice e lança citando o campo quando ele não está em `fields`, porque escrever o índice à mão gravaria no campo errado do ERP. Registro **sem** `pk` insere; **com** `pk` atualiza (M88). `removeRecord` tem guarda contra "apagar tudo" (R2/G3) verificada antes da rede: `pks` vazia é recusada, cada pk precisa de ao menos uma chave e **todo** valor precisa ser string não vazia — `{ NUNOTA: undefined }` chegaria ao servidor como `{}` (o `JSON.stringify` descarta o par) e apagaria a entidade inteira. `dataset.load` delega a `CRUDServiceProvider.loadRecords`, que é o caminho medido; não inventa um `DatasetSP.load`.
- **`notas.confirmar` / `notas.excluir` / `notas.cancelar`** e `sankhya.notas` (`CACSP`). `confirmar` é **idempotente** (M80): `A nota <n> já foi confirmada.` é sucesso equivalente e resolve `{ confirmada: true, jaEstavaConfirmada: true }` — a regex é ancorada nas duas pontas, para que `Erro ao gravar: A nota 1 ja foi confirmada. Verifique o estoque.` continue sendo erro. `excluir` usa o **único** formato aceito, `{"notas":{"nota":[{"NUNOTA":"<n>"}]}}` (M73) — para pedido 1001 confirmado, exclusão é o caminho real de desfazer, não `cancelarNota` (M73/M95). `cancelar` **prova o efeito por read-back em `TGFCAN`**, sempre: `CACSP.cancelarNota` devolve HTTP 200 cancelando zero notas (M75/M94), e a resposta é aninhada — `{"resultadoCancelamento":{"totalNotasCanceladas":"0",…}}` (`spike-raw/cancelamento/C5_CANCELARNOTA_1101_V7.json`); ler da raiz devolveria `undefined` para sempre. `confirmadoPorReadBack` é a única prova (I3).
- **`faturamento.faturar` / `faturamento.consultarVar`** e `sankhya.faturamento`. `faturar` só manda o comando com **`TGFVAR` vazio E `TGFCAB.PENDENTE = 'S'`**: os dois guards são necessários juntos porque a idempotência do faturamento é reversível — a 1101 pode ser excluída, e o flag volta (M81). A NUNOTA devolvida vem **sempre** de `TGFVAR`, nunca do HTTP 200. A recusa `O pedido <n> não esta pendente.` (M79) não decide sozinha: com linha em `TGFVAR` vira `JA_FATURADO`; **sem** linha lança `FATURAR_DESFECHO_INDETERMINADO`, porque "não sei" nunca vira sucesso.
- **`conferencia.*` (7 métodos)** e `sankhya.conferencia` — conferência nativa `TGFCON2`/`TGFCOI2` via `DatasetSP` (a REST v1 não tem endpoint de conferência): `carimbarSeparacao`, `abrir`, `bipar`, `fechar`, `apontarNaNota` (E1, M107), `reapontarOrigem` (E2, M108) e `listarPorNota`. `abrir` roda dois guards **antes** de qualquer escrita: carimbo (o gatilho `TRG_B_I_TGFCON2_TRUE` recusa o `INSERT` sem `AD_DTHRSEPARACAO` com `ORA-20101`, M76) e duplicata (o ERP **aceita** uma 2ª conferência para a mesma `NUNOTAORIG` e o `NUCONFATUAL` não migra — o "abrir só se não existir" é guard nosso, M110).
- **`estoque.porLote`** — as linhas de `TGFEST` de um produto, o saldo **por lote** que a REST v1 não expõe (`/estoque/produtos/{id}` agrega por local, sem `CONTROLE`). Sem `codEmp`/`codLocal` a leitura é **global**, que é a forma que a virada de lote exige (M103). Números têm parse estrito: coluna vazia ou não numérica lança em vez de virar `0` — `0` em `estoque`/`reservado` seria lido como "pode baixar".
- **`lotes.entrada1813` / `lotes.baixa1811`** e `sankhya.lotes`. `entrada1813` grava em ordem **obrigatória** — `CabecalhoNota` (TOP 1813) → `ItemNota` (`ATUALESTOQUE='1'`, com `CONTROLE`) → `Estoque` (`DTVAL`/`DTFABRICACAO`, PK de **6 colunas**) → `notas.confirmar`: confirmar antes das datas é recusado **com o estoque já movido** (M97). `baixa1811` usa a TOP **1811** porque a 1814, que seria a natural, é recusada com `TOP nao encontrada.` apesar de ativa (M100/M101) — a escolha da TOP de ajuste é decisão do dono/contabilidade e o impacto fiscal **não foi medido**. Reserva bloqueia a baixa (`DISPONÍVEL = ESTOQUE − RESERVADO`, M102) e o gatilho recusa o `save` inteiro. A nota de baixa **não** é confirmada: fica em `STATUSNOTA='A'` e é reversível por `CACSP.excluirNotas`.
- **`produtos.setTipoControle`** — vira `TGFPRO.TIPCONTEST` só depois de provar, por `SELECT` **global e independente** em `TGFEST` (sem filtro de empresa ou local — o gatilho `TRG_INC_UPD_TGFPRO` é global, M103), que `ESTOQUE = 0` **e** `RESERVADO = 0` em todas as linhas. O eco do `save` nunca é prova (I3). `SELECT` com **0 linhas prossegue**: a linha de `TGFEST` some quando zera (M91) e a virada medida em M104 aconteceu justamente com o read-back devolvendo `rows: []` (`spike-raw/virada/T05E_RB_EST_ZERO_GLOBAL.json`) — RD-6, que corrigiu a regra do plano. A **liberação** das reservas fica fora do SDK: é ordem de negócio sobre pedidos; aqui o SDK apenas recusa.
- **`classifyFailure(err)` e `SankhyaFailureKind`** — classificação de falha em 3 camadas: `AUTH_FAIL` (retry seguro) · `NEGOCIO` (o ERP entendeu e recusou — terminal) · `TIMEOUT` (desfecho desconhecido, decide por read-back). **HTTP 408 é `TIMEOUT`, retentável — nunca `NEGOCIO` terminal** (RD-3): é ambiguidade de transporte, o servidor pode ter executado. 429 e 5xx idem; o resto do 4xx é `NEGOCIO`, 409 incluso. Falha que não se sabe classificar entra em `TIMEOUT`: desconhecido nunca é terminal.
- **Guarda de ambiente exportada:** `assertAllowedHost`, `isAllowedHost`, `isProductionHost`, `SANDBOX_MARKER`, `PRODUCTION_HOSTS`, e `SankhyaConfig.allowProduction` / `SankhyaConfig.allowedHosts` — para quem precisa decidir antes de construir o cliente.
- **Escrita ambígua não vira estado terminal em silêncio (RD-4).** Escrita cujo desfecho é `TIMEOUT` dispara read-back obrigatório; sem read-back possível, o SDK lança um erro `*_DESFECHO_INDETERMINADO` em vez de inferir sucesso ou falha da mensagem: `notas.cancelar` → `CANCELAR_NOTA_DESFECHO_INDETERMINADO` / `CANCELAR_NOTA_READ_BACK_INDISPONIVEL`; `faturamento.faturar` → `FATURAR_DESFECHO_INDETERMINADO`.
- **Lane de integração WMS, opt-in duplo (D4).** `tests/integration/wms-sandbox.test.ts` exercita contra o **sandbox** o caminho do WMS (estoque → volume → pedido em `A` → item com `CONTROLE` → `consultarVar`). Exige credenciais **e** `SDK_INTEGRATION_WMS=1`, tem teto de **40** chamadas, marca tudo com o prefixo `SDK-T-`, faz teardown por id só em `STATUSNOTA='A'` e nunca roda em CI de PR. Fora do `npm test`.

### Corrigido na documentação

- `docs/api-reference/gateway-crud.md` documentava `saveRecord` mandando a PK dentro de `data` e um retorno `GatewayDataRow` lido como `row.fields.X`; o SDK usa `primaryKey` + `dataRow{key,localFields}` e devolve `Record<string,string>` plano. `loadRecord` citava o endpoint `CRUDServiceProvider.loadRecord`, que o código não chama — a chamada é `loadRecords` com `criteria`, e o retorno é `| null` (D-01).
- `docs/api-reference/pedidos.md` não tinha os campos novos de `incluirNotaGateway`, nem `NUNOTA`, `INFORMARPRECO`, `PERCDESC`/`VLRTOT` do item; documentava `confirmar` como `Promise<void>` (mudou na 1.4.0) e `dataFaturamento` como obrigatório (é opcional); e documentava `pedidos.simularImpostos()`, **método que não existe** em `src/resources/pedidos.ts`.
- Páginas novas: `db-explorer.md`, `dataset.md`, `notas.md`, `faturamento.md`, `conferencia.md`, `lotes.md`; `produtos.md`, `estoque.md`, `cliente-sdk.md` e `tipos.md` atualizados.
- **Host de produção saiu dos exemplos (D-07).** `docs/**` e `examples/README.md` mostravam o host de produção como `baseUrl` de exemplo — que, a partir desta versão, **aborta** sem `allowProduction`. Os exemplos passaram a usar o host de sandbox; produção só aparece onde ela é o assunto, sempre pela constante `PRODUCTION_HOSTS`, com a flag e o aviso.

### ⚠️ Impacto operacional

- **Cliente que hoje aponta para produção para de subir** até alguém escrever `allowProduction: true`. É deliberado: a decisão passa a ser explícita e visível no log. Rode o construtor uma vez em homologação antes de subir.
- **`INCOMPLETE_READ` não existe nesta versão.** RD-5 previu esse código para leitura paginada truncada em `volumesProduto`, mas a paginação desse método **deixou de existir** com RD-7 (SQL em vez de `loadRecords`) — `TGFVOA` tem no máximo 2 linhas por produto nos 513 PA do censo T0-3. Nenhum caminho do SDK emite esse código hoje: a única ocorrência em `src/` é um comentário em `src/resources/produtos.ts:423` dizendo justamente que ele não está lá.
- **Códigos de erro novos ficaram FORA da união tipada `SankhyaErrorCode`** (D-07/D-09), que continua com os 5 de sempre (`AUTH_ERROR`, `API_ERROR`, `GATEWAY_ERROR`, `TIMEOUT_ERROR`, `CIRCUIT_OPEN`). Em uso hoje, sempre no `code` de um `SankhyaError`: `VALIDATION_ERROR`, `PARSE_ERROR`, `NOT_FOUND`, `PRODUCTION_BLOCKED`, `DB_EXPLORER_ROW_MISMATCH`, `DATASET_SAVE_MALFORMED_RESPONSE`, `CANCELAR_NOTA_READ_BACK_INDISPONIVEL`, `CANCELAR_NOTA_DESFECHO_INDETERMINADO`, `FATURAR_DESFECHO_INDETERMINADO`, `FATURAR_VAR_INVALIDA`, `CONFERENCIA_SEM_CARIMBO`, `CONFERENCIA_DUPLICADA`, `CONFERENCIA_NUCONF_AUSENTE`, `CONFERENCIA_NUCONF_INVALIDO`, `LOTES_NUNOTA_AUSENTE`, `METADATA_INVALID_INPUT`, `METADATA_EMPTY`. **Não faça `switch` exaustivo sobre `SankhyaErrorCode` esperando cobrir tudo** — compare `err.code` como string. A consolidação da união está prevista e ainda não aconteceu.
- **Duas portas para `CACSP.confirmarNota` (D-09).** `pedidos.confirmar` (devolve o corpo com avisos/`liberacoes`, e "já confirmada" é erro) e `notas.confirmar` (idempotente, M80). As duas ficam nesta versão; a decisão de qual morre é posterior.
- **`camposExtras` é obrigatório na prática** para `incluirNotaGateway` contra uma base com `EXIGNATCFR` ligado (D-14). Use `spike-raw/faturamento/ped.ts:8` como cabeçalho de referência.


## [1.5.0] - 2026-08-29

### Corrigido

- **Resultado único era descartado.** A API devolve objeto em vez de array quando exatamente 1 registro corresponde ao filtro; o SDK procurava um array e devolvia lista vazia, informando `totalRecords: 1`. Atingia qualquer listagem filtrada até um único resultado — em sync incremental, o caso comum.
- **Varreduras dos endpoints financeiros paravam na primeira página.** `/financeiros/receitas` e `/despesas` usam `hasMore` booleano; a comparação era com a string `'true'`. `listarTodasReceitas()` entregava 50 de 519.004 registros.
- **Varreduras de preços paravam na primeira página.** Os endpoints `/precos/*` não têm bloco `pagination` — trazem `temMaisRegistros` na raiz do corpo, que era ignorado.
- **`clientes.listar()` e `clientes.listarTodos()` pulavam a primeira página.** O default era `page: 1` num endpoint 0-based.
- **Iteração dirigida pelo echo do servidor.** `createPaginator` derivava a próxima página do campo `page` da resposta; agora usa contador local.
- **`total: "0"` virava `undefined`** em `normalizeRestPagination` e em `deserializeRows`.
- **`cadastros.listarUsuarios()`, `financeiros.listarContasBancarias()` e `produtos.volumes()` devolviam só a primeira página.** Os endpoints paginam de verdade e o bloco `pagination` era descartado. Medido: `/usuarios` responde 50 itens com `hasMore: true`. As assinaturas não mudaram — os métodos agora percorrem todas as páginas internamente.

### Adicionado

- `PaginatedResult.degraded` — `true` quando a resposta não trouxe o formato declarado pelo endpoint. Sempre presente no retorno do SDK. Lista vazia legítima vem com `false`.
- `onDegraded` opcional nos métodos de varredura, para instrumentação.
- `SankhyaConfig.onDegradedResponse` — hoje só `'flag'`. O default passa a `'throw'` na 2.0.0.
- Tipos `FinanceiroPagination` e `PrecosPagination`, documentando os contratos divergentes.

### Corrigido na documentação

- `modifiedSince` e `dataHoraAlteracao` documentavam formato ISO. A API exige `dd/MM/yyyy [HH:mm:ss]`; ISO responde `400 ORA-01861`.
- `totalRecords` documentado por endpoint: é censo nos financeiros e contagem de página nos demais.

### ⚠️ Impacto operacional

As varreduras antes truncadas passam a percorrer o conjunto inteiro. `listarTodasReceitas()` sai de 50 itens para 519.004 — **10.381 páginas**. Um job que hoje termina em segundos passará a fazer dez mil requisições. É correção de perda de dados, não regressão, mas planeje capacidade antes de subir. Varreduras acima de 100 páginas emitem `logger.warn`.

Se seu código espelha dados via sync incremental, **faça um resync completo** após o upgrade: o bug do resultado único deixou registros desatualizados sem rastro em log.

## [1.4.0] - 2026-08-19

### Added

- `pedidos.confirmar()` passa a devolver `{ responseBody }` normalizado do
  Gateway (`CACSP.confirmarNota`): `avisos` e demais campos preservados como
  vieram; `liberacoes.liberacao` — objeto (uma pendência) ou array (várias),
  conforme o bridge XML→JSON — vira SEMPRE `liberacoes: ConfirmarPedidoLiberacao[]`.
  Corpo vazio/ausente ⇒ `responseBody` `undefined`. Motivação: `status "1"`
  pode carregar liberação de crédito pendente (evento 8 "Atraso", 44/1000
  "Análise de crédito") que era descartada — o consumidor via sucesso sem
  saber que a nota ficou `STATUSNOTA='A'` aguardando liberação.
- Tipos novos exportados: `ConfirmarPedidoResult`, `ConfirmarPedidoResponseBody`,
  `ConfirmarPedidoLiberacao`.

### Compatibility

- Retorno anterior era `Promise<void>`: quem ignora o resultado continua
  funcionando sem mudança. `status "0"` continua lançando `GatewayError`.

## [1.3.0] - 2026-07-22

Resiliência: correção de três falhas de desenho que transformavam degradação
transiente do servidor Sankhya em falha dura no cliente (diagnóstico TrueForce).
Escritas permanecem SEM retry automático, mas os **novos defaults mudam o
comportamento mesmo sem nenhuma config** — veja "Changed".

### Added
- `authRetry` em `SankhyaConfig`: retry da autenticação OAuth com backoff
  exponencial + jitter (default: 3 retries, base 500ms, fator 2, jitter ±50%)
  **apenas** para falhas transientes (timeout, erro de rede, 408/429/5xx).
  HTTP 400/401/403 (credencial/request inválida) falha imediatamente, sem
  retry — evita vetor de lockout.
- `circuitBreaker` em `SankhyaConfig`: `threshold` e `resetTimeoutMs`
  configuráveis + jitter na janela de reabertura (evita thundering herd).
- `CircuitOpenError` (estende `AuthError`, `code: 'CIRCUIT_OPEN'`, campo
  `retryAfterMs`) + guard `isCircuitOpenError`: diferencia "breaker local
  aberto" de "servidor rejeitou". `instanceof AuthError` continua `true`.
- Flag `idempotent` no retry HTTP: leituras do Gateway (`loadRecords`,
  `loadRecord`, `DbExplorerSP.executeQuery`, reads de cadastros) agora são
  retentadas em erro transiente (502/503/504/timeout/429), mesmo sendo POST
  no transporte. Retry por semântica da operação, não por método HTTP.
- Header `Retry-After` (segundos ou HTTP-date) respeitado no delay de retry,
  com teto de 60s.

### Changed
- **Sem nenhuma config, a autenticação agora retenta 3× por default** (antes
  da 1.3.0, falha transiente do OAuth falhava imediatamente). Pior caso de
  obtenção de token sob indisponibilidade total: ~2min (4 tentativas × timeout
  de 30s + backoff) antes do erro chegar ao caller.
  `authRetry: { maxRetries: 0 }` restaura o fail-fast pré-1.3.0.
- **O timeout de cada tentativa de auth agora segue `config.timeout`** (antes:
  30s fixos). Com `timeout: 5000`, cada tentativa de auth aborta em 5s.
- `isAuthError` agora também retorna `true` para `CircuitOpenError` (que
  estende `AuthError`) — cheque `isCircuitOpenError` **antes** de
  `isAuthError`. O tipo de `AuthError.code` foi ampliado para
  `'AUTH_ERROR' | 'CIRCUIT_OPEN'`.
- A janela de reabertura do circuit breaker ganha jitter aditivo de 0–20%
  (30s → 30–36s com defaults).

### Fixed
- `AuthManager.authenticate()`: timeout hardcoded de 30s substituído pelo
  `timeout` do client (30s continua default).
- Circuit breaker: cascata de refresh de 401 de UMA chamada de negócio conta
  como **1 falha**, não 3 — a falha de auth propaga e encerra a chamada (a
  cascata só continua após refresh com sucesso), então uma única chamada ruim
  não arma o breaker sozinha.
- Corpo da resposta do servidor OAuth não é mais incluído em mensagem/details
  de `AuthError` (podia ecoar credencial/token). Logs de retry registram
  apenas tentativa, status e delay.

### Security
- Escritas (criar/confirmar/cancelar/`saveRecord`/`faturar`) permanecem SEM
  retry automático — retry de write é risco de duplicação no ERP.

## [1.2.4] - 2026-06-30

### Docs
- README (pt + en) atualizado para os recursos do 1.2.3: pedido com nomes
  canonicos do financeiro (`tipoPagamento`/`valorParcela`) e datas ISO, secoes
  de campos personalizados `AD_*` (`camposExtras`/`camposAdicionais` +
  `metadata.listFields`) e de fluxo financeiro (consultar debito / registrar /
  baixar); tabela de modulos com a linha `metadata`.
- Nova pagina `docs/api-reference/metadata.md` (documenta `metadata.listFields` e
  o fluxo `AD_*` ponta a ponta).
- `examples/03-criar-pedido.ts` alinhado aos nomes canonicos + data ISO.

Apenas documentacao — sem mudanca de codigo. Publicado para refletir o novo
README na pagina do npm.

## [1.2.3] - 2026-06-29

Fechamento dos gaps de cobertura de vendas levantados na auditoria doc-oficial ×
SDK × testes (clientes, financeiros, catalogo). Contratos verificados na doc
OpenAPI **e** ao vivo no sandbox.

### Fixed
- **Baixa de financeiro (`baixarReceita`/`baixarDespesa`) usava URL e corpo errados.**
  O contrato oficial e `POST /financeiros/{receitas|despesas}/{codigoFinanceiro}/baixa`
  (id no **path**); o SDK enviava `codigoFinanceiro` no corpo num path sem id. Agora o
  id vai na URL e o corpo segue o contrato (`dataBaixa` + `valorJuro`/`valorMulta`/
  `valorDesconto`/`codigoContaBancaria`/`codigoTipoOperacao`/`observacao`). O retorno
  e desempacotado para `{ codigoFinanceiro }` (antes `{ sucesso }`, que nunca existiu).
- **Datas de financeiro eram enviadas em ISO e rejeitadas pelo servidor.**
  `registrar*`/`atualizar*`/`baixar*` convertem `dataNegociacao`/`dataVencimento`/
  `dataBaixa` para `dd/MM/yyyy` (formato exigido pelo Om — verificado ao vivo; a doc
  documenta ISO incorretamente).
- **`registrarReceita`/`registrarDespesa` nao expunham campos do contrato oficial.**
  Adicionados como opcionais: `codigoBanco`, `codigoContaBancaria`, `codigoCentroResultado`,
  `numeroNota`, `codigoProjeto`, `codigoMoeda`, `cheque`, `cartao`, `boleto`, `rateios`.
  O retorno passou a ser desempacotado (`retorno.codigoFinanceiro`).
- **`clientes.criar` so funcionava com `tipo` errado.** A API REST exige `'PF'`/`'PJ'`
  (enviar `'F'`/`'J'` resultava em `TIPPESSOA` nulo — verificado ao vivo). `tipo` agora
  aceita `'PF'`/`'PJ'` canonico e mapeia `'F'`/`'J'` legado. Alem disso `codigoCliente`
  (string na resposta) e coagido para `number` conforme o tipo prometia.
- **Volumes de produto usavam path inexistente.** `produtos.listarVolumes`/`buscarVolume`
  apontavam para `/produtos/volumes`; o path oficial e `/volumes-produtos`.

### Added
- **Campos personalizados `AD_*` em clientes e financeiros.** `CriarClienteInput`/
  `AtualizarClienteInput` ganharam `camposAdicionais` (objeto aninhado do contrato);
  `registrar*`/`atualizar*` de financeiro ganharam `camposExtras` (merge no payload).
  Fecha a paridade com `pedidos` (Issue #4 backlog de campos `AD_*`).
- Tipos novos: `TipoPessoaInput`, `ChequeFinanceiroInput`, `CartaoFinanceiroInput`,
  `BoletoFinanceiroInput`, `RateioFinanceiroInput`; validadores
  `validateBaixarFinanceiroInput`, `validateAtualizarClienteInput`, `validateContatoInput`.
- Validacao adicionada a `clientes.atualizar` e aos metodos de contato.

### Changed
- `BaixaResult` agora e `{ codigoFinanceiro: number }` (antes `{ sucesso: boolean }`,
  que nunca refletia a resposta real). `valorBaixa` passou a ser opcional na baixa.
- `tipo` de cliente: canonico `'PF'`/`'PJ'`; `'F'`/`'J'` aceitos como aliases legados.

### Tests
- Novo `tests/integration/v123-coverage.test.ts`: valida ao vivo `listarVolumes`
  (path oficial), `registrarReceita`, o round-trip de campo `AD_*` no pedido
  (`camposExtras` → readback) e a coercao de `codigoCliente`. Baixa, cancelamento e
  `cliente.atualizar` ficam best-effort (dependem de config do tenant — conta
  bancaria, `EXCLUIRPEDCONF`, cadastro de bairro).

## [1.2.2] - 2026-06-29

### Fixed
- **`pedidos.criar`/`pedidos.atualizar` não conseguiam criar um pedido pela API tipada.**
  O contrato oficial (`POST /vendas/pedidos`, conferido na doc OpenAPI e no sandbox ao
  vivo) exige no item os campos `controle` e `codigoLocalEstoque` — ausentes do tipo — e
  no financeiro os nomes `tipoPagamento`/`valorParcela`/`sequencia`, enquanto o SDK
  enviava `codigoTipoPagamento`/`valor`/`numeroParcela`. Ambos os níveis foram alinhados
  ao contrato e o payload passou a ser montado pelo SDK (datas, sequência e defaults),
  fechando o round-trip de criação que nunca havia passado (Issue #4).
- **`pedidos.confirmar` chamava um serviço inexistente nesta versão do Om.**
  `ServicosNfeSP.confirmarNota` retornava *"Método confirmarNota não encontrado"*; o
  serviço correto, verificado ao vivo (transição `STATUSNOTA` A → L), é
  `CACSP.confirmarNota`.
- **`criar`/`atualizar`/`cancelar` retornavam o envelope REST cru** em vez de
  `{ codigoPedido }`. A API responde `{ codigo, retorno: { codigoPedido } }` com o id
  (string) aninhado; agora é desempacotado e coagido para número. Bug mascarado pelos
  unit tests, que mockavam o shape já desempacotado.

### Added
- **Campos do contrato oficial agora tipados** em `ItemPedidoInput`/`FinanceiroPedidoInput`
  como opcionais: `controle` (default `' '` quando omitido), `codigoLocalEstoque`,
  `sequencia` (auto-preenchida 1, 2, 3…), `cfop`, `sequenciaItemOrigem`, `impostos`
  (IBS/CBS/ICMS via novo `ImpostoPedidoInput`), `dataBaixa`, `idTransacao`, `cheque`
  e `cartao` (novos `ChequePedidoInput`/`CartaoPedidoInput`). `unidade` passou a ser
  opcional (a API usa a unidade do produto quando omitida).
- **Escape hatch `camposExtras?: Record<string, unknown>`** em cabeçalho, item e
  financeiro — mescla campos `AD_*` e quaisquer atributos do dicionário de dados
  (ex.: `QTDNEG`, `DTVENC`) ou sobrescreve valores herdados do modelo de nota
  (`CODTIPOPER`, `CODEMP`, `CODNAT`), cobrindo customizações por empresa sem alterar o SDK.
- **Datas aceitas em ISO (`yyyy-MM-dd`)** em `data`/`dataVencimento`/`dataBaixa` e
  convertidas para o formato Sankhya `dd/MM/yyyy` via novo `toSankhyaDateMaybe`
  (sem deslocamento de fuso; repassa datas já no formato brasileiro).

### Changed
- Nomes canônicos do financeiro passam a ser `tipoPagamento`/`valorParcela`/`sequencia`.
  Os antigos `codigoTipoPagamento`/`valor`/`numeroParcela` continuam aceitos como
  **aliases depreciados** (sem quebra de compatibilidade).

### Tests
- Novo `tests/integration/pedido-roundtrip.test.ts`: cria + confirma um pedido REAL no
  sandbox e verifica a transição de status via Gateway (parametrizável por env para
  outros tenants). Fecha o ciclo de escrita que o Issue #4 provou estar quebrado.

## [1.2.1] - 2026-06-29

### Fixed
- **`buscar*` (GET-por-id) retornavam o envelope REST cru** em vez do objeto tipado.
  11 métodos — `produtos.buscarGrupo/buscarVolume`, `cadastros.buscarTipoOperacao/
  buscarNatureza/buscarProjeto/buscarCentroResultado/buscarEmpresa`, `estoque.buscarLocal`,
  `financeiros.buscarTipoPagamento/buscarMoeda/buscarContaBancaria` — devolviam
  `{ "<recurso>": { ...campos } }` (ex.: `{ grupos: {...} }`) apesar do tipo prometer
  o registro desempacotado. Agora desempacotam via `extractRestRecord` e lançam
  `SankhyaError('NOT_FOUND')` quando o registro não existe. Bug exposto por novos
  testes de integração ao vivo (os unit tests mascaravam com shape fabricado).

### Tests
- Novo `tests/integration/read-coverage.test.ts`: valida ao vivo os métodos de leitura
  que antes só tinham cobertura mockada (incl. `precos.contextualizado`, catálogo de
  produtos e todos os `buscar*`).
- Mocks dos `buscar*` aterrados no shape real do Sankhya (envelope `{ "<recurso>": {...} }`).

## [1.2.0] - 2026-06-25

### Added
- `sankhya.metadata.listFields(entityOrTable, options?)` — descobre as colunas reais de
  uma entidade Sankhya (incluindo campos personalizados `AD_*`) sem precisar saber a
  tabela fisica Oracle nem montar SQL contra `USER_TAB_COLUMNS`. Aceita nome logico da
  entidade (mapa curado: `CabecalhoNota` → `TGFCAB`, etc.) ou tabela fisica via passthrough.
  Suporta `{ customOnly: true }` para listar apenas campos `AD_*`. Consulta `USER_TAB_COLUMNS`
  com fallback para `ALL_TAB_COLUMNS` (cobre instalacoes multi-schema onde a tabela e
  alcancada via synonym/grant). Resolve o Bug #5. (`MetadataResource`)

### Fixed
- Gateway `loadRecords`/`loadRecord`: `criteria.expression` agora vai no envelope
  `{ $: ... }` exigido pelo servidor — antes o filtro era ignorado silenciosamente
  e retornava as 50 primeiras linhas (Bug #1/#2).

### Packaging
- Arquivos referenciados no README agora sao publicados no pacote npm: `examples/`,
  `docs/` (incluindo `docs/en/`, alvo de links em `docs/README-en.md`) e
  `CONTRIBUTING.md` — eliminando links quebrados no pacote instalado (Bug #4).

## [1.0.0] - 2026-04-07

### Added
- CI/CD pipeline with GitHub Actions (lint, typecheck, test, build on Node 20+22)
- Integration test workflow running against Sankhya sandbox on push to main
- Automated npm publish with OIDC provenance attestation on version tags
- GitHub Release with auto-extracted changelog notes
- Package validation with publint and @arethetypeswrong/cli

### Changed
- Package validated for npm publish (sideEffects, exports map, strict TypeScript)

## [0.1.0] - 2026-04-07

### Added
- `SankhyaClient` facade with lazy-loaded resource access
- OAuth 2.0 authentication with automatic token refresh and caching
- 10 resource modules: clientes, vendedores, produtos, precos, estoque, pedidos, financeiros, cadastros, fiscal, gateway
- 67 API operations (55 REST v1 + 12 Gateway)
- Typed error hierarchy: `SankhyaError`, `AuthError`, `ApiError`, `GatewayError`, `TimeoutError`
- Type guards: `isSankhyaError()`, `isAuthError()`, `isApiError()`, `isGatewayError()`, `isTimeoutError()`
- `SankhyaErrorCode` union type for exhaustive error code matching
- `AsyncGenerator` pagination via `listarTodos()` on all list resources
- Retry with exponential backoff and full jitter for transient failures
- Gateway serializer handling Sankhya `{$: value}` format including TAXAJURO edge case
- Dual ESM/CJS output with full TypeScript declarations (`.d.ts` + `.d.cts`)
- Per-call timeout override via `RequestOptions`
- Idempotency key support for pedidos and financeiros mutations
- Zero runtime dependencies (native fetch, Node 20+)

[Unreleased]: https://github.com/gabrielnfc/sankhya-sales-sdk/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/gabrielnfc/sankhya-sales-sdk/compare/v0.1.0...v1.0.0
[0.1.0]: https://github.com/gabrielnfc/sankhya-sales-sdk/releases/tag/v0.1.0
