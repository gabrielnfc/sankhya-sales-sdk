# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.2.0] - 2026-06-25

### Added
- `sankhya.metadata.listFields(entityOrTable, options?)` — descobre as colunas reais de
  uma entidade Sankhya (incluindo campos personalizados `AD_*`) sem precisar saber a
  tabela fisica Oracle nem montar SQL contra `USER_TAB_COLUMNS`. Aceita nome logico da
  entidade (mapa curado: `CabecalhoNota` → `TGFCAB`, etc.) ou tabela fisica via passthrough.
  Suporta `{ customOnly: true }` para listar apenas campos `AD_*`. Resolve o Bug #5. (`MetadataResource`)

### Fixed
- Gateway `loadRecords`/`loadRecord`: `criteria.expression` agora vai no envelope
  `{ $: ... }` exigido pelo servidor — antes o filtro era ignorado silenciosamente
  e retornava as 50 primeiras linhas (Bug #1/#2).
- Aviso (`warn`) quando uma `criteria` e enviada mas a resposta volta com a pagina
  default cheia (`total=50, hasMoreResult=true`), sintoma de filtro nao aplicado (Bug #3).

### Packaging
- `examples/` e `docs/` referenciados no README agora sao publicados no pacote npm (Bug #4).

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
