import type { HttpClient } from '../core/http.js';
import { createPaginator, extractRestData, normalizeRestPagination } from '../core/pagination.js';
import type {
  AtualizarClienteInput,
  Cliente,
  Contato,
  CriarClienteInput,
  ListarClientesParams,
} from '../types/clientes.js';
import type { PaginatedResult } from '../types/common.js';

/** Operacoes de clientes (parceiros) no Sankhya ERP. Acesse via `sankhya.clientes`. */
export class ClientesResource {
  constructor(private readonly http: HttpClient) {}

  /**
   * Lista clientes paginados.
   *
   * @param params - Filtros e paginacao.
   * @returns Resultado paginado com clientes.
   * @throws {ApiError} Em erro HTTP.
   * @throws {AuthError} Se autenticacao falhar.
   * @example
   * ```ts
   * const resultado = await sankhya.clientes.listar({ page: 1 });
   * ```
   */
  async listar(params?: ListarClientesParams): Promise<PaginatedResult<Cliente>> {
    const query: Record<string, string> = { page: String(params?.page ?? 1) };
    if (params?.dataHoraAlteracao) query.dataHoraAlteracao = params.dataHoraAlteracao;

    const raw = await this.http.restGet<Record<string, unknown>>('/parceiros/clientes', query);
    const { data, pagination } = extractRestData<Cliente>(raw);
    return normalizeRestPagination(data, pagination);
  }

  /**
   * Cria um novo cliente.
   *
   * @param dados - Dados do cliente a criar.
   * @returns Codigo do cliente criado.
   * @throws {ApiError} Em erro HTTP.
   * @throws {AuthError} Se autenticacao falhar.
   * @example
   * ```ts
   * const { codigoCliente } = await sankhya.clientes.criar({
   *   nome: 'Empresa Teste',
   *   tipo: 'J',
   *   cnpjCpf: '12345678000199',
   *   endereco: { logradouro: 'Rua A', numero: '1',
   *     bairro: 'Centro', cidade: 'SP',
   *     codigoIbge: '3550308', uf: 'SP', cep: '01000000' },
   * });
   * ```
   */
  async criar(dados: CriarClienteInput): Promise<{ codigoCliente: number }> {
    return this.http.restPost('/parceiros/clientes', dados);
  }

  /**
   * Atualiza um cliente existente.
   *
   * @param codigoCliente - Codigo do cliente a atualizar.
   * @param dados - Campos a atualizar (parcial).
   * @returns Codigo do cliente atualizado.
   * @throws {ApiError} Em erro HTTP.
   * @throws {AuthError} Se autenticacao falhar.
   */
  async atualizar(
    codigoCliente: number,
    dados: AtualizarClienteInput,
  ): Promise<{ codigoCliente: number }> {
    return this.http.restPut(`/parceiros/clientes/${codigoCliente}`, dados);
  }

  /**
   * Inclui um contato em um cliente.
   *
   * @param codigoCliente - Codigo do cliente.
   * @param contato - Dados do contato.
   * @returns Codigos do contato e cliente.
   * @throws {ApiError} Em erro HTTP.
   * @throws {AuthError} Se autenticacao falhar.
   */
  async incluirContato(
    codigoCliente: number,
    contato: Contato,
  ): Promise<{ codigoContato: number; codigoCliente: number }> {
    return this.http.restPost(`/parceiros/clientes/${codigoCliente}/contatos`, contato);
  }

  /**
   * Atualiza um contato de um cliente.
   *
   * @param codigoCliente - Codigo do cliente.
   * @param codigoContato - Codigo do contato.
   * @param dados - Campos do contato a atualizar.
   * @throws {ApiError} Em erro HTTP.
   * @throws {AuthError} Se autenticacao falhar.
   */
  async atualizarContato(
    codigoCliente: number,
    codigoContato: number,
    dados: Partial<Contato>,
  ): Promise<void> {
    await this.http.restPut(
      `/parceiros/clientes/${codigoCliente}/contatos/${codigoContato}`,
      dados,
    );
  }

  /**
   * Itera sobre todos os clientes automaticamente, pagina por pagina.
   *
   * @param params - Filtros (sem paginacao).
   * @returns AsyncGenerator que emite clientes individualmente.
   * @throws {ApiError} Em erro HTTP.
   * @throws {AuthError} Se autenticacao falhar.
   * @example
   * ```ts
   * for await (const cliente of sankhya.clientes.listarTodos()) {
   *   console.log(cliente.nome);
   * }
   * ```
   */
  listarTodos(params?: Omit<ListarClientesParams, 'page'>): AsyncGenerator<Cliente> {
    return createPaginator((page) => this.listar({ ...params, page }), 1);
  }
}
