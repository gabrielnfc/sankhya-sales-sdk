import type { HttpClient } from '../core/http.js';
import { createPaginator, extractRestData, normalizeRestPagination } from '../core/pagination.js';
import type { PaginatedResult } from '../types/common.js';
import type {
  ComponenteProduto,
  GrupoProduto,
  ListarProdutosParams,
  Produto,
  ProdutoAlternativo,
  Volume,
} from '../types/produtos.js';

export class ProdutosResource {
  constructor(private readonly http: HttpClient) {}

  async listar(params?: ListarProdutosParams): Promise<PaginatedResult<Produto>> {
    const query: Record<string, string> = { page: String(params?.page ?? 0) };
    if (params?.modifiedSince) query.modifiedSince = params.modifiedSince;

    const raw = await this.http.restGet<Record<string, unknown>>('/produtos', query);
    const { data, pagination } = extractRestData<Produto>(raw);
    return normalizeRestPagination(data, pagination);
  }

  async buscar(codigoProduto: number): Promise<Produto> {
    /** Sandbox retorna { produtos: { ...campos } } — precisa extrair o objeto interno */
    const raw = await this.http.restGet<Record<string, unknown>>(`/produtos/${codigoProduto}`);
    if (raw && typeof raw === 'object' && 'produtos' in raw) {
      return raw.produtos as Produto;
    }
    return raw as unknown as Produto;
  }

  async componentes(codigoProduto: number): Promise<ComponenteProduto[]> {
    const raw = await this.http.restGet<Record<string, unknown>>(
      `/produtos/${codigoProduto}/componentes`,
    );
    const { data } = extractRestData<ComponenteProduto>(raw);
    return data;
  }

  async alternativos(codigoProduto: number): Promise<ProdutoAlternativo[]> {
    const raw = await this.http.restGet<Record<string, unknown>>(
      `/produtos/${codigoProduto}/alternativos`,
    );
    const { data } = extractRestData<ProdutoAlternativo>(raw);
    return data;
  }

  async volumes(codigoProduto: number): Promise<Volume[]> {
    const raw = await this.http.restGet<Record<string, unknown>>(
      `/produtos/${codigoProduto}/volumes`,
    );
    const { data } = extractRestData<Volume>(raw);
    return data;
  }

  async listarVolumes(params?: { page?: number }): Promise<PaginatedResult<Volume>> {
    const query: Record<string, string> = { page: String(params?.page ?? 0) };
    const raw = await this.http.restGet<Record<string, unknown>>('/produtos/volumes', query);
    const { data, pagination } = extractRestData<Volume>(raw);
    return normalizeRestPagination(data, pagination);
  }

  async buscarVolume(codigoVolume: string): Promise<Volume> {
    return this.http.restGet(`/produtos/volumes/${codigoVolume}`);
  }

  async listarGrupos(params?: ListarProdutosParams): Promise<PaginatedResult<GrupoProduto>> {
    const query: Record<string, string> = { page: String(params?.page ?? 0) };
    if (params?.modifiedSince) query.modifiedSince = params.modifiedSince;

    const raw = await this.http.restGet<Record<string, unknown>>('/grupos-produto', query);
    const { data, pagination } = extractRestData<GrupoProduto>(raw);
    return normalizeRestPagination(data, pagination);
  }

  async buscarGrupo(codigoGrupoProduto: number): Promise<GrupoProduto> {
    return this.http.restGet(`/grupos-produto/${codigoGrupoProduto}`);
  }

  listarTodos(params?: Omit<ListarProdutosParams, 'page'>): AsyncGenerator<Produto> {
    return createPaginator((page) => this.listar({ ...params, page }));
  }
}
