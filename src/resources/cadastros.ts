import { deserializeRows } from '../core/gateway-serializer.js';
import type { HttpClient } from '../core/http.js';
import {
  createPaginator,
  extractRestData,
  extractRestRecordOrThrow,
  normalizePagination,
} from '../core/pagination.js';
import { safeParseNumber } from '../core/parse-utils.js';
import type {
  CentroResultado,
  Empresa,
  ModeloNota,
  Natureza,
  Projeto,
  TipoNegociacao,
  TipoOperacao,
  Usuario,
} from '../types/cadastros.js';
import type { PaginatedResult } from '../types/common.js';
import type { DegradedInfo, ResourceDescriptor } from '../types/pagination-contracts.js';

const DESCRITOR_TIPOS_OPERACAO: ResourceDescriptor = {
  resourceKey: 'data',
  contract: 'rest',
  expectPagination: true,
  endpoint: '/tipos-operacao',
};

const DESCRITOR_NATUREZAS: ResourceDescriptor = {
  resourceKey: 'data',
  contract: 'rest',
  expectPagination: true,
  endpoint: '/naturezas',
};

const DESCRITOR_PROJETOS: ResourceDescriptor = {
  resourceKey: 'data',
  contract: 'rest',
  expectPagination: true,
  endpoint: '/projetos',
};

const DESCRITOR_CENTROS_RESULTADO: ResourceDescriptor = {
  resourceKey: 'data',
  contract: 'rest',
  expectPagination: true,
  endpoint: '/centros-resultado',
};

const DESCRITOR_EMPRESAS: ResourceDescriptor = {
  resourceKey: 'empresas',
  contract: 'rest',
  expectPagination: true,
  endpoint: '/empresas',
};

const DESCRITOR_USUARIOS: ResourceDescriptor = {
  resourceKey: 'usuarios',
  contract: 'rest',
  expectPagination: true,
  endpoint: '/usuarios',
};

/**
 * Operacoes de cadastros gerais no Sankhya ERP
 * (tipos de operacao, naturezas, empresas, etc.).
 * Acesse via `sankhya.cadastros`.
 */
export class CadastrosResource {
  constructor(private readonly http: HttpClient) {}

  // --- Tipos de Operacao ---

  /**
   * Lista tipos de operacao paginados.
   *
   * @param params - Filtros e paginacao.
   * @returns Resultado paginado com tipos de operacao.
   * @throws {ApiError} Em erro HTTP.
   * @throws {AuthError} Se autenticacao falhar.
   * @example
   * ```ts
   * const tops = await sankhya.cadastros.listarTiposOperacao();
   * ```
   */
  async listarTiposOperacao(params?: {
    page?: number;
    tipoMovimento?: number;
  }): Promise<PaginatedResult<TipoOperacao>> {
    const query: Record<string, string> = { page: String(params?.page ?? 0) };
    if (params?.tipoMovimento !== undefined) query.tipoMovimento = String(params.tipoMovimento);

    const raw = await this.http.restGet<Record<string, unknown>>('/tipos-operacao', query);
    const { data, degraded, degradedInfo } = extractRestData<TipoOperacao>(
      raw,
      DESCRITOR_TIPOS_OPERACAO,
    );
    return normalizePagination(
      data,
      raw,
      DESCRITOR_TIPOS_OPERACAO,
      degraded,
      this.http.getLogger(),
      degradedInfo,
    );
  }

  /**
   * Busca um tipo de operacao pelo codigo.
   *
   * @param codigoTipoOperacao - Codigo do tipo de operacao (TOP).
   * @returns Tipo de operacao encontrado.
   * @throws {ApiError} Em erro HTTP.
   * @throws {AuthError} Se autenticacao falhar.
   */
  async buscarTipoOperacao(codigoTipoOperacao: number): Promise<TipoOperacao> {
    const raw = await this.http.restGet<Record<string, unknown>>(
      `/tipos-operacao/${codigoTipoOperacao}`,
    );
    return extractRestRecordOrThrow<TipoOperacao>(
      raw,
      `Tipo de operacao ${codigoTipoOperacao} nao encontrado`,
    );
  }

  // --- Naturezas ---

  /**
   * Lista naturezas paginadas.
   *
   * @param params - Paginacao.
   * @returns Resultado paginado com naturezas.
   * @throws {ApiError} Em erro HTTP.
   * @throws {AuthError} Se autenticacao falhar.
   */
  async listarNaturezas(params?: { page?: number }): Promise<PaginatedResult<Natureza>> {
    const query: Record<string, string> = { page: String(params?.page ?? 0) };
    const raw = await this.http.restGet<Record<string, unknown>>('/naturezas', query);
    const { data, degraded, degradedInfo } = extractRestData<Natureza>(raw, DESCRITOR_NATUREZAS);
    return normalizePagination(
      data,
      raw,
      DESCRITOR_NATUREZAS,
      degraded,
      this.http.getLogger(),
      degradedInfo,
    );
  }

  /**
   * Busca uma natureza pelo codigo.
   *
   * @param codigoNatureza - Codigo da natureza.
   * @returns Natureza encontrada.
   * @throws {ApiError} Em erro HTTP.
   * @throws {AuthError} Se autenticacao falhar.
   */
  async buscarNatureza(codigoNatureza: number): Promise<Natureza> {
    const raw = await this.http.restGet<Record<string, unknown>>(`/naturezas/${codigoNatureza}`);
    return extractRestRecordOrThrow<Natureza>(raw, `Natureza ${codigoNatureza} nao encontrada`);
  }

  // --- Projetos ---

  /**
   * Lista projetos paginados.
   *
   * @param params - Paginacao.
   * @returns Resultado paginado com projetos.
   * @throws {ApiError} Em erro HTTP.
   * @throws {AuthError} Se autenticacao falhar.
   */
  async listarProjetos(params?: { page?: number }): Promise<PaginatedResult<Projeto>> {
    const query: Record<string, string> = { page: String(params?.page ?? 0) };
    const raw = await this.http.restGet<Record<string, unknown>>('/projetos', query);
    const { data, degraded, degradedInfo } = extractRestData<Projeto>(raw, DESCRITOR_PROJETOS);
    return normalizePagination(
      data,
      raw,
      DESCRITOR_PROJETOS,
      degraded,
      this.http.getLogger(),
      degradedInfo,
    );
  }

  /**
   * Busca um projeto pelo codigo.
   *
   * @param codigoProjeto - Codigo do projeto.
   * @returns Projeto encontrado.
   * @throws {ApiError} Em erro HTTP.
   * @throws {AuthError} Se autenticacao falhar.
   */
  async buscarProjeto(codigoProjeto: number): Promise<Projeto> {
    const raw = await this.http.restGet<Record<string, unknown>>(`/projetos/${codigoProjeto}`);
    return extractRestRecordOrThrow<Projeto>(raw, `Projeto ${codigoProjeto} nao encontrado`);
  }

  // --- Centros de Resultado ---

  /**
   * Lista centros de resultado paginados.
   *
   * @param params - Paginacao.
   * @returns Resultado paginado com centros de resultado.
   * @throws {ApiError} Em erro HTTP.
   * @throws {AuthError} Se autenticacao falhar.
   */
  async listarCentrosResultado(params?: {
    page?: number;
  }): Promise<PaginatedResult<CentroResultado>> {
    const query: Record<string, string> = { page: String(params?.page ?? 0) };
    const raw = await this.http.restGet<Record<string, unknown>>('/centros-resultado', query);
    const { data, degraded, degradedInfo } = extractRestData<CentroResultado>(
      raw,
      DESCRITOR_CENTROS_RESULTADO,
    );
    return normalizePagination(
      data,
      raw,
      DESCRITOR_CENTROS_RESULTADO,
      degraded,
      this.http.getLogger(),
      degradedInfo,
    );
  }

  /**
   * Busca um centro de resultado pelo codigo.
   *
   * @param codigoCentroResultado - Codigo do centro de resultado.
   * @returns Centro de resultado encontrado.
   * @throws {ApiError} Em erro HTTP.
   * @throws {AuthError} Se autenticacao falhar.
   */
  async buscarCentroResultado(codigoCentroResultado: number): Promise<CentroResultado> {
    const raw = await this.http.restGet<Record<string, unknown>>(
      `/centros-resultado/${codigoCentroResultado}`,
    );
    return extractRestRecordOrThrow<CentroResultado>(
      raw,
      `Centro de resultado ${codigoCentroResultado} nao encontrado`,
    );
  }

  // --- Empresas ---

  /**
   * Lista empresas paginadas.
   *
   * @param params - Paginacao.
   * @returns Resultado paginado com empresas.
   * @throws {ApiError} Em erro HTTP.
   * @throws {AuthError} Se autenticacao falhar.
   */
  async listarEmpresas(params?: { page?: number }): Promise<PaginatedResult<Empresa>> {
    const query: Record<string, string> = { page: String(params?.page ?? 0) };
    const raw = await this.http.restGet<Record<string, unknown>>('/empresas', query);
    const { data, degraded, degradedInfo } = extractRestData<Empresa>(raw, DESCRITOR_EMPRESAS);
    return normalizePagination(
      data,
      raw,
      DESCRITOR_EMPRESAS,
      degraded,
      this.http.getLogger(),
      degradedInfo,
    );
  }

  /**
   * Busca uma empresa pelo codigo.
   *
   * @param codigoEmpresa - Codigo da empresa.
   * @returns Empresa encontrada.
   * @throws {ApiError} Em erro HTTP.
   * @throws {AuthError} Se autenticacao falhar.
   */
  async buscarEmpresa(codigoEmpresa: number): Promise<Empresa> {
    const raw = await this.http.restGet<Record<string, unknown>>(`/empresas/${codigoEmpresa}`);
    return extractRestRecordOrThrow<Empresa>(raw, `Empresa ${codigoEmpresa} nao encontrada`);
  }

  // --- Usuarios ---

  /**
   * Lista todos os usuarios do sistema.
   *
   * @returns Array de usuarios.
   * @throws {ApiError} Em erro HTTP.
   * @throws {AuthError} Se autenticacao falhar.
   * @remarks
   * Este endpoint devolve bloco `pagination` real, que versoes anteriores
   * descartavam — o metodo entregava so a primeira pagina. Agora percorre
   * todas as paginas internamente, entao pode fazer N requisicoes e falhar
   * no meio de uma varredura longa.
   */
  async listarUsuarios(): Promise<Usuario[]> {
    const paginar = async (page: number) => {
      const raw = await this.http.restGet<Record<string, unknown>>('/usuarios', {
        page: String(page),
      });
      const { data, degraded, degradedInfo } = extractRestData<Usuario>(raw, DESCRITOR_USUARIOS);
      return normalizePagination(
        data,
        raw,
        DESCRITOR_USUARIOS,
        degraded,
        this.http.getLogger(),
        degradedInfo,
      );
    };

    const todos: Usuario[] = [];
    for await (const usuario of createPaginator(paginar, 0, { logger: this.http.getLogger() })) {
      todos.push(usuario);
    }
    return todos;
  }

  // --- Iteradores ---

  /**
   * Itera sobre todos os tipos de operacao automaticamente.
   *
   * @param params - Filtros (sem paginacao).
   * @returns AsyncGenerator que emite tipos de operacao.
   * @throws {ApiError} Em erro HTTP.
   * @throws {AuthError} Se autenticacao falhar.
   */
  listarTodosTiposOperacao(
    params?: Omit<{ page?: number; tipoMovimento?: number }, 'page'> & {
      onDegraded?: ((info: DegradedInfo) => void) | undefined;
    },
  ): AsyncGenerator<TipoOperacao> {
    const { onDegraded, ...filtros } = params ?? {};
    return createPaginator((page) => this.listarTiposOperacao({ ...filtros, page }), 0, {
      onDegraded,
      logger: this.http.getLogger(),
    });
  }

  /**
   * Itera sobre todas as naturezas automaticamente.
   *
   * @returns AsyncGenerator que emite naturezas individualmente.
   */
  listarTodasNaturezas(params?: {
    onDegraded?: ((info: DegradedInfo) => void) | undefined;
  }): AsyncGenerator<Natureza> {
    const { onDegraded } = params ?? {};
    return createPaginator((page) => this.listarNaturezas({ page }), 0, {
      onDegraded,
      logger: this.http.getLogger(),
    });
  }

  /**
   * Itera sobre todos os projetos automaticamente.
   *
   * @returns AsyncGenerator que emite projetos individualmente.
   */
  listarTodosProjetos(params?: {
    onDegraded?: ((info: DegradedInfo) => void) | undefined;
  }): AsyncGenerator<Projeto> {
    const { onDegraded } = params ?? {};
    return createPaginator((page) => this.listarProjetos({ page }), 0, {
      onDegraded,
      logger: this.http.getLogger(),
    });
  }

  /**
   * Itera sobre todos os centros de resultado automaticamente.
   *
   * @returns AsyncGenerator que emite centros de resultado.
   */
  listarTodosCentrosResultado(params?: {
    onDegraded?: ((info: DegradedInfo) => void) | undefined;
  }): AsyncGenerator<CentroResultado> {
    const { onDegraded } = params ?? {};
    return createPaginator((page) => this.listarCentrosResultado({ page }), 0, {
      onDegraded,
      logger: this.http.getLogger(),
    });
  }

  /**
   * Itera sobre todas as empresas automaticamente.
   *
   * @returns AsyncGenerator que emite empresas individualmente.
   */
  listarTodasEmpresas(params?: {
    onDegraded?: ((info: DegradedInfo) => void) | undefined;
  }): AsyncGenerator<Empresa> {
    const { onDegraded } = params ?? {};
    return createPaginator((page) => this.listarEmpresas({ page }), 0, {
      onDegraded,
      logger: this.http.getLogger(),
    });
  }

  // --- Gateway: Tipos de Negociacao ---

  /**
   * Lista tipos de negociacao via Gateway.
   *
   * Disponivel apenas no Gateway (nao tem endpoint REST).
   *
   * @param params - Filtros (apenasAtivos, paginacao).
   * @returns Array de tipos de negociacao.
   * @throws {GatewayError} Em erro de negocio Sankhya.
   * @throws {AuthError} Se autenticacao falhar.
   * @example
   * ```ts
   * const tipos = await sankhya.cadastros.listarTiposNegociacao({
   *   apenasAtivos: true,
   * });
   * ```
   */
  async listarTiposNegociacao(params?: {
    page?: number;
    apenasAtivos?: boolean;
  }): Promise<TipoNegociacao[]> {
    const criteria = params?.apenasAtivos !== false ? "this.ATIVO = 'S'" : '1 = 1';

    const result = await this.http.gatewayCall<Record<string, unknown>>(
      'mge',
      'CRUDServiceProvider.loadRecords',
      {
        dataSet: {
          rootEntity: 'TipoNegociacao',
          includePresentationFields: 'N',
          offsetPage: String(params?.page ?? 0),
          criteria: { expression: { $: criteria } },
          entity: {
            fieldset: { list: 'CODTIPVENDA,DESCRTIPVENDA,ATIVO,TAXAJURO' },
          },
        },
      },
      undefined,
      true, // idempotent: leitura, elegivel a retry em falha transiente
    );

    const { rows } = deserializeRows(result, this.http.getLogger());
    return rows.map((row) => ({
      codigoTipoNegociacao: safeParseNumber(row.CODTIPVENDA, 'CODTIPVENDA'),
      descricao: row.DESCRTIPVENDA ?? '',
      taxaJuro: row.TAXAJURO ? safeParseNumber(row.TAXAJURO, 'TAXAJURO') : 0,
      ativo: row.ATIVO === 'S',
    }));
  }

  // --- Gateway: Modelos de Nota ---

  /**
   * Lista modelos de nota via Gateway.
   *
   * Disponivel apenas no Gateway (nao tem endpoint REST).
   *
   * @param params - Paginacao.
   * @returns Array de modelos de nota.
   * @throws {GatewayError} Em erro de negocio Sankhya.
   * @throws {AuthError} Se autenticacao falhar.
   */
  async listarModelosNota(params?: { page?: number }): Promise<ModeloNota[]> {
    const result = await this.http.gatewayCall<Record<string, unknown>>(
      'mge',
      'CRUDServiceProvider.loadRecords',
      {
        dataSet: {
          rootEntity: 'ModeloNota',
          includePresentationFields: 'N',
          offsetPage: String(params?.page ?? 0),
          entity: {
            fieldset: {
              list: 'CODMODELANOTA,DESCRICAO,CODTIPOPER,CODTIPVENDA,CODEMP,CODNAT,CODCENCUS',
            },
          },
        },
      },
      undefined,
      true, // idempotent: leitura, elegivel a retry em falha transiente
    );

    const { rows } = deserializeRows(result, this.http.getLogger());
    return rows.map((row) => ({
      numeroModelo: safeParseNumber(row.CODMODELANOTA, 'CODMODELANOTA'),
      descricao: row.DESCRICAO ?? '',
      codigoTipoOperacao: safeParseNumber(row.CODTIPOPER, 'CODTIPOPER'),
      codigoTipoNegociacao: safeParseNumber(row.CODTIPVENDA, 'CODTIPVENDA'),
      codigoEmpresa: safeParseNumber(row.CODEMP, 'CODEMP'),
      codigoNatureza: row.CODNAT ? safeParseNumber(row.CODNAT, 'CODNAT') : undefined,
      codigoCentroResultado: row.CODCENCUS
        ? safeParseNumber(row.CODCENCUS, 'CODCENCUS')
        : undefined,
    }));
  }
}
