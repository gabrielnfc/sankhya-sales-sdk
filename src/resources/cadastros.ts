import { deserializeRows } from '../core/gateway-serializer.js';
import type { HttpClient } from '../core/http.js';
import { createPaginator, extractRestData, normalizeRestPagination } from '../core/pagination.js';
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
    const { data, pagination } = extractRestData<TipoOperacao>(raw);
    return normalizeRestPagination(data, pagination);
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
    return this.http.restGet(`/tipos-operacao/${codigoTipoOperacao}`);
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
    const { data, pagination } = extractRestData<Natureza>(raw);
    return normalizeRestPagination(data, pagination);
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
    return this.http.restGet(`/naturezas/${codigoNatureza}`);
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
    const { data, pagination } = extractRestData<Projeto>(raw);
    return normalizeRestPagination(data, pagination);
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
    return this.http.restGet(`/projetos/${codigoProjeto}`);
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
    const { data, pagination } = extractRestData<CentroResultado>(raw);
    return normalizeRestPagination(data, pagination);
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
    return this.http.restGet(`/centros-resultado/${codigoCentroResultado}`);
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
    const { data, pagination } = extractRestData<Empresa>(raw);
    return normalizeRestPagination(data, pagination);
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
    return this.http.restGet(`/empresas/${codigoEmpresa}`);
  }

  // --- Usuarios ---

  /**
   * Lista todos os usuarios do sistema.
   *
   * @returns Array de usuarios.
   * @throws {ApiError} Em erro HTTP.
   * @throws {AuthError} Se autenticacao falhar.
   */
  async listarUsuarios(): Promise<Usuario[]> {
    const raw = await this.http.restGet<Record<string, unknown>>('/usuarios');
    const { data } = extractRestData<Usuario>(raw);
    return data;
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
    params?: Omit<{ page?: number; tipoMovimento?: number }, 'page'>,
  ): AsyncGenerator<TipoOperacao> {
    return createPaginator((page) => this.listarTiposOperacao({ ...params, page }));
  }

  /**
   * Itera sobre todas as naturezas automaticamente.
   *
   * @returns AsyncGenerator que emite naturezas individualmente.
   */
  listarTodasNaturezas(): AsyncGenerator<Natureza> {
    return createPaginator((page) => this.listarNaturezas({ page }));
  }

  /**
   * Itera sobre todos os projetos automaticamente.
   *
   * @returns AsyncGenerator que emite projetos individualmente.
   */
  listarTodosProjetos(): AsyncGenerator<Projeto> {
    return createPaginator((page) => this.listarProjetos({ page }));
  }

  /**
   * Itera sobre todos os centros de resultado automaticamente.
   *
   * @returns AsyncGenerator que emite centros de resultado.
   */
  listarTodosCentrosResultado(): AsyncGenerator<CentroResultado> {
    return createPaginator((page) => this.listarCentrosResultado({ page }));
  }

  /**
   * Itera sobre todas as empresas automaticamente.
   *
   * @returns AsyncGenerator que emite empresas individualmente.
   */
  listarTodasEmpresas(): AsyncGenerator<Empresa> {
    return createPaginator((page) => this.listarEmpresas({ page }));
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
          criteria: { expression: criteria },
          entity: {
            fieldset: { list: 'CODTIPVENDA,DESCRTIPVENDA,ATIVO,TAXAJURO' },
          },
        },
      },
    );

    const { rows } = deserializeRows(result);
    return rows.map((row) => ({
      codigoTipoNegociacao: Number(row.CODTIPVENDA) || 0,
      descricao: row.DESCRTIPVENDA ?? '',
      taxaJuro: row.TAXAJURO ? Number(row.TAXAJURO) || 0 : 0,
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
    );

    const { rows } = deserializeRows(result);
    return rows.map((row) => ({
      numeroModelo: Number(row.CODMODELANOTA) || 0,
      descricao: row.DESCRICAO ?? '',
      codigoTipoOperacao: Number(row.CODTIPOPER) || 0,
      codigoTipoNegociacao: Number(row.CODTIPVENDA) || 0,
      codigoEmpresa: Number(row.CODEMP) || 0,
      codigoNatureza: row.CODNAT ? Number(row.CODNAT) : undefined,
      codigoCentroResultado: row.CODCENCUS ? Number(row.CODCENCUS) : undefined,
    }));
  }
}
