# Phase 6: Documentation - Research

**Researched:** 2026-04-07
**Domain:** TypeScript SDK documentation (TSDoc, TypeDoc, README, examples, changelog)
**Confidence:** HIGH

## Summary

Phase 6 transforms sankhya-sales-sdk from a technically complete SDK into a developer-friendly package. The codebase already has a solid README with quick-start and module table, plus 21 hand-written markdown docs in `docs/`. However, TSDoc coverage is minimal (only ~20 JSDoc comments across ~30 source files), no TypeDoc generation exists, no `examples/` directory exists, and no CHANGELOG.md exists.

The work divides into: (1) adding TSDoc comments to all public exports (~79 types, ~75 public methods, 10 resource classes, 5 error classes, 7 enums, client class), (2) configuring TypeDoc 0.28.18 for HTML API reference generation, (3) polishing the README quick-start to be completable in under 5 minutes, (4) ensuring the error handling guide covers all 5 error classes with copy-pasteable examples, (5) creating runnable `examples/` scripts, and (6) creating CHANGELOG.md.

**Primary recommendation:** TSDoc annotation is the bulk of the work. Use TypeDoc 0.28.18 (compatible with TypeScript 5.8.x). Structure examples as standalone `.ts` files that can run with `npx tsx` against the sandbox.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DOCS-01 | README with quick-start (< 5 min for first call) including auth, install, example | README already exists with good structure; needs polish for 5-min completability and env var setup clarity |
| DOCS-02 | TSDoc on all public methods and types | Currently ~20 JSDoc comments across 30+ files; needs ~150+ TSDoc annotations on exports in index.ts |
| DOCS-03 | TypeDoc generating navigable API reference | TypeDoc 0.28.18 supports TS 5.8; configure as devDep with `npm run docs` script |
| DOCS-04 | Error handling guide showing try/catch with each error class | `docs/guia/tratamento-erros.md` already exists and covers all 5 classes; needs type guard examples added |
| DOCS-05 | Working code examples in `examples/` for each major resource | `examples/` dir does not exist; create standalone scripts using env vars |
| DOCS-06 | CHANGELOG.md with Keep a Changelog format | No CHANGELOG.md exists; create with v0.1.0 and v1.0.0-preview entries |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

- **Zero deps**: TypeDoc is devDependency only -- must NOT appear in runtime dependencies
- **Biome**: All new `.ts` files must pass `biome check` (single quotes, 100 char width, no explicit any)
- **ES module imports**: Always use `.js` extension in imports
- **Comments convention**: JSDoc `/** */` format, document "why" not "what", public API + type signatures
- **Function naming**: Portuguese method names (`listar`, `criar`, `atualizar`), English infra names
- **Node 20+**: Examples must use native fetch, no polyfills

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| typedoc | 0.28.18 | API reference generation from TSDoc | De facto standard for TypeScript API docs; supports TS 5.8.x peer dep |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| tsx | latest | Run TypeScript examples without compilation | Running `examples/*.ts` directly; devDep only |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| TypeDoc | api-extractor + api-documenter | Microsoft toolchain, more complex setup, better for monorepos -- overkill for single-package SDK |
| tsx for examples | ts-node | tsx is faster (esbuild-based), zero-config, better ESM support |

**Installation:**
```bash
npm install -D typedoc@^0.28.18 tsx
```

**Version verification:** TypeDoc 0.28.18 confirmed on npm registry (2026-04-07). Peer dep: `typescript 5.8.x` -- compatible with project's `^5.8.0`.

## Architecture Patterns

### TSDoc Coverage Strategy

**Files requiring TSDoc (by priority):**

1. **Client entry** (`src/client.ts`): Class doc, constructor, 10 getter properties, `authenticate()`, `invalidateToken()`
2. **Resource classes** (`src/resources/*.ts`): ~75 public methods across 10 classes -- each needs `@param`, `@returns`, `@throws`, `@example`
3. **Error classes** (`src/core/errors.ts`): 5 classes + 5 type guards + 1 union type -- already partially documented
4. **Type definitions** (`src/types/*.ts`): ~79 exported types/interfaces/enums -- each needs a one-line `/** description */`
5. **Core utilities** (exported via index): Only document what appears in public API

**TSDoc format to use:**
```typescript
/**
 * Lista clientes paginados.
 *
 * @param params - Filtros e paginacao (opcional)
 * @returns Resultado paginado com array de clientes
 * @throws {ApiError} Quando a API retorna erro HTTP (4xx/5xx)
 * @throws {AuthError} Quando as credenciais sao invalidas
 *
 * @example
 * ```typescript
 * const result = await sankhya.clientes.listar({ page: 0 });
 * console.log(result.data[0].nome);
 * ```
 */
async listar(params?: ListarClientesParams): Promise<PaginatedResult<Cliente>> {
```

### TypeDoc Configuration

Create `typedoc.json` at project root:
```json
{
  "entryPoints": ["src/index.ts"],
  "out": "docs/api",
  "plugin": [],
  "name": "sankhya-sales-sdk",
  "readme": "none",
  "excludePrivate": true,
  "excludeInternal": true,
  "excludeExternals": true,
  "categorizeByGroup": true,
  "navigationLinks": {
    "GitHub": "https://github.com/gabrielnfc/sankhya-sales-sdk",
    "npm": "https://www.npmjs.com/package/sankhya-sales-sdk"
  }
}
```

Key settings:
- `entryPoints: ["src/index.ts"]` -- generates docs only for public API (barrel file)
- `excludeInternal: true` -- respects `@internal` JSDoc tags already on private methods
- `excludePrivate: true` -- hides `private` members
- `out: "docs/api"` -- generated HTML goes alongside existing hand-written docs

### Package.json Script

```json
{
  "scripts": {
    "docs": "typedoc"
  }
}
```

### Examples Directory Structure

```
examples/
  01-quick-start.ts        # Install + config + first call
  02-listar-produtos.ts    # Pagination with listarTodos
  03-criar-pedido.ts       # Full order flow
  04-error-handling.ts     # Try/catch with all error types
  05-gateway-generico.ts   # Raw Gateway CRUD
  README.md                # How to run examples
```

Each example file pattern:
```typescript
/**
 * Example: Quick Start
 * Run: SANKHYA_BASE_URL=... npx tsx examples/01-quick-start.ts
 */
import { SankhyaClient } from 'sankhya-sales-sdk';

const sankhya = new SankhyaClient({
  baseUrl: process.env.SANKHYA_BASE_URL!,
  clientId: process.env.SANKHYA_CLIENT_ID!,
  clientSecret: process.env.SANKHYA_CLIENT_SECRET!,
  xToken: process.env.SANKHYA_X_TOKEN!,
});

// ... actual API call
```

### CHANGELOG Format (Keep a Changelog)

```markdown
# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.0] - 2026-04-07

### Added
- SankhyaClient with OAuth 2.0 authentication
- 10 resource modules: clientes, vendedores, produtos, precos, estoque, pedidos, financeiros, cadastros, fiscal, gateway
- ...
```

### Anti-Patterns to Avoid
- **TSDoc on private members**: Waste of effort -- TypeDoc excludes them, IDE tooltips irrelevant
- **Duplicate docs**: Do NOT replicate the hand-written `docs/guia/` content into TSDoc -- keep TSDoc concise, link to guides
- **Generated docs in git**: Add `docs/api/` to `.gitignore` -- regenerate on demand
- **Examples that need editing**: Every example must work with just env vars set -- no hardcoded IDs

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| API reference HTML | Manual HTML/MD reference | TypeDoc 0.28 | Auto-links types, stays in sync with code |
| TSDoc validation | Manual review | TypeDoc warnings + `--treatWarningsAsErrors` | Catches missing/broken references |
| Example runner | Custom script | `npx tsx examples/XX.ts` | Zero config, ESM-native, reads .env |

## Common Pitfalls

### Pitfall 1: TypeDoc entryPoints misconfiguration
**What goes wrong:** TypeDoc generates docs for internal modules, or misses exports
**Why it happens:** Using `src/**/*.ts` instead of barrel file, or barrel file has missing re-exports
**How to avoid:** Use `entryPoints: ["src/index.ts"]` which is the single public API barrel
**Warning signs:** Internal classes like `HttpClient` or `AuthManager` appearing in generated docs

### Pitfall 2: TSDoc @example blocks breaking Biome
**What goes wrong:** Code inside TSDoc `@example` blocks may trigger Biome linting errors
**Why it happens:** Biome can parse JSDoc code blocks and flag style issues
**How to avoid:** Ensure example code inside TSDoc follows Biome conventions (single quotes, etc.)
**Warning signs:** `biome check` failures after adding TSDoc

### Pitfall 3: TypeDoc with bundler moduleResolution
**What goes wrong:** TypeDoc fails to resolve `.js` imports in source files
**Why it happens:** Project uses `moduleResolution: "bundler"` and `.js` extensions in imports
**How to avoid:** TypeDoc 0.28 handles this correctly -- just ensure tsconfig.json is the one TypeDoc reads
**Warning signs:** "Could not find module" warnings during generation

### Pitfall 4: Examples with hardcoded sandbox data
**What goes wrong:** Examples fail when run against different Sankhya instances
**Why it happens:** Hardcoding codigoEmpresa=1 or specific product IDs
**How to avoid:** Use discovery patterns (listar first, then use first result) or accept env vars for IDs
**Warning signs:** Examples that work only against one specific sandbox

### Pitfall 5: Generated docs directory bloating npm package
**What goes wrong:** `docs/api/` HTML gets included in `npm pack`
**Why it happens:** `docs/` is not in files exclude
**How to avoid:** package.json `files: ["dist"]` already limits this -- verify it stays that way
**Warning signs:** `npm pack --dry-run` showing doc files

## Code Examples

### TypeDoc configuration (typedoc.json)
```json
{
  "$schema": "https://typedoc.org/schema.json",
  "entryPoints": ["src/index.ts"],
  "out": "docs/api",
  "name": "sankhya-sales-sdk",
  "readme": "none",
  "excludePrivate": true,
  "excludeInternal": true,
  "categorizeByGroup": true
}
```

### TSDoc for resource class
```typescript
/**
 * Operacoes de clientes e contatos no Sankhya ERP.
 *
 * Acesse via `sankhya.clientes`.
 *
 * @example
 * ```typescript
 * const result = await sankhya.clientes.listar({ page: 0 });
 * ```
 */
export class ClientesResource {
```

### TSDoc for type with field descriptions
```typescript
/**
 * Configuracao do cliente SDK.
 *
 * @example
 * ```typescript
 * const config: SankhyaConfig = {
 *   baseUrl: 'https://api.sankhya.com.br',
 *   clientId: 'your-client-id',
 *   clientSecret: 'your-client-secret',
 *   xToken: 'your-x-token',
 * };
 * ```
 */
export interface SankhyaConfig {
  /** URL base da API Sankhya (ex: 'https://api.sankhya.com.br') */
  baseUrl: string;
  /** Client ID do OAuth 2.0 */
  clientId: string;
  // ...
}
```

### Keep a Changelog entry
```markdown
## [0.1.0] - 2026-04-07

### Added
- `SankhyaClient` facade with lazy-loaded resource access
- OAuth 2.0 authentication with automatic token refresh and caching
- 10 resource modules covering 67 API operations
- Typed error hierarchy: `AuthError`, `ApiError`, `GatewayError`, `TimeoutError`
- Type guards: `isSankhyaError()`, `isAuthError()`, `isApiError()`, `isGatewayError()`, `isTimeoutError()`
- `AsyncGenerator` pagination via `listarTodos()` on all list resources
- Retry with exponential backoff and jitter for transient failures
- Gateway serializer handling Sankhya `{$: value}` format
- Dual ESM/CJS output with full TypeScript declarations
- Per-call timeout and idempotency key support
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| TypeDoc 0.27 | TypeDoc 0.28 | 2025-Q3 | ESM-native, better TS 5.x support, new config schema |
| Manual API docs | TypeDoc from TSDoc | Standard | Auto-generated, always in sync |
| JSDoc `@typedef` | TSDoc `@param`/`@returns` | TypeScript era | IDE integration, type-aware |

## Open Questions

1. **README language**
   - What we know: Current README is in Portuguese, referencing a `README.en.md` that may not exist
   - What's unclear: Whether to maintain dual language or consolidate
   - Recommendation: Keep Portuguese as primary (target audience is Brazilian Sankhya developers), verify if README.en.md exists and decide

2. **Existing hand-written docs vs TypeDoc**
   - What we know: 21 markdown files exist in `docs/` with detailed guides
   - What's unclear: Whether TypeDoc output should replace or coexist
   - Recommendation: Coexist -- `docs/api/` for TypeDoc HTML, `docs/guia/` and `docs/api-reference/` stay as hand-written markdown. Update README links.

3. **docs/api/ in .gitignore**
   - What we know: Generated HTML should not be committed
   - What's unclear: Whether to serve via GitHub Pages
   - Recommendation: Add `docs/api/` to `.gitignore`, defer GitHub Pages to CI/CD phase (Phase 8)

## Existing Assets Inventory

| Asset | Status | Action Needed |
|-------|--------|---------------|
| `README.md` | Exists, good structure | Polish quick-start for 5-min target, verify all links work |
| `docs/guia/tratamento-erros.md` | Exists, covers all 5 errors | Add type guard examples (`isApiError()` etc.) |
| `docs/guia/inicio-rapido.md` | Exists | Verify against current API surface |
| `docs/guia/autenticacao.md` | Exists | Verify OAuth flow matches implementation |
| `docs/guia/paginacao.md` | Exists | Verify listarTodos pattern documented |
| `docs/guia/fluxo-venda-completo.md` | Exists | Verify matches pedidos resource methods |
| `docs/api-reference/*.md` | 13 files | Verify method signatures match implementation |
| `docs/projeto/` | 3 files | Low priority -- internal docs |
| `CHANGELOG.md` | Missing | Create from scratch |
| `examples/` | Missing | Create from scratch |
| TSDoc comments | ~20 total | Need ~150+ more |

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 3.0.0 |
| Config file | `vitest.config.ts` |
| Quick run command | `npx vitest run tests/api-surface.test.ts` |
| Full suite command | `npx vitest run` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DOCS-01 | README quick-start completeness | manual | N/A -- human reads and follows | N/A |
| DOCS-02 | TSDoc on all public exports | smoke | `npx typedoc --treatWarningsAsErrors` | Wave 0 |
| DOCS-03 | TypeDoc generates navigable HTML | smoke | `npm run docs && test -d docs/api` | Wave 0 |
| DOCS-04 | Error handling guide covers all 5 classes | manual | N/A -- review guide content | N/A |
| DOCS-05 | Examples run against sandbox | integration | `npx tsx examples/01-quick-start.ts` | Wave 0 |
| DOCS-06 | CHANGELOG exists with correct format | smoke | `test -f CHANGELOG.md` | Wave 0 |

### Sampling Rate
- **Per task commit:** `npx typedoc --treatWarningsAsErrors` (catches broken TSDoc)
- **Per wave merge:** `npx vitest run` (full test suite still green)
- **Phase gate:** TypeDoc generates without errors + all examples runnable

### Wave 0 Gaps
- [ ] `typedoc.json` -- TypeDoc configuration file
- [ ] `npm run docs` script in package.json
- [ ] `typedoc` devDependency installation
- [ ] `docs/api/` in `.gitignore`

## Sources

### Primary (HIGH confidence)
- npm registry: `typedoc@0.28.18` version and peer deps verified
- Project source: `src/index.ts` exports inventory, `src/core/errors.ts` error hierarchy
- Existing docs: `docs/` directory with 21 markdown files

### Secondary (MEDIUM confidence)
- [TypeDoc configuration docs](https://typedoc.org/documents/Options.Configuration.html)
- [Keep a Changelog format](https://keepachangelog.com/en/1.1.0/)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - TypeDoc version verified against npm, peer deps confirmed
- Architecture: HIGH - Based on direct codebase analysis of 30+ source files
- Pitfalls: MEDIUM - Based on common TypeDoc issues with ESM/bundler projects

**Research date:** 2026-04-07
**Valid until:** 2026-05-07 (stable domain, TypeDoc releases are infrequent)
