import { describe, expect, it, vi } from 'vitest';
import type { HttpClient } from '../../src/core/http.js';
import { CadastrosResource } from '../../src/resources/cadastros.js';

function createMockHttp() {
  return {
    restGet: vi.fn(),
    restPost: vi.fn(),
    restPut: vi.fn(),
    gatewayCall: vi.fn(),
  } as unknown as HttpClient & {
    restGet: ReturnType<typeof vi.fn>;
    restPost: ReturnType<typeof vi.fn>;
    restPut: ReturnType<typeof vi.fn>;
    gatewayCall: ReturnType<typeof vi.fn>;
  };
}

function makeRestResponse(key: string, items: unknown[], hasMore = false) {
  return {
    [key]: items,
    pagination: { page: '0', offset: '0', total: String(items.length), hasMore: String(hasMore) },
  };
}

function makeGatewayResponse(
  fieldNames: string[],
  entities: Array<Record<string, unknown>>,
  total?: string,
) {
  return {
    entities: {
      total: total ?? String(entities.length),
      hasMoreResult: 'false',
      offsetPage: '0',
      metadata: {
        fields: {
          field: fieldNames.map((name) => ({ name })),
        },
      },
      entity: entities,
    },
  };
}

describe('CadastrosResource', () => {
  // --- Tipos de Operacao ---

  describe('listarTiposOperacao()', () => {
    it('calls restGet with /tipos-operacao and default page', async () => {
      const http = createMockHttp();
      const cad = new CadastrosResource(http);
      http.restGet.mockResolvedValue(makeRestResponse('tiposOperacao', [{ id: 1 }]));

      const result = await cad.listarTiposOperacao();

      expect(http.restGet).toHaveBeenCalledWith('/tipos-operacao', { page: '0' });
      expect(result.data).toHaveLength(1);
    });

    it('passes tipoMovimento param as string', async () => {
      const http = createMockHttp();
      const cad = new CadastrosResource(http);
      http.restGet.mockResolvedValue(makeRestResponse('tiposOperacao', []));

      await cad.listarTiposOperacao({ tipoMovimento: 3 });

      expect(http.restGet).toHaveBeenCalledWith('/tipos-operacao', {
        page: '0',
        tipoMovimento: '3',
      });
    });
  });

  describe('buscarTipoOperacao()', () => {
    it('calls restGet with id in path', async () => {
      const http = createMockHttp();
      const cad = new CadastrosResource(http);
      http.restGet.mockResolvedValue({ id: 5 });

      const result = await cad.buscarTipoOperacao(5);

      expect(http.restGet).toHaveBeenCalledWith('/tipos-operacao/5');
      expect(result).toEqual({ id: 5 });
    });
  });

  // --- Naturezas ---

  describe('listarNaturezas()', () => {
    it('calls restGet with /naturezas and default page', async () => {
      const http = createMockHttp();
      const cad = new CadastrosResource(http);
      http.restGet.mockResolvedValue(makeRestResponse('naturezas', [{ id: 1 }]));

      const result = await cad.listarNaturezas();

      expect(http.restGet).toHaveBeenCalledWith('/naturezas', { page: '0' });
      expect(result.data).toHaveLength(1);
    });
  });

  describe('buscarNatureza()', () => {
    it('calls restGet with id in path', async () => {
      const http = createMockHttp();
      const cad = new CadastrosResource(http);
      http.restGet.mockResolvedValue({ id: 2 });

      await cad.buscarNatureza(2);

      expect(http.restGet).toHaveBeenCalledWith('/naturezas/2');
    });
  });

  // --- Projetos ---

  describe('listarProjetos()', () => {
    it('calls restGet with /projetos and default page', async () => {
      const http = createMockHttp();
      const cad = new CadastrosResource(http);
      http.restGet.mockResolvedValue(makeRestResponse('projetos', [{ id: 1 }]));

      const result = await cad.listarProjetos();

      expect(http.restGet).toHaveBeenCalledWith('/projetos', { page: '0' });
      expect(result.data).toHaveLength(1);
    });
  });

  describe('buscarProjeto()', () => {
    it('calls restGet with id in path', async () => {
      const http = createMockHttp();
      const cad = new CadastrosResource(http);
      http.restGet.mockResolvedValue({ id: 3 });

      await cad.buscarProjeto(3);

      expect(http.restGet).toHaveBeenCalledWith('/projetos/3');
    });
  });

  // --- Centros de Resultado ---

  describe('listarCentrosResultado()', () => {
    it('calls restGet with /centros-resultado and default page', async () => {
      const http = createMockHttp();
      const cad = new CadastrosResource(http);
      http.restGet.mockResolvedValue(makeRestResponse('centrosResultado', [{ id: 1 }]));

      const result = await cad.listarCentrosResultado();

      expect(http.restGet).toHaveBeenCalledWith('/centros-resultado', { page: '0' });
      expect(result.data).toHaveLength(1);
    });
  });

  describe('buscarCentroResultado()', () => {
    it('calls restGet with id in path', async () => {
      const http = createMockHttp();
      const cad = new CadastrosResource(http);
      http.restGet.mockResolvedValue({ id: 4 });

      await cad.buscarCentroResultado(4);

      expect(http.restGet).toHaveBeenCalledWith('/centros-resultado/4');
    });
  });

  // --- Empresas ---

  describe('listarEmpresas()', () => {
    it('calls restGet with /empresas and default page', async () => {
      const http = createMockHttp();
      const cad = new CadastrosResource(http);
      http.restGet.mockResolvedValue(makeRestResponse('empresas', [{ id: 1 }]));

      const result = await cad.listarEmpresas();

      expect(http.restGet).toHaveBeenCalledWith('/empresas', { page: '0' });
      expect(result.data).toHaveLength(1);
    });
  });

  describe('buscarEmpresa()', () => {
    it('calls restGet with id in path', async () => {
      const http = createMockHttp();
      const cad = new CadastrosResource(http);
      http.restGet.mockResolvedValue({ id: 1 });

      await cad.buscarEmpresa(1);

      expect(http.restGet).toHaveBeenCalledWith('/empresas/1');
    });
  });

  // --- Usuarios ---

  describe('listarUsuarios()', () => {
    it('calls restGet with /usuarios and returns array directly', async () => {
      const http = createMockHttp();
      const cad = new CadastrosResource(http);
      http.restGet.mockResolvedValue(makeRestResponse('usuarios', [{ id: 1 }, { id: 2 }]));

      const result = await cad.listarUsuarios();

      expect(http.restGet).toHaveBeenCalledWith('/usuarios');
      expect(result).toHaveLength(2);
      expect(Array.isArray(result)).toBe(true);
    });
  });

  // --- Gateway: Tipos de Negociacao ---

  describe('listarTiposNegociacao()', () => {
    it('calls gatewayCall with mge, CRUDServiceProvider.loadRecords, and TipoNegociacao', async () => {
      const http = createMockHttp();
      const cad = new CadastrosResource(http);
      http.gatewayCall.mockResolvedValue(
        makeGatewayResponse(
          ['CODTIPVENDA', 'DESCRTIPVENDA', 'ATIVO'],
          [{ f0: { $: '1' }, f1: { $: 'A VISTA' }, f2: { $: 'S' } }],
        ),
      );

      const result = await cad.listarTiposNegociacao();

      expect(http.gatewayCall).toHaveBeenCalledWith(
        'mge',
        'CRUDServiceProvider.loadRecords',
        expect.objectContaining({
          dataSet: expect.objectContaining({
            rootEntity: 'TipoNegociacao',
            criteria: { expression: "this.ATIVO = 'S'" },
          }),
        }),
      );

      expect(result).toEqual([
        {
          codigoTipoNegociacao: 1,
          descricao: 'A VISTA',
          taxaJuro: 0,
          ativo: true,
        },
      ]);
    });

    it('uses "1 = 1" criteria when apenasAtivos is false', async () => {
      const http = createMockHttp();
      const cad = new CadastrosResource(http);
      http.gatewayCall.mockResolvedValue(
        makeGatewayResponse(
          ['CODTIPVENDA', 'DESCRTIPVENDA', 'ATIVO'],
          [{ f0: { $: '1' }, f1: { $: 'INATIVO' }, f2: { $: 'N' } }],
        ),
      );

      const result = await cad.listarTiposNegociacao({ apenasAtivos: false });

      const body = http.gatewayCall.mock.calls[0][2] as Record<string, unknown>;
      const dataSet = body.dataSet as Record<string, unknown>;
      const criteria = dataSet.criteria as { expression: string };
      expect(criteria.expression).toBe('1 = 1');
      expect(result[0].ativo).toBe(false);
    });

    it('TEST-06: TAXAJURO empty object edge case returns taxaJuro: 0', async () => {
      const http = createMockHttp();
      const cad = new CadastrosResource(http);
      // Note: TAXAJURO is not in the requested fields list, so the resource always returns 0.
      // This test verifies the hardcoded behavior is correct.
      http.gatewayCall.mockResolvedValue(
        makeGatewayResponse(
          ['CODTIPVENDA', 'DESCRTIPVENDA', 'ATIVO'],
          [
            { f0: { $: '1' }, f1: { $: 'A VISTA' }, f2: { $: 'S' } },
            { f0: { $: '2' }, f1: { $: 'PARCELADO' }, f2: { $: 'S' } },
          ],
        ),
      );

      const result = await cad.listarTiposNegociacao();

      // taxaJuro is always 0 (not NaN, not "[object Object]")
      expect(result[0].taxaJuro).toBe(0);
      expect(result[1].taxaJuro).toBe(0);
      expect(typeof result[0].taxaJuro).toBe('number');
      expect(typeof result[1].taxaJuro).toBe('number');
    });

    it('maps response fields correctly', async () => {
      const http = createMockHttp();
      const cad = new CadastrosResource(http);
      http.gatewayCall.mockResolvedValue(
        makeGatewayResponse(
          ['CODTIPVENDA', 'DESCRTIPVENDA', 'ATIVO'],
          [
            { f0: { $: '10' }, f1: { $: 'BOLETO 30' }, f2: { $: 'S' } },
            { f0: { $: '20' }, f1: { $: 'CARTAO' }, f2: { $: 'N' } },
          ],
        ),
      );

      const result = await cad.listarTiposNegociacao({ apenasAtivos: false });

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        codigoTipoNegociacao: 10,
        descricao: 'BOLETO 30',
        taxaJuro: 0,
        ativo: true,
      });
      expect(result[1]).toEqual({
        codigoTipoNegociacao: 20,
        descricao: 'CARTAO',
        taxaJuro: 0,
        ativo: false,
      });
    });
  });

  // --- Gateway: Modelos de Nota ---

  describe('listarModelosNota()', () => {
    it('calls gatewayCall and maps response correctly', async () => {
      const http = createMockHttp();
      const cad = new CadastrosResource(http);
      http.gatewayCall.mockResolvedValue(
        makeGatewayResponse(
          [
            'CODMODELANOTA',
            'DESCRICAO',
            'CODTIPOPER',
            'CODTIPVENDA',
            'CODEMP',
            'CODNAT',
            'CODCENCUS',
          ],
          [
            {
              f0: { $: '1' },
              f1: { $: 'Modelo A' },
              f2: { $: '10' },
              f3: { $: '20' },
              f4: { $: '30' },
              f5: { $: '40' },
              f6: { $: '50' },
            },
          ],
        ),
      );

      const result = await cad.listarModelosNota();

      expect(http.gatewayCall).toHaveBeenCalledWith(
        'mge',
        'CRUDServiceProvider.loadRecords',
        expect.objectContaining({
          dataSet: expect.objectContaining({
            rootEntity: 'ModeloNota',
          }),
        }),
      );

      expect(result).toEqual([
        {
          numeroModelo: 1,
          descricao: 'Modelo A',
          codigoTipoOperacao: 10,
          codigoTipoNegociacao: 20,
          codigoEmpresa: 30,
          codigoNatureza: 40,
          codigoCentroResultado: 50,
        },
      ]);
    });

    it('returns undefined for optional fields CODNAT and CODCENCUS when absent', async () => {
      const http = createMockHttp();
      const cad = new CadastrosResource(http);
      // When CODNAT and CODCENCUS have empty string values from deserializeRows
      http.gatewayCall.mockResolvedValue(
        makeGatewayResponse(
          [
            'CODMODELANOTA',
            'DESCRICAO',
            'CODTIPOPER',
            'CODTIPVENDA',
            'CODEMP',
            'CODNAT',
            'CODCENCUS',
          ],
          [
            {
              f0: { $: '1' },
              f1: { $: 'Modelo B' },
              f2: { $: '10' },
              f3: { $: '20' },
              f4: { $: '30' },
              // f5 and f6 are absent (no CODNAT, no CODCENCUS in entity)
            },
          ],
        ),
      );

      const result = await cad.listarModelosNota();

      // Empty string from deserializeRows is falsy, so ternary returns undefined
      expect(result[0].codigoNatureza).toBeUndefined();
      expect(result[0].codigoCentroResultado).toBeUndefined();
    });

    it('passes page parameter to gatewayCall', async () => {
      const http = createMockHttp();
      const cad = new CadastrosResource(http);
      http.gatewayCall.mockResolvedValue(
        makeGatewayResponse(
          [
            'CODMODELANOTA',
            'DESCRICAO',
            'CODTIPOPER',
            'CODTIPVENDA',
            'CODEMP',
            'CODNAT',
            'CODCENCUS',
          ],
          [],
        ),
      );

      await cad.listarModelosNota({ page: 3 });

      const body = http.gatewayCall.mock.calls[0][2] as Record<string, unknown>;
      const dataSet = body.dataSet as Record<string, unknown>;
      expect(dataSet.offsetPage).toBe('3');
    });
  });
});
