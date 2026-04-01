import { defineConfig } from 'vitest/config';
import { readFileSync } from 'node:fs';

function loadEnv() {
  try {
    const content = readFileSync('.env', 'utf-8');
    const env: Record<string, string> = {};
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIndex = trimmed.indexOf('=');
      if (eqIndex === -1) continue;
      env[trimmed.slice(0, eqIndex)] = trimmed.slice(eqIndex + 1);
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
    env: loadEnv(),
  },
});
