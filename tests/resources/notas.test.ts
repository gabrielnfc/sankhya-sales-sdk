import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GatewayError, TimeoutError } from '../../src/core/errors.js';
import type { HttpClient } from '../../src/core/http.js';
import type { DbExplorerResource } from '../../src/resources/db-explorer.js';
import { NotasResource } from '../../src/resources/notas.js';

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

/** `dbExplorer` dublado: o read-back e o que esta sob teste, nunca a rede. */
function createMockDbx(rows: Array<Record<string, string>> = []) {
  return { query: vi.fn().mockResolvedValue(rows) } as unknown as DbExplorerResource & {
    query: ReturnType<typeof vi.fn>;
  };
}

describe('NotasResource', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('confirmar', () => {
    it('confirmar trata "ja foi confirmada" como sucesso equivalente (M80)', async () => {
      const http = createMockHttp();
      const dbx = createMockDbx();
      http.gatewayCall.mockRejectedValue(
        new GatewayError('A nota 1889309 ja foi confirmada.', 'CACSP.confirmarNota'),
      );
      await expect(new NotasResource(http, dbx).confirmar(1889309)).resolves.toEqual({
        confirmada: true,
        jaEstavaConfirmada: true,
      });
    });

    it('confirmar propaga erro de negocio que NAO seja o de idempotencia', async () => {
      const http = createMockHttp();
      const dbx = createMockDbx();
      http.gatewayCall.mockRejectedValue(
        new GatewayError(
          'Falta informar Data de Validade e/ou Data de Fabricacao',
          'CACSP.confirmarNota',
        ),
      );
      await expect(new NotasResource(http, dbx).confirmar(1)).rejects.toThrow(/Data de Validade/);
    });

    it('confirmar usa mgecom/CACSP.confirmarNota e devolve jaEstavaConfirmada false no caminho feliz', async () => {
      const http = createMockHttp();
      const dbx = createMockDbx();
      http.gatewayCall.mockResolvedValue({});
      await expect(new NotasResource(http, dbx).confirmar(1889309)).resolves.toEqual({
        confirmada: true,
        jaEstavaConfirmada: false,
      });
      expect(http.gatewayCall).toHaveBeenCalledWith(
        'mgecom',
        'CACSP.confirmarNota',
        { nota: { NUNOTA: { $: '1889309' } } },
        undefined,
      );
    });

    it('confirmar classifica a falha nao-idempotente antes de re-lancar o erro original', async () => {
      const http = createMockHttp();
      const dbx = createMockDbx();
      const erro = new TimeoutError('Request timeout apos 30000ms');
      http.gatewayCall.mockRejectedValue(erro);
      await expect(new NotasResource(http, dbx).confirmar(1889309)).rejects.toBe(erro);
      expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining('TIMEOUT'));
    });
  });

  describe('excluir', () => {
    it('excluir usa o unico formato aceito: notas.nota[].NUNOTA string (M73)', async () => {
      const http = createMockHttp();
      const dbx = createMockDbx();
      http.gatewayCall.mockResolvedValue({});
      await new NotasResource(http, dbx).excluir([1889304, 1889305]);
      expect(http.gatewayCall).toHaveBeenCalledWith(
        'mgecom',
        'CACSP.excluirNotas',
        { notas: { nota: [{ NUNOTA: '1889304' }, { NUNOTA: '1889305' }] } },
        undefined,
      );
    });

    it('excluir recusa lista vazia ANTES da rede', async () => {
      const http = createMockHttp();
      const dbx = createMockDbx();
      await expect(new NotasResource(http, dbx).excluir([])).rejects.toThrow(/nunotas/);
      expect(http.gatewayCall).not.toHaveBeenCalled();
    });

    it('excluir recusa nunota nao-inteiro ANTES da rede', async () => {
      const http = createMockHttp();
      const dbx = createMockDbx();
      await expect(new NotasResource(http, dbx).excluir([1889304, 1.5])).rejects.toThrow(
        /inteiro/i,
      );
      expect(http.gatewayCall).not.toHaveBeenCalled();
    });
  });

  describe('cancelar', () => {
    it('cancelar le resultadoCancelamento.totalNotasCanceladas (fixture real V7) e NAO a raiz', async () => {
      const http = createMockHttp();
      http.gatewayCall.mockResolvedValue({
        resultadoCancelamento: { totalNotasCanceladas: '0', gerouRecebimento: 'false' },
      });
      const dbx = createMockDbx([]); // 0 linhas em TGFCAN
      const out = await new NotasResource(http, dbx).cancelar({
        nunota: 1889277,
        justificativa: 'teste',
      });
      expect(dbx.query).toHaveBeenCalled();
      expect(out).toEqual({
        totalNotasCanceladas: 0,
        gerouRecebimento: false,
        confirmadoPorReadBack: false,
        statusNfe: null,
      });
    });

    it('cancelar so confirma quando TGFCAN tem a linha (M75/M94)', async () => {
      const http = createMockHttp();
      http.gatewayCall.mockResolvedValue({
        resultadoCancelamento: { totalNotasCanceladas: '1', gerouRecebimento: 'false' },
      });
      const dbx = createMockDbx([{ NUNOTA: '1889277', STATUSNFE: 'C' }]);
      await expect(
        new NotasResource(http, dbx).cancelar({ nunota: 1889277, justificativa: 'x' }),
      ).resolves.toMatchObject({ confirmadoPorReadBack: true, statusNfe: 'C' });
    });

    it('cancelar com resposta sem resultadoCancelamento nao explode e nao confirma', async () => {
      const http = createMockHttp();
      http.gatewayCall.mockResolvedValue({});
      const dbx = createMockDbx([]);
      await expect(
        new NotasResource(http, dbx).cancelar({ nunota: 1, justificativa: 'x' }),
      ).resolves.toMatchObject({ totalNotasCanceladas: 0, confirmadoPorReadBack: false });
    });

    it('cancelar envia o payload medido no sandbox (notasCanceladas.notaCancelada[])', async () => {
      const http = createMockHttp();
      http.gatewayCall.mockResolvedValue({
        resultadoCancelamento: { totalNotasCanceladas: '1', gerouRecebimento: 'true' },
      });
      const dbx = createMockDbx([{ NUNOTA: '1889277', STATUSNFE: '' }]);
      const out = await new NotasResource(http, dbx).cancelar({
        nunota: 1889277,
        justificativa: 'devolucao do cliente',
      });
      expect(http.gatewayCall).toHaveBeenCalledWith(
        'mgecom',
        'CACSP.cancelarNota',
        {
          notasCanceladas: {
            justificativa: 'devolucao do cliente',
            notaCancelada: [{ NUNOTA: '1889277' }],
          },
        },
        undefined,
      );
      // gerouRecebimento vem string do Gateway: 'true' precisa virar boolean true.
      expect(out).toEqual({
        totalNotasCanceladas: 1,
        gerouRecebimento: true,
        confirmadoPorReadBack: true,
        statusNfe: null, // STATUSNFE vazio nao e status: e ausencia (null), nunca ''
      });
    });

    it('cancelar recusa nunota nao-inteiro ANTES da rede e do read-back', async () => {
      const http = createMockHttp();
      const dbx = createMockDbx();
      await expect(
        new NotasResource(http, dbx).cancelar({ nunota: 1 / 3, justificativa: 'x' }),
      ).rejects.toThrow(/inteiro/i);
      expect(http.gatewayCall).not.toHaveBeenCalled();
      expect(dbx.query).not.toHaveBeenCalled();
    });

    it('cancelar recusa justificativa vazia ANTES da rede', async () => {
      const http = createMockHttp();
      const dbx = createMockDbx();
      await expect(
        new NotasResource(http, dbx).cancelar({ nunota: 1889277, justificativa: '   ' }),
      ).rejects.toThrow(/justificativa/i);
      expect(http.gatewayCall).not.toHaveBeenCalled();
    });

    it('cancelar interpola no SQL apenas o inteiro validado (guarda de injecao)', async () => {
      const http = createMockHttp();
      http.gatewayCall.mockResolvedValue({
        resultadoCancelamento: { totalNotasCanceladas: '1', gerouRecebimento: 'false' },
      });
      const dbx = createMockDbx([{ NUNOTA: '1889277', STATUSNFE: 'C' }]);
      await new NotasResource(http, dbx).cancelar({ nunota: 1889277, justificativa: 'x' });
      const sql = dbx.query.mock.calls[0]?.[0] as string;
      expect(sql).toMatch(/^\s*SELECT\b/i);
      expect(sql).not.toContain(';');
      expect(sql).toContain('TGFCAN');
      expect(sql).toContain('STATUSNFE');
      expect(sql).toContain('1889277');
    });

    it('cancelar NUNCA devolve sucesso quando o read-back esta indisponivel (fail-closed, G9)', async () => {
      const http = createMockHttp();
      http.gatewayCall.mockResolvedValue({
        resultadoCancelamento: { totalNotasCanceladas: '1', gerouRecebimento: 'false' },
      });
      const dbx = {
        query: vi.fn().mockRejectedValue(new Error('sem permissao no DbExplorer')),
      } as unknown as DbExplorerResource & {
        query: ReturnType<typeof vi.fn>;
      };
      await expect(
        new NotasResource(http, dbx).cancelar({ nunota: 1889277, justificativa: 'x' }),
      ).rejects.toThrow(/read-back/i);
    });
  });
});
