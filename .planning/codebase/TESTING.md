# Testing Patterns

**Analysis Date:** 2026-04-06

## Test Framework

**Runner:**
- Vitest 3.0.0
- Config: `vitest.config.ts`
- Node environment

**Assertion Library:**
- Vitest built-in (uses `expect` from Vitest)
- Matchers: `expect().toBe()`, `expect().toEqual()`, `expect().toHaveBeenCalled()`, `expect().toBeInstanceOf()`, `expect().toBeTypeOf()`

**Run Commands:**
```bash
npm test              # Run all tests once
npm run test:watch   # Watch mode (re-run on file changes)
npm run test:coverage # Generate coverage report
```

**Test Configuration:**
- Globals enabled: `globals: true` (no need to import `describe`, `it`, `expect`)
- Test timeout: 30 seconds (`testTimeout: 30_000`)
- Test files: `tests/**/*.test.ts`
- Environment variables: loaded from `.env` via custom `loadEnv()` function in vitest config

## Test File Organization

**Location:**
- Co-located with source: no — tests in separate `tests/` directory
- Structure mirrors `src/` — `tests/core/`, `tests/integration/`, etc.

**Naming:**
- Pattern: `{module}.test.ts`
- Examples: `logger.test.ts`, `errors.test.ts`, `http.test.ts`, `pagination.test.ts`

**Structure:**
```
tests/
├── core/              # Unit tests for core modules
│   ├── auth.test.ts
│   ├── date.test.ts
│   ├── errors.test.ts
│   ├── gateway-serializer.test.ts
│   ├── http.test.ts
│   ├── logger.test.ts
│   ├── pagination.test.ts
│   └── retry.test.ts
└── integration/       # Integration and sandbox tests
    ├── curadorio.test.ts
    ├── curadorio-v2.test.ts
    ├── paths-validation.test.ts
    ├── resources.test.ts
    └── sandbox.test.ts
```

## Test Structure

**Suite Organization:**
```typescript
import { describe, expect, it, beforeAll, beforeEach, afterEach, vi } from 'vitest';

describe('ModuleName', () => {
  // Setup
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('methodName', () => {
    it('should do something specific', () => {
      // Arrange
      const input = { /* ... */ };

      // Act
      const result = doSomething(input);

      // Assert
      expect(result).toBe(expected);
    });
  });
});
```

**Patterns:**
- Nested `describe()` blocks by method — group related tests by functionality
- Setup functions: `beforeEach()` for shared setup, `beforeAll()` for expensive one-time setup
- Cleanup: `afterEach()` for cleanup (restore mocks, clear spies)
- Each test is isolated — mocks cleared between tests with `vi.clearAllMocks()`

**Example from `tests/core/logger.test.ts`:**
```typescript
describe('createLogger', () => {
  it('deve retornar logger padrão com level warn', () => {
    const logger = createLogger();
    expect(logger.debug).toBeTypeOf('function');
    expect(logger.info).toBeTypeOf('function');
    expect(logger.warn).toBeTypeOf('function');
    expect(logger.error).toBeTypeOf('function');
  });

  it('deve logar warn e error no nível warn (padrão)', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    
    const logger = createLogger();
    logger.warn('test');
    logger.error('test');

    expect(warnSpy).toHaveBeenCalledOnce();
    expect(errorSpy).toHaveBeenCalledOnce();

    warnSpy.mockRestore();
    errorSpy.mockRestore();
  });
});
```

## Mocking

**Framework:** Vitest's built-in `vi` module

**Patterns:**
- Spy on modules: `vi.spyOn(module, 'method').mockImplementation(() => {})`
- Mock return value: `.mockResolvedValue(value)` for Promises, `.mockReturnValue(value)` for sync
- Clear mocks: `vi.clearAllMocks()` in `beforeEach()`
- Restore: `.mockRestore()` after test

**Example from `tests/core/http.test.ts`:**
```typescript
const mockLogger: Logger = {
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
};

function createMockAuth() {
  return {
    getToken: vi.fn().mockResolvedValue('test-token'),
    invalidateToken: vi.fn().mockResolvedValue(undefined),
  } as unknown as AuthManager;
}

// In test:
globalThis.fetch = vi.fn().mockResolvedValue({
  ok: true,
  status: 200,
  json: () => Promise.resolve(responseData),
});

const result = await client.restGet('/clientes');
expect(result).toEqual(responseData);

const call = vi.mocked(globalThis.fetch).mock.calls[0];
expect(call[0]).toContain('/v1/clientes');
expect(call[1]?.headers).toEqual(
  expect.objectContaining({
    Authorization: 'Bearer test-token',
    'X-Token': 'x-token',
  }),
);
```

**What to Mock:**
- External APIs (HTTP calls via `fetch`)
- Console methods when testing logging
- Time-dependent functions (use Vitest timers if needed)
- Dependencies passed as parameters

**What NOT to Mock:**
- Internal error classes — test actual behavior
- Type/interface structures — import actual types
- Pure utility functions — test actual implementation
- Data transformations — verify real output

## Fixtures and Factories

**Test Data:**
```typescript
// Mock implementations as needed
function createMockAuth() {
  return {
    getToken: vi.fn().mockResolvedValue('test-token'),
    invalidateToken: vi.fn().mockResolvedValue(undefined),
  } as unknown as AuthManager;
}

function createHttpClient(auth?: AuthManager, timeout = 30000) {
  return new HttpClient(
    'https://api.sankhya.com.br',
    'x-token',
    timeout,
    mockLogger,
    auth ?? createMockAuth(),
  );
}
```

**Location:**
- Factory functions defined in test files themselves — no separate fixtures directory
- Reusable setup functions grouped near the top of test files
- Consistent naming: `createMock{Type}()`, `create{Type}()`

**Example from `tests/integration/resources.test.ts`:**
```typescript
const config = {
  baseUrl: process.env.SANKHYA_BASE_URL ?? '',
  clientId: process.env.SANKHYA_CLIENT_ID ?? '',
  clientSecret: process.env.SANKHYA_CLIENT_SECRET ?? '',
  xToken: process.env.SANKHYA_X_TOKEN ?? '',
  timeout: 30_000,
  logger: { level: 'silent' as const },
};

const has = config.baseUrl && config.clientId && config.clientSecret && config.xToken;

describe.skipIf(!has)('Resources — Validação contra Sandbox', () => {
  let sankhya: SankhyaClient;

  beforeAll(async () => {
    sankhya = new SankhyaClient(config);
    await sankhya.authenticate();
  });

  it('clientes.listar()', async () => {
    const result = await sankhya.clientes.listar({ page: 1 });
    expect(result.data.length).toBeGreaterThan(0);
    expect(typeof result.hasMore).toBe('boolean');
  });
});
```

## Coverage

**Requirements:** Not enforced (no coverage threshold in config)

**View Coverage:**
```bash
npm run test:coverage
```

**Current Status:**
- Core utilities: high coverage (errors, logger, pagination, retry, auth all tested)
- Resource layer: integration tested via sandbox
- Gaps: No explicit unit tests for individual Resource methods (tested via integration)

## Test Types

**Unit Tests:**
- Scope: Individual functions and classes
- Location: `tests/core/*.test.ts`
- Approach: Mock dependencies, test pure behavior
- Examples: `logger.test.ts`, `errors.test.ts`, `pagination.test.ts`, `retry.test.ts`
- Count: ~75 tests in core/

**Integration Tests:**
- Scope: Multiple components working together
- Location: `tests/integration/*.test.ts`
- Approach: Real HTTP calls to sandbox (skipped if env vars missing)
- Examples: `resources.test.ts` (validates all 10 resources against live sandbox)
- Uses `describe.skipIf(!has)` to skip when credentials not available

**E2E Tests:**
- Status: Not implemented
- Could be added for full customer workflows (create client, create order, etc.)

## Common Patterns

**Async Testing:**
```typescript
it('deve retornar token válido', async () => {
  const token = await auth.getToken();
  expect(token).toBeDefined();
  expect(typeof token).toBe('string');
});

// Or with callback:
it('should call fetch with correct parameters', async () => {
  globalThis.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve({ data: [] }),
  });

  await client.restGet('/path');
  
  expect(globalThis.fetch).toHaveBeenCalled();
});
```

**Error Testing:**
```typescript
describe('errors', () => {
  it('should create error with correct properties', () => {
    const error = new ApiError('not found', '/clientes', 'GET', 404, 'body');
    expect(error.code).toBe('API_ERROR');
    expect(error.endpoint).toBe('/clientes');
    expect(error.method).toBe('GET');
    expect(error.statusCode).toBe(404);
    expect(error).toBeInstanceOf(SankhyaError);
    expect(error).toBeInstanceOf(ApiError);
  });
});

// Testing error throwing:
it('deve lançar TimeoutError quando timeout expira', async () => {
  const client = createHttpClient(undefined, 100); // Short timeout
  
  expect(() => client.restGet('/slow-endpoint')).rejects.toThrow(TimeoutError);
});
```

**Instance/Type Checking:**
```typescript
it('should validate error type hierarchy', () => {
  const error = new AuthError('auth fail');
  expect(error).toBeInstanceOf(SankhyaError);
  expect(error).toBeInstanceOf(AuthError);
  expect(error).not.toBeInstanceOf(ApiError);
});

it('should validate function types', () => {
  const logger = createLogger();
  expect(logger.debug).toBeTypeOf('function');
  expect(logger.info).toBeTypeOf('function');
});
```

**Mocking and Verification:**
```typescript
it('should call console.warn with prefix', () => {
  const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  const logger = createLogger({ level: 'warn' });
  
  logger.warn('algo aconteceu');
  
  expect(warnSpy).toHaveBeenCalledWith('[sankhya-sdk]', 'algo aconteceu');
  expect(warnSpy).toHaveBeenCalledOnce();
  
  warnSpy.mockRestore();
});

// Verifying fetch calls:
const call = vi.mocked(globalThis.fetch).mock.calls[0];
expect(call[0]).toContain('/v1/clientes');
expect(call[1]?.headers).toEqual(
  expect.objectContaining({
    Authorization: 'Bearer test-token',
    'X-Token': 'x-token',
  }),
);
```

## Test Execution

**Full Suite:**
- 1125+ lines across ~13 test files
- ~75 unit tests in `tests/core/`
- ~15 integration tests in `tests/integration/` (skipped if sandbox credentials missing)
- Execution time: typically < 5 seconds for unit tests

**Single Test File:**
```bash
npx vitest run tests/core/logger.test.ts
```

**Watch Mode:**
```bash
npm run test:watch
# Then in Vitest UI:
# - Press 'a' to run all
# - Press 'f' to filter
# - Press 'q' to quit
```

---

*Testing analysis: 2026-04-06*
