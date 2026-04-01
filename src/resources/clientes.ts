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

export class ClientesResource {
  constructor(private readonly http: HttpClient) {}

  async listar(params?: ListarClientesParams): Promise<PaginatedResult<Cliente>> {
    const query: Record<string, string> = { page: String(params?.page ?? 1) };
    if (params?.dataHoraAlteracao) query.dataHoraAlteracao = params.dataHoraAlteracao;

    const raw = await this.http.restGet<Record<string, unknown>>('/parceiros/clientes', query);
    const { data, pagination } = extractRestData<Cliente>(raw);
    return normalizeRestPagination(data, pagination);
  }

  async criar(dados: CriarClienteInput): Promise<{ codigoCliente: number }> {
    return this.http.restPost('/parceiros/clientes', dados);
  }

  async atualizar(
    codigoCliente: number,
    dados: AtualizarClienteInput,
  ): Promise<{ codigoCliente: number }> {
    return this.http.restPut(`/parceiros/clientes/${codigoCliente}`, dados);
  }

  async incluirContato(
    codigoCliente: number,
    contato: Contato,
  ): Promise<{ codigoContato: number; codigoCliente: number }> {
    return this.http.restPost(`/parceiros/clientes/${codigoCliente}/contatos`, contato);
  }

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

  listarTodos(params?: Omit<ListarClientesParams, 'page'>): AsyncGenerator<Cliente> {
    return createPaginator((page) => this.listar({ ...params, page }), 1);
  }
}
