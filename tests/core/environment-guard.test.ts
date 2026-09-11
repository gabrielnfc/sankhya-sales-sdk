import { describe, expect, it, vi } from 'vitest';
import { SankhyaClient } from '../../src/client.js';
import {
  PRODUCTION_HOSTS,
  SANDBOX_MARKER,
  isAllowedHost,
  isProductionHost,
} from '../../src/core/environment-guard.js';
import type { SankhyaConfig } from '../../src/types/config.js';

/**
 * O host de producao nao aparece literal neste arquivo: as URLs de producao sao
 * montadas a partir de `PRODUCTION_HOSTS`, que e a fonte unica do SDK.
 */
const HOST_PRODUCAO = PRODUCTION_HOSTS[0];
const URL_SANDBOX = 'https://api.sandbox.sankhya.com.br';
const CREDENCIAIS = { clientId: 'a', clientSecret: 'b', xToken: 'c' } as const;

/** Hosts que so PARECEM producao (sufixo falso): nao sao producao nem allowlist. */
const SUFIXO_FALSO = [`${HOST_PRODUCAO}.evil.com`, `evil-${HOST_PRODUCAO}`];

function fakeLogger() {
  return { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };
}

/** Mensagem do erro lancado na construcao — falha se a construcao nao lancar. */
function mensagemDeErro(config: SankhyaConfig): string {
  try {
    new SankhyaClient(config);
  } catch (erro) {
    return (erro as Error).message;
  }
  throw new Error('esperava que a construcao lancasse, e nao lancou');
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

  describe('producao decide primeiro: nem allowedHosts nem o marcador liberam', () => {
    it('allowedHosts com host de producao NAO libera producao sem a flag', () => {
      const custom = fakeLogger();
      expect(
        () =>
          new SankhyaClient({
            baseUrl: `https://${HOST_PRODUCAO}`,
            ...CREDENCIAIS,
            allowedHosts: [HOST_PRODUCAO],
            logger: { custom },
          }),
      ).toThrow(/producao/i);
      expect(custom.warn).not.toHaveBeenCalled();
    });

    it('subdominio de producao que carrega o marcador de sandbox NAO passa sem a flag', () => {
      const custom = fakeLogger();
      expect(
        () =>
          new SankhyaClient({
            baseUrl: `https://${SANDBOX_MARKER}.${HOST_PRODUCAO}`,
            ...CREDENCIAIS,
            logger: { custom },
          }),
      ).toThrow(/producao/i);
      expect(custom.warn).not.toHaveBeenCalled();
    });

    it('subdominio de producao com a flag sobe e avisa citando o host', () => {
      const custom = fakeLogger();
      const host = `${SANDBOX_MARKER}.${HOST_PRODUCAO}`;
      new SankhyaClient({
        baseUrl: `https://${host}`,
        ...CREDENCIAIS,
        allowProduction: true,
        logger: { custom },
      });
      expect(String(custom.warn.mock.calls[0][0])).toContain(host);
    });
  });

  describe('sufixo falso nao e producao e tambem nao entra na allowlist', () => {
    it.each(SUFIXO_FALSO)('isProductionHost("%s") e false', (host) => {
      expect(isProductionHost(host)).toBe(false);
    });

    it.each(SUFIXO_FALSO)('host de sufixo falso aborta mesmo com a flag: %s', (host) => {
      expect(
        () =>
          new SankhyaClient({
            baseUrl: `https://${host}`,
            ...CREDENCIAIS,
            allowProduction: true,
          }),
      ).toThrow(/allowlist/i);
    });
  });

  describe('mensagem de erro nao vaza credencial', () => {
    it('baseUrl que nao parseia: a mensagem nao cita o valor cru', () => {
      const msg = mensagemDeErro({ baseUrl: 'https://user:SENHA_SECRETA@', ...CREDENCIAIS });
      expect(msg).toMatch(/baseUrl/i);
      expect(msg).not.toContain('SENHA_SECRETA');
    });

    it('baseUrl com userinfo num host fora da allowlist: cita so o host', () => {
      const msg = mensagemDeErro({
        baseUrl: 'https://user:SENHA_SECRETA@erp.qualquer.com.br',
        ...CREDENCIAIS,
      });
      expect(msg).toContain('erp.qualquer.com.br');
      expect(msg).not.toContain('SENHA_SECRETA');
    });
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

    it('predicados ignoram a caixa do host (quem decide antes de construir)', () => {
      expect(isProductionHost(HOST_PRODUCAO.toUpperCase())).toBe(true);
      expect(isProductionHost(`MGE.${HOST_PRODUCAO}`.toUpperCase())).toBe(true);
      expect(isAllowedHost('API.SANDBOX.SANKHYA.COM.BR')).toBe(true);
      expect(isAllowedHost('ERP.INTERNO.LOCAL', ['erp.interno.local'])).toBe(true);
    });
  });
});
