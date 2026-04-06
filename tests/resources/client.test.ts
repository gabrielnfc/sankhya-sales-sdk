import { describe, expect, it } from 'vitest';
import { AuthManager } from '../../src/core/auth.js';
import { HttpClient } from '../../src/core/http.js';
import { SankhyaClient } from '../../src/client.js';
import { ClientesResource } from '../../src/resources/clientes.js';
import { VendedoresResource } from '../../src/resources/vendedores.js';
import { ProdutosResource } from '../../src/resources/produtos.js';
import { PrecosResource } from '../../src/resources/precos.js';
import { EstoqueResource } from '../../src/resources/estoque.js';
import { PedidosResource } from '../../src/resources/pedidos.js';
import { FinanceirosResource } from '../../src/resources/financeiros.js';
import { CadastrosResource } from '../../src/resources/cadastros.js';
import { FiscalResource } from '../../src/resources/fiscal.js';
import { GatewayResource } from '../../src/resources/gateway.js';
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
      expect(() => new SankhyaClient({ ...validConfig, clientSecret: '' })).toThrow(
        'clientSecret',
      );
    });

    it('throws on missing xToken', () => {
      expect(() => new SankhyaClient({ ...validConfig, xToken: '' })).toThrow('xToken');
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
  });

  describe('internal getters', () => {
    it('getHttpClient() returns HttpClient instance', () => {
      const client = new SankhyaClient(validConfig);
      expect(client.getHttpClient()).toBeInstanceOf(HttpClient);
    });

    it('getAuthManager() returns AuthManager instance', () => {
      const client = new SankhyaClient(validConfig);
      expect(client.getAuthManager()).toBeInstanceOf(AuthManager);
    });

    it('getLogger() returns Logger with debug/info/warn/error methods', () => {
      const client = new SankhyaClient(validConfig);
      const logger = client.getLogger();
      expect(typeof logger.debug).toBe('function');
      expect(typeof logger.info).toBe('function');
      expect(typeof logger.warn).toBe('function');
      expect(typeof logger.error).toBe('function');
    });

    it('getConfig() returns the config object', () => {
      const client = new SankhyaClient(validConfig);
      const config = client.getConfig();
      expect(config.baseUrl).toBe('https://api.test.com');
      expect(config.clientId).toBe('test-id');
      expect(config.clientSecret).toBe('test-secret');
      expect(config.xToken).toBe('test-token');
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
