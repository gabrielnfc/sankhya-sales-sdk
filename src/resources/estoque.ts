import type { HttpClient } from '../core/http.js';
import { createPaginator, extractRestData, normalizeRestPagination } from '../core/pagination.js';
import type { PaginatedResult } from '../types/common.js';
import type { Estoque, LocalEstoque } from '../types/estoque.js';

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
    const { data } = extractRestData<Estoque>(raw);
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
    const { data, pagination } = extractRestData<Estoque>(raw);
    return normalizeRestPagination(data, pagination);
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
    const { data, pagination } = extractRestData<LocalEstoque>(raw);
    return normalizeRestPagination(data, pagination);
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
    return this.http.restGet(`/estoque/locais/${codigoLocal}`);
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
