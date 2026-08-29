import type { HttpClient } from '../core/http.js';
import { createPaginator, extractRestData, normalizePagination } from '../core/pagination.js';
import type { PaginatedResult } from '../types/common.js';
import type { DegradedInfo, ResourceDescriptor } from '../types/pagination-contracts.js';
import type {
  Preco,
  PrecoContextualizadoInput,
  PrecosPorProdutoETabelaParams,
  PrecosPorTabelaParams,
} from '../types/precos.js';

const DESCRITOR_POR_TABELA: ResourceDescriptor = {
  resourceKey: 'produtos',
  contract: 'precos',
  expectPagination: false,
  endpoint: '/precos/tabela/{id}',
};

const DESCRITOR_POR_PRODUTO: ResourceDescriptor = {
  resourceKey: 'produtos',
  contract: 'precos',
  expectPagination: false,
  endpoint: '/precos/produto/{id}',
};

const DESCRITOR_POR_PRODUTO_E_TABELA: ResourceDescriptor = {
  resourceKey: 'produtos',
  contract: 'precos',
  expectPagination: false,
  endpoint: '/precos/produto/{id}/tabela/{id}',
};

const DESCRITOR_CONTEXTUALIZADO: ResourceDescriptor = {
  // resourceKey null: endpoint nao mensuravel neste sandbox (ver §10 do design).
  // Mantem o comportamento legado de primeiro array; sem deteccao de degradacao.
  resourceKey: null,
  contract: 'precos',
  expectPagination: false,
  endpoint: '/precos/contextualizado',
};

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
    const { data, degraded, degradedInfo } = extractRestData<Preco>(raw, DESCRITOR_POR_TABELA);
    return normalizePagination(
      data,
      raw,
      DESCRITOR_POR_TABELA,
      degraded,
      this.http.getLogger(),
      degradedInfo,
    );
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
    const { data, degraded, degradedInfo } = extractRestData<Preco>(raw, DESCRITOR_POR_PRODUTO);
    return normalizePagination(
      data,
      raw,
      DESCRITOR_POR_PRODUTO,
      degraded,
      this.http.getLogger(),
      degradedInfo,
    );
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
    const { data, degraded, degradedInfo } = extractRestData<Preco>(
      raw,
      DESCRITOR_POR_PRODUTO_E_TABELA,
    );
    return normalizePagination(
      data,
      raw,
      DESCRITOR_POR_PRODUTO_E_TABELA,
      degraded,
      this.http.getLogger(),
      degradedInfo,
    );
  }

  /**
   * Itera sobre todos os precos de uma tabela automaticamente.
   *
   * @param params - Codigo da tabela (sem paginacao).
   * @returns AsyncGenerator que emite precos individualmente.
   * @throws {ApiError} Em erro HTTP.
   * @throws {AuthError} Se autenticacao falhar.
   */
  todosPorTabela(
    params: Omit<PrecosPorTabelaParams, 'pagina'> & {
      onDegraded?: ((info: DegradedInfo) => void) | undefined;
    },
  ): AsyncGenerator<Preco> {
    const { onDegraded, ...filtros } = params;
    return createPaginator((page) => this.porTabela({ ...filtros, pagina: page }), 1, {
      onDegraded,
      logger: this.http.getLogger(),
    });
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
    const { data } = extractRestData<Preco>(raw, DESCRITOR_CONTEXTUALIZADO);
    return data;
  }
}
