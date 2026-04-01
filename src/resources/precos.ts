import type { HttpClient } from '../core/http.js';
import { extractRestData, normalizeRestPagination } from '../core/pagination.js';
import type { PaginatedResult } from '../types/common.js';
import type {
  Preco,
  PrecoContextualizadoInput,
  PrecosPorProdutoETabelaParams,
  PrecosPorTabelaParams,
} from '../types/precos.js';

export class PrecosResource {
  constructor(private readonly http: HttpClient) {}

  async porTabela(params: PrecosPorTabelaParams): Promise<PaginatedResult<Preco>> {
    const query: Record<string, string> = { pagina: String(params.pagina ?? 1) };
    const raw = await this.http.restGet<Record<string, unknown>>(
      `/precos/tabela/${params.codigoTabela}`,
      query,
    );
    const { data, pagination } = extractRestData<Preco>(raw);
    return normalizeRestPagination(data, pagination);
  }

  async porProduto(codigoProduto: number, pagina = 1): Promise<PaginatedResult<Preco>> {
    const raw = await this.http.restGet<Record<string, unknown>>(
      `/precos/produto/${codigoProduto}`,
      { pagina: String(pagina) },
    );
    const { data, pagination } = extractRestData<Preco>(raw);
    return normalizeRestPagination(data, pagination);
  }

  async porProdutoETabela(params: PrecosPorProdutoETabelaParams): Promise<PaginatedResult<Preco>> {
    const raw = await this.http.restGet<Record<string, unknown>>(
      `/precos/produto/${params.codigoProduto}/tabela/${params.codigoTabela}`,
      { pagina: String(params.pagina ?? 1) },
    );
    const { data, pagination } = extractRestData<Preco>(raw);
    return normalizeRestPagination(data, pagination);
  }

  async contextualizado(input: PrecoContextualizadoInput): Promise<Preco[]> {
    const raw = await this.http.restPost<Record<string, unknown>>('/precos/contextualizado', input);
    const { data } = extractRestData<Preco>(raw);
    return data;
  }
}
