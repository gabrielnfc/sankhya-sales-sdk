import { describe, expect, it, vi } from 'vitest';
import { SankhyaClient } from '../../src/client.js';
import {
  PRODUCTION_HOSTS,
  isAllowedHost,
  isProductionHost,
} from '../../src/core/environment-guard.js';

/**
 * O host de producao nao aparece literal neste arquivo: as URLs de producao sao
 * montadas a partir de `PRODUCTION_HOSTS`, que e a fonte unica do SDK.
 */
const HOST_PRODUCAO = PRODUCTION_HOSTS[0];
const URL_SANDBOX = 'https://api.sandbox.sankhya.com.br';
const CREDENCIAIS = { clientId: 'a', clientSecret: 'b', xToken: 'c' } as const;

function fakeLogger() {
  return { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };
}

describe('environment-guard (allowlist fail-closed)', () => {
  it.each([
    `https://${HOST_PRODUCAO}`,
    `https://${HOST_PRODUCAO}/`,
    `https://mge.${HOST_PRODUCAO}`,
    'https://erp.qualquer.com.br',
  ])('recusa host fora da allowlist: %s', (baseUrl) => {
    expect(() => new SankhyaClient({ baseUrl, ...CREDENCIAIS })).toThrow(/sandbox|allowlist/i);
  });

  it('aceita host de sandbox sem flag e nao avisa', () => {
    const custom = fakeLogger();
    expect(
      () => new SankhyaClient({ baseUrl: URL_SANDBOX, ...CREDENCIAIS, logger: { custom } }),
    ).not.toThrow();
    expect(custom.warn).not.toHaveBeenCalled();
  });

  it('aceita host declarado em allowedHosts (allowlist explicita)', () => {
    expect(
      () =>
        new SankhyaClient({
          baseUrl: 'https://erp.interno.truebrands.local',
          ...CREDENCIAIS,
          allowedHosts: ['erp.interno.truebrands.local'],
        }),
    ).not.toThrow();
  });

  it('allowProduction:true libera producao e avisa citando SO o host', () => {
    const custom = fakeLogger();
    new SankhyaClient({
      baseUrl: `https://${HOST_PRODUCAO}`,
      clientId: 'a',
      clientSecret: 'segredo',
      xToken: 'tok',
      allowProduction: true,
      logger: { custom },
    });
    const msg = String(custom.warn.mock.calls[0][0]);
    expect(msg).toContain(HOST_PRODUCAO);
    expect(msg).not.toContain('segredo');
    expect(msg).not.toContain('tok');
  });

  it('fail-closed: baseUrl que nao parseia aborta', () => {
    expect(() => new SankhyaClient({ baseUrl: 'nao-e-url', ...CREDENCIAIS })).toThrow();
  });

  it('allowProduction:true num host de sandbox nao avisa nem muda nada', () => {
    const custom = fakeLogger();
    new SankhyaClient({
      baseUrl: URL_SANDBOX,
      ...CREDENCIAIS,
      allowProduction: true,
      logger: { custom },
    });
    expect(custom.warn).not.toHaveBeenCalled();
  });

  describe('predicados exportados', () => {
    it('isAllowedHost: sandbox sim, host arbitrario nao, host em allowedHosts sim', () => {
      expect(isAllowedHost('api.sandbox.sankhya.com.br')).toBe(true);
      expect(isAllowedHost('erp.qualquer.com.br')).toBe(false);
      expect(isAllowedHost('erp.qualquer.com.br', ['erp.qualquer.com.br'])).toBe(true);
    });

    it('isProductionHost: host exato e subdominio sim, sandbox nao', () => {
      expect(isProductionHost(HOST_PRODUCAO)).toBe(true);
      expect(isProductionHost(`mge.${HOST_PRODUCAO}`)).toBe(true);
      expect(isProductionHost('api.sandbox.sankhya.com.br')).toBe(false);
    });
  });
});
