# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.0.0-preview] - 2026-04-07

### Planned
- Package validation with publint and @arethetypeswrong/cli
- CI/CD pipeline with GitHub Actions
- npm publish with provenance attestation
- GitHub Release with auto-generated notes

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

[Unreleased]: https://github.com/gabrielnfc/sankhya-sales-sdk/compare/v1.0.0-preview...HEAD
[1.0.0-preview]: https://github.com/gabrielnfc/sankhya-sales-sdk/compare/v0.1.0...v1.0.0-preview
[0.1.0]: https://github.com/gabrielnfc/sankhya-sales-sdk/releases/tag/v0.1.0
