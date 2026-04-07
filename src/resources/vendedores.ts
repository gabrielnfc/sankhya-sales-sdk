import type { HttpClient } from '../core/http.js';
import { createPaginator, extractRestData, normalizeRestPagination } from '../core/pagination.js';
import type { PaginatedResult } from '../types/common.js';
import type { ListarVendedoresParams, Vendedor } from '../types/vendedores.js';

/** Operacoes de vendedores no Sankhya ERP. Acesse via `sankhya.vendedores`. */
export class VendedoresResource {
  constructor(private readonly http: HttpClient) {}

  /**
   * Lista vendedores paginados.
   *
   * @param params - Filtros e paginacao.
   * @returns Resultado paginado com vendedores.
   * @throws {ApiError} Em erro HTTP.
   * @throws {AuthError} Se autenticacao falhar.
   * @example
   * ```ts
   * const resultado = await sankhya.vendedores.listar();
   * ```
   */
  async listar(params?: ListarVendedoresParams): Promise<PaginatedResult<Vendedor>> {
    const query: Record<string, string> = { page: String(params?.page ?? 0) };
    if (params?.modifiedSince) query.modifiedSince = params.modifiedSince;

    const raw = await this.http.restGet<Record<string, unknown>>('/vendedores', query);
    const { data, pagination } = extractRestData<Vendedor>(raw);
    return normalizeRestPagination(data, pagination);
  }

  /**
   * Busca um vendedor pelo codigo.
   *
   * @param codigoVendedor - Codigo do vendedor.
   * @returns Vendedor encontrado.
   * @throws {ApiError} Em erro HTTP (404 se nao encontrado).
   * @throws {AuthError} Se autenticacao falhar.
   * @example
   * ```ts
   * const vendedor = await sankhya.vendedores.buscar(10);
   * ```
   */
  async buscar(codigoVendedor: number): Promise<Vendedor> {
    /** Sandbox retorna { vendedores: { ...campos } } — precisa extrair o objeto interno */
    const raw = await this.http.restGet<Record<string, unknown>>(`/vendedores/${codigoVendedor}`);
    if (raw && typeof raw === 'object' && 'vendedores' in raw) {
      return raw.vendedores as Vendedor;
    }
    return raw as unknown as Vendedor;
  }

  /**
   * Itera sobre todos os vendedores automaticamente.
   *
   * @param params - Filtros (sem paginacao).
   * @returns AsyncGenerator que emite vendedores individualmente.
   * @throws {ApiError} Em erro HTTP.
   * @throws {AuthError} Se autenticacao falhar.
   */
  listarTodos(params?: Omit<ListarVendedoresParams, 'page'>): AsyncGenerator<Vendedor> {
    return createPaginator((page) => this.listar({ ...params, page }));
  }
}
