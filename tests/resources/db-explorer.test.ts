import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { HttpClient } from '../../src/core/http.js';
import { DbExplorerResource } from '../../src/resources/db-explorer.js';

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

describe('DbExplorerResource', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each([
    'UPDATE TGFEST SET ESTOQUE = 0',
    'DELETE FROM TGFCAB',
    'SELECT 1 FROM DUAL; DROP TABLE TGFEST',
    'SELECT 1 FROM DUAL;',
    'INSERT INTO t SELECT 1 FROM DUAL',
    'WITH x AS (SELECT 1 FROM DUAL) SELECT * FROM x',
    'DELETE FROM TGFCAB WHERE NUNOTA IN (SELECT NUNOTA FROM TGFITE)',
    '  delete from x',
    '',
  ])('recusa SQL que nao e SELECT puro: %s', async (sql) => {
    const http = createMockHttp();
    await expect(new DbExplorerResource(http).query(sql)).rejects.toThrow(/SELECT/i);
    expect(http.gatewayCall).not.toHaveBeenCalled(); // recusa ANTES da rede
  });

  // Consumidor JS (sem TS) pode passar algo que nao e string: recusa antes da
  // rede. O array e o caso que importa — `regex.test(valor)` coage para string e
  // `Array.prototype.includes` existe, entao sem a checagem de `typeof` ele
  // atravessaria o guard inteiro e chegaria ao Sankhya.
  it.each([
    ['undefined', undefined],
    ['array que imita SELECT', ['SELECT 1 FROM DUAL']],
  ])('recusa sql nao-string (%s)', async (_label, sql) => {
    const http = createMockHttp();
    await expect(new DbExplorerResource(http).query(sql as unknown as string)).rejects.toThrow(
      /SELECT/i,
    );
    expect(http.gatewayCall).not.toHaveBeenCalled();
  });

  it('casa rows com fieldsMetadata (resposta real do sandbox)', async () => {
    const http = createMockHttp();
    http.gatewayCall.mockResolvedValue({
      fieldsMetadata: [{ name: 'NUNOTA' }, { name: 'STATUSNOTA' }, { name: 'PENDENTE' }],
      rows: [
        ['1889309', 'L', 'S'],
        ['1889310', 'L', 'N'],
      ],
    });
    const sql = 'SELECT NUNOTA, STATUSNOTA, PENDENTE FROM TGFCAB WHERE NUNOTA IN (1889309,1889310)';
    const rows = await new DbExplorerResource(http).query(sql);
    // Payload preso no literal: o SDK nao reescreve o SQL do chamador.
    expect(http.gatewayCall).toHaveBeenCalledWith(
      'mge',
      'DbExplorerSP.executeQuery',
      { sql },
      undefined,
      true,
    );
    expect(rows).toEqual([
      { NUNOTA: '1889309', STATUSNOTA: 'L', PENDENTE: 'S' },
      { NUNOTA: '1889310', STATUSNOTA: 'L', PENDENTE: 'N' },
    ]);
  });

  it('devolve [] quando rows vem ausente', async () => {
    const http = createMockHttp();
    http.gatewayCall.mockResolvedValue({ fieldsMetadata: [{ name: 'X' }] });
    await expect(new DbExplorerResource(http).query('SELECT X FROM DUAL')).resolves.toEqual([]);
  });

  it('aceita SELECT com espacos a esquerda e caixa mista', async () => {
    const http = createMockHttp();
    http.gatewayCall.mockResolvedValue({ fieldsMetadata: [{ name: 'X' }], rows: [['1']] });
    await expect(new DbExplorerResource(http).query('\n  select X from DUAL')).resolves.toEqual([
      { X: '1' },
    ]);
    // Nem trim: o SQL chega ao Gateway exatamente como o chamador escreveu.
    expect(http.gatewayCall.mock.calls[0][2]).toEqual({ sql: '\n  select X from DUAL' });
  });

  // Medido no spike legado (tools/sankhya-spike/lib.ts:80): CODLOCAL veio `number`,
  // nao string. A celula e convertida explicitamente; null/undefined viram ''.
  it('converte celula nao-string para string; so null/undefined viram vazio', async () => {
    const http = createMockHttp();
    http.gatewayCall.mockResolvedValue({
      fieldsMetadata: [
        { name: 'CODLOCAL' },
        { name: 'QTDNEG' },
        { name: 'ATIVO' },
        { name: 'DESCRICAO' },
        { name: 'DTALTER' },
      ],
      // 0 e false sao valores reais do ERP (quantidade, flag) — nao podem virar ''.
      rows: [[1010, 0, false, null, undefined]],
    });
    const rows = await new DbExplorerResource(http).query(
      'SELECT CODLOCAL, QTDNEG, ATIVO, DESCRICAO, DTALTER FROM TGFLOC',
    );
    expect(rows).toEqual([
      { CODLOCAL: '1010', QTDNEG: '0', ATIVO: 'false', DESCRICAO: '', DTALTER: '' },
    ]);
  });

  // I11: linha com numero de colunas diferente do metadata nao vira objeto
  // parcial em silencio — lanca.
  it('lanca quando a linha tem numero de colunas diferente do fieldsMetadata', async () => {
    const http = createMockHttp();
    http.gatewayCall.mockResolvedValue({
      fieldsMetadata: [{ name: 'NUNOTA' }, { name: 'STATUSNOTA' }],
      rows: [['1889309', 'L'], ['1889310']],
    });
    await expect(
      new DbExplorerResource(http).query('SELECT NUNOTA, STATUSNOTA FROM TGFCAB'),
    ).rejects.toThrow(/colunas/i);
  });
});
