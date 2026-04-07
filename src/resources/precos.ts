import type { HttpClient } from '../core/http.js';
import { createPaginator, extractRestData, normalizeRestPagination } from '../core/pagination.js';
import type { PaginatedResult } from '../types/common.js';
import type {
  Preco,
  PrecoContextualizadoInput,
  PrecosPorProdutoETabelaParams,
  PrecosPorTabelaParams,
} from '../types/precos.js';

/** Operacoes de precos e tabelas de preco no Sankhya ERP. Acesse via `sankhya.precos`. */
export class PrecosResource {
  constructor(private readonly http: HttpClient) {}

  /**
   * Lista precos de uma tabela de preco.
   *
   * @param params - Codigo da tabela e paginacao.
   * @returns Resultado paginado com precos.
   * @throws {ApiError} Em erro HTTP.
   * @throws {AuthError} Se autenticacao falhar.
   * @example
   * ```ts
   * const precos = await sankhya.precos.porTabela({
   *   codigoTabela: 1,
   * });
   * ```
   */
  async porTabela(params: PrecosPorTabelaParams): Promise<PaginatedResult<Preco>> {
    const query: Record<string, string> = { pagina: String(params.pagina ?? 1) };
    const raw = await this.http.restGet<Record<string, unknown>>(
      `/precos/tabela/${params.codigoTabela}`,
      query,
    );
    const { data, pagination } = extractRestData<Preco>(raw);
    return normalizeRestPagination(data, pagination);
  }

  /**
   * Lista precos de um produto em todas as tabelas.
   *
   * @param codigoProduto - Codigo do produto.
   * @param pagina - Numero da pagina (default: 1).
   * @returns Resultado paginado com precos.
   * @throws {ApiError} Em erro HTTP.
   * @throws {AuthError} Se autenticacao falhar.
   */
  async porProduto(codigoProduto: number, pagina = 1): Promise<PaginatedResult<Preco>> {
    const raw = await this.http.restGet<Record<string, unknown>>(
      `/precos/produto/${codigoProduto}`,
      { pagina: String(pagina) },
    );
    const { data, pagination } = extractRestData<Preco>(raw);
    return normalizeRestPagination(data, pagination);
  }

  /**
   * Lista precos de um produto em uma tabela especifica.
   *
   * @param params - Codigos do produto e tabela, com paginacao.
   * @returns Resultado paginado com precos.
   * @throws {ApiError} Em erro HTTP.
   * @throws {AuthError} Se autenticacao falhar.
   */
  async porProdutoETabela(params: PrecosPorProdutoETabelaParams): Promise<PaginatedResult<Preco>> {
    const raw = await this.http.restGet<Record<string, unknown>>(
      `/precos/produto/${params.codigoProduto}/tabela/${params.codigoTabela}`,
      { pagina: String(params.pagina ?? 1) },
    );
    const { data, pagination } = extractRestData<Preco>(raw);
    return normalizeRestPagination(data, pagination);
  }

  /**
   * Itera sobre todos os precos de uma tabela automaticamente.
   *
   * @param params - Codigo da tabela (sem paginacao).
   * @returns AsyncGenerator que emite precos individualmente.
   * @throws {ApiError} Em erro HTTP.
   * @throws {AuthError} Se autenticacao falhar.
   */
  todosPorTabela(params: Omit<PrecosPorTabelaParams, 'pagina'>): AsyncGenerator<Preco> {
    return createPaginator((page) => this.porTabela({ ...params, pagina: page }), 1);
  }

  /**
   * Calcula precos contextualizados (com impostos e descontos).
   *
   * @param input - Contexto de negociacao e produtos.
   * @returns Array de precos calculados.
   * @throws {ApiError} Em erro HTTP.
   * @throws {AuthError} Se autenticacao falhar.
   * @example
   * ```ts
   * const precos = await sankhya.precos.contextualizado({
   *   codigoEmpresa: 1,
   *   codigoCliente: 100,
   *   codigoVendedor: 10,
   *   codigoTipoOperacao: 1000,
   *   codigoTipoNegociacao: 1,
   *   produtos: [{ codigoProduto: 5, quantidade: 10 }],
   * });
   * ```
   */
  async contextualizado(input: PrecoContextualizadoInput): Promise<Preco[]> {
    const raw = await this.http.restPost<Record<string, unknown>>('/precos/contextualizado', input);
    const { data } = extractRestData<Preco>(raw);
    return data;
  }
}
