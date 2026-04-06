import type { HttpClient } from '../core/http.js';
import { createPaginator, extractRestData, normalizeRestPagination } from '../core/pagination.js';
import type { PaginatedResult } from '../types/common.js';
import type { RequestOptions } from '../types/config.js';
import type {
  ContaBancaria,
  Moeda,
  Receita,
  ReceitasFiltro,
  TipoPagamento,
} from '../types/financeiros.js';

export class FinanceirosResource {
  constructor(private readonly http: HttpClient) {}

  // --- Tipos de Pagamento ---

  async listarTiposPagamento(params?: {
    page?: number;
    subTipoPagamento?: number;
  }): Promise<PaginatedResult<TipoPagamento>> {
    const query: Record<string, string> = { page: String(params?.page ?? 0) };
    if (params?.subTipoPagamento !== undefined)
      query.subTipoPagamento = String(params.subTipoPagamento);

    const raw = await this.http.restGet<Record<string, unknown>>(
      '/financeiros/tipos-pagamento',
      query,
    );
    const { data, pagination } = extractRestData<TipoPagamento>(raw);
    return normalizeRestPagination(data, pagination);
  }

  async buscarTipoPagamento(codigoTipoPagamento: number): Promise<TipoPagamento> {
    return this.http.restGet(`/financeiros/tipos-pagamento/${codigoTipoPagamento}`);
  }

  // --- Receitas ---

  async listarReceitas(filtro?: ReceitasFiltro): Promise<PaginatedResult<Receita>> {
    const query: Record<string, string> = { page: String(filtro?.page ?? 0) };
    if (filtro?.codigoEmpresa !== undefined) query.codigoEmpresa = String(filtro.codigoEmpresa);
    if (filtro?.codigoParceiro !== undefined) query.codigoParceiro = String(filtro.codigoParceiro);
    if (filtro?.statusFinanceiro !== undefined)
      query.statusFinanceiro = String(filtro.statusFinanceiro);
    if (filtro?.tipoFinanceiro !== undefined) query.tipoFinanceiro = String(filtro.tipoFinanceiro);
    if (filtro?.dataNegociacaoInicio) query.dataNegociacaoInicio = filtro.dataNegociacaoInicio;
    if (filtro?.dataNegociacaoFinal) query.dataNegociacaoFinal = filtro.dataNegociacaoFinal;

    const raw = await this.http.restGet<Record<string, unknown>>('/financeiros/receitas', query);
    const { data, pagination } = extractRestData<Receita>(raw);
    return normalizeRestPagination(data, pagination);
  }

  async registrarReceita(dados: Record<string, unknown>, options?: RequestOptions): Promise<unknown> {
    return this.http.restPost('/financeiros/receitas', dados, options);
  }

  async atualizarReceita(
    codigoFinanceiro: number,
    dados: Record<string, unknown>,
    options?: RequestOptions,
  ): Promise<unknown> {
    return this.http.restPut(`/financeiros/receitas/${codigoFinanceiro}`, dados, options);
  }

  async baixarReceita(dados: Record<string, unknown>, options?: RequestOptions): Promise<unknown> {
    return this.http.restPost('/financeiros/receitas/baixa', dados, options);
  }

  // --- Despesas ---

  async listarDespesas(params?: { page?: number }): Promise<PaginatedResult<Receita>> {
    const query: Record<string, string> = { page: String(params?.page ?? 0) };
    const raw = await this.http.restGet<Record<string, unknown>>('/financeiros/despesas', query);
    const { data, pagination } = extractRestData<Receita>(raw);
    return normalizeRestPagination(data, pagination);
  }

  async registrarDespesa(dados: Record<string, unknown>, options?: RequestOptions): Promise<unknown> {
    return this.http.restPost('/financeiros/despesas', dados, options);
  }

  async atualizarDespesa(
    codigoFinanceiro: number,
    dados: Record<string, unknown>,
    options?: RequestOptions,
  ): Promise<unknown> {
    return this.http.restPut(`/financeiros/despesas/${codigoFinanceiro}`, dados, options);
  }

  async baixarDespesa(dados: Record<string, unknown>, options?: RequestOptions): Promise<unknown> {
    return this.http.restPost('/financeiros/despesas/baixa', dados, options);
  }

  // --- Moedas ---

  async listarMoedas(params?: { page?: number }): Promise<PaginatedResult<Moeda>> {
    const query: Record<string, string> = { page: String(params?.page ?? 0) };
    const raw = await this.http.restGet<Record<string, unknown>>('/financeiros/moedas', query);
    const { data, pagination } = extractRestData<Moeda>(raw);
    return normalizeRestPagination(data, pagination);
  }

  async buscarMoeda(codigoMoeda: number): Promise<Moeda> {
    return this.http.restGet(`/financeiros/moedas/${codigoMoeda}`);
  }

  // --- Contas Bancárias ---

  async listarContasBancarias(): Promise<ContaBancaria[]> {
    const raw = await this.http.restGet<Record<string, unknown>>('/financeiros/contas-bancaria');
    const { data } = extractRestData<ContaBancaria>(raw);
    return data;
  }

  async buscarContaBancaria(codigoContaBancaria: number): Promise<ContaBancaria> {
    return this.http.restGet(`/financeiros/contas-bancaria/${codigoContaBancaria}`);
  }

  // --- Iteradores ---

  listarTodasReceitas(filtro?: Omit<ReceitasFiltro, 'page'>): AsyncGenerator<Receita> {
    return createPaginator((page) => this.listarReceitas({ ...filtro, page }));
  }
}
