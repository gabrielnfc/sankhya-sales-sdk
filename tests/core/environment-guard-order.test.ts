import { describe, expect, it, vi } from 'vitest';

/**
 * Trava a ORDEM do construtor: o guard de ambiente roda ANTES de `AuthManager` e
 * `HttpClient`. Hoje os dois construtores sao atribuicao pura, mas a promessa
 * esta escrita no JSDoc do `SankhyaClient` — e invariante sem teste e mutacao que
 * sobrevive (M7 do review da D3). Os construtores entram dublados so aqui.
 */
const { authSpy, httpSpy } = vi.hoisted(() => ({ authSpy: vi.fn(), httpSpy: vi.fn() }));

vi.mock('../../src/core/auth.js', () => ({
  AuthManager: class {
    constructor(...args: unknown[]) {
      authSpy(...args);
    }
  },
}));

vi.mock('../../src/core/http.js', () => ({
  HttpClient: class {
    constructor(...args: unknown[]) {
      httpSpy(...args);
    }
  },
}));

const { SankhyaClient } = await import('../../src/client.js');

const CREDENCIAIS = { clientId: 'a', clientSecret: 'b', xToken: 'c' } as const;

describe('ordem do construtor: guard antes de AuthManager/HttpClient', () => {
  it('host recusado: nenhum dos dois e instanciado', () => {
    authSpy.mockClear();
    httpSpy.mockClear();
    expect(
      () => new SankhyaClient({ baseUrl: 'https://erp.qualquer.com.br', ...CREDENCIAIS }),
    ).toThrow(/allowlist/i);
    expect(authSpy).not.toHaveBeenCalled();
    expect(httpSpy).not.toHaveBeenCalled();
  });

  it('host aceito: os dois sao instanciados (prova que o dublê esta ligado)', () => {
    authSpy.mockClear();
    httpSpy.mockClear();
    new SankhyaClient({ baseUrl: 'https://api.sandbox.sankhya.com.br', ...CREDENCIAIS });
    expect(authSpy).toHaveBeenCalledOnce();
    expect(httpSpy).toHaveBeenCalledOnce();
  });
});
