import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SankhyaClient } from '../../src/client.js';
import { HttpClient } from '../../src/core/http.js';
import { CadastrosResource } from '../../src/resources/cadastros.js';
import { ClientesResource } from '../../src/resources/clientes.js';
import { DbExplorerResource } from '../../src/resources/db-explorer.js';
import { EstoqueResource } from '../../src/resources/estoque.js';
import { FinanceirosResource } from '../../src/resources/financeiros.js';
import { FiscalResource } from '../../src/resources/fiscal.js';
import { GatewayResource } from '../../src/resources/gateway.js';
import { PedidosResource } from '../../src/resources/pedidos.js';
import { PrecosResource } from '../../src/resources/precos.js';
import { ProdutosResource } from '../../src/resources/produtos.js';
import { VendedoresResource } from '../../src/resources/vendedores.js';
import type { SankhyaConfig } from '../../src/types/config.js';

const validConfig: SankhyaConfig = {
  baseUrl: 'https://api.test.com',
  clientId: 'test-id',
  clientSecret: 'test-secret',
  xToken: 'test-token',
};

describe('SankhyaClient', () => {
  describe('config validation', () => {
    it('creates instance with valid config', () => {
      const client = new SankhyaClient(validConfig);
      expect(client).toBeInstanceOf(SankhyaClient);
    });

    it('throws on missing baseUrl', () => {
      expect(() => new SankhyaClient({ ...validConfig, baseUrl: '' })).toThrow('baseUrl');
    });

    it('throws on missing clientId', () => {
      expect(() => new SankhyaClient({ ...validConfig, clientId: '' })).toThrow('clientId');
    });

    it('throws on missing clientSecret', () => {
      expect(() => new SankhyaClient({ ...validConfig, clientSecret: '' })).toThrow('clientSecret');
    });

    it('throws on missing xToken', () => {
      expect(() => new SankhyaClient({ ...validConfig, xToken: '' })).toThrow('xToken');
    });

    it('accepts authRetry and circuitBreaker config', () => {
      const client = new SankhyaClient({
        ...validConfig,
        authRetry: { maxRetries: 5, baseDelayMs: 250 },
        circuitBreaker: { threshold: 4, resetTimeoutMs: 15_000 },
      });
      expect(client).toBeInstanceOf(SankhyaClient);
    });
  });

  describe('resilience config wiring', () => {
    let originalFetch: typeof globalThis.fetch;
    beforeEach(() => {
      originalFetch = globalThis.fetch;
      vi.clearAllMocks();
    });
    afterEach(() => {
      globalThis.fetch = originalFetch;
      vi.useRealTimers();
    });

    it('authRetry override wired: maxRetries=0 suppresses retry em 502 (1 unica chamada)', async () => {
      // Prova o wiring: sem passar a config para o AuthManager, o default
      // (maxRetries=3) retentaria e faria varias chamadas. maxRetries=0 so
      // tem efeito se a config foi realmente propagada.
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 502,
        statusText: 'Bad Gateway',
        text: () => Promise.resolve(''),
      });

      const client = new SankhyaClient({
        ...validConfig,
        authRetry: { maxRetries: 0 },
      });

      await expect(client.authenticate()).rejects.toThrow();
      expect(globalThis.fetch).toHaveBeenCalledOnce();
    });

    it('circuitBreaker override wired: threshold=2 abre apos 2 falhas', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        text: () => Promise.resolve(''),
      });

      const client = new SankhyaClient({
        ...validConfig,
        authRetry: { maxRetries: 0 },
        circuitBreaker: { threshold: 2, resetTimeoutMs: 30_000 },
      });

      // 2 falhas distintas => breaker arma (default threshold=3 nao armaria aqui)
      await expect(client.authenticate()).rejects.toThrow();
      await expect(client.authenticate()).rejects.toThrow();

      const fetchCalls = vi.mocked(globalThis.fetch).mock.calls.length;
      // 3a chamada: breaker aberto => nao chama fetch
      await expect(client.authenticate()).rejects.toThrow();
      expect(vi.mocked(globalThis.fetch).mock.calls.length).toBe(fetchCalls);
    });
  });

  describe('lazy-load resource getters', () => {
    it('client.clientes returns ClientesResource instance', () => {
      const client = new SankhyaClient(validConfig);
      expect(client.clientes).toBeInstanceOf(ClientesResource);
    });

    it('client.clientes returns same instance on second access (singleton)', () => {
      const client = new SankhyaClient(validConfig);
      const first = client.clientes;
      const second = client.clientes;
      expect(first).toBe(second);
    });

    it('client.vendedores returns VendedoresResource instance', () => {
      const client = new SankhyaClient(validConfig);
      expect(client.vendedores).toBeInstanceOf(VendedoresResource);
    });

    it('client.produtos returns ProdutosResource instance', () => {
      const client = new SankhyaClient(validConfig);
      expect(client.produtos).toBeInstanceOf(ProdutosResource);
    });

    it('client.precos returns PrecosResource instance', () => {
      const client = new SankhyaClient(validConfig);
      expect(client.precos).toBeInstanceOf(PrecosResource);
    });

    it('client.estoque returns EstoqueResource instance', () => {
      const client = new SankhyaClient(validConfig);
      expect(client.estoque).toBeInstanceOf(EstoqueResource);
    });

    it('client.pedidos returns PedidosResource instance', () => {
      const client = new SankhyaClient(validConfig);
      expect(client.pedidos).toBeInstanceOf(PedidosResource);
    });

    it('client.financeiros returns FinanceirosResource instance', () => {
      const client = new SankhyaClient(validConfig);
      expect(client.financeiros).toBeInstanceOf(FinanceirosResource);
    });

    it('client.cadastros returns CadastrosResource instance', () => {
      const client = new SankhyaClient(validConfig);
      expect(client.cadastros).toBeInstanceOf(CadastrosResource);
    });

    it('client.fiscal returns FiscalResource instance', () => {
      const client = new SankhyaClient(validConfig);
      expect(client.fiscal).toBeInstanceOf(FiscalResource);
    });

    it('client.gateway returns GatewayResource instance', () => {
      const client = new SankhyaClient(validConfig);
      expect(client.gateway).toBeInstanceOf(GatewayResource);
    });

    it('client.dbExplorer returns DbExplorerResource instance (lazy, mesma instancia)', () => {
      const client = new SankhyaClient(validConfig);
      expect(client.dbExplorer).toBeInstanceOf(DbExplorerResource);
      expect(client.dbExplorer).toBe(client.dbExplorer);
    });
  });

  describe('public methods', () => {
    it('authenticate() is a callable async function', () => {
      const client = new SankhyaClient(validConfig);
      expect(typeof client.authenticate).toBe('function');
    });

    it('invalidateToken() is a callable async function', () => {
      const client = new SankhyaClient(validConfig);
      expect(typeof client.invalidateToken).toBe('function');
    });
  });
});
