import type { HttpClient } from '../core/http.js';
import { createPaginator, extractRestData, normalizeRestPagination } from '../core/pagination.js';
import type { PaginatedResult } from '../types/common.js';
import type { RequestOptions } from '../types/config.js';
import type {
  AtualizarDespesaInput,
  AtualizarReceitaInput,
  BaixarDespesaInput,
  BaixarReceitaInput,
  ContaBancaria,
  Moeda,
  Receita,
  ReceitasFiltro,
  RegistrarDespesaInput,
  RegistrarFinanceiroResponse,
  RegistrarReceitaInput,
  TipoPagamento,
} from '../types/financeiros.js';

/**
 * Operacoes financeiras no Sankhya ERP (receitas, despesas, pagamentos).
 * Acesse via `sankhya.financeiros`.
 */
export class FinanceirosResource {
  constructor(private readonly http: HttpClient) {}

  // --- Tipos de Pagamento ---

  /**
   * Lista tipos de pagamento paginados.
   *
   * @param params - Filtros e paginacao.
   * @returns Resultado paginado com tipos de pagamento.
   * @throws {ApiError} Em erro HTTP.
   * @throws {AuthError} Se autenticacao falhar.
   */
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

  /**
   * Busca um tipo de pagamento pelo codigo.
   *
   * @param codigoTipoPagamento - Codigo do tipo de pagamento.
   * @returns Tipo de pagamento encontrado.
   * @throws {ApiError} Em erro HTTP.
   * @throws {AuthError} Se autenticacao falhar.
   */
  async buscarTipoPagamento(codigoTipoPagamento: number): Promise<TipoPagamento> {
    return this.http.restGet(`/financeiros/tipos-pagamento/${codigoTipoPagamento}`);
  }

  // --- Receitas ---

  /**
   * Lista receitas (titulos a receber) paginadas.
   *
   * @param filtro - Filtros e paginacao.
   * @returns Resultado paginado com receitas.
   * @throws {ApiError} Em erro HTTP.
   * @throws {AuthError} Se autenticacao falhar.
   * @example
   * ```ts
   * const receitas = await sankhya.financeiros.listarReceitas({
   *   codigoEmpresa: 1,
   * });
   * ```
   */
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

  /**
   * Registra uma nova receita (titulo a receber).
   *
   * @param dados - Dados da receita.
   * @param options - Opcoes de requisicao.
   * @returns Codigo do financeiro criado.
   * @throws {ApiError} Em erro HTTP.
   * @throws {AuthError} Se autenticacao falhar.
   */
  async registrarReceita(
    dados: RegistrarReceitaInput,
    options?: RequestOptions,
  ): Promise<RegistrarFinanceiroResponse> {
    return this.http.restPost('/financeiros/receitas', dados, options);
  }

  /**
   * Atualiza uma receita existente.
   *
   * @param codigoFinanceiro - Codigo do titulo financeiro.
   * @param dados - Campos a atualizar.
   * @param options - Opcoes de requisicao.
   * @returns Codigo do financeiro atualizado.
   * @throws {ApiError} Em erro HTTP.
   * @throws {AuthError} Se autenticacao falhar.
   */
  async atualizarReceita(
    codigoFinanceiro: number,
    dados: AtualizarReceitaInput,
    options?: RequestOptions,
  ): Promise<RegistrarFinanceiroResponse> {
    return this.http.restPut(`/financeiros/receitas/${codigoFinanceiro}`, dados, options);
  }

  /**
   * Registra a baixa (pagamento) de uma receita.
   *
   * @param dados - Dados da baixa.
   * @param options - Opcoes de requisicao.
   * @returns Resposta da API.
   * @throws {ApiError} Em erro HTTP.
   * @throws {AuthError} Se autenticacao falhar.
   */
  async baixarReceita(dados: BaixarReceitaInput, options?: RequestOptions): Promise<unknown> {
    return this.http.restPost('/financeiros/receitas/baixa', dados, options);
  }

  // --- Despesas ---

  /**
   * Lista despesas (titulos a pagar) paginadas.
   *
   * @param params - Paginacao.
   * @returns Resultado paginado com despesas.
   * @throws {ApiError} Em erro HTTP.
   * @throws {AuthError} Se autenticacao falhar.
   */
  async listarDespesas(params?: { page?: number }): Promise<PaginatedResult<Receita>> {
    const query: Record<string, string> = { page: String(params?.page ?? 0) };
    const raw = await this.http.restGet<Record<string, unknown>>('/financeiros/despesas', query);
    const { data, pagination } = extractRestData<Receita>(raw);
    return normalizeRestPagination(data, pagination);
  }

  /**
   * Registra uma nova despesa (titulo a pagar).
   *
   * @param dados - Dados da despesa.
   * @param options - Opcoes de requisicao.
   * @returns Codigo do financeiro criado.
   * @throws {ApiError} Em erro HTTP.
   * @throws {AuthError} Se autenticacao falhar.
   */
  async registrarDespesa(
    dados: RegistrarDespesaInput,
    options?: RequestOptions,
  ): Promise<RegistrarFinanceiroResponse> {
    return this.http.restPost('/financeiros/despesas', dados, options);
  }

  /**
   * Atualiza uma despesa existente.
   *
   * @param codigoFinanceiro - Codigo do titulo financeiro.
   * @param dados - Campos a atualizar.
   * @param options - Opcoes de requisicao.
   * @returns Codigo do financeiro atualizado.
   * @throws {ApiError} Em erro HTTP.
   * @throws {AuthError} Se autenticacao falhar.
   */
  async atualizarDespesa(
    codigoFinanceiro: number,
    dados: AtualizarDespesaInput,
    options?: RequestOptions,
  ): Promise<RegistrarFinanceiroResponse> {
    return this.http.restPut(`/financeiros/despesas/${codigoFinanceiro}`, dados, options);
  }

  /**
   * Registra a baixa (pagamento) de uma despesa.
   *
   * @param dados - Dados da baixa.
   * @param options - Opcoes de requisicao.
   * @returns Resposta da API.
   * @throws {ApiError} Em erro HTTP.
   * @throws {AuthError} Se autenticacao falhar.
   */
  async baixarDespesa(dados: BaixarDespesaInput, options?: RequestOptions): Promise<unknown> {
    return this.http.restPost('/financeiros/despesas/baixa', dados, options);
  }

  // --- Moedas ---

  /**
   * Lista moedas paginadas.
   *
   * @param params - Paginacao.
   * @returns Resultado paginado com moedas.
   * @throws {ApiError} Em erro HTTP.
   * @throws {AuthError} Se autenticacao falhar.
   */
  async listarMoedas(params?: { page?: number }): Promise<PaginatedResult<Moeda>> {
    const query: Record<string, string> = { page: String(params?.page ?? 0) };
    const raw = await this.http.restGet<Record<string, unknown>>('/financeiros/moedas', query);
    const { data, pagination } = extractRestData<Moeda>(raw);
    return normalizeRestPagination(data, pagination);
  }

  /**
   * Busca uma moeda pelo codigo.
   *
   * @param codigoMoeda - Codigo da moeda.
   * @returns Moeda encontrada.
   * @throws {ApiError} Em erro HTTP.
   * @throws {AuthError} Se autenticacao falhar.
   */
  async buscarMoeda(codigoMoeda: number): Promise<Moeda> {
    return this.http.restGet(`/financeiros/moedas/${codigoMoeda}`);
  }

  // --- Contas Bancarias ---

  /**
   * Lista todas as contas bancarias.
   *
   * @returns Array de contas bancarias.
   * @throws {ApiError} Em erro HTTP.
   * @throws {AuthError} Se autenticacao falhar.
   */
  async listarContasBancarias(): Promise<ContaBancaria[]> {
    const raw = await this.http.restGet<Record<string, unknown>>('/financeiros/contas-bancaria');
    const { data } = extractRestData<ContaBancaria>(raw);
    return data;
  }

  /**
   * Busca uma conta bancaria pelo codigo.
   *
   * @param codigoContaBancaria - Codigo da conta bancaria.
   * @returns Conta bancaria encontrada.
   * @throws {ApiError} Em erro HTTP.
   * @throws {AuthError} Se autenticacao falhar.
   */
  async buscarContaBancaria(codigoContaBancaria: number): Promise<ContaBancaria> {
    return this.http.restGet(`/financeiros/contas-bancaria/${codigoContaBancaria}`);
  }

  // --- Iteradores ---

  /**
   * Itera sobre todas as receitas automaticamente.
   *
   * @param filtro - Filtros (sem paginacao).
   * @returns AsyncGenerator que emite receitas individualmente.
   * @throws {ApiError} Em erro HTTP.
   * @throws {AuthError} Se autenticacao falhar.
   */
  listarTodasReceitas(filtro?: Omit<ReceitasFiltro, 'page'>): AsyncGenerator<Receita> {
    return createPaginator((page) => this.listarReceitas({ ...filtro, page }));
  }

  /**
   * Itera sobre todos os tipos de pagamento automaticamente.
   *
   * @param params - Filtros (sem paginacao).
   * @returns AsyncGenerator que emite tipos de pagamento.
   * @throws {ApiError} Em erro HTTP.
   * @throws {AuthError} Se autenticacao falhar.
   */
  listarTodosTiposPagamento(
    params?: Omit<{ page?: number; subTipoPagamento?: number }, 'page'>,
  ): AsyncGenerator<TipoPagamento> {
    return createPaginator((page) => this.listarTiposPagamento({ ...params, page }));
  }

  /**
   * Itera sobre todas as despesas automaticamente.
   *
   * @returns AsyncGenerator que emite despesas individualmente.
   * @throws {ApiError} Em erro HTTP.
   * @throws {AuthError} Se autenticacao falhar.
   */
  listarTodasDespesas(): AsyncGenerator<Receita> {
    return createPaginator((page) => this.listarDespesas({ page }));
  }

  /**
   * Itera sobre todas as moedas automaticamente.
   *
   * @returns AsyncGenerator que emite moedas individualmente.
   * @throws {ApiError} Em erro HTTP.
   * @throws {AuthError} Se autenticacao falhar.
   */
  listarTodasMoedas(): AsyncGenerator<Moeda> {
    return createPaginator((page) => this.listarMoedas({ page }));
  }
}
