import { toSankhyaDateMaybe } from '../core/date.js';
import { SankhyaError } from '../core/errors.js';
import type { HttpClient } from '../core/http.js';
import {
  createPaginator,
  extractRestData,
  extractRestRecordOrThrow,
  normalizePagination,
} from '../core/pagination.js';
import { safeParseNumber } from '../core/parse-utils.js';
import {
  validateBaixarFinanceiroInput,
  validateRegistrarDespesaInput,
  validateRegistrarReceitaInput,
} from '../core/validators.js';
import type { PaginatedResult } from '../types/common.js';
import type { RequestOptions } from '../types/config.js';
import type {
  AtualizarDespesaInput,
  AtualizarReceitaInput,
  BaixaResult,
  BaixarDespesaInput,
  BaixarReceitaInput,
  ContaBancaria,
  Despesa,
  Moeda,
  Receita,
  ReceitasFiltro,
  RegistrarDespesaInput,
  RegistrarFinanceiroResponse,
  RegistrarReceitaInput,
  TipoPagamento,
} from '../types/financeiros.js';
import type { DegradedInfo, ResourceDescriptor } from '../types/pagination-contracts.js';

const DESCRITOR_TIPOS_PAGAMENTO: ResourceDescriptor = {
  resourceKey: 'data',
  contract: 'rest',
  expectPagination: true,
};

const DESCRITOR_RECEITAS: ResourceDescriptor = {
  resourceKey: 'financeiros',
  contract: 'financeiro',
  expectPagination: true,
};

const DESCRITOR_DESPESAS: ResourceDescriptor = {
  resourceKey: 'financeiros',
  contract: 'financeiro',
  expectPagination: true,
};

const DESCRITOR_MOEDAS: ResourceDescriptor = {
  resourceKey: 'data',
  contract: 'rest',
  expectPagination: true,
};

const DESCRITOR_CONTAS_BANCARIAS: ResourceDescriptor = {
  resourceKey: 'data',
  contract: 'rest',
  expectPagination: true,
};

/**
 * Operacoes financeiras no Sankhya ERP (receitas, despesas, pagamentos).
 * Acesse via `sankhya.financeiros`.
 */
export class FinanceirosResource {
  constructor(private readonly http: HttpClient) {}

  /**
   * Monta o payload de um movimento financeiro: converte os campos de data
   * informados (ISO -> `dd/MM/yyyy`) e mescla `camposExtras` no objeto.
   *
   * @internal
   */
  private buildFinanceiroPayload(
    dados: Record<string, unknown>,
    dateFields: string[],
  ): Record<string, unknown> {
    const { camposExtras, ...rest } = dados;
    const out: Record<string, unknown> = { ...rest };
    for (const field of dateFields) {
      if (typeof out[field] === 'string') out[field] = toSankhyaDateMaybe(out[field] as string);
    }
    if (camposExtras) Object.assign(out, camposExtras as Record<string, unknown>);
    return out;
  }

  /**
   * Desempacota o codigo do financeiro do envelope REST
   * (`{ codigo, tipo, mensagem, retorno: { codigoFinanceiro } }`). Lanca quando
   * ausente, em vez de fabricar um `0` silencioso.
   *
   * @internal
   */
  private extractCodigoFinanceiro(raw: unknown): number {
    const envelope = (raw ?? {}) as Record<string, unknown>;
    const retorno = (envelope.retorno ?? {}) as Record<string, unknown>;
    // Nao usar `envelope.codigo`: e o status code do envelope, nao o NUFIN.
    const value = retorno.codigoFinanceiro ?? envelope.codigoFinanceiro;
    if (value === undefined || value === null) {
      throw new SankhyaError(
        'Resposta financeira sem codigoFinanceiro (envelope inesperado da API)',
        'API_ERROR',
      );
    }
    return safeParseNumber(value, 'codigoFinanceiro');
  }

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
    const { data, degraded, degradedInfo } = extractRestData<TipoPagamento>(
      raw,
      DESCRITOR_TIPOS_PAGAMENTO,
    );
    return normalizePagination(
      data,
      raw,
      DESCRITOR_TIPOS_PAGAMENTO,
      degraded,
      this.http.getLogger(),
      degradedInfo,
    );
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
    const raw = await this.http.restGet<Record<string, unknown>>(
      `/financeiros/tipos-pagamento/${codigoTipoPagamento}`,
    );
    return extractRestRecordOrThrow<TipoPagamento>(
      raw,
      `Tipo de pagamento ${codigoTipoPagamento} nao encontrado`,
    );
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
    const { data, degraded, degradedInfo } = extractRestData<Receita>(raw, DESCRITOR_RECEITAS);
    return normalizePagination(
      data,
      raw,
      DESCRITOR_RECEITAS,
      degraded,
      this.http.getLogger(),
      degradedInfo,
    );
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
    validateRegistrarReceitaInput(dados, 'RegistrarReceitaInput');
    const payload = this.buildFinanceiroPayload(dados as unknown as Record<string, unknown>, [
      'dataNegociacao',
      'dataVencimento',
    ]);
    const raw = await this.http.restPost<Record<string, unknown>>(
      '/financeiros/receitas',
      payload,
      options,
    );
    return { codigoFinanceiro: this.extractCodigoFinanceiro(raw) };
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
    const payload = this.buildFinanceiroPayload(dados as unknown as Record<string, unknown>, [
      'dataNegociacao',
      'dataVencimento',
    ]);
    const raw = await this.http.restPut<Record<string, unknown>>(
      `/financeiros/receitas/${codigoFinanceiro}`,
      payload,
      options,
    );
    return { codigoFinanceiro: this.extractCodigoFinanceiro(raw) };
  }

  /**
   * Realiza a baixa (liquidacao) de uma receita.
   *
   * `codigoFinanceiro` vai na URL; o restante no corpo. `dataBaixa` (ISO ou
   * `dd/MM/yyyy`) e convertida para `dd/MM/yyyy`.
   *
   * @param dados - Dados da baixa (inclui o `codigoFinanceiro` a baixar).
   * @param options - Opcoes de requisicao.
   * @returns Codigo do financeiro baixado.
   * @throws {ApiError} Em erro HTTP (ex.: conta obrigatoria, data ausente).
   * @throws {AuthError} Se autenticacao falhar.
   */
  async baixarReceita(dados: BaixarReceitaInput, options?: RequestOptions): Promise<BaixaResult> {
    validateBaixarFinanceiroInput(dados, 'BaixarReceitaInput');
    const { codigoFinanceiro, ...corpo } = dados;
    const body = this.buildFinanceiroPayload(corpo, ['dataBaixa']);
    const raw = await this.http.restPost<Record<string, unknown>>(
      `/financeiros/receitas/${codigoFinanceiro}/baixa`,
      body,
      options,
    );
    return { codigoFinanceiro: this.extractCodigoFinanceiro(raw) };
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
  async listarDespesas(params?: { page?: number }): Promise<PaginatedResult<Despesa>> {
    const query: Record<string, string> = { page: String(params?.page ?? 0) };
    const raw = await this.http.restGet<Record<string, unknown>>('/financeiros/despesas', query);
    const { data, degraded, degradedInfo } = extractRestData<Despesa>(raw, DESCRITOR_DESPESAS);
    return normalizePagination(
      data,
      raw,
      DESCRITOR_DESPESAS,
      degraded,
      this.http.getLogger(),
      degradedInfo,
    );
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
    validateRegistrarDespesaInput(dados, 'RegistrarDespesaInput');
    const payload = this.buildFinanceiroPayload(dados as unknown as Record<string, unknown>, [
      'dataNegociacao',
      'dataVencimento',
    ]);
    const raw = await this.http.restPost<Record<string, unknown>>(
      '/financeiros/despesas',
      payload,
      options,
    );
    return { codigoFinanceiro: this.extractCodigoFinanceiro(raw) };
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
    const payload = this.buildFinanceiroPayload(dados as unknown as Record<string, unknown>, [
      'dataNegociacao',
      'dataVencimento',
    ]);
    const raw = await this.http.restPut<Record<string, unknown>>(
      `/financeiros/despesas/${codigoFinanceiro}`,
      payload,
      options,
    );
    return { codigoFinanceiro: this.extractCodigoFinanceiro(raw) };
  }

  /**
   * Realiza a baixa (liquidacao) de uma despesa.
   *
   * `codigoFinanceiro` vai na URL; o restante no corpo. `dataBaixa` (ISO ou
   * `dd/MM/yyyy`) e convertida para `dd/MM/yyyy`.
   *
   * @param dados - Dados da baixa (inclui o `codigoFinanceiro` a baixar).
   * @param options - Opcoes de requisicao.
   * @returns Codigo do financeiro baixado.
   * @throws {ApiError} Em erro HTTP (ex.: conta obrigatoria, data ausente).
   * @throws {AuthError} Se autenticacao falhar.
   */
  async baixarDespesa(dados: BaixarDespesaInput, options?: RequestOptions): Promise<BaixaResult> {
    validateBaixarFinanceiroInput(dados, 'BaixarDespesaInput');
    const { codigoFinanceiro, ...corpo } = dados;
    const body = this.buildFinanceiroPayload(corpo, ['dataBaixa']);
    const raw = await this.http.restPost<Record<string, unknown>>(
      `/financeiros/despesas/${codigoFinanceiro}/baixa`,
      body,
      options,
    );
    return { codigoFinanceiro: this.extractCodigoFinanceiro(raw) };
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
    const { data, degraded, degradedInfo } = extractRestData<Moeda>(raw, DESCRITOR_MOEDAS);
    return normalizePagination(
      data,
      raw,
      DESCRITOR_MOEDAS,
      degraded,
      this.http.getLogger(),
      degradedInfo,
    );
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
    const raw = await this.http.restGet<Record<string, unknown>>(
      `/financeiros/moedas/${codigoMoeda}`,
    );
    return extractRestRecordOrThrow<Moeda>(raw, `Moeda ${codigoMoeda} nao encontrada`);
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
    const paginar = async (page: number) => {
      const raw = await this.http.restGet<Record<string, unknown>>('/financeiros/contas-bancaria', {
        page: String(page),
      });
      const { data, degraded, degradedInfo } = extractRestData<ContaBancaria>(
        raw,
        DESCRITOR_CONTAS_BANCARIAS,
      );
      return normalizePagination(
        data,
        raw,
        DESCRITOR_CONTAS_BANCARIAS,
        degraded,
        this.http.getLogger(),
        degradedInfo,
      );
    };

    const todas: ContaBancaria[] = [];
    for await (const conta of createPaginator(paginar, 0, { logger: this.http.getLogger() })) {
      todas.push(conta);
    }
    return todas;
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
    const raw = await this.http.restGet<Record<string, unknown>>(
      `/financeiros/contas-bancaria/${codigoContaBancaria}`,
    );
    return extractRestRecordOrThrow<ContaBancaria>(
      raw,
      `Conta bancaria ${codigoContaBancaria} nao encontrada`,
    );
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
  listarTodasReceitas(
    filtro?: Omit<ReceitasFiltro, 'page'> & {
      onDegraded?: ((info: DegradedInfo) => void) | undefined;
    },
  ): AsyncGenerator<Receita> {
    const { onDegraded, ...filtros } = filtro ?? {};
    return createPaginator((page) => this.listarReceitas({ ...filtros, page }), 0, {
      onDegraded,
      logger: this.http.getLogger(),
    });
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
    params?: Omit<{ page?: number; subTipoPagamento?: number }, 'page'> & {
      onDegraded?: ((info: DegradedInfo) => void) | undefined;
    },
  ): AsyncGenerator<TipoPagamento> {
    const { onDegraded, ...filtros } = params ?? {};
    return createPaginator((page) => this.listarTiposPagamento({ ...filtros, page }), 0, {
      onDegraded,
      logger: this.http.getLogger(),
    });
  }

  /**
   * Itera sobre todas as despesas automaticamente.
   *
   * @returns AsyncGenerator que emite despesas individualmente.
   * @throws {ApiError} Em erro HTTP.
   * @throws {AuthError} Se autenticacao falhar.
   */
  listarTodasDespesas(params?: {
    onDegraded?: ((info: DegradedInfo) => void) | undefined;
  }): AsyncGenerator<Despesa> {
    const { onDegraded } = params ?? {};
    return createPaginator((page) => this.listarDespesas({ page }), 0, {
      onDegraded,
      logger: this.http.getLogger(),
    });
  }

  /**
   * Itera sobre todas as moedas automaticamente.
   *
   * @returns AsyncGenerator que emite moedas individualmente.
   * @throws {ApiError} Em erro HTTP.
   * @throws {AuthError} Se autenticacao falhar.
   */
  listarTodasMoedas(params?: {
    onDegraded?: ((info: DegradedInfo) => void) | undefined;
  }): AsyncGenerator<Moeda> {
    const { onDegraded } = params ?? {};
    return createPaginator((page) => this.listarMoedas({ page }), 0, {
      onDegraded,
      logger: this.http.getLogger(),
    });
  }
}
