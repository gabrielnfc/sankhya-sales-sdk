import { AuthManager } from './core/auth.js';
import { HttpClient } from './core/http.js';
import { createLogger } from './core/logger.js';
import {
  CadastrosResource,
  ClientesResource,
  EstoqueResource,
  FinanceirosResource,
  FiscalResource,
  GatewayResource,
  PedidosResource,
  PrecosResource,
  ProdutosResource,
  VendedoresResource,
} from './resources/index.js';
import type { Logger, SankhyaConfig } from './types/config.js';

export class SankhyaClient {
  private readonly config: SankhyaConfig;
  private readonly logger: Logger;
  private readonly auth: AuthManager;
  private readonly http: HttpClient;

  private _clientes?: ClientesResource;
  private _vendedores?: VendedoresResource;
  private _produtos?: ProdutosResource;
  private _precos?: PrecosResource;
  private _estoque?: EstoqueResource;
  private _pedidos?: PedidosResource;
  private _financeiros?: FinanceirosResource;
  private _cadastros?: CadastrosResource;
  private _fiscal?: FiscalResource;
  private _gateway?: GatewayResource;

  constructor(config: SankhyaConfig) {
    this.validateConfig(config);
    this.config = config;
    this.logger = createLogger(config.logger);
    this.auth = new AuthManager(
      config.baseUrl,
      config.clientId,
      config.clientSecret,
      config.xToken,
      this.logger,
      config.tokenCacheProvider,
    );
    this.http = new HttpClient(
      config.baseUrl,
      config.xToken,
      config.timeout ?? 30_000,
      this.logger,
      this.auth,
    );
  }

  get clientes(): ClientesResource {
    this._clientes ??= new ClientesResource(this.http);
    return this._clientes;
  }

  get vendedores(): VendedoresResource {
    this._vendedores ??= new VendedoresResource(this.http);
    return this._vendedores;
  }

  get produtos(): ProdutosResource {
    this._produtos ??= new ProdutosResource(this.http);
    return this._produtos;
  }

  get precos(): PrecosResource {
    this._precos ??= new PrecosResource(this.http);
    return this._precos;
  }

  get estoque(): EstoqueResource {
    this._estoque ??= new EstoqueResource(this.http);
    return this._estoque;
  }

  get pedidos(): PedidosResource {
    this._pedidos ??= new PedidosResource(this.http);
    return this._pedidos;
  }

  get financeiros(): FinanceirosResource {
    this._financeiros ??= new FinanceirosResource(this.http);
    return this._financeiros;
  }

  get cadastros(): CadastrosResource {
    this._cadastros ??= new CadastrosResource(this.http);
    return this._cadastros;
  }

  get fiscal(): FiscalResource {
    this._fiscal ??= new FiscalResource(this.http);
    return this._fiscal;
  }

  get gateway(): GatewayResource {
    this._gateway ??= new GatewayResource(this.http);
    return this._gateway;
  }

  async authenticate(): Promise<void> {
    await this.auth.getToken();
  }

  async invalidateToken(): Promise<void> {
    await this.auth.invalidateToken();
  }

  /** @internal */
  getHttpClient(): HttpClient {
    return this.http;
  }

  /** @internal */
  getAuthManager(): AuthManager {
    return this.auth;
  }

  /** @internal */
  getLogger(): Logger {
    return this.logger;
  }

  /** @internal */
  getConfig(): SankhyaConfig {
    return this.config;
  }

  private validateConfig(config: SankhyaConfig): void {
    if (!config.baseUrl) throw new Error('baseUrl é obrigatório');
    if (!config.clientId) throw new Error('clientId é obrigatório');
    if (!config.clientSecret) throw new Error('clientSecret é obrigatório');
    if (!config.xToken) throw new Error('xToken é obrigatório');
  }
}
