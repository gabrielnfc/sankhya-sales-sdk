import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { HttpClient } from '../../src/core/http.js';
import { DatasetResource, datasetRecord } from '../../src/resources/dataset.js';

const mockLogger = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };

function createMockHttp() {
  return {
    restGet: vi.fn(),
    restPost: vi.fn(),
    restPut: vi.fn(),
    gatewayCall: vi.fn(),
    getLogger: vi.fn(() => mockLogger),
  } as unknown as HttpClient & {
    restGet: ReturnType<typeof vi.fn>;
    restPost: ReturnType<typeof vi.fn>;
    restPut: ReturnType<typeof vi.fn>;
    gatewayCall: ReturnType<typeof vi.fn>;
    getLogger: ReturnType<typeof vi.fn>;
  };
}

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

describe('DatasetResource', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('datasetRecord resolve nome -> indice posicional', () => {
    expect(
      datasetRecord(['NUNOTA', 'SEQUENCIA', 'CONTROLE'], {
        pk: { NUNOTA: '1889272', SEQUENCIA: '1' },
        set: { CONTROLE: 'SPIKE-L1' },
      }),
    ).toEqual({ pk: { NUNOTA: '1889272', SEQUENCIA: '1' }, values: { '2': 'SPIKE-L1' } });
  });

  it('datasetRecord lanca quando o campo nao esta em fields', () => {
    expect(() => datasetRecord(['NUNOTA'], { set: { CONTROLE: 'X' } })).toThrow(/CONTROLE/);
  });

  it('save envia entityName/standAlone/fields/records e le total+result', async () => {
    const http = createMockHttp();
    // spike-raw/conferencia/C3_E1_SET_NUCONFATUAL_N.json
    http.gatewayCall.mockResolvedValue({ total: '1', result: [['1889349', '281956']] });

    const out = await new DatasetResource(http).save({
      entityName: 'CabecalhoNota',
      fields: ['NUNOTA', 'NUCONFATUAL'],
      records: [
        datasetRecord(['NUNOTA', 'NUCONFATUAL'], {
          pk: { NUNOTA: '1889349' },
          set: { NUCONFATUAL: '281956' },
        }),
      ],
    });

    expect(http.gatewayCall).toHaveBeenCalledWith(
      'mge',
      'DatasetSP.save',
      {
        entityName: 'CabecalhoNota',
        standAlone: false,
        fields: ['NUNOTA', 'NUCONFATUAL'],
        records: [{ pk: { NUNOTA: '1889349' }, values: { '1': '281956' } }],
      },
      undefined,
    );
    expect(out).toEqual({ total: 1, result: [['1889349', '281956']] });
  });

  it('save aceita insercao multi-record sem pk (entrada 1813 com 2 lotes, M88)', async () => {
    const http = createMockHttp();
    http.gatewayCall.mockResolvedValue({ total: '2', result: [['1'], ['2']] });
    const F = [
      'NUNOTA',
      'CODPROD',
      'QTDNEG',
      'VLRUNIT',
      'CODVOL',
      'CODLOCALORIG',
      'CONTROLE',
      'ATUALESTOQUE',
    ];

    await new DatasetResource(http).save({
      entityName: 'ItemNota',
      fields: F,
      records: [
        datasetRecord(F, {
          set: {
            NUNOTA: '1889280',
            CODPROD: '10077',
            QTDNEG: '10',
            VLRUNIT: '1',
            CODVOL: 'UN',
            CODLOCALORIG: '30301',
            CONTROLE: 'SPIKE-T002-A',
            ATUALESTOQUE: '1',
          },
        }),
        datasetRecord(F, {
          set: {
            NUNOTA: '1889280',
            CODPROD: '10077',
            QTDNEG: '6',
            VLRUNIT: '1',
            CODVOL: 'UN',
            CODLOCALORIG: '30301',
            CONTROLE: 'SPIKE-T002-B',
            ATUALESTOQUE: '1',
          },
        }),
      ],
    });

    const body = http.gatewayCall.mock.calls[0][2] as { records: Array<Record<string, unknown>> };
    expect(body.records[0]).not.toHaveProperty('pk');
    expect(body.records[1].values).toMatchObject({ '6': 'SPIKE-T002-B', '7': '1' });
  });

  it('save lanca quando a resposta nao traz total (nunca 0 silencioso, I11)', async () => {
    const http = createMockHttp();
    http.gatewayCall.mockResolvedValue({ result: [['1889349']] });

    await expect(
      new DatasetResource(http).save({
        entityName: 'CabecalhoNota',
        fields: ['NUNOTA'],
        records: [datasetRecord(['NUNOTA'], { set: { NUNOTA: '1889349' } })],
      }),
    ).rejects.toThrow(/total/);
  });

  it('removeRecord envia pks e devolve void', async () => {
    const http = createMockHttp();
    http.gatewayCall.mockResolvedValue({});

    await new DatasetResource(http).removeRecord({
      entityName: 'CabecalhoNota',
      pks: [{ NUNOTA: '1889349' }],
    });

    expect(http.gatewayCall).toHaveBeenCalledWith(
      'mge',
      'DatasetSP.removeRecord',
      { entityName: 'CabecalhoNota', standAlone: false, pks: [{ NUNOTA: '1889349' }] },
      undefined,
    );
  });

  it('removeRecord recusa lista de pks vazia (guarda contra apagar tudo)', async () => {
    const http = createMockHttp();
    await expect(
      new DatasetResource(http).removeRecord({ entityName: 'CabecalhoNota', pks: [] }),
    ).rejects.toThrow(/pks/);
    expect(http.gatewayCall).not.toHaveBeenCalled();
  });

  it('removeRecord recusa pk vazia {} na lista (apagaria tudo da entidade)', async () => {
    const http = createMockHttp();
    await expect(
      new DatasetResource(http).removeRecord({
        entityName: 'CabecalhoNota',
        pks: [{ NUNOTA: '1889349' }, {}],
      }),
    ).rejects.toThrow(/pk/);
    expect(http.gatewayCall).not.toHaveBeenCalled();
  });

  it('load delega a CRUDServiceProvider.loadRecords (caminho medido da D1.1)', async () => {
    const http = createMockHttp();
    http.gatewayCall.mockResolvedValue(
      makeGatewayResponse(
        ['NUNOTA', 'CONTROLE'],
        [{ f0: { $: '1889280' }, f1: { $: 'SPIKE-T002-A' } }],
      ),
    );

    const rows = await new DatasetResource(http).load({
      entityName: 'ItemNota',
      fields: ['NUNOTA', 'CONTROLE'],
      criteria: 'this.NUNOTA = 1889280',
      page: 1,
    });

    expect(http.gatewayCall).toHaveBeenCalledWith(
      'mge',
      'CRUDServiceProvider.loadRecords',
      {
        dataSet: {
          rootEntity: 'ItemNota',
          includePresentationFields: 'N',
          offsetPage: '1',
          criteria: { expression: { $: 'this.NUNOTA = 1889280' } },
          entity: { fieldset: { list: 'NUNOTA,CONTROLE' } },
        },
      },
      undefined,
      true,
    );
    expect(rows).toEqual([{ NUNOTA: '1889280', CONTROLE: 'SPIKE-T002-A' }]);
  });
});
