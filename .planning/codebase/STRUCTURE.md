# Codebase Structure

**Analysis Date:** 2026-04-06

## Directory Layout

```
sankhya_kit/
├── src/                          # Source code
│   ├── client.ts                 # Main SankhyaClient class
│   ├── index.ts                  # Public API exports
│   ├── core/                     # Core infrastructure
│   │   ├── auth.ts               # OAuth 2.0 token management
│   │   ├── http.ts               # Unified HTTP client (REST + Gateway)
│   │   ├── errors.ts             # Error class hierarchy
│   │   ├── logger.ts             # Logging implementation
│   │   ├── pagination.ts         # Response normalization (REST)
│   │   ├── gateway-serializer.ts # Data transformation (Gateway)
│   │   ├── retry.ts              # Exponential backoff retry logic
│   │   └── date.ts               # Date formatting utilities
│   ├── resources/                # Domain-specific API operations
│   │   ├── index.ts              # Resource exports
│   │   ├── clientes.ts           # Client management (REST)
│   │   ├── vendedores.ts         # Salesperson operations (REST)
│   │   ├── produtos.ts           # Product catalog (REST)
│   │   ├── precos.ts             # Pricing queries (REST)
│   │   ├── estoque.ts            # Inventory operations (REST/Gateway)
│   │   ├── pedidos.ts            # Sales orders (REST + Gateway hybrid)
│   │   ├── financeiros.ts        # Financial data (REST)
│   │   ├── cadastros.ts          # Master data (REST)
│   │   ├── fiscal.ts             # Tax/fiscal operations (Gateway)
│   │   └── gateway.ts            # Low-level Gateway CRUD (Gateway)
│   └── types/                    # Complete type definitions
│       ├── index.ts              # Type exports
│       ├── auth.ts               # Auth response types
│       ├── config.ts             # Client configuration types
│       ├── common.ts             # Shared types (pagination, errors)
│       ├── clientes.ts           # Client domain types
│       ├── vendedores.ts         # Salesperson types
│       ├── produtos.ts           # Product types
│       ├── precos.ts             # Price types
│       ├── estoque.ts            # Inventory types
│       ├── pedidos.ts            # Order types
│       ├── financeiros.ts        # Financial types
│       ├── cadastros.ts          # Master data types
│       ├── fiscal.ts             # Fiscal types
│       └── gateway.ts            # Gateway protocol types
├── tests/                        # Test suite
│   ├── core/                     # Core layer unit tests
│   │   ├── auth.test.ts
│   │   ├── http.test.ts
│   │   ├── errors.test.ts
│   │   ├── logger.test.ts
│   │   ├── pagination.test.ts
│   │   ├── gateway-serializer.test.ts
│   │   ├── retry.test.ts
│   │   └── date.test.ts
│   └── integration/              # API integration and sandbox tests
│       ├── sandbox.test.ts       # Full API validation against sandbox
│       ├── resources.test.ts     # Resource method smoke tests
│       ├── curadoria.test.ts     # Initial curation run (all endpoints)
│       └── curadorio-v2.test.ts  # Iterative curation (new endpoints)
├── docs/                         # Documentation
│   ├── api-reference/            # Endpoint reference documentation
│   ├── guia/                     # Implementation guides
│   └── projeto/                  # Project planning documents
├── dist/                         # Compiled output (generated, not committed)
├── .planning/codebase/           # GSD codebase analysis documents
├── package.json                  # Dependencies and build scripts
├── tsconfig.json                 # TypeScript configuration
├── tsup.config.ts                # Build tool configuration
├── vitest.config.ts              # Test runner configuration
├── biome.json                    # Linting/formatting rules
└── .gitignore                    # Git exclusions
```

## Directory Purposes

**src/:**
- Purpose: All production TypeScript source code
- Contains: Client, resources, core utilities, complete type system
- Key files: `client.ts` (entry point), `index.ts` (public API)

**src/core/:**
- Purpose: Infrastructure and cross-cutting concerns
- Contains: HTTP transport, authentication, logging, error handling, pagination, serialization
- Key files: `http.ts` (request/response), `auth.ts` (token management), `errors.ts` (error types)

**src/resources/:**
- Purpose: Domain-specific API method implementations
- Contains: 10 resource classes (one per major domain)
- Key files: `clientes.ts` (most common), `pedidos.ts` (most complex, REST + Gateway hybrid)

**src/types/:**
- Purpose: Complete TypeScript type definitions
- Contains: Interfaces, types, enums for all API entities and operations
- Key files: `index.ts` (re-exports), `common.ts` (shared types like `PaginatedResult`)

**tests/core/:**
- Purpose: Unit tests for infrastructure layers
- Contains: 8 test files covering auth, HTTP, errors, logging, pagination, serialization, retry, date
- Key files: `http.test.ts` (largest), `gateway-serializer.test.ts` (complex data transformation)

**tests/integration/:**
- Purpose: End-to-end tests against actual sandbox environment
- Contains: API validation, resource smoke tests, endpoint coverage curation
- Key files: `sandbox.test.ts` (primary validation), `resources.test.ts` (all resource methods)

**docs/:**
- Purpose: Reference documentation and guides
- Contains: API endpoint reference, implementation guides, project architecture docs
- Structure: Organized by topic (api-reference, guia, projeto)

**dist/:**
- Purpose: Compiled JavaScript and TypeScript declaration files
- Generated: Yes (by tsup build process)
- Committed: No (in .gitignore)

**.planning/codebase/:**
- Purpose: GSD orchestrator documentation
- Contains: Architecture, structure, conventions, testing patterns, concerns
- Auto-generated: Yes (by `/gsd:map-codebase` command)

## Key File Locations

**Entry Points:**

- `src/index.ts`: Public SDK exports (client, resources, errors, utilities, types)
- `src/client.ts`: `SankhyaClient` main class and factory
- `package.json`: Script entry points (`main`, `exports`)

**Configuration:**

- `package.json`: Dependencies, build scripts, package metadata
- `tsconfig.json`: TypeScript compiler options
- `tsup.config.ts`: Build/bundling configuration
- `vitest.config.ts`: Test runner and coverage settings
- `biome.json`: Linting and formatting rules

**Core Logic:**

- `src/core/http.ts`: HTTP request/response handling for REST and Gateway
- `src/core/auth.ts`: OAuth 2.0 token management and caching
- `src/core/pagination.ts`: REST response normalization and async generators
- `src/core/gateway-serializer.ts`: Gateway protocol serialization/deserialization
- `src/core/errors.ts`: Error class definitions with error codes

**Testing:**

- `tests/core/`: Unit tests for infrastructure
- `tests/integration/`: Integration tests against sandbox
- `vitest.config.ts`: Test configuration

## Naming Conventions

**Files:**

- `*.ts`: TypeScript source files
- `*.test.ts`: Vitest unit tests (co-located with core layer)
- `*.ts` in resources: Classes named `[Domain]Resource` (e.g., `ClientesResource`)
- `*.ts` in types: Type definitions and interfaces (no class files)

**Directories:**

- `src/core/`: Single-purpose utilities (one concept per file)
- `src/resources/`: One resource class per domain (e.g., `clientes/`, `produtos/`)
- `src/types/`: One type file per domain matching resource name (e.g., `clientes.ts`, `produtos.ts`)
- `tests/`: Mirrored structure to source (e.g., `tests/core/http.test.ts` → `src/core/http.ts`)

**Classes:**

- `*Resource`: Resource classes (e.g., `ClientesResource`, `ProdutosResource`)
- `*Manager`: Core manager classes (e.g., `AuthManager`)
- `*Client`: HTTP transport (e.g., `HttpClient`)
- `*Error`: Error types (all extend `SankhyaError`)

**Functions:**

- `*normalize*`: Data normalization (e.g., `normalizeRestPagination()`)
- `*extract*`: Data extraction (e.g., `extractRestData()`)
- `*serialize*`: Data transformation (e.g., `serialize()`, `deserialize()`)
- `create*`: Factory functions (e.g., `createLogger()`, `createPaginator()`)
- `with*`: Higher-order functions (e.g., `withRetry()`)

**Types/Interfaces:**

- `*Input`: Input parameter types (e.g., `CriarClienteInput`, `ConsultarPedidosParams`)
- `*Result`: Response types (e.g., `PaginatedResult<T>`)
- `*Params`: Query/filter parameters (e.g., `ListarClientesParams`)
- `*Response`: API response types (e.g., `AuthResponse`, `RestResponse`)

**Enums/Constants:**

- `Tipo*`: Enumeration values (e.g., `TipoVendedor`, `TipoPessoa`)
- `Status*`: Status values (e.g., `StatusFinanceiro`)
- All-caps: Constants (e.g., `DEFAULT_MAX_RETRIES`, `RETRYABLE_STATUS_CODES`)

## Where to Add New Code

**New REST Endpoint:**

1. Create/update type file: `src/types/[domain].ts` — add request/response types
2. Create/update resource: `src/resources/[domain].ts` — add method to resource class
3. Add method tests: `tests/integration/resources.test.ts` — smoke test the new method
4. Export from: `src/index.ts` — if new type or resource added

**New Domain/Resource (e.g., "Clientes" doesn't exist yet):**

1. Create type file: `src/types/clientes.ts` — all types for the domain
2. Create resource class: `src/resources/clientes.ts` — implement `ClientesResource` class
3. Export resource: `src/resources/index.ts` — add to barrel export
4. Add to client: `src/client.ts` — add getter property and lazy initialization
5. Export from SDK: `src/index.ts` — add to public API
6. Create test file: `tests/integration/resources.test.ts` — add smoke tests
7. Update docs: `docs/api-reference/` — document new endpoints

**New Core Utility (e.g., new retry strategy):**

- Create file: `src/core/[utility].ts`
- Export: `src/index.ts` (if public API) or keep internal
- Test: `tests/core/[utility].test.ts`
- Example: `src/core/retry.ts` exports `withRetry()` public utility

**New Error Type:**

- Add to: `src/core/errors.ts` — create class extending `SankhyaError`
- Export: `src/index.ts` — add to public API exports
- Type code: Use constant like `override readonly code = 'MY_ERROR' as const`

**New Type Definition:**

- Create/update: `src/types/[domain].ts`
- If used across domains: Add to `src/types/common.ts`
- Export: `src/types/index.ts` — add to public API barrel

## Special Directories

**dist/:**
- Purpose: Compiled output from tsup build
- Generated: Yes (run `npm run build`)
- Committed: No
- Contents: `index.js`, `index.d.ts`, and esm/cjs splits

**tests/integration/:**
- Purpose: Live API testing against sandbox environment
- Generated: No (hand-written)
- Committed: Yes
- Environment: Requires `.env` file with Sankhya credentials
- Note: Tests marked with `.skip` or commented out during development

**docs/:**
- Purpose: Reference documentation (API reference, guides, architecture)
- Generated: Partially (some auto-generated from code comments)
- Committed: Yes
- Maintenance: Updated by humans as API knowledge evolves

**.planning/codebase/:**
- Purpose: GSD orchestrator analysis documents
- Generated: Yes (by `/gsd:map-codebase` command)
- Committed: Yes
- Files: ARCHITECTURE.md, STRUCTURE.md, CONVENTIONS.md, TESTING.md, CONCERNS.md (if applicable)

---

*Structure analysis: 2026-04-06*
