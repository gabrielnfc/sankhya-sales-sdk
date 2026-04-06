import type { HttpClient } from '../core/http.js';
import { createPaginator, extractRestData, normalizeRestPagination } from '../core/pagination.js';
import type { PaginatedResult } from '../types/common.js';
import type { ListarVendedoresParams, Vendedor } from '../types/vendedores.js';

export class VendedoresResource {
  constructor(private readonly http: HttpClient) {}

  async listar(params?: ListarVendedoresParams): Promise<PaginatedResult<Vendedor>> {
    const query: Record<string, string> = { page: String(params?.page ?? 0) };
    if (params?.modifiedSince) query.modifiedSince = params.modifiedSince;

    const raw = await this.http.restGet<Record<string, unknown>>('/vendedores', query);
    const { data, pagination } = extractRestData<Vendedor>(raw);
    return normalizeRestPagination(data, pagination);
  }

  async buscar(codigoVendedor: number): Promise<Vendedor> {
    /** Sandbox retorna { vendedores: { ...campos } } — precisa extrair o objeto interno */
    const raw = await this.http.restGet<Record<string, unknown>>(`/vendedores/${codigoVendedor}`);
    if (raw && typeof raw === 'object' && 'vendedores' in raw) {
      return raw.vendedores as Vendedor;
    }
    return raw as unknown as Vendedor;
  }

  listarTodos(params?: Omit<ListarVendedoresParams, 'page'>): AsyncGenerator<Vendedor> {
    return createPaginator((page) => this.listar({ ...params, page }));
  }
}
