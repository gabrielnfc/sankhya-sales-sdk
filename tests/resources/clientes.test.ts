import { describe, expect, it, vi } from 'vitest';
import type { HttpClient } from '../../src/core/http.js';
import { ClientesResource } from '../../src/resources/clientes.js';

function createMockHttp(overrides?: Partial<HttpClient>) {
  return {
    restGet: vi.fn().mockResolvedValue({
      clientes: [{ codigoCliente: 1, nomeCliente: 'Acme', tipoPessoa: 'J' }],
      pagination: { page: '0', total: '1', hasMore: 'false', offset: '0' },
    }),
    restPost: vi.fn().mockResolvedValue({ codigoCliente: 99 }),
    restPut: vi.fn().mockResolvedValue({ codigoCliente: 1 }),
    gatewayCall: vi.fn().mockResolvedValue({}),
    ...overrides,
  } as unknown as HttpClient;
}

describe('ClientesResource', () => {
  it('listar() calls restGet with /parceiros/clientes and default page 1', async () => {
    const http = createMockHttp();
    const resource = new ClientesResource(http);
    const result = await resource.listar();

    expect(http.restGet).toHaveBeenCalledWith('/parceiros/clientes', { page: '1' });
    expect(result.data).toHaveLength(1);
    expect(result.hasMore).toBe(false);
  });

  it('listar() passes dataHoraAlteracao query param', async () => {
    const http = createMockHttp();
    const resource = new ClientesResource(http);
    await resource.listar({ page: 2, dataHoraAlteracao: '2024-01-01' });

    expect(http.restGet).toHaveBeenCalledWith('/parceiros/clientes', {
      page: '2',
      dataHoraAlteracao: '2024-01-01',
    });
  });

  it('criar() calls restPost with /parceiros/clientes', async () => {
    const http = createMockHttp();
    const resource = new ClientesResource(http);
    const input = {
      nome: 'Novo Cliente',
      tipo: 'J' as const,
      cnpjCpf: '12345678000199',
      endereco: {
        logradouro: 'Rua A',
        numero: '100',
        bairro: 'Centro',
        cidade: 'Sao Paulo',
        codigoIbge: '3550308',
        uf: 'SP',
        cep: '01000000',
      },
    };
    const result = await resource.criar(input);

    expect(http.restPost).toHaveBeenCalledWith('/parceiros/clientes', input);
    expect(result).toEqual({ codigoCliente: 99 });
  });

  it('atualizar() calls restPut with /parceiros/clientes/{id}', async () => {
    const http = createMockHttp();
    const resource = new ClientesResource(http);
    const dados = { nomeCliente: 'Atualizado' };
    const result = await resource.atualizar(42, dados);

    expect(http.restPut).toHaveBeenCalledWith('/parceiros/clientes/42', dados);
    expect(result).toEqual({ codigoCliente: 1 });
  });

  it('incluirContato() calls restPost with correct path', async () => {
    const http = createMockHttp();
    const resource = new ClientesResource(http);
    const contato = { nomeContato: 'Joao', telefone: '11999' };
    await resource.incluirContato(10, contato);

    expect(http.restPost).toHaveBeenCalledWith('/parceiros/clientes/10/contatos', contato);
  });

  it('atualizarContato() calls restPut with correct path', async () => {
    const http = createMockHttp();
    const resource = new ClientesResource(http);
    const dados = { telefone: '11888' };
    await resource.atualizarContato(10, 5, dados);

    expect(http.restPut).toHaveBeenCalledWith('/parceiros/clientes/10/contatos/5', dados);
  });

  it('listarTodos() returns AsyncGenerator yielding items', async () => {
    const http = createMockHttp();
    const resource = new ClientesResource(http);
    const items: unknown[] = [];

    for await (const item of resource.listarTodos()) {
      items.push(item);
    }

    expect(items).toHaveLength(1);
    expect(items[0]).toEqual({ codigoCliente: 1, nomeCliente: 'Acme', tipoPessoa: 'J' });
  });

  it('listarTodos() passes extra params but not page', async () => {
    const http = createMockHttp();
    const resource = new ClientesResource(http);

    for await (const _ of resource.listarTodos({ dataHoraAlteracao: '2024-06-01' })) {
      // consume
    }

    expect(http.restGet).toHaveBeenCalledWith('/parceiros/clientes', {
      page: '1',
      dataHoraAlteracao: '2024-06-01',
    });
  });

  // TEST-06: TipoPessoa F/J edge case
  describe('TipoPessoa F/J edge case (TEST-06)', () => {
    it('handles TipoPessoa "F" (pessoa fisica) correctly', async () => {
      const http = createMockHttp({
        restGet: vi.fn().mockResolvedValue({
          clientes: [{ codigoCliente: 2, nomeCliente: 'Maria Silva', tipoPessoa: 'F' }],
          pagination: { page: '0', total: '1', hasMore: 'false', offset: '0' },
        }),
      });
      const resource = new ClientesResource(http);
      const result = await resource.listar();

      expect(result.data[0].tipoPessoa).toBe('F');
    });

    it('handles TipoPessoa "J" (pessoa juridica) correctly', async () => {
      const http = createMockHttp({
        restGet: vi.fn().mockResolvedValue({
          clientes: [{ codigoCliente: 3, nomeCliente: 'Empresa LTDA', tipoPessoa: 'J' }],
          pagination: { page: '0', total: '1', hasMore: 'false', offset: '0' },
        }),
      });
      const resource = new ClientesResource(http);
      const result = await resource.listar();

      expect(result.data[0].tipoPessoa).toBe('J');
    });

    it('returns F/J not PF/PJ as Sankhya uses single-char codes', async () => {
      const http = createMockHttp({
        restGet: vi.fn().mockResolvedValue({
          clientes: [
            { codigoCliente: 4, tipoPessoa: 'F' },
            { codigoCliente: 5, tipoPessoa: 'J' },
          ],
          pagination: { page: '0', total: '2', hasMore: 'false', offset: '0' },
        }),
      });
      const resource = new ClientesResource(http);
      const result = await resource.listar();

      for (const cliente of result.data) {
        expect(['F', 'J']).toContain(cliente.tipoPessoa);
        expect(cliente.tipoPessoa).not.toBe('PF');
        expect(cliente.tipoPessoa).not.toBe('PJ');
      }
    });
  });
});
