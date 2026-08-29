# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
