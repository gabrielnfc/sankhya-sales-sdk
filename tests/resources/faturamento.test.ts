import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GatewayError, SankhyaError, TimeoutError } from '../../src/core/errors.js';
import { buildFaturarWizardPayload } from '../../src/core/faturamento-payload.js';
import type { HttpClient } from '../../src/core/http.js';
import type { DbExplorerResource } from '../../src/resources/db-explorer.js';
import { FaturamentoResource } from '../../src/resources/faturamento.js';

/**
 * O builder do wizard (D1.3) e embrulhado num spy que chama a implementacao
 * REAL: o comportamento nao muda, mas a delegacao fica provada. Sem isto,
 * montar o corpo inline dentro de `faturar` seria um mutante equivalente — o
 * payload sairia identico e nenhum `toEqual` acusaria a duplicacao da fonte
 * unica (Global Constraints: `faturamento-payload.ts` e o unico lugar que monta
 * este corpo).
 */
vi.mock('../../src/core/faturamento-payload.js', async (importOriginal) => {
  const mod = await importOriginal<typeof import('../../src/core/faturamento-payload.js')>();
  return { ...mod, buildFaturarWizardPayload: vi.fn(mod.buildFaturarWizardPayload) };
});

const mockLogger = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };

/** Copiado de `tests/resources/gateway.test.ts:7-36` (Global Constraints). */
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

const varRow = (n: string) => ({ NUNOTA: n, SEQUENCIA: '1', SEQUENCIAORIG: '2', QTDATENDIDA: '4' });

describe('FaturamentoResource', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('faturar', () => {
    it('nao fatura quando TGFVAR ja tem linha (S2 guard)', async () => {
      const dbx = {
        query: vi.fn().mockResolvedValue([varRow('1889311')]),
      } as unknown as DbExplorerResource & { query: ReturnType<typeof vi.fn> };
      const http = createMockHttp();
      const out = await new FaturamentoResource(http, dbx).faturar({
        nunotaPedido: 1889309,
        codigoTipoOperacao: 1101,
      });
      expect(http.gatewayCall).not.toHaveBeenCalled();
      expect(out).toEqual({ faturado: false, nunotaNota: 1889311, motivo: 'JA_FATURADO' });
      // TGFVAR e a PRIMEIRA leitura: achou linha, nem consulta PENDENTE.
      expect(dbx.query).toHaveBeenCalledTimes(1);
      expect(dbx.query.mock.calls[0][0]).toContain('TGFVAR');
    });

    it('nao fatura quando PENDENTE = N mesmo com TGFVAR vazio (M81)', async () => {
      const dbx = {
        query: vi
          .fn()
          .mockResolvedValueOnce([]) // TGFVAR vazio
          .mockResolvedValueOnce([{ PENDENTE: 'N', STATUSNOTA: 'L' }]), // TGFCAB
      } as unknown as DbExplorerResource & { query: ReturnType<typeof vi.fn> };
      const http = createMockHttp();
      const out = await new FaturamentoResource(http, dbx).faturar({
        nunotaPedido: 1889309,
        codigoTipoOperacao: 1101,
      });
      expect(http.gatewayCall).not.toHaveBeenCalled();
      expect(out).toEqual({ faturado: false, nunotaNota: null, motivo: 'NAO_PENDENTE' });
      expect(dbx.query.mock.calls[1][0]).toContain('TGFCAB');
    });

    it.each([
      ['linha ausente em TGFCAB (leitura vazia nao autoriza faturar — I4/G2)', []],
      ['PENDENTE vazio', [{ PENDENTE: '', STATUSNOTA: 'L' }]],
      ['PENDENTE com valor desconhecido', [{ PENDENTE: 'X', STATUSNOTA: 'L' }]],
    ])('guard PENDENTE fecha em %s, nao so em N', async (_caso, cab) => {
      const dbx = {
        query: vi.fn().mockResolvedValueOnce([]).mockResolvedValueOnce(cab),
      } as unknown as DbExplorerResource & { query: ReturnType<typeof vi.fn> };
      const http = createMockHttp();
      const out = await new FaturamentoResource(http, dbx).faturar({
        nunotaPedido: 1889309,
        codigoTipoOperacao: 1101,
      });
      expect(out).toEqual({ faturado: false, nunotaNota: null, motivo: 'NAO_PENDENTE' });
      expect(http.gatewayCall).not.toHaveBeenCalled();
    });

    it('fatura e devolve a 1101 lida no read-back pos-chamada', async () => {
      const dbx = {
        query: vi
          .fn()
          .mockResolvedValueOnce([]) // TGFVAR pre
          .mockResolvedValueOnce([{ PENDENTE: 'S', STATUSNOTA: 'L' }]) // TGFCAB pre
          .mockResolvedValueOnce([varRow('1889311')]), // TGFVAR pos
      } as unknown as DbExplorerResource & { query: ReturnType<typeof vi.fn> };
      const http = createMockHttp();
      http.gatewayCall.mockResolvedValue({});
      const out = await new FaturamentoResource(http, dbx).faturar({
        nunotaPedido: 1889309,
        codigoTipoOperacao: 1101,
      });
      expect(http.gatewayCall.mock.calls[0][1]).toBe('SelecaoDocumentoSP.faturar');
      expect(http.gatewayCall.mock.calls[0][0]).toBe('mgecom');
      expect(out).toEqual({ faturado: true, nunotaNota: 1889311, motivo: 'FATURADO' });
    });

    it('gateway aceitou mas TGFVAR segue vazio: lanca, nao inventa sucesso (I3)', async () => {
      const dbx = {
        query: vi
          .fn()
          .mockResolvedValueOnce([])
          .mockResolvedValueOnce([{ PENDENTE: 'S', STATUSNOTA: 'L' }])
          .mockResolvedValueOnce([]), // read-back pos-chamada sem linha
      } as unknown as DbExplorerResource & { query: ReturnType<typeof vi.fn> };
      const http = createMockHttp();
      http.gatewayCall.mockResolvedValue({});
      await expect(
        new FaturamentoResource(http, dbx).faturar({
          nunotaPedido: 1889309,
          codigoTipoOperacao: 1101,
        }),
      ).rejects.toMatchObject({ code: 'FATURAR_DESFECHO_INDETERMINADO' });
    });

    it('os dois read-backs sao SELECT puro e filtram pelo nunotaPedido recebido', async () => {
      const dbx = {
        query: vi
          .fn()
          .mockResolvedValueOnce([])
          .mockResolvedValueOnce([{ PENDENTE: 'S', STATUSNOTA: 'L' }])
          .mockResolvedValueOnce([varRow('1889311')]),
      } as unknown as DbExplorerResource & { query: ReturnType<typeof vi.fn> };
      const http = createMockHttp();
      http.gatewayCall.mockResolvedValue({});
      await new FaturamentoResource(http, dbx).faturar({
        nunotaPedido: 1889309,
        codigoTipoOperacao: 1101,
      });
      const sqlVar = dbx.query.mock.calls[0][0] as string;
      const sqlCab = dbx.query.mock.calls[1][0] as string;
      // SELECT puro e sem `;`: o chokepoint da D2.1 recusa o resto, mas o SQL
      // montado aqui tambem tem de ser verificavel sem depender dele.
      for (const sql of [sqlVar, sqlCab]) {
        expect(sql).toMatch(/^SELECT\b/);
        expect(sql).not.toContain(';');
      }
      // Sem o WHERE com o NUNOTA recebido, o guard decidiria pelo estado de
      // OUTRO pedido — a primeira linha que a tabela devolvesse.
      expect(sqlVar).toMatch(/\bWHERE\s+V\.NUNOTAORIG\s*=\s*1889309\s*$/);
      expect(sqlCab).toMatch(/\bWHERE\s+NUNOTA\s*=\s*1889309\s*$/);
      expect(dbx.query.mock.calls[2][0]).toBe(sqlVar);
    });

    it('o corpo do gateway vem de buildFaturarWizardPayload, nunca montado inline', async () => {
      const dbx = {
        query: vi
          .fn()
          .mockResolvedValueOnce([])
          .mockResolvedValueOnce([{ PENDENTE: 'S', STATUSNOTA: 'L' }])
          .mockResolvedValueOnce([varRow('1889311')]),
      } as unknown as DbExplorerResource & { query: ReturnType<typeof vi.fn> };
      const http = createMockHttp();
      http.gatewayCall.mockResolvedValue({});
      await new FaturamentoResource(http, dbx).faturar({
        nunotaPedido: 1889309,
        codigoTipoOperacao: 1101,
        serie: '2',
      });
      // `nunotaPedido` e mapeado para `codigoPedido`, o nome que o builder espera.
      expect(vi.mocked(buildFaturarWizardPayload)).toHaveBeenCalledTimes(1);
      expect(vi.mocked(buildFaturarWizardPayload)).toHaveBeenCalledWith({
        codigoPedido: 1889309,
        codigoTipoOperacao: 1101,
        serie: '2',
      });
      expect(http.gatewayCall.mock.calls[0][2]).toBe(
        vi.mocked(buildFaturarWizardPayload).mock.results[0]?.value,
      );
    });

    it('recusa "nao esta pendente" vira JA_FATURADO com read-back, nao erro (M79)', async () => {
      const dbx = {
        query: vi
          .fn()
          .mockResolvedValueOnce([])
          .mockResolvedValueOnce([{ PENDENTE: 'S', STATUSNOTA: 'L' }])
          .mockResolvedValueOnce([varRow('1889311')]),
      } as unknown as DbExplorerResource & { query: ReturnType<typeof vi.fn> };
      const http = createMockHttp();
      http.gatewayCall.mockRejectedValue(
        new GatewayError('O pedido 544437 nao esta pendente.', 'SelecaoDocumentoSP.faturar'),
      );
      await expect(
        new FaturamentoResource(http, dbx).faturar({
          nunotaPedido: 1889309,
          codigoTipoOperacao: 1101,
        }),
      ).resolves.toEqual({ faturado: false, nunotaNota: 1889311, motivo: 'JA_FATURADO' });
    });

    it('recusa "nao esta pendente" com read-back vazio lanca FATURAR_DESFECHO_INDETERMINADO', async () => {
      const dbx = {
        query: vi
          .fn()
          .mockResolvedValueOnce([])
          .mockResolvedValueOnce([{ PENDENTE: 'S', STATUSNOTA: 'L' }])
          .mockResolvedValueOnce([]), // TGFVAR continua vazio: recusa sem prova
      } as unknown as DbExplorerResource & { query: ReturnType<typeof vi.fn> };
      const http = createMockHttp();
      http.gatewayCall.mockRejectedValue(
        new GatewayError('O pedido 544437 não esta pendente.', 'SelecaoDocumentoSP.faturar'),
      );
      await expect(
        new FaturamentoResource(http, dbx).faturar({
          nunotaPedido: 1889309,
          codigoTipoOperacao: 1101,
        }),
      ).rejects.toMatchObject({ code: 'FATURAR_DESFECHO_INDETERMINADO' });
      expect(dbx.query).toHaveBeenCalledTimes(3);
    });

    it.each([
      [
        'a recusa embutida numa frase maior (regex ancorada)',
        new GatewayError(
          'Erro ao faturar: o item X nao esta pendente. Estoque insuficiente.',
          'SelecaoDocumentoSP.faturar',
        ),
      ],
      [
        'a mensagem certa vinda de OUTRO serviceName',
        new GatewayError('O pedido 544437 nao esta pendente.', 'CACSP.confirmarNota'),
      ],
    ])('faturar NAO trata como JA_FATURADO: %s', async (_caso, erro) => {
      const dbx = {
        query: vi
          .fn()
          .mockResolvedValueOnce([])
          .mockResolvedValueOnce([{ PENDENTE: 'S', STATUSNOTA: 'L' }])
          .mockResolvedValueOnce([varRow('1889311')]),
      } as unknown as DbExplorerResource & { query: ReturnType<typeof vi.fn> };
      const http = createMockHttp();
      http.gatewayCall.mockRejectedValue(erro);
      await expect(
        new FaturamentoResource(http, dbx).faturar({
          nunotaPedido: 1889309,
          codigoTipoOperacao: 1101,
        }),
      ).rejects.toBe(erro);
      // Recusa de NEGOCIO fora da forma medida nao gasta read-back: o comando
      // nao foi aceito, nao ha o que consultar.
      expect(dbx.query).toHaveBeenCalledTimes(2);
    });

    it('a mensagem certa num TimeoutError segue o caminho TIMEOUT, nao vira JA_FATURADO', async () => {
      const erro = new TimeoutError('O pedido 544437 nao esta pendente.', { timeoutMs: 30000 });
      const dbx = {
        query: vi
          .fn()
          .mockResolvedValueOnce([])
          .mockResolvedValueOnce([{ PENDENTE: 'S', STATUSNOTA: 'L' }])
          .mockResolvedValueOnce([]), // TGFVAR vazio: nada provado
      } as unknown as DbExplorerResource & { query: ReturnType<typeof vi.fn> };
      const http = createMockHttp();
      http.gatewayCall.mockRejectedValue(erro);
      // `instanceof GatewayError` e o que separa recusa (HTTP 200 com erro no
      // corpo) de desfecho desconhecido — texto igual nao muda a camada.
      await expect(
        new FaturamentoResource(http, dbx).faturar({
          nunotaPedido: 1889309,
          codigoTipoOperacao: 1101,
        }),
      ).rejects.toBe(erro);
      expect(dbx.query).toHaveBeenCalledTimes(3);
    });

    it('TIMEOUT nao vira terminal: rele TGFVAR e propaga se ainda vazio', async () => {
      const dbx = {
        query: vi
          .fn()
          .mockResolvedValueOnce([])
          .mockResolvedValueOnce([{ PENDENTE: 'S', STATUSNOTA: 'L' }])
          .mockResolvedValueOnce([]), // TGFVAR ainda vazio apos o timeout
      } as unknown as DbExplorerResource & { query: ReturnType<typeof vi.fn> };
      const http = createMockHttp();
      http.gatewayCall.mockRejectedValue(new TimeoutError('estourou', { timeoutMs: 30000 }));
      await expect(
        new FaturamentoResource(http, dbx).faturar({
          nunotaPedido: 1889309,
          codigoTipoOperacao: 1101,
        }),
      ).rejects.toThrow(TimeoutError);
      expect(dbx.query).toHaveBeenCalledTimes(3);
    });

    it('TIMEOUT com linha em TGFVAR e FATURADO: o banco decide, nao a mensagem', async () => {
      const dbx = {
        query: vi
          .fn()
          .mockResolvedValueOnce([])
          .mockResolvedValueOnce([{ PENDENTE: 'S', STATUSNOTA: 'L' }])
          .mockResolvedValueOnce([varRow('1889311')]),
      } as unknown as DbExplorerResource & { query: ReturnType<typeof vi.fn> };
      const http = createMockHttp();
      http.gatewayCall.mockRejectedValue(new TimeoutError('estourou', { timeoutMs: 30000 }));
      await expect(
        new FaturamentoResource(http, dbx).faturar({
          nunotaPedido: 1889309,
          codigoTipoOperacao: 1101,
        }),
      ).resolves.toEqual({ faturado: true, nunotaNota: 1889311, motivo: 'FATURADO' });
    });

    it('nunotaPedido nao inteiro lanca antes de qualquer query', async () => {
      const dbx = { query: vi.fn() } as unknown as DbExplorerResource & {
        query: ReturnType<typeof vi.fn>;
      };
      const http = createMockHttp();
      await expect(
        new FaturamentoResource(http, dbx).faturar({
          nunotaPedido: 1.5,
          codigoTipoOperacao: 1101,
        }),
      ).rejects.toThrow(SankhyaError);
      expect(dbx.query).not.toHaveBeenCalled();
      expect(http.gatewayCall).not.toHaveBeenCalled();
    });
  });

  describe('consultarVar', () => {
    it('converte as colunas para numero e devolve o censo inteiro, na ordem', async () => {
      // Censo real de 2 linhas, medido no spike S6
      // (`spike-raw/faturamento/S6_VAR_P3.json`, NUNOTAORIG 1889310): um pedido
      // de 2 itens gera 2 linhas em TGFVAR para a MESMA nota, com SEQUENCIA e
      // SEQUENCIAORIG cruzadas. Devolver so a primeira seria censo parcial (I1).
      const dbx = {
        query: vi.fn().mockResolvedValue([
          { NUNOTA: '1889311', SEQUENCIA: '1', SEQUENCIAORIG: '2', QTDATENDIDA: '2' },
          { NUNOTA: '1889311', SEQUENCIA: '2', SEQUENCIAORIG: '1', QTDATENDIDA: '2' },
        ]),
      } as unknown as DbExplorerResource & { query: ReturnType<typeof vi.fn> };
      const out = await new FaturamentoResource(createMockHttp(), dbx).consultarVar(1889310);
      expect(out).toEqual([
        { nunota: 1889311, sequencia: 1, sequenciaOrig: 2, qtdAtendida: 2 },
        { nunota: 1889311, sequencia: 2, sequenciaOrig: 1, qtdAtendida: 2 },
      ]);
    });

    it.each([
      ['NUNOTA fracionaria', { NUNOTA: '1.5' }],
      ['SEQUENCIA vazia', { SEQUENCIA: '' }],
    ])('coluna inteira invalida lanca: %s', async (_caso, override) => {
      const dbx = {
        query: vi.fn().mockResolvedValue([{ ...varRow('1889311'), ...override }]),
      } as unknown as DbExplorerResource & { query: ReturnType<typeof vi.fn> };
      await expect(
        new FaturamentoResource(createMockHttp(), dbx).consultarVar(1889309),
      ).rejects.toMatchObject({ code: 'FATURAR_VAR_INVALIDA' });
    });

    it('QTDATENDIDA nao numerica lanca, nunca vira 0 nem NaN', async () => {
      const dbx = {
        query: vi.fn().mockResolvedValue([{ ...varRow('1889311'), QTDATENDIDA: 'ABC' }]),
      } as unknown as DbExplorerResource & { query: ReturnType<typeof vi.fn> };
      await expect(
        new FaturamentoResource(createMockHttp(), dbx).consultarVar(1889309),
      ).rejects.toMatchObject({ code: 'FATURAR_VAR_INVALIDA' });
    });
  });
});
