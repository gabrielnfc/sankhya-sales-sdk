import { AuthManager } from './core/auth.js';
import { assertAllowedHost } from './core/environment-guard.js';
import { HttpClient } from './core/http.js';
import { createLogger } from './core/logger.js';
import {
  CadastrosResource,
  ClientesResource,
  DatasetResource,
  DbExplorerResource,
  EstoqueResource,
  FinanceirosResource,
  FiscalResource,
  GatewayResource,
  MetadataResource,
  PedidosResource,
  PrecosResource,
  ProdutosResource,
  VendedoresResource,
} from './resources/index.js';
import type { Logger, SankhyaConfig } from './types/config.js';

/**
 * Ponto de entrada principal do SDK Sankhya.
 *
 * Facade que expoe todos os recursos da API via propriedades lazy-loaded.
 * Cada recurso e instanciado apenas no primeiro acesso.
 *
 * O host passa por uma allowlist fail-closed: producao e avaliada PRIMEIRO e
 * exige `allowProduction` explicito (e e logada) — nem `allowedHosts` nem o
 * marcador de sandbox num subdominio a liberam. Fora de producao, sobe host de
 * sandbox ou host declarado em `allowedHosts`; qualquer outro aborta.
 *
 * @example
 * ```ts
 * const sankhya = new SankhyaClient({
 *   // sandbox: 'https://api.sandbox.sankhya.com.br'
 *   baseUrl: process.env.SANKHYA_BASE_URL!,
 *   clientId: process.env.SANKHYA_CLIENT_ID!,
 *   clientSecret: process.env.SANKHYA_CLIENT_SECRET!,
 *   xToken: process.env.SANKHYA_X_TOKEN!,
 * });
 *
 * const clientes = await sankhya.clientes.listar();
 * ```
 */
export class SankhyaClient {
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
  private _metadata?: MetadataResource;
  private _dbExplorer?: DbExplorerResource;
  private _dataset?: DatasetResource;

  /**
   * Cria uma instancia do SDK Sankhya.
   *
   * @param config - Configuracao de conexao com a API Sankhya.
   * @throws {Error} Se campos obrigatorios estiverem ausentes.
   * @throws {SankhyaError} Se o host de `baseUrl` estiver fora da allowlist
   *   (`VALIDATION_ERROR`) ou for producao sem `allowProduction` (`PRODUCTION_BLOCKED`).
   */
  constructor(config: SankhyaConfig) {
    this.validateConfig(config);
    this.logger = createLogger(config.logger);
    // Allowlist fail-closed: roda depois da validacao de tipos e ANTES de
    // instanciar AuthManager/HttpClient — nenhum recurso de rede e criado
    // para um host que a guarda recusaria. Ordem travada em
    // tests/core/environment-guard-order.test.ts (dubla os dois construtores).
    assertAllowedHost(config.baseUrl, config, this.logger);
    this.auth = new AuthManager(
      config.baseUrl,
      config.clientId,
      config.clientSecret,
      config.xToken,
      this.logger,
      config.tokenCacheProvider,
      {
        timeout: config.timeout ?? 30_000,
        authRetry: config.authRetry,
        circuitBreaker: config.circuitBreaker,
      },
    );
    this.http = new HttpClient(
      config.baseUrl,
      config.xToken,
      config.timeout ?? 30_000,
      this.logger,
      this.auth,
      config.retries ?? 3,
    );
  }

  /** Acesso ao recurso de clientes. */
  get clientes(): ClientesResource {
    this._clientes ??= new ClientesResource(this.http);
    return this._clientes;
  }

  /** Acesso ao recurso de vendedores. */
  get vendedores(): VendedoresResource {
    this._vendedores ??= new VendedoresResource(this.http);
    return this._vendedores;
  }

  /** Acesso ao recurso de produtos. */
  get produtos(): ProdutosResource {
    this._produtos ??= new ProdutosResource(this.http);
    return this._produtos;
  }

  /** Acesso ao recurso de precos e tabelas de preco. */
  get precos(): PrecosResource {
    this._precos ??= new PrecosResource(this.http);
    return this._precos;
  }

  /** Acesso ao recurso de estoque. */
  get estoque(): EstoqueResource {
    this._estoque ??= new EstoqueResource(this.http);
    return this._estoque;
  }

  /** Acesso ao recurso de pedidos de venda. */
  get pedidos(): PedidosResource {
    this._pedidos ??= new PedidosResource(this.http);
    return this._pedidos;
  }

  /** Acesso ao recurso financeiro (receitas, despesas, pagamentos). */
  get financeiros(): FinanceirosResource {
    this._financeiros ??= new FinanceirosResource(this.http);
    return this._financeiros;
  }

  /** Acesso ao recurso de cadastros gerais (operacoes, naturezas, empresas). */
  get cadastros(): CadastrosResource {
    this._cadastros ??= new CadastrosResource(this.http);
    return this._cadastros;
  }

  /** Acesso ao recurso fiscal (calculo de impostos, NFS-e). */
  get fiscal(): FiscalResource {
    this._fiscal ??= new FiscalResource(this.http);
    return this._fiscal;
  }

  /** Acesso direto ao Gateway Sankhya para operacoes genericas. */
  get gateway(): GatewayResource {
    this._gateway ??= new GatewayResource(this.http);
    return this._gateway;
  }

  /** Descoberta de metadata de entidades (colunas reais, incluindo campos `AD_*`). */
  get metadata(): MetadataResource {
    this._metadata ??= new MetadataResource(this.http);
    return this._metadata;
  }

  /** Consulta SQL somente-leitura (SELECT puro) via DbExplorer. */
  get dbExplorer(): DbExplorerResource {
    this._dbExplorer ??= new DbExplorerResource(this.http);
    return this._dbExplorer;
  }

  /** Escrita e leitura tipadas sobre o DatasetSP (save, removeRecord, load). */
  get dataset(): DatasetResource {
    this._dataset ??= new DatasetResource(this.http);
    return this._dataset;
  }

  /**
   * Autentica explicitamente com a API Sankhya.
   *
   * Util para validar credenciais antes de fazer chamadas.
   * A autenticacao tambem ocorre automaticamente no primeiro request.
   *
   * @returns Promise resolvida apos autenticacao bem-sucedida.
   * @throws {AuthError} Se as credenciais forem invalidas.
   */
  async authenticate(): Promise<void> {
    await this.auth.getToken();
  }

  /**
   * Invalida o token em cache, forcando re-autenticacao no proximo request.
   *
   * @returns Promise resolvida apos invalidacao do cache.
   */
  async invalidateToken(): Promise<void> {
    await this.auth.invalidateToken();
  }

  private validateConfig(config: SankhyaConfig): void {
    if (!config || typeof config !== 'object') {
      throw new Error('config deve ser um objeto');
    }
    if (typeof config.baseUrl !== 'string' || !config.baseUrl) {
      throw new Error('baseUrl é obrigatório e deve ser uma string');
    }
    if (typeof config.clientId !== 'string' || !config.clientId) {
      throw new Error('clientId é obrigatório e deve ser uma string');
    }
    if (typeof config.clientSecret !== 'string' || !config.clientSecret) {
      throw new Error('clientSecret é obrigatório e deve ser uma string');
    }
    if (typeof config.xToken !== 'string' || !config.xToken) {
      throw new Error('xToken é obrigatório e deve ser uma string');
    }
    if (
      config.timeout !== undefined &&
      (typeof config.timeout !== 'number' || config.timeout <= 0)
    ) {
      throw new Error('timeout deve ser um número positivo');
    }
    if (
      config.retries !== undefined &&
      (typeof config.retries !== 'number' || config.retries < 0)
    ) {
      throw new Error('retries deve ser um número >= 0');
    }
  }
}
