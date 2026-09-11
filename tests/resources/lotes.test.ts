import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DatasetResource } from '../../src/resources/dataset.js';
import { LotesResource } from '../../src/resources/lotes.js';
import type { NotasResource } from '../../src/resources/notas.js';
import type { DatasetSaveParams } from '../../src/types/dataset.js';

/**
 * `dataset` e `notas` dublados: esta suite testa o que o SDK **manda** para
 * `DatasetSP.save` e em que **ordem** — nunca a rede (Global Constraints).
 */
function createMockDs(result: unknown = { total: 1, result: [['1889280']] }) {
  return { save: vi.fn().mockResolvedValue(result) } as unknown as DatasetResource & {
    save: ReturnType<typeof vi.fn>;
  };
}

function createMockNotas() {
  return {
    confirmar: vi.fn().mockResolvedValue({ confirmada: true, jaEstavaConfirmada: false }),
  } as unknown as NotasResource & { confirmar: ReturnType<typeof vi.fn> };
}

const ENTRADA_OK = {
  codEmp: 2,
  codLocal: 30301,
  codProd: 10077,
  dtNeg: '06/09/2026',
  observacao: 'SDK-T entrada',
  itens: [
    { controle: 'SDK-T-A', quantidade: 10, vlrUnit: 1, dtVal: '06/09/2027', dtFab: '06/09/2026' },
  ],
} as const;

describe('LotesResource', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('entrada1813', () => {
    it('entrada1813 grava as datas em Estoque ANTES de confirmar (M97)', async () => {
      const ordem: string[] = [];
      const ds = {
        save: vi.fn().mockImplementation((p: DatasetSaveParams) => {
          ordem.push(p.entityName);
          return Promise.resolve({ total: 1, result: [['1889280']] });
        }),
      } as unknown as DatasetResource;
      const notas = {
        confirmar: vi.fn().mockImplementation(() => {
          ordem.push('confirmar');
          return Promise.resolve({ confirmada: true, jaEstavaConfirmada: false });
        }),
      } as unknown as NotasResource;

      await new LotesResource(ds, notas).entrada1813({
        ...ENTRADA_OK,
        itens: [...ENTRADA_OK.itens],
      });

      expect(ordem).toEqual(['CabecalhoNota', 'ItemNota', 'Estoque', 'confirmar']);
    });

    it('entrada1813 usa a PK de 6 colunas em Estoque (M36/M88)', async () => {
      const ds = createMockDs();
      const notas = createMockNotas();

      await new LotesResource(ds, notas).entrada1813({
        ...ENTRADA_OK,
        itens: [...ENTRADA_OK.itens],
      });

      expect(ds.save.mock.calls[2]?.[0]).toEqual({
        entityName: 'Estoque',
        fields: [
          'CODEMP',
          'CODLOCAL',
          'CODPROD',
          'CONTROLE',
          'TIPO',
          'CODPARC',
          'DTVAL',
          'DTFABRICACAO',
        ],
        records: [
          {
            pk: {
              CODEMP: '2',
              CODLOCAL: '30301',
              CODPROD: '10077',
              CONTROLE: 'SDK-T-A',
              TIPO: 'P',
              CODPARC: '0',
            },
            values: { '6': '06/09/2027', '7': '06/09/2026' },
          },
        ],
      });
    });

    it('entrada1813 grava CONTROLE e ATUALESTOQUE 1 em cada ItemNota (M36)', async () => {
      const ds = createMockDs();
      const notas = createMockNotas();

      await new LotesResource(ds, notas).entrada1813({
        ...ENTRADA_OK,
        itens: [...ENTRADA_OK.itens],
      });

      const ite = ds.save.mock.calls[1]?.[0] as DatasetSaveParams;
      expect(ite.entityName).toBe('ItemNota');
      expect(ite.fields).toContain('CONTROLE');
      expect(ite.records[0]?.values[String(ite.fields.indexOf('CONTROLE'))]).toBe('SDK-T-A');
      expect(ite.records[0]?.values[String(ite.fields.indexOf('ATUALESTOQUE'))]).toBe('1');
    });

    it('entrada1813 devolve o NUNOTA lido do result do save', async () => {
      const ds = createMockDs();
      const notas = createMockNotas();

      await expect(
        new LotesResource(ds, notas).entrada1813({ ...ENTRADA_OK, itens: [...ENTRADA_OK.itens] }),
      ).resolves.toEqual({ nunota: 1889280 });
      expect(notas.confirmar).toHaveBeenCalledWith(1889280);
    });

    it('entrada1813 recusa itens vazio ANTES de qualquer escrita', async () => {
      const ds = createMockDs();
      const notas = createMockNotas();

      await expect(
        new LotesResource(ds, notas).entrada1813({ ...ENTRADA_OK, itens: [] }),
      ).rejects.toThrow(/itens/i);
      expect(ds.save).not.toHaveBeenCalled();
      expect(notas.confirmar).not.toHaveBeenCalled();
    });
  });

  describe('baixa1811', () => {
    it('baixa1811 usa CODTIPOPER 1811 e ATUALESTOQUE -1 (M100)', async () => {
      const ds = createMockDs({ total: 1, result: [['1889290']] });
      const notas = createMockNotas();

      await new LotesResource(ds, notas).baixa1811({
        codEmp: 1,
        codProd: 10015,
        dtNeg: '06/09/2026',
        observacao: 'SDK-T ajuste',
        itens: [
          { codLocal: 30201, quantidade: 2 },
          { codLocal: 30403, quantidade: 10 },
        ],
      });

      const cab = ds.save.mock.calls[0]?.[0] as DatasetSaveParams;
      expect(cab.fields[cab.fields.indexOf('CODTIPOPER')]).toBe('CODTIPOPER');
      expect(Object.values(cab.records[0]?.values ?? {})).toContain('1811');
      const ite = ds.save.mock.calls[1]?.[0] as DatasetSaveParams;
      expect(Object.values(ite.records[0]?.values ?? {})).toContain('-1');
      expect(ite.records).toHaveLength(2);
    });

    it('baixa1811 recusa quantidade <= 0 ANTES de qualquer escrita', async () => {
      const ds = createMockDs();
      const notas = createMockNotas();

      await expect(
        new LotesResource(ds, notas).baixa1811({
          codEmp: 1,
          codProd: 10015,
          dtNeg: '06/09/2026',
          observacao: 'SDK-T ajuste',
          itens: [{ codLocal: 30201, quantidade: 0 }],
        }),
      ).rejects.toThrow(/quantidade/i);
      expect(ds.save).not.toHaveBeenCalled();
    });
  });
});
