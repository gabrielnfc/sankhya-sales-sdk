import type { HttpClient } from '../core/http.js';
import { createPaginator, extractRestData, normalizeRestPagination } from '../core/pagination.js';
import type { PaginatedResult } from '../types/common.js';
import type { Estoque, LocalEstoque } from '../types/estoque.js';

export class EstoqueResource {
  constructor(private readonly http: HttpClient) {}

  async porProduto(codigoProduto: number): Promise<Estoque[]> {
    const raw = await this.http.restGet<Record<string, unknown>>(
      `/estoque/produtos/${codigoProduto}`,
    );
    const { data } = extractRestData<Estoque>(raw);
    return data;
  }

  async listar(params?: { page?: number }): Promise<PaginatedResult<Estoque>> {
    const query: Record<string, string> = { page: String(params?.page ?? 0) };
    const raw = await this.http.restGet<Record<string, unknown>>('/estoque/produtos', query);
    const { data, pagination } = extractRestData<Estoque>(raw);
    return normalizeRestPagination(data, pagination);
  }

  async listarLocais(params?: { page?: number }): Promise<PaginatedResult<LocalEstoque>> {
    const query: Record<string, string> = { page: String(params?.page ?? 0) };
    const raw = await this.http.restGet<Record<string, unknown>>('/estoque/locais', query);
    const { data, pagination } = extractRestData<LocalEstoque>(raw);
    return normalizeRestPagination(data, pagination);
  }

  async buscarLocal(codigoLocal: number): Promise<LocalEstoque> {
    return this.http.restGet(`/estoque/locais/${codigoLocal}`);
  }

  listarTodos(): AsyncGenerator<Estoque> {
    return createPaginator((page) => this.listar({ page }));
  }
}
