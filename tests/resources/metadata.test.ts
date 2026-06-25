import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SankhyaError } from '../../src/core/errors.js';
import type { HttpClient } from '../../src/core/http.js';
import { MetadataResource } from '../../src/resources/metadata.js';

const mockLogger = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };

function createMockHttp() {
  return {
    restGet: vi.fn(),
    restPost: vi.fn(),
    restPut: vi.fn(),
    gatewayCall: vi.fn(),
    getLogger: vi.fn(() => mockLogger),
  } as unknown as HttpClient & {
    gatewayCall: ReturnType<typeof vi.fn>;
    getLogger: ReturnType<typeof vi.fn>;
  };
}

/** Linha posicional do DbExplorer: [name, type, length, nullable, precision, scale]. */
function dbResponse(rows: unknown[][]) {
  return { rows };
}

describe('MetadataResource', () => {
  beforeEach(() => vi.clearAllMocks());

  describe('listFields()', () => {
    it('resolves a known entity name to its physical table in the SQL', async () => {
      const http = createMockHttp();
      const meta = new MetadataResource(http);
      http.gatewayCall.mockResolvedValue(dbResponse([['NUNOTA', 'NUMBER', 22, 'N', 10, 0]]));

      await meta.listFields('CabecalhoNota');

      expect(http.gatewayCall).toHaveBeenCalledWith(
        'mge',
        'DbExplorerSP.executeQuery',
        expect.objectContaining({ sql: expect.stringContaining("TABLE_NAME = 'TGFCAB'") }),
      );
    });

    it('is case-insensitive for entity resolution', async () => {
      const http = createMockHttp();
      const meta = new MetadataResource(http);
      http.gatewayCall.mockResolvedValue(dbResponse([['CODPARC', 'NUMBER', 22, 'N', 10, 0]]));

      await meta.listFields('parceiro');

      const arg = http.gatewayCall.mock.calls[0][2] as { sql: string };
      expect(arg.sql).toContain("TABLE_NAME = 'TGFPAR'");
    });

    it('passes unknown names through as physical table (uppercased)', async () => {
      const http = createMockHttp();
      const meta = new MetadataResource(http);
      http.gatewayCall.mockResolvedValue(dbResponse([['X', 'NUMBER', 22, 'Y', null, null]]));

      await meta.listFields('tgfxyz');

      const arg = http.gatewayCall.mock.calls[0][2] as { sql: string };
      expect(arg.sql).toContain("TABLE_NAME = 'TGFXYZ'");
    });

    it('maps rows to EntityField, flags AD_ as custom and parses nullable', async () => {
      const http = createMockHttp();
      const meta = new MetadataResource(http);
      http.gatewayCall.mockResolvedValue(
        dbResponse([
          ['NUNOTA', 'NUMBER', 22, 'N', 10, 0],
          ['AD_CODRASTREIO', 'VARCHAR2', 100, 'Y', null, null],
        ]),
      );

      const fields = await meta.listFields('CabecalhoNota');

      expect(fields).toEqual([
        {
          name: 'NUNOTA',
          type: 'NUMBER',
          length: 22,
          nullable: false,
          custom: false,
          precision: 10,
          scale: 0,
        },
        { name: 'AD_CODRASTREIO', type: 'VARCHAR2', length: 100, nullable: true, custom: true },
      ]);
    });

    it('filters to custom AD_ fields when customOnly is set', async () => {
      const http = createMockHttp();
      const meta = new MetadataResource(http);
      http.gatewayCall.mockResolvedValue(
        dbResponse([
          ['NUNOTA', 'NUMBER', 22, 'N', 10, 0],
          ['AD_FOO', 'VARCHAR2', 10, 'Y', null, null],
          ['AD_BAR', 'DATE', 7, 'Y', null, null],
        ]),
      );

      const fields = await meta.listFields('CabecalhoNota', { customOnly: true });

      expect(fields.map((f) => f.name)).toEqual(['AD_FOO', 'AD_BAR']);
    });

    it('throws METADATA_EMPTY when no columns are returned', async () => {
      const http = createMockHttp();
      const meta = new MetadataResource(http);
      http.gatewayCall.mockResolvedValue(dbResponse([]));

      await expect(meta.listFields('NAO_EXISTE')).rejects.toMatchObject({
        code: 'METADATA_EMPTY',
      });
    });

    it('tolerates a missing rows array', async () => {
      const http = createMockHttp();
      const meta = new MetadataResource(http);
      http.gatewayCall.mockResolvedValue({});

      await expect(meta.listFields('TGFCAB')).rejects.toBeInstanceOf(SankhyaError);
    });

    it.each(['', '   '])('rejects empty input %p', async (input) => {
      const http = createMockHttp();
      const meta = new MetadataResource(http);

      await expect(meta.listFields(input)).rejects.toMatchObject({
        code: 'METADATA_INVALID_INPUT',
      });
      expect(http.gatewayCall).not.toHaveBeenCalled();
    });

    it('blocks SQL injection in the table name', async () => {
      const http = createMockHttp();
      const meta = new MetadataResource(http);

      await expect(meta.listFields("TGFCAB'; DROP TABLE X--")).rejects.toMatchObject({
        code: 'METADATA_INVALID_INPUT',
      });
      expect(http.gatewayCall).not.toHaveBeenCalled();
    });

    it('warns when DbExplorer truncates the result (burstLimit)', async () => {
      const http = createMockHttp();
      const meta = new MetadataResource(http);
      http.gatewayCall.mockResolvedValue({
        rows: [['NUNOTA', 'NUMBER', 22, 'N', 10, 0]],
        burstLimit: true,
      });

      const fields = await meta.listFields('CabecalhoNota');

      expect(fields).toHaveLength(1);
      expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining('burstLimit'));
    });

    it('does not warn when burstLimit is false', async () => {
      const http = createMockHttp();
      const meta = new MetadataResource(http);
      http.gatewayCall.mockResolvedValue({
        rows: [['NUNOTA', 'NUMBER', 22, 'N', 10, 0]],
        burstLimit: false,
      });

      await meta.listFields('CabecalhoNota');

      expect(mockLogger.warn).not.toHaveBeenCalled();
    });

    it('coerces non-numeric length/precision to 0', async () => {
      const http = createMockHttp();
      const meta = new MetadataResource(http);
      http.gatewayCall.mockResolvedValue(dbResponse([['COL', 'CLOB', 'n/a', 'Y', null, null]]));

      const [field] = await meta.listFields('TGFCAB');

      expect(field.length).toBe(0);
    });
  });
});
