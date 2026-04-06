# Technology Stack

**Analysis Date:** 2026-04-06

## Languages

**Primary:**
- TypeScript 5.8 - SDK implementation, type-safe API client
- JavaScript (generated) - Dual CJS/ESM output bundles

## Runtime

**Environment:**
- Node.js >= 20.0.0 - Required runtime

**Package Manager:**
- npm - Package management
- Lockfile: present (`package-lock.json`)

## Frameworks

**Core:**
- tsup 8.3.0 - Build bundler (ES modules + CommonJS dual format)
- Vitest 3.0.0 - Test framework and runner
- Biome 1.9.0 - Linter and formatter (replaces Prettier + ESLint)

**Testing:**
- Vitest 3.0.0 - Unit and integration test runner
- Vitest config: `vitest.config.ts` with test timeout 30s, node environment

**Build/Dev:**
- TypeScript 5.8 - Strict type checking (strict mode enabled)
- tsup - Zero-config bundler with sourcemaps, dual format output

## Key Dependencies

**Critical:**
- Native Fetch API - HTTP client (no axios/node-fetch dependency)
- Node.js native AbortController - Request cancellation/timeout handling

**Infrastructure:**
- URLSearchParams - URL query parameter building (native)
- JSON.stringify/parse - Serialization (native)

## Configuration

**Environment:**
- Loaded from `.env` file via `vitest.config.ts` environment loader
- Supports optional token cache provider injection (memory default)
- Custom logger support (console.log/warn/error default)

**Required env vars (from .env.example):**
- `SANKHYA_BASE_URL` - API base URL (e.g., https://api.sankhya.com.br)
- `SANKHYA_CLIENT_ID` - OAuth 2.0 client ID
- `SANKHYA_CLIENT_SECRET` - OAuth 2.0 client secret
- `SANKHYA_X_TOKEN` - Additional security token (Sankhya requirement)

**Build:**
- `tsconfig.json` - Strict TS config, ES2022 target, ESNext modules, bundler resolution
- `tsup.config.ts` - Dual format (ESM/CJS), sourcemaps, declaration files (.d.ts, .d.cts)
- `biome.json` - Line width 100, single quotes, trailing commas, no-explicit-any error

## Platform Requirements

**Development:**
- Node.js >= 20.0.0
- TypeScript 5.0+ (for consuming projects)
- npm or compatible package manager

**Production:**
- Node.js >= 20.0.0
- Zero runtime dependencies (fetch native since Node 18+)

## Exports Configuration

**Package Entry Points (package.json):**

```json
{
  "type": "module",
  "main": "./dist/index.cjs",
  "module": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "import": { "types": "./dist/index.d.ts", "default": "./dist/index.js" },
      "require": { "types": "./dist/index.d.cts", "default": "./dist/index.cjs" }
    }
  }
}
```

- ESM: `dist/index.js` (default in modern bundlers)
- CJS: `dist/index.cjs` (for CommonJS consumers)
- Types: `dist/index.d.ts` / `dist/index.d.cts` dual format

## Scripts

```bash
npm run build          # Build ESM + CJS with tsup
npm run dev           # Watch mode build
npm run test          # Run all tests (vitest run)
npm run test:watch    # Watch mode testing
npm run test:coverage # Coverage report
npm run lint          # Check code with Biome
npm run lint:fix      # Auto-fix with Biome
npm run typecheck     # Type check without emit (tsc --noEmit)
```

---

*Stack analysis: 2026-04-06*
