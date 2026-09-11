import { describe, expect, it } from 'vitest';
import { buildFaturarWizardPayload } from '../../src/core/faturamento-payload.js';

describe('buildFaturarWizardPayload', () => {
  it('monta o payload wizard medido no sandbox (T0-11a, spike-raw/faturamento/ped.ts:fatBody)', () => {
    expect(buildFaturarWizardPayload({ codigoPedido: 1889309, codigoTipoOperacao: 1101 })).toEqual({
      notas: {
        codTipOper: '1101',
        dtFaturamento: '',
        serie: '1',
        tipoFaturamento: 'FaturamentoNormal',
        dataValidada: 'true',
        notasComMoeda: {},
        nota: [{ $: '1889309' }],
        codLocalDestino: '',
        faturarTodosItens: 'true',
        umaNotaParaCada: 'false',
        ehWizardFaturamento: 'true',
        dtFixaVenc: '',
        ehPedidoWeb: 'false',
        nfeDevolucaoViaRecusa: 'false',
        serieNFDevolucao: '',
        ehJejum: 'false',
      },
    });
  });

  it('faturarTodosItens:false nao e suportado — lanca (M82: nao existe faturamento parcial)', () => {
    expect(() =>
      buildFaturarWizardPayload({
        codigoPedido: 1,
        codigoTipoOperacao: 1101,
        faturarTodosItens: false,
      }),
    ).toThrow(/faturamento parcial/i);
  });
});
