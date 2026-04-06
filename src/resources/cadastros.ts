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

export class CadastrosResource {
  constructor(private readonly http: HttpClient) {}

  // --- Tipos de Operação ---

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

  async buscarTipoOperacao(codigoTipoOperacao: number): Promise<TipoOperacao> {
    return this.http.restGet(`/tipos-operacao/${codigoTipoOperacao}`);
  }

  // --- Naturezas ---

  async listarNaturezas(params?: { page?: number }): Promise<PaginatedResult<Natureza>> {
    const query: Record<string, string> = { page: String(params?.page ?? 0) };
    const raw = await this.http.restGet<Record<string, unknown>>('/naturezas', query);
    const { data, pagination } = extractRestData<Natureza>(raw);
    return normalizeRestPagination(data, pagination);
  }

  async buscarNatureza(codigoNatureza: number): Promise<Natureza> {
    return this.http.restGet(`/naturezas/${codigoNatureza}`);
  }

  // --- Projetos ---

  async listarProjetos(params?: { page?: number }): Promise<PaginatedResult<Projeto>> {
    const query: Record<string, string> = { page: String(params?.page ?? 0) };
    const raw = await this.http.restGet<Record<string, unknown>>('/projetos', query);
    const { data, pagination } = extractRestData<Projeto>(raw);
    return normalizeRestPagination(data, pagination);
  }

  async buscarProjeto(codigoProjeto: number): Promise<Projeto> {
    return this.http.restGet(`/projetos/${codigoProjeto}`);
  }

  // --- Centros de Resultado ---

  async listarCentrosResultado(params?: {
    page?: number;
  }): Promise<PaginatedResult<CentroResultado>> {
    const query: Record<string, string> = { page: String(params?.page ?? 0) };
    const raw = await this.http.restGet<Record<string, unknown>>('/centros-resultado', query);
    const { data, pagination } = extractRestData<CentroResultado>(raw);
    return normalizeRestPagination(data, pagination);
  }

  async buscarCentroResultado(codigoCentroResultado: number): Promise<CentroResultado> {
    return this.http.restGet(`/centros-resultado/${codigoCentroResultado}`);
  }

  // --- Empresas ---

  async listarEmpresas(params?: { page?: number }): Promise<PaginatedResult<Empresa>> {
    const query: Record<string, string> = { page: String(params?.page ?? 0) };
    const raw = await this.http.restGet<Record<string, unknown>>('/empresas', query);
    const { data, pagination } = extractRestData<Empresa>(raw);
    return normalizeRestPagination(data, pagination);
  }

  async buscarEmpresa(codigoEmpresa: number): Promise<Empresa> {
    return this.http.restGet(`/empresas/${codigoEmpresa}`);
  }

  // --- Usuários ---

  async listarUsuarios(): Promise<Usuario[]> {
    const raw = await this.http.restGet<Record<string, unknown>>('/usuarios');
    const { data } = extractRestData<Usuario>(raw);
    return data;
  }

  // --- Iteradores ---

  listarTodosTiposOperacao(
    params?: Omit<{ page?: number; tipoMovimento?: number }, 'page'>,
  ): AsyncGenerator<TipoOperacao> {
    return createPaginator((page) => this.listarTiposOperacao({ ...params, page }));
  }

  listarTodasNaturezas(): AsyncGenerator<Natureza> {
    return createPaginator((page) => this.listarNaturezas({ page }));
  }

  listarTodosProjetos(): AsyncGenerator<Projeto> {
    return createPaginator((page) => this.listarProjetos({ page }));
  }

  listarTodosCentrosResultado(): AsyncGenerator<CentroResultado> {
    return createPaginator((page) => this.listarCentrosResultado({ page }));
  }

  listarTodasEmpresas(): AsyncGenerator<Empresa> {
    return createPaginator((page) => this.listarEmpresas({ page }));
  }

  // --- Gateway: Tipos de Negociação ---

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
