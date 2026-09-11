import { describe, expect, it } from 'vitest';
import * as sdk from '../src/index.js';

describe('api-surface', () => {
  describe('public exports are present', () => {
    it('exports SankhyaClient', () => {
      expect(sdk.SankhyaClient).toBeDefined();
    });

    it('exports error classes', () => {
      expect(sdk.SankhyaError).toBeDefined();
      expect(sdk.AuthError).toBeDefined();
      expect(sdk.ApiError).toBeDefined();
      expect(sdk.GatewayError).toBeDefined();
      expect(sdk.TimeoutError).toBeDefined();
    });

    it('exports classifyFailure (o tipo e travado em tests/types)', () => {
      expect(sdk.classifyFailure).toBeDefined();
      expect(sdk.classifyFailure(new Error('boom'))).toBe('TIMEOUT');
      // O tipo `SankhyaFailureKind` nao existe em runtime: quem o trava e
      // `tests/types/failure-classification-superficie.ts`, via `npm run typecheck:tests`.
    });

    it('exports type guard functions', () => {
      expect(sdk.isSankhyaError).toBeDefined();
      expect(sdk.isAuthError).toBeDefined();
      expect(sdk.isApiError).toBeDefined();
      expect(sdk.isGatewayError).toBeDefined();
      expect(sdk.isTimeoutError).toBeDefined();
    });

    it('exports all 17 resource classes', () => {
      expect(sdk.ClientesResource).toBeDefined();
      expect(sdk.VendedoresResource).toBeDefined();
      expect(sdk.ProdutosResource).toBeDefined();
      expect(sdk.PrecosResource).toBeDefined();
      expect(sdk.EstoqueResource).toBeDefined();
      expect(sdk.PedidosResource).toBeDefined();
      expect(sdk.FinanceirosResource).toBeDefined();
      expect(sdk.CadastrosResource).toBeDefined();
      expect(sdk.FiscalResource).toBeDefined();
      expect(sdk.GatewayResource).toBeDefined();
      expect(sdk.MetadataResource).toBeDefined();
      expect(sdk.DbExplorerResource).toBeDefined();
      expect(sdk.DatasetResource).toBeDefined();
      expect(sdk.NotasResource).toBeDefined();
      expect(sdk.ConferenciaResource).toBeDefined();
      expect(sdk.FaturamentoResource).toBeDefined();
      expect(sdk.LotesResource).toBeDefined();
    });

    it('exports datasetRecord (helper de modulo, nao metodo de resource)', () => {
      expect(sdk.datasetRecord).toBeDefined();
    });

    it('exports enum values', () => {
      expect(sdk.TipoVendedor).toBeDefined();
      expect(sdk.TipoControleEstoque).toBeDefined();
      expect(sdk.TipoFaturamento).toBeDefined();
      expect(sdk.SubTipoPagamento).toBeDefined();
      expect(sdk.StatusFinanceiro).toBeDefined();
      expect(sdk.TipoFinanceiro).toBeDefined();
      expect(sdk.TipoMovimento).toBeDefined();
    });
  });

  describe('internal utilities are NOT exported', () => {
    const exports = sdk as Record<string, unknown>;

    it('does not export createLogger', () => {
      expect(exports.createLogger).toBeUndefined();
    });

    it('does not export gateway serializer functions', () => {
      expect(exports.serialize).toBeUndefined();
      expect(exports.deserialize).toBeUndefined();
      expect(exports.deserializeRows).toBeUndefined();
    });

    it('does not export pagination internals', () => {
      expect(exports.normalizeRestPagination).toBeUndefined();
      expect(exports.normalizeGatewayPagination).toBeUndefined();
      expect(exports.extractRestData).toBeUndefined();
      expect(exports.createPaginator).toBeUndefined();
    });

    it('does not export withRetry', () => {
      expect(exports.withRetry).toBeUndefined();
    });

    it('does not export date utilities', () => {
      expect(exports.toSankhyaDate).toBeUndefined();
      expect(exports.toSankhyaDateTime).toBeUndefined();
      expect(exports.toISODate).toBeUndefined();
    });
  });
});
