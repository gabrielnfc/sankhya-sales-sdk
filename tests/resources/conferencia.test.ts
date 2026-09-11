import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ConferenciaResource } from '../../src/resources/conferencia.js';
import type { DatasetResource } from '../../src/resources/dataset.js';
import type { DbExplorerResource } from '../../src/resources/db-explorer.js';

/**
 * `dataset` dublado: esta suite testa o que o SDK **manda** para `DatasetSP.save`
 * (entidade, campos e indices posicionais), nunca a rede (Global Constraints).
 */
function createMockDs(result: unknown = { total: 1, result: [['281956']] }) {
  return { save: vi.fn().mockResolvedValue(result) } as unknown as DatasetResource & {
    save: ReturnType<typeof vi.fn>;
  };
}

/** `dbExplorer` dublado: guard de carimbo e guard de duplicata sao leitura. */
function createMockDbx(rows: Array<Record<string, string>> = []) {
  return { query: vi.fn().mockResolvedValue(rows) } as unknown as DbExplorerResource & {
    query: ReturnType<typeof vi.fn>;
  };
}

describe('ConferenciaResource', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('carimbarSeparacao', () => {
    it('carimbarSeparacao grava AD_DTHRSEPARACAO e AD_NOMESEPARADOR por pk (M76)', async () => {
      const ds = createMockDs({
        total: 1,
        result: [['1889338', '06/09/2026 12:55:34', 'SPIKE-T7']],
      });
      const dbx = createMockDbx();
      await new ConferenciaResource(ds, dbx).carimbarSeparacao({
        nunota: 1889338,
        dataHora: '06/09/2026 12:55:34',
        nomeSeparador: 'SPIKE-T7',
      });
      expect(ds.save).toHaveBeenCalledWith({
        entityName: 'CabecalhoNota',
        fields: ['NUNOTA', 'AD_DTHRSEPARACAO', 'AD_NOMESEPARADOR'],
        records: [
          {
            pk: { NUNOTA: '1889338' },
            values: { '1': '06/09/2026 12:55:34', '2': 'SPIKE-T7' },
          },
        ],
      });
    });
  });

  describe('abrir', () => {
    it('abrir recusa quando a nota nao tem carimbo de separacao (M76) — sem escrever', async () => {
      const dbx = createMockDbx([{ AD_DTHRSEPARACAO: '', NUNOTA: '1889349' }]);
      const ds = createMockDs();
      await expect(
        new ConferenciaResource(ds, dbx).abrir({
          nunota: 1889349,
          codUsuConf: 69,
          dataHora: '06/09/2026 12:55:34',
        }),
      ).rejects.toThrow(/carimbarSeparacao/);
      expect(ds.save).not.toHaveBeenCalled();
    });

    it('abrir recusa duplicata — guard do SeparaTrue, nao do ERP (M110)', async () => {
      const dbx = createMockDbx();
      dbx.query
        .mockResolvedValueOnce([{ AD_DTHRSEPARACAO: '06/09/2026 12:55:34' }])
        .mockResolvedValueOnce([{ NUCONF: '281956', STATUS: 'F' }]);
      const ds = createMockDs();
      await expect(
        new ConferenciaResource(ds, dbx).abrir({
          nunota: 1889349,
          codUsuConf: 69,
          dataHora: '06/09/2026 12:55:34',
        }),
      ).rejects.toThrow(/281956/);
      expect(ds.save).not.toHaveBeenCalled();
    });

    it('abrir grava CabecalhoConferencia sem NUCONF e devolve o NUCONF do result', async () => {
      const dbx = createMockDbx();
      dbx.query
        .mockResolvedValueOnce([{ AD_DTHRSEPARACAO: '06/09/2026 12:55:34' }])
        .mockResolvedValueOnce([]);
      // fixture: spike-raw/conferencia/C1_ABRIR_CONF_P.json
      const ds = createMockDs({ total: 1, result: [['281956']] });
      const out = await new ConferenciaResource(ds, dbx).abrir({
        nunota: 1889348,
        codUsuConf: 69,
        dataHora: '06/09/2026 12:55:34',
      });
      expect(ds.save).toHaveBeenCalledWith({
        entityName: 'CabecalhoConferencia',
        fields: ['NUCONF', 'NUNOTAORIG', 'DHINICONF', 'CODUSUCONF', 'STATUS'],
        records: [{ values: { '1': '1889348', '2': '06/09/2026 12:55:34', '3': '69', '4': 'A' } }],
      });
      expect(out).toEqual({ nuconf: 281956 });
    });

    it('abrir lanca quando o result nao traz NUCONF utilizavel — nunca devolve 0', async () => {
      const dbx = createMockDbx();
      dbx.query
        .mockResolvedValueOnce([{ AD_DTHRSEPARACAO: '06/09/2026 12:55:34' }])
        .mockResolvedValueOnce([]);
      const ds = createMockDs({ total: 1, result: [[]] });
      await expect(
        new ConferenciaResource(ds, dbx).abrir({
          nunota: 1889348,
          codUsuConf: 69,
          dataHora: '06/09/2026 12:55:34',
        }),
      ).rejects.toThrow(/NUCONF/);
    });

    it('abrir le o carimbo por SELECT puro em AD_DTHRSEPARACAO, filtrado pelo nunota recebido', async () => {
      const dbx = createMockDbx();
      dbx.query
        .mockResolvedValueOnce([{ AD_DTHRSEPARACAO: '06/09/2026 12:55:34' }])
        .mockResolvedValueOnce([]);
      const ds = createMockDs({ total: 1, result: [['281956']] });
      await new ConferenciaResource(ds, dbx).abrir({
        nunota: 1889348,
        codUsuConf: 69,
        dataHora: '06/09/2026 12:55:34',
      });
      const sql = String(dbx.query.mock.calls[0][0]);
      expect(sql).toMatch(/^\s*SELECT\b/);
      expect(sql).not.toContain(';');
      expect(sql).toContain('AD_DTHRSEPARACAO');
      // coluna nua, como na leitura medida (spike-raw/conferencia/C1_RB_P_POS_CONF.json)
      expect(sql).not.toContain('TO_CHAR');
      // filtro pelo nunota recebido, e so por ele: sem WHERE o guard leria outra nota
      expect(sql).toMatch(/WHERE\s+NUNOTA\s*=\s*1889348\s*$/);
    });

    it('abrir recusa NUNOTA nao-inteiro antes de qualquer leitura ou escrita', async () => {
      const dbx = createMockDbx();
      const ds = createMockDs();
      await expect(
        new ConferenciaResource(ds, dbx).abrir({
          nunota: 1.5,
          codUsuConf: 69,
          dataHora: '06/09/2026 12:55:34',
        }),
      ).rejects.toThrow(/inteiro/);
      expect(dbx.query).not.toHaveBeenCalled();
      expect(ds.save).not.toHaveBeenCalled();
    });
  });

  describe('bipar', () => {
    it('bipar grava DetalhesConferencia com CONTROLE (M38: o lote persiste em TGFCOI2)', async () => {
      const ds = createMockDs({ total: 1, result: [[]] });
      const dbx = createMockDbx();
      await new ConferenciaResource(ds, dbx).bipar({
        nuconf: 281956,
        seqConf: 1,
        codProd: 10077,
        codVol: 'UN',
        qtdConf: 1,
        codBarra: '7891234567890',
        controle: 'SPIKE-T002-A',
      });
      expect(ds.save).toHaveBeenCalledWith({
        entityName: 'DetalhesConferencia',
        fields: ['NUCONF', 'SEQCONF', 'CODPROD', 'CODVOL', 'QTDCONF', 'CODBARRA', 'CONTROLE'],
        records: [
          {
            values: {
              '0': '281956',
              '1': '1',
              '2': '10077',
              '3': 'UN',
              '4': '1',
              '5': '7891234567890',
              '6': 'SPIKE-T002-A',
            },
          },
        ],
      });
    });

    it('bipar aceita controle vazio — produto sem controle de lote nao tem lote a informar', async () => {
      const ds = createMockDs({ total: 1, result: [[]] });
      const dbx = createMockDbx();
      await new ConferenciaResource(ds, dbx).bipar({
        nuconf: 281956,
        seqConf: 1,
        codProd: 10077,
        codVol: 'UN',
        qtdConf: 1,
        codBarra: '7891234567890',
        controle: '',
      });
      expect(ds.save.mock.calls[0][0].records[0].values['6']).toBe('');
    });

    it('bipar recusa qtdConf <= 0 antes da rede', async () => {
      const ds = createMockDs();
      const dbx = createMockDbx();
      await expect(
        new ConferenciaResource(ds, dbx).bipar({
          nuconf: 281956,
          seqConf: 1,
          codProd: 10077,
          codVol: 'UN',
          qtdConf: 0,
          codBarra: '7891234567890',
          controle: 'SPIKE-T002-A',
        }),
      ).rejects.toThrow(/qtdConf/);
      expect(ds.save).not.toHaveBeenCalled();
    });
  });

  describe('fechar', () => {
    it('fechar grava DHFINCONF e STATUS=F por pk', async () => {
      const ds = createMockDs({ total: 1, result: [['281956']] });
      const dbx = createMockDbx();
      await new ConferenciaResource(ds, dbx).fechar({
        nuconf: 281956,
        dataHora: '06/09/2026 13:10:00',
      });
      expect(ds.save).toHaveBeenCalledWith({
        entityName: 'CabecalhoConferencia',
        fields: ['NUCONF', 'DHFINCONF', 'STATUS'],
        records: [{ pk: { NUCONF: '281956' }, values: { '1': '06/09/2026 13:10:00', '2': 'F' } }],
      });
    });
  });

  describe('E1 / E2 (M107 / M108)', () => {
    it('apontarNaNota (E1) e reapontarOrigem (E2) escrevem entidades diferentes (M107/M108)', async () => {
      const ds = createMockDs({ total: 1, result: [['1889349', '281956']] });
      const dbx = createMockDbx();
      const c = new ConferenciaResource(ds, dbx);
      await c.apontarNaNota({ nunota: 1889349, nuconf: 281956 });
      await c.reapontarOrigem({ nuconf: 281956, nunota: 1889349 });
      expect(ds.save.mock.calls[0][0]).toMatchObject({
        entityName: 'CabecalhoNota',
        fields: ['NUNOTA', 'NUCONFATUAL'],
      });
      expect(ds.save.mock.calls[1][0]).toMatchObject({
        entityName: 'CabecalhoConferencia',
        fields: ['NUCONF', 'NUNOTAORIG'],
      });
    });
  });

  describe('listarPorNota', () => {
    it('listarPorNota devolve NUCONF numerico e STATUS, por SELECT puro sem ";"', async () => {
      const ds = createMockDs();
      const dbx = createMockDbx([
        { NUCONF: '281956', STATUS: 'F' },
        { NUCONF: '281957', STATUS: 'A' },
      ]);
      const out = await new ConferenciaResource(ds, dbx).listarPorNota(1889338);
      expect(out).toEqual([
        { nuconf: 281956, status: 'F' },
        { nuconf: 281957, status: 'A' },
      ]);
      const sql = String(dbx.query.mock.calls[0][0]);
      expect(sql).toMatch(/^SELECT\b/);
      expect(sql).not.toContain(';');
      expect(sql).toContain('1889338');
    });

    it('listarPorNota lanca quando o NUCONF lido nao e numerico — nunca devolve NaN', async () => {
      const ds = createMockDs();
      const dbx = createMockDbx([{ NUCONF: 'X', STATUS: 'A' }]);
      await expect(new ConferenciaResource(ds, dbx).listarPorNota(1889338)).rejects.toThrow(
        /NUCONF/,
      );
    });

    it('listarPorNota recusa nunota nao-inteiro antes da rede', async () => {
      const ds = createMockDs();
      const dbx = createMockDbx();
      await expect(new ConferenciaResource(ds, dbx).listarPorNota(Number.NaN)).rejects.toThrow(
        /inteiro/,
      );
      expect(dbx.query).not.toHaveBeenCalled();
    });
  });
});
