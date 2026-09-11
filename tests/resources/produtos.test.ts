import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { HttpClient } from '../../src/core/http.js';
import type { DatasetResource } from '../../src/resources/dataset.js';
import type { DbExplorerResource } from '../../src/resources/db-explorer.js';
import { ProdutosResource } from '../../src/resources/produtos.js';

/** Logger estavel: `getLogger()` novo por chamada nao daria para asserir. */
const mockLogger = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };

function createMockHttp(overrides?: Partial<HttpClient>) {
  return {
    restGet: vi.fn().mockResolvedValue({
      produtos: [{ codigoProduto: 1, descricao: 'Widget' }],
      pagination: { page: '0', total: '1', hasMore: 'false', offset: '0' },
    }),
    restPost: vi.fn(),
    restPut: vi.fn(),
    gatewayCall: vi.fn(),
    getLogger: vi.fn(() => mockLogger),
    ...overrides,
  } as unknown as HttpClient & {
    restGet: ReturnType<typeof vi.fn>;
    restPost: ReturnType<typeof vi.fn>;
    restPut: ReturnType<typeof vi.fn>;
    gatewayCall: ReturnType<typeof vi.fn>;
    getLogger: ReturnType<typeof vi.fn>;
  };
}

/** Copiado de tests/resources/gateway.test.ts:23-36 — nao criar variante. */
function makeGatewayResponse(fieldNames: string[], entities: Array<Record<string, unknown>>) {
  return {
    entities: {
      total: String(entities.length),
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

const CAMPOS_VOA = ['CODPROD', 'CODVOL', 'QUANTIDADE', 'LASTRO', 'CAMADAS', 'ATIVO'];

/** Uma pagina de `TGFVOA` com `hasMoreResult`/`offsetPage` sob controle do teste. */
function paginaVoa(
  entities: Array<Record<string, unknown>>,
  hasMore: 'true' | 'false',
  offsetPage: string,
) {
  const resposta = makeGatewayResponse(CAMPOS_VOA, entities);
  resposta.entities.hasMoreResult = hasMore;
  resposta.entities.offsetPage = offsetPage;
  return resposta;
}

describe('ProdutosResource', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('listar() calls restGet with /produtos and default page 0', async () => {
    const http = createMockHttp();
    const resource = new ProdutosResource(http);
    const result = await resource.listar();

    expect(http.restGet).toHaveBeenCalledWith('/produtos', { page: '0' });
    expect(result.data).toHaveLength(1);
  });

  it('listar() passes modifiedSince param', async () => {
    const http = createMockHttp();
    const resource = new ProdutosResource(http);
    await resource.listar({ page: 2, modifiedSince: '2024-01-01' });

    expect(http.restGet).toHaveBeenCalledWith('/produtos', {
      page: '2',
      modifiedSince: '2024-01-01',
    });
  });

  it('buscar() calls restGet with /produtos/{id}', async () => {
    const http = createMockHttp({
      restGet: vi.fn().mockResolvedValue({ codigoProduto: 5, descricao: 'Gadget' }),
    });
    const resource = new ProdutosResource(http);
    const result = await resource.buscar(5);

    expect(http.restGet).toHaveBeenCalledWith('/produtos/5');
    expect(result.descricao).toBe('Gadget');
  });

  it('componentes() calls restGet with correct path', async () => {
    const http = createMockHttp({
      restGet: vi.fn().mockResolvedValue({
        componentes: [{ codigoProduto: 10, quantidade: 2 }],
      }),
    });
    const resource = new ProdutosResource(http);
    const result = await resource.componentes(5);

    expect(http.restGet).toHaveBeenCalledWith('/produtos/5/componentes');
    expect(result).toHaveLength(1);
  });

  it('alternativos() calls restGet with correct path', async () => {
    const http = createMockHttp({
      restGet: vi.fn().mockResolvedValue({
        alternativos: [{ codigoProduto: 20 }],
      }),
    });
    const resource = new ProdutosResource(http);
    const result = await resource.alternativos(5);

    expect(http.restGet).toHaveBeenCalledWith('/produtos/5/alternativos');
    expect(result).toHaveLength(1);
  });

  it('volumes() calls restGet with correct path for specific product', async () => {
    const http = createMockHttp({
      // Chave real medida (medicoes-complementares §Lacuna 1/5): 'volumesProduto',
      // nao 'volumes' — esse nome e o de listarVolumes()/'/volumes-produtos', um
      // endpoint diferente. O endpoint tambem devolve pagination real (Task 8b).
      restGet: vi.fn().mockResolvedValue({
        volumesProduto: [{ codigoVolume: 'UN' }],
        pagination: { page: '0', total: '1', hasMore: 'false', offset: '0' },
      }),
    });
    const resource = new ProdutosResource(http);
    const result = await resource.volumes(5);

    expect(http.restGet).toHaveBeenCalledWith('/produtos/5/volumes', { page: '0' });
    expect(result).toHaveLength(1);
  });

  it('listarVolumes() calls restGet with /volumes-produtos', async () => {
    const http = createMockHttp({
      restGet: vi.fn().mockResolvedValue({
        volumes: [{ codigoVolume: 'UN' }],
        pagination: { page: '0', total: '1', hasMore: 'false', offset: '0' },
      }),
    });
    const resource = new ProdutosResource(http);
    const result = await resource.listarVolumes();

    expect(http.restGet).toHaveBeenCalledWith('/volumes-produtos', { page: '0' });
    expect(result.data).toHaveLength(1);
  });

  it('buscarVolume() calls restGet with /volumes-produtos/{id}', async () => {
    const http = createMockHttp({
      restGet: vi.fn().mockResolvedValue({ volumes: { codigoVolume: 'CX', descricao: 'Caixa' } }),
    });
    const resource = new ProdutosResource(http);
    const result = await resource.buscarVolume('CX');

    expect(http.restGet).toHaveBeenCalledWith('/volumes-produtos/CX');
    expect(result.codigoVolume).toBe('CX');
  });

  it('listarGrupos() calls restGet with /grupos-produto', async () => {
    const http = createMockHttp({
      restGet: vi.fn().mockResolvedValue({
        grupos: [{ codigoGrupoProduto: 1, descricao: 'Eletronicos' }],
        pagination: { page: '0', total: '1', hasMore: 'false', offset: '0' },
      }),
    });
    const resource = new ProdutosResource(http);
    const result = await resource.listarGrupos();

    expect(http.restGet).toHaveBeenCalledWith('/grupos-produto', { page: '0' });
    expect(result.data).toHaveLength(1);
  });

  it('buscarGrupo() calls restGet with /grupos-produto/{id}', async () => {
    const http = createMockHttp({
      restGet: vi
        .fn()
        .mockResolvedValue({ grupos: { codigoGrupoProduto: 3, descricao: 'Ferramentas' } }),
    });
    const resource = new ProdutosResource(http);
    const result = await resource.buscarGrupo(3);

    expect(http.restGet).toHaveBeenCalledWith('/grupos-produto/3');
    expect(result.descricao).toBe('Ferramentas');
  });

  it('listarTodos() returns AsyncGenerator yielding items', async () => {
    const http = createMockHttp();
    const resource = new ProdutosResource(http);
    const items: unknown[] = [];

    for await (const item of resource.listarTodos()) {
      items.push(item);
    }

    expect(items).toHaveLength(1);
    expect(items[0]).toEqual({ codigoProduto: 1, descricao: 'Widget' });
  });
  // --- setTipoControle (D2.6, REQ-VIR-3) — prova de saldo E reserva zero ---

  /** `dbExplorer` dublado: a prova de saldo zero e SELECT global em TGFEST. */
  function createMockDbx(rows: Array<Record<string, string>>) {
    return { query: vi.fn().mockResolvedValue(rows) } as unknown as DbExplorerResource & {
      query: ReturnType<typeof vi.fn>;
    };
  }

  /** `dataset` dublado: a escrita e `DatasetSP.save` em `Produto`. */
  function createMockDs(result: unknown = { total: 1, result: [['10015']] }) {
    return { save: vi.fn().mockResolvedValue(result) } as unknown as DatasetResource & {
      save: ReturnType<typeof vi.fn>;
    };
  }

  it('setTipoControle recusa quando ha SALDO em qualquer empresa/local (M103, REQ-VIR-3)', async () => {
    const http = createMockHttp();
    const dbx = createMockDbx([
      { CODEMP: '1', CODLOCAL: '30201', ESTOQUE: '0', RESERVADO: '0' },
      { CODEMP: '2', CODLOCAL: '30301', ESTOQUE: '12', RESERVADO: '0' },
    ]);
    const ds = createMockDs();

    await expect(
      new ProdutosResource(http, { dataset: ds, dbExplorer: dbx }).setTipoControle({
        codProd: 10015,
        tipo: 'L',
        usaLoteDtVal: true,
      }),
    ).rejects.toThrow(/saldo/i);
    expect(ds.save).not.toHaveBeenCalled();
  });

  it('setTipoControle recusa quando ha RESERVA, mesmo com ESTOQUE zero (M102, spec §4.2.3 passo 1)', async () => {
    const http = createMockHttp();
    const dbx = createMockDbx([{ CODEMP: '2', CODLOCAL: '30301', ESTOQUE: '0', RESERVADO: '3' }]);
    const ds = createMockDs();

    await expect(
      new ProdutosResource(http, { dataset: ds, dbExplorer: dbx }).setTipoControle({
        codProd: 10015,
        tipo: 'L',
        usaLoteDtVal: true,
      }),
    ).rejects.toThrow(/reserva/i);
    expect(ds.save).not.toHaveBeenCalled();
  });

  it('setTipoControle grava Produto quando TODAS as linhas estao zeradas em ESTOQUE e RESERVADO', async () => {
    const http = createMockHttp();
    const dbx = createMockDbx([{ CODEMP: '1', CODLOCAL: '30201', ESTOQUE: '0', RESERVADO: '0' }]);
    const ds = createMockDs();

    await new ProdutosResource(http, { dataset: ds, dbExplorer: dbx }).setTipoControle({
      codProd: 10015,
      tipo: 'L',
      usaLoteDtVal: true,
    });

    expect(dbx.query.mock.calls[0]?.[0]).not.toMatch(/CODEMP\s*=/); // SELECT global (M103)
    expect(ds.save).toHaveBeenCalledWith({
      entityName: 'Produto',
      fields: ['CODPROD', 'TIPCONTEST', 'USALOTEDTVAL'],
      records: [{ pk: { CODPROD: '10015' }, values: { '1': 'L', '2': 'S' } }],
    });
  });

  it('setTipoControle grava quando o SELECT global nao devolve nenhuma linha de TGFEST (M104/M91, RD-6)', async () => {
    const http = createMockHttp();
    const dbx = createMockDbx([]);
    const ds = createMockDs();

    await new ProdutosResource(http, { dataset: ds, dbExplorer: dbx }).setTipoControle({
      codProd: 10015,
      tipo: 'N',
      usaLoteDtVal: false,
    });

    expect(dbx.query).toHaveBeenCalledTimes(1); // o SELECT EXECUTOU: 0 linhas e resposta, nao ausencia
    expect(ds.save).toHaveBeenCalledWith({
      entityName: 'Produto',
      fields: ['CODPROD', 'TIPCONTEST', 'USALOTEDTVAL'],
      records: [{ pk: { CODPROD: '10015' }, values: { '1': 'N', '2': 'N' } }],
    });
  });

  it('setTipoControle propaga a falha do SELECT em vez de tratar como 0 linhas (RD-6)', async () => {
    const http = createMockHttp();
    const dbx = {
      query: vi.fn().mockRejectedValue(new Error('DbExplorer fora do ar')),
    } as unknown as DbExplorerResource & { query: ReturnType<typeof vi.fn> };
    const ds = createMockDs();

    await expect(
      new ProdutosResource(http, { dataset: ds, dbExplorer: dbx }).setTipoControle({
        codProd: 10015,
        tipo: 'N',
        usaLoteDtVal: false,
      }),
    ).rejects.toThrow(/DbExplorer fora do ar/);
    expect(ds.save).not.toHaveBeenCalled();
  });

  it('setTipoControle sem as deps injetadas lanca citando a dep faltante', async () => {
    await expect(
      new ProdutosResource(createMockHttp()).setTipoControle({
        codProd: 10015,
        tipo: 'L',
        usaLoteDtVal: true,
      }),
    ).rejects.toThrow(/dbExplorer/);
  });

  it('le volumes do gateway (TGFVOA) e converte os numericos', async () => {
    const http = createMockHttp();
    const produtos = new ProdutosResource(http);
    http.gatewayCall.mockResolvedValue(
      makeGatewayResponse(
        ['CODPROD', 'CODVOL', 'QUANTIDADE', 'LASTRO', 'CAMADAS', 'ATIVO'],
        [
          {
            f0: { $: '13609' },
            f1: { $: 'CX' },
            f2: { $: '72' },
            f3: { $: '12' },
            f4: { $: '4' },
            f5: { $: 'S' },
          },
        ],
      ),
    ); // M54: 13609 = 72 un/cx, 12x4
    const vols = await produtos.volumesProduto(13609);

    expect(http.gatewayCall.mock.calls[0][1]).toBe('CRUDServiceProvider.loadRecords');
    expect(vols).toEqual([
      { codProd: 13609, codVol: 'CX', quantidade: 72, lastro: 12, camadas: 4, ativo: true },
    ]);

    // Payload medido preso inteiro: modulo, dataSet e flag de idempotencia.
    const [modulo, , body, options, idempotent] = http.gatewayCall.mock.calls[0];
    expect(modulo).toBe('mge');
    expect(body).toEqual({
      dataSet: {
        rootEntity: 'VolumeProduto',
        includePresentationFields: 'N',
        offsetPage: '0',
        criteria: { expression: { $: "this.CODPROD = '13609'" } },
        entity: { fieldset: { list: 'CODPROD,CODVOL,QUANTIDADE,LASTRO,CAMADAS,ATIVO' } },
      },
    });
    expect(options).toBeUndefined();
    expect(idempotent).toBe(true);
  });

  it('concatena duas paginas e avanca o offsetPage', async () => {
    const http = createMockHttp();
    const produtos = new ProdutosResource(http);
    http.gatewayCall
      .mockResolvedValueOnce(
        paginaVoa(
          [
            {
              f0: { $: '13609' },
              f1: { $: 'CX' },
              f2: { $: '72' },
              f3: { $: '12' },
              f4: { $: '4' },
              f5: { $: 'S' },
            },
          ],
          'true',
          '0',
        ),
      )
      .mockResolvedValueOnce(
        paginaVoa(
          [
            {
              f0: { $: '13609' },
              f1: { $: 'UN' },
              f2: { $: '1' },
              f3: { $: '0' },
              f4: { $: '0' },
              f5: { $: 'S' },
            },
          ],
          'false',
          '1',
        ),
      );

    const vols = await produtos.volumesProduto(13609);

    expect(http.gatewayCall).toHaveBeenCalledTimes(2);
    expect(vols.map((v) => v.codVol)).toEqual(['CX', 'UN']);
    expect(http.gatewayCall.mock.calls[0][2].dataSet.offsetPage).toBe('0');
    expect(http.gatewayCall.mock.calls[1][2].dataSet.offsetPage).toBe('1');
  });

  it('lanca INCOMPLETE_READ quando hasMoreResult e true com pagina vazia (nao devolve [])', async () => {
    const http = createMockHttp();
    const produtos = new ProdutosResource(http);
    http.gatewayCall.mockResolvedValue(paginaVoa([], 'true', '0'));

    // `[]` aqui significaria "sem cadastro" (REQ-CNT-5) — varredura truncada
    // nao pode se disfarcar disso. I11/G1.
    // Prende mensagem **e** `code`: a mensagem sozinha nao distingue truncamento
    // de erro de validacao (M9 do re-review sobrevivia sem o `code`).
    await expect(produtos.volumesProduto(13609)).rejects.toMatchObject({
      code: 'INCOMPLETE_READ',
      message: expect.stringMatching(/incompleta/i),
    });
    expect(http.gatewayCall).toHaveBeenCalledTimes(1);
    expect(mockLogger.error).toHaveBeenCalledTimes(1);
  });

  it('numerico ausente, nulo ou {} vira 0; CODVOL nulo vira string vazia', async () => {
    const http = createMockHttp();
    const produtos = new ProdutosResource(http);
    http.gatewayCall.mockResolvedValue(
      paginaVoa(
        [
          // f1 = {} (NULL do gateway), f2 = { $: {} }, f3 = { $: null }, f4 ausente
          { f0: { $: '13609' }, f1: {}, f2: { $: {} }, f3: { $: null }, f5: { $: 'S' } },
        ],
        'false',
        '0',
      ),
    );

    const [vol] = await produtos.volumesProduto(13609);

    expect(vol).toEqual({
      codProd: 13609,
      codVol: '',
      quantidade: 0,
      lastro: 0,
      camadas: 0,
      ativo: true,
    });
  });

  it('lanca PARSE_ERROR quando QUANTIDADE nao e numero', async () => {
    const http = createMockHttp();
    const produtos = new ProdutosResource(http);
    http.gatewayCall.mockResolvedValue(
      paginaVoa(
        [{ f0: { $: '13609' }, f1: { $: 'CX' }, f2: { $: 'ABC' }, f5: { $: 'S' } }],
        'false',
        '0',
      ),
    );

    await expect(produtos.volumesProduto(13609)).rejects.toThrow(/QUANTIDADE/);
  });

  it('devolve [] quando o produto nao tem volume cadastrado (M57) — sem lancar', async () => {
    const http = createMockHttp();
    const produtos = new ProdutosResource(http);
    http.gatewayCall.mockResolvedValue(makeGatewayResponse(['CODPROD'], []));

    await expect(produtos.volumesProduto(10077)).resolves.toEqual([]);
  });

  // Adicao a §D1.4 do anexo: a mutacao prescrita no Step 5 (`ATIVO === 'S'` ->
  // `Boolean(ATIVO)`) SOBREVIVIA com a fixture do anexo, que so tem ATIVO='S'.
  // Este caso e o que a mata.
  it('ativo e false quando ATIVO nao e S (mata Boolean(ATIVO))', async () => {
    const http = createMockHttp();
    const produtos = new ProdutosResource(http);
    http.gatewayCall.mockResolvedValue(
      makeGatewayResponse(
        ['CODPROD', 'CODVOL', 'QUANTIDADE', 'LASTRO', 'CAMADAS', 'ATIVO'],
        [
          {
            f0: { $: '13609' },
            f1: { $: 'UN' },
            f2: { $: '1' },
            f3: { $: '0' },
            f4: { $: '0' },
            f5: { $: 'N' },
          },
        ],
      ),
    );
    const [vol] = await produtos.volumesProduto(13609);

    expect(vol?.ativo).toBe(false);
  });

  it('recusa codigoProduto que nao e inteiro (guarda de injecao no criteria)', async () => {
    const http = createMockHttp();

    await expect(new ProdutosResource(http).volumesProduto(1.5)).rejects.toThrow(/inteiro/i);
    expect(http.gatewayCall).not.toHaveBeenCalled();
  });
});
