import type { HttpClient } from '../core/http.js';
import {
  createPaginator,
  extractRestData,
  extractRestRecordOrThrow,
  normalizePagination,
} from '../core/pagination.js';
import type { PaginatedResult } from '../types/common.js';
import type { Estoque, LocalEstoque } from '../types/estoque.js';
import type { ResourceDescriptor } from '../types/pagination-contracts.js';

const DESCRITOR_POR_PRODUTO: ResourceDescriptor = {
  resourceKey: 'estoque',
  contract: 'rest',
  expectPagination: false,
};

const DESCRITOR_ESTOQUE: ResourceDescriptor = {
  resourceKey: 'estoque',
  contract: 'rest',
  expectPagination: true,
};

const DESCRITOR_LOCAIS: ResourceDescriptor = {
  resourceKey: 'locais',
  contract: 'rest',
  expectPagination: true,
};

/** Operacoes de estoque no Sankhya ERP. Acesse via `sankhya.estoque`. */
export class EstoqueResource {
  constructor(private readonly http: HttpClient) {}

  /**
   * Consulta estoque de um produto em todos os locais.
   *
   * @param codigoProduto - Codigo do produto.
   * @returns Array de posicoes de estoque por local.
   * @throws {ApiError} Em erro HTTP.
   * @throws {AuthError} Se autenticacao falhar.
   * @example
   * ```ts
   * const posicoes = await sankhya.estoque.porProduto(123);
   * ```
   */
  async porProduto(codigoProduto: number): Promise<Estoque[]> {
    const raw = await this.http.restGet<Record<string, unknown>>(
      `/estoque/produtos/${codigoProduto}`,
    );
    const { data } = extractRestData<Estoque>(raw, DESCRITOR_POR_PRODUTO);
    return data;
  }

  /**
   * Lista posicoes de estoque paginadas.
   *
   * @param params - Paginacao.
   * @returns Resultado paginado com posicoes de estoque.
   * @throws {ApiError} Em erro HTTP.
   * @throws {AuthError} Se autenticacao falhar.
   */
  async listar(params?: { page?: number }): Promise<PaginatedResult<Estoque>> {
    const query: Record<string, string> = { page: String(params?.page ?? 0) };
    const raw = await this.http.restGet<Record<string, unknown>>('/estoque/produtos', query);
    const { data, degraded, degradedInfo } = extractRestData<Estoque>(raw, DESCRITOR_ESTOQUE);
    return normalizePagination(
      data,
      raw,
      DESCRITOR_ESTOQUE,
      degraded,
      this.http.getLogger(),
      degradedInfo,
    );
  }

  /**
   * Lista locais de estoque paginados.
   *
   * @param params - Paginacao.
   * @returns Resultado paginado com locais de estoque.
   * @throws {ApiError} Em erro HTTP.
   * @throws {AuthError} Se autenticacao falhar.
   */
  async listarLocais(params?: { page?: number }): Promise<PaginatedResult<LocalEstoque>> {
    const query: Record<string, string> = { page: String(params?.page ?? 0) };
    const raw = await this.http.restGet<Record<string, unknown>>('/estoque/locais', query);
    const { data, degraded, degradedInfo } = extractRestData<LocalEstoque>(raw, DESCRITOR_LOCAIS);
    return normalizePagination(
      data,
      raw,
      DESCRITOR_LOCAIS,
      degraded,
      this.http.getLogger(),
      degradedInfo,
    );
  }

  /**
   * Busca um local de estoque pelo codigo.
   *
   * @param codigoLocal - Codigo do local de estoque.
   * @returns Local de estoque encontrado.
   * @throws {ApiError} Em erro HTTP.
   * @throws {AuthError} Se autenticacao falhar.
   */
  async buscarLocal(codigoLocal: number): Promise<LocalEstoque> {
    const raw = await this.http.restGet<Record<string, unknown>>(`/estoque/locais/${codigoLocal}`);
    return extractRestRecordOrThrow<LocalEstoque>(
      raw,
      `Local de estoque ${codigoLocal} nao encontrado`,
    );
  }

  /**
   * Itera sobre todas as posicoes de estoque automaticamente.
   *
   * @returns AsyncGenerator que emite posicoes individualmente.
   * @throws {ApiError} Em erro HTTP.
   * @throws {AuthError} Se autenticacao falhar.
   */
  listarTodos(): AsyncGenerator<Estoque> {
    return createPaginator((page) => this.listar({ page }));
  }
}
