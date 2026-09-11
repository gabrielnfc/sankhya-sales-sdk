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

  // Item 2 do review (M10 sobreviveu): sem isto, um `false` fixo no payload
  // passaria sem nenhum teste notar.
  it('save leva standAlone: true explicito ao payload', async () => {
    const http = createMockHttp();
    http.gatewayCall.mockResolvedValue({ total: '1', result: [['1889349']] });

    await new DatasetResource(http).save({
      entityName: 'CabecalhoNota',
      fields: ['NUNOTA'],
      records: [datasetRecord(['NUNOTA'], { set: { NUNOTA: '1889349' } })],
      standAlone: true,
    });

    const body = http.gatewayCall.mock.calls[0][2] as { standAlone: boolean };
    expect(body.standAlone).toBe(true);
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

  // Item 5 do review (MENOR): 0 records nao foi medido no Sankhya — recusa antes
  // da rede em vez de deixar o ERP decidir (R2-adjacente).
  it('save recusa records vazio antes da rede (efeito de 0 records nao medido)', async () => {
    const http = createMockHttp();
    await expect(
      new DatasetResource(http).save({
        entityName: 'CabecalhoNota',
        fields: ['NUNOTA'],
        records: [],
      }),
    ).rejects.toThrow(/records/);
    expect(http.gatewayCall).not.toHaveBeenCalled();
  });

  // Item 6 do review (MENOR): `{}` e a forma medida de campo vazio do Gateway
  // (src/core/parse-utils.ts:14-17) — virar `'[object Object]'` seria inventar valor.
  it('save normaliza celula {} (campo vazio do Gateway) para string vazia', async () => {
    const http = createMockHttp();
    http.gatewayCall.mockResolvedValue({ total: '1', result: [['1889349', {}, null]] });

    // 3 campos para 3 celulas: desde a D2.2b, celula EXCEDENTE que nao seja a
    // metadata `_rmd` reprova — e este teste e sobre normalizacao de celula,
    // nao sobre excedente.
    const out = await new DatasetResource(http).save({
      entityName: 'CabecalhoNota',
      fields: ['NUNOTA', 'NUCONFATUAL', 'OBSERVACAO'],
      records: [
        datasetRecord(['NUNOTA', 'NUCONFATUAL', 'OBSERVACAO'], { set: { NUNOTA: '1889349' } }),
      ],
    });

    expect(out.result).toEqual([['1889349', '', '']]);
  });

  // --- D2.2b: a celula final `_rmd` do DatasetSP (RD-8) ---
  //
  // Fato medido (a): toda resposta de `DatasetSP.save` nos fixtures de 06/09
  // traz, DEPOIS das celulas dos `fields`, uma celula a mais com metadata de
  // renderizacao — `spike-raw/faturamento/S1_DS_ITENS_1813.json` e
  // `S1_DS_ESTOQUE_DATAS.json` (`/res/result`). Ate a D2.2b o SDK a tratava
  // como valor e lancava `DATASET_SAVE_MALFORMED_RESPONSE`: no spike 6 o ERP
  // ACEITOU o item (pedido 1890082) e quem reprovou a lane foi o SDK.
  const LINHA_MEDIDA_1813 = [
    '1889306',
    '10077',
    '10',
    '1',
    'UN',
    '30301',
    'SPIKE-T002-A',
    '1',
    {
      _rmd: {
        provider: 'PRODUTORMP',
        CODPROD: {
          decVlr: 4,
          decQtd: 4,
          controle: {
            tipoContEst: 'L',
            labelContEst: 'Lote',
            listaContEst: [''],
            usaMascara: false,
          },
        },
      },
    },
  ];
  const CAMPOS_1813 = [
    'NUNOTA',
    'CODPROD',
    'QTDNEG',
    'VLRUNIT',
    'CODVOL',
    'CODLOCALORIG',
    'CONTROLE',
    'ATUALESTOQUE',
  ];

  it('save descarta a celula final _rmd e devolve so as celulas dos fields (D2.2b)', async () => {
    const http = createMockHttp();
    http.gatewayCall.mockResolvedValue({ total: '1', result: [LINHA_MEDIDA_1813] });

    const out = await new DatasetResource(http).save({
      entityName: 'ItemNota',
      fields: CAMPOS_1813,
      records: [datasetRecord(CAMPOS_1813, { set: { NUNOTA: '1889306' } })],
    });

    expect(out).toEqual({
      total: 1,
      result: [['1889306', '10077', '10', '1', 'UN', '30301', 'SPIKE-T002-A', '1']],
    });
  });

  it('save lanca quando a celula excedente NAO e a metadata _rmd', async () => {
    const http = createMockHttp();
    http.gatewayCall.mockResolvedValue({
      total: '1',
      result: [['1889306', { outra: 'coisa' }]],
    });

    await expect(
      new DatasetResource(http).save({
        entityName: 'ItemNota',
        fields: ['NUNOTA'],
        records: [datasetRecord(['NUNOTA'], { set: { NUNOTA: '1889306' } })],
      }),
    ).rejects.toMatchObject({ code: 'DATASET_SAVE_MALFORMED_RESPONSE' });
  });

  it('save lanca quando a celula excedente e HIBRIDA (_rmd + campo)', async () => {
    const http = createMockHttp();
    http.gatewayCall.mockResolvedValue({
      total: '1',
      result: [['1889306', { _rmd: { provider: 'PRODUTORMP' }, VLRTOT: '10' }]],
    });

    // Descartar isto jogaria fora um valor de campo em silencio.
    await expect(
      new DatasetResource(http).save({
        entityName: 'ItemNota',
        fields: ['NUNOTA'],
        records: [datasetRecord(['NUNOTA'], { set: { NUNOTA: '1889306' } })],
      }),
    ).rejects.toMatchObject({ code: 'DATASET_SAVE_MALFORMED_RESPONSE' });
  });

  it('save lanca quando ha mais de uma celula excedente, mesmo com _rmd', async () => {
    const http = createMockHttp();
    http.gatewayCall.mockResolvedValue({
      total: '1',
      result: [['1889306', 'sobra', { _rmd: {} }]],
    });

    await expect(
      new DatasetResource(http).save({
        entityName: 'ItemNota',
        fields: ['NUNOTA'],
        records: [datasetRecord(['NUNOTA'], { set: { NUNOTA: '1889306' } })],
      }),
    ).rejects.toMatchObject({ code: 'DATASET_SAVE_MALFORMED_RESPONSE' });
  });

  it('save continua lancando com objeto nao vazio em POSICAO DE CAMPO (D2.2 intocada)', async () => {
    const http = createMockHttp();
    http.gatewayCall.mockResolvedValue({
      total: '1',
      result: [[{ $: '1889306' }, { _rmd: {} }]],
    });

    await expect(
      new DatasetResource(http).save({
        entityName: 'ItemNota',
        fields: ['NUNOTA'],
        records: [datasetRecord(['NUNOTA'], { set: { NUNOTA: '1889306' } })],
      }),
    ).rejects.toMatchObject({ code: 'DATASET_SAVE_MALFORMED_RESPONSE' });
  });

  it('save lanca quando uma celula e objeto nao vazio (nunca "[object Object]")', async () => {
    const http = createMockHttp();
    http.gatewayCall.mockResolvedValue({ total: '1', result: [[{ $: '1889349' }]] });

    await expect(
      new DatasetResource(http).save({
        entityName: 'CabecalhoNota',
        fields: ['NUNOTA'],
        records: [datasetRecord(['NUNOTA'], { set: { NUNOTA: '1889349' } })],
      }),
    ).rejects.toThrow(/result\[0\]\[0\]/);
  });

  // Item 4 do review (M11/M12 sobreviveram): os ramos que o JSDoc vende como
  // decisao I11 nao tinham teste.
  it.each([
    ['total: null', { total: null, result: [['1889349']] }],
    ['total: string vazia', { total: '', result: [['1889349']] }],
  ])('save lanca quando %s (safeParseNumber daria 0)', async (_nome, resposta) => {
    const http = createMockHttp();
    http.gatewayCall.mockResolvedValue(resposta);

    await expect(
      new DatasetResource(http).save({
        entityName: 'CabecalhoNota',
        fields: ['NUNOTA'],
        records: [datasetRecord(['NUNOTA'], { set: { NUNOTA: '1889349' } })],
      }),
    ).rejects.toThrow(/total/);
  });

  it('save lanca quando result esta ausente com total presente (nunca [] silencioso)', async () => {
    const http = createMockHttp();
    http.gatewayCall.mockResolvedValue({ total: '1' });

    await expect(
      new DatasetResource(http).save({
        entityName: 'CabecalhoNota',
        fields: ['NUNOTA'],
        records: [datasetRecord(['NUNOTA'], { set: { NUNOTA: '1889349' } })],
      }),
    ).rejects.toThrow(/result/);
  });

  it('save lanca PARSE_ERROR quando total nao e numero', async () => {
    const http = createMockHttp();
    http.gatewayCall.mockResolvedValue({ total: 'abc', result: [] });

    await expect(
      new DatasetResource(http).save({
        entityName: 'CabecalhoNota',
        fields: ['NUNOTA'],
        records: [datasetRecord(['NUNOTA'], { set: { NUNOTA: '1889349' } })],
      }),
    ).rejects.toMatchObject({ code: 'PARSE_ERROR' });
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

  it('removeRecord leva standAlone: true explicito ao payload', async () => {
    const http = createMockHttp();
    http.gatewayCall.mockResolvedValue({});

    await new DatasetResource(http).removeRecord({
      entityName: 'CabecalhoNota',
      pks: [{ NUNOTA: '1889349' }],
      standAlone: true,
    });

    const body = http.gatewayCall.mock.calls[0][2] as { standAlone: boolean };
    expect(body.standAlone).toBe(true);
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

  // Item 1 do review (BLOQUEANTE): contar chaves nao basta — `JSON.stringify`
  // (src/core/http.ts:272) descarta chave com valor `undefined`, e o servidor
  // receberia `pks: [{}]`, o filtro vazio do incidente de R2/G3.
  it.each([
    ['valor undefined', { NUNOTA: undefined as unknown as string }],
    ['string vazia', { NUNOTA: '' }],
    ['so espacos', { NUNOTA: '   ' }],
    ['valor null', { NUNOTA: null as unknown as string }],
  ])('removeRecord recusa pk com %s (JSON.stringify apagaria a chave)', async (_nome, pk) => {
    const http = createMockHttp();
    await expect(
      new DatasetResource(http).removeRecord({ entityName: 'CabecalhoNota', pks: [pk] }),
    ).rejects.toThrow(/NUNOTA/);
    expect(http.gatewayCall).not.toHaveBeenCalled();
  });

  it('removeRecord recusa pk invalida mesmo quando a primeira pk da lista e valida', async () => {
    const http = createMockHttp();
    await expect(
      new DatasetResource(http).removeRecord({
        entityName: 'ItemNota',
        pks: [{ NUNOTA: '1889280' }, { NUNOTA: undefined as unknown as string }],
      }),
    ).rejects.toThrow(/NUNOTA/);
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
