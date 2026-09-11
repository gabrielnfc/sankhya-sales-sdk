import type { FaturarPedidoInput } from '../types/pedidos.js';
import { SankhyaError } from './errors.js';
import { validateFaturarPedidoInput } from './validators.js';

/**
 * Defaults literais do wizard de faturamento, medidos no sandbox (M51/M49,
 * spike 3 B2/B3' e T0-11a). O wizard do Sankhya manda booleano como **STRING**
 * (`'true'`/`'false'`) e `notasComMoeda` como objeto vazio; trocar por booleano
 * de verdade ou omitir a chave faz o 4midware recusar o payload. Nao
 * "simplificar" nem "normalizar" — cada valor aqui e o que o ERP aceitou.
 */
const PADROES_WIZARD = {
  /** `'1'` e a serie medida; o wizard recusa serie vazia. */
  SERIE: '1',
  TIPO_FATURAMENTO: 'FaturamentoNormal',
  VAZIO: '',
  SIM: 'true',
  NAO: 'false',
} as const;

/**
 * Monta o corpo de `SelecaoDocumentoSP.faturar` no formato do wizard de
 * faturamento (M51: o shape do SDK 1.5.0 estava errado — faltavam
 * `notasComMoeda`, `serie` e `ehWizardFaturamento`, `nota` ia como objeto e
 * `faturarTodosItens` como booleano).
 *
 * **Fonte unica** do payload: nenhum outro lugar do SDK monta este corpo.
 *
 * - `nota` e um ARRAY de `{ $: '<NUNOTA>' }` — objeto unico e recusado.
 * - `faturarTodosItens` e a STRING `'true'`; parcial nao existe (M82: 0 de 4
 *   formas geraram a 1101), por isso `faturarTodosItens: false` **lanca** antes
 *   de qualquer chamada de rede, em vez de mandar um payload que o ERP recusa.
 *
 * @param input - Dados de faturamento (pedido, TOP, serie, local de destino).
 * @returns Corpo pronto para `gatewayCall('mgecom', 'SelecaoDocumentoSP.faturar', ...)`.
 * @throws {SankhyaError} Se o input for invalido (`VALIDATION_ERROR`) ou se
 * `faturarTodosItens` for `false` (M82).
 */
export function buildFaturarWizardPayload(input: FaturarPedidoInput): Record<string, unknown> {
  // O builder valida por conta propria: ele e a fonte unica do payload e e
  // chamado direto (D2.4), nao so por `pedidos.faturar`. Sem isto,
  // `String(undefined)` vira a string `'undefined'` dentro de `nota[0].$`.
  validateFaturarPedidoInput(input, 'FaturarPedidoInput');

  if (input.faturarTodosItens === false) {
    throw new SankhyaError(
      'faturamento parcial nao e suportado pelo wizard de faturamento do Sankhya (M82): ' +
        'use faturarTodosItens true ou ajuste as quantidades do pedido antes de faturar',
      'VALIDATION_ERROR',
    );
  }

  return {
    notas: {
      codTipOper: String(input.codigoTipoOperacao),
      dtFaturamento: input.dataFaturamento ?? PADROES_WIZARD.VAZIO,
      serie: input.serie ?? PADROES_WIZARD.SERIE,
      tipoFaturamento: input.tipoFaturamento ?? PADROES_WIZARD.TIPO_FATURAMENTO,
      dataValidada: PADROES_WIZARD.SIM,
      notasComMoeda: {},
      nota: [{ $: String(input.codigoPedido) }],
      codLocalDestino: input.codigoLocalDestino ?? PADROES_WIZARD.VAZIO,
      faturarTodosItens: PADROES_WIZARD.SIM,
      umaNotaParaCada: input.umaNotaParaCada === true ? PADROES_WIZARD.SIM : PADROES_WIZARD.NAO,
      ehWizardFaturamento: PADROES_WIZARD.SIM,
      dtFixaVenc: PADROES_WIZARD.VAZIO,
      ehPedidoWeb: PADROES_WIZARD.NAO,
      nfeDevolucaoViaRecusa: PADROES_WIZARD.NAO,
      serieNFDevolucao: PADROES_WIZARD.VAZIO,
      ehJejum: PADROES_WIZARD.NAO,
    },
  };
}
