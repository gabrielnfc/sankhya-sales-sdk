import { describe, expect, it } from 'vitest';
import { SankhyaError } from '../../src/core/errors.js';
import { buildFaturarWizardPayload } from '../../src/core/faturamento-payload.js';
import type { FaturarPedidoInput } from '../../src/types/pedidos.js';

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

  // O builder e a fonte unica que a D2.4 reusa: sem validacao propria,
  // `String(undefined)` viraria a string `'undefined'` dentro de `nota[0].$`.
  it('valida o input: codigoPedido ausente lanca VALIDATION_ERROR, nao vira "undefined"', () => {
    const semPedido: Partial<FaturarPedidoInput> = { codigoTipoOperacao: 1101 };

    let capturado: unknown;
    try {
      buildFaturarWizardPayload(semPedido as FaturarPedidoInput);
    } catch (err) {
      capturado = err;
    }

    expect(capturado).toBeInstanceOf(SankhyaError);
    expect((capturado as SankhyaError).code).toBe('VALIDATION_ERROR');
    expect((capturado as SankhyaError).message).toMatch(/codigoPedido/);
  });

  it('valida o input: serie vazia e recusada pelo builder', () => {
    expect(() =>
      buildFaturarWizardPayload({ codigoPedido: 1889309, codigoTipoOperacao: 1101, serie: '' }),
    ).toThrow(/serie/i);
  });

  // A validacao vem ANTES do guard M82: com input invalido E
  // `faturarTodosItens: false`, quem vence e o VALIDATION_ERROR do input —
  // inverter a ordem troca o erro que o chamador ve.
  it('valida o input ANTES do guard M82: input invalido vence faturarTodosItens:false', () => {
    const semPedido: Partial<FaturarPedidoInput> = {
      codigoTipoOperacao: 1101,
      faturarTodosItens: false,
    };

    let capturado: unknown;
    try {
      buildFaturarWizardPayload(semPedido as FaturarPedidoInput);
    } catch (err) {
      capturado = err;
    }

    expect(capturado).toBeInstanceOf(SankhyaError);
    expect((capturado as SankhyaError).message).toMatch(/codigoPedido/);
    expect((capturado as SankhyaError).message).not.toMatch(/faturamento parcial/i);
  });

  it('valida o input: codigoPedido fracionario e recusado (inteiro obrigatorio)', () => {
    expect(() =>
      buildFaturarWizardPayload({ codigoPedido: 1.5, codigoTipoOperacao: 1101 }),
    ).toThrow(/inteiro/i);
  });
});
