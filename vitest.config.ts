import { readFileSync } from 'node:fs';
import { defineConfig } from 'vitest/config';

function loadEnv() {
  try {
    const content = readFileSync('.env', 'utf-8');
    const env: Record<string, string> = {};
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIndex = trimmed.indexOf('=');
      if (eqIndex === -1) continue;
      let value = trimmed.slice(eqIndex + 1);
      // Strip surrounding quotes (single or double)
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      const key = trimmed.slice(0, eqIndex);
      // Chave duplicada no .env sombreia silenciosamente a primeira ocorrencia.
      // Ja causou um near-miss real: um bloco de PROD com as mesmas chaves do
      // bloco de SANDBOX fazia `npm run test:integration` (que inclui suites de
      // escrita) apontar para producao. Falha alto em vez de escolher sozinho.
      if (key in env) {
        const dica = 'Prefixos distintos por ambiente: SANKHYA_* sandbox, SANKHYA_PROD_* producao.';
        throw new Error(`.env: chave duplicada "${key}". ${dica}`);
      }
      env[key] = value;
    }
    return env;
  } catch {
    return {};
  }
}

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    testTimeout: 30_000,
    // beforeAll de integração faz várias chamadas live sequenciais; o default
    // de 10s estoura quando o sandbox está lento.
    hookTimeout: 30_000,
    env: loadEnv(),
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary'],
      include: ['src/**/*.ts'],
      exclude: ['src/types/**/*.ts', 'src/index.ts', 'src/resources/index.ts'],
      thresholds: {
        lines: 90,
        functions: 90,
        branches: 85,
        statements: 90,
      },
    },
  },
});
