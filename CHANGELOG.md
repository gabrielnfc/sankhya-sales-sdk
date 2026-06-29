# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
