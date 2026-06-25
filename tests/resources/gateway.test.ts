import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { HttpClient } from '../../src/core/http.js';
import { GatewayResource } from '../../src/resources/gateway.js';

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

function makeGatewayResponse(fieldNames: string[], entities: Array<Record<string, unknown>>) {
  return {
    entities: {
      total: String(entities.length),
      hasMoreResult: 'false',
      offsetPage: '0',
      metadata: {
        fields: {
          field: fieldNames.map((name) => ({ name })),
        },
      },
      entity: entities,
    },
  };
}

describe('GatewayResource', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('loadRecords()', () => {
    it('calls gatewayCall with correct structure and returns deserialized rows', async () => {
      const http = createMockHttp();
      const gw = new GatewayResource(http);
      http.gatewayCall.mockResolvedValue(
        makeGatewayResponse(
          ['CODPROD', 'DESCRPROD'],
          [
            { f0: { $: '100' }, f1: { $: 'Produto A' } },
            { f0: { $: '200' }, f1: { $: 'Produto B' } },
          ],
        ),
      );

      const result = await gw.loadRecords({
        entity: 'Produto',
        fields: 'CODPROD,DESCRPROD',
      });

      expect(http.gatewayCall).toHaveBeenCalledWith('mge', 'CRUDServiceProvider.loadRecords', {
        dataSet: {
          rootEntity: 'Produto',
          includePresentationFields: 'N',
          offsetPage: '0',
          entity: {
            fieldset: { list: 'CODPROD,DESCRPROD' },
          },
        },
      });

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({ CODPROD: '100', DESCRPROD: 'Produto A' });
      expect(result[1]).toEqual({ CODPROD: '200', DESCRPROD: 'Produto B' });
    });

    it('passes criteria when provided', async () => {
      const http = createMockHttp();
      const gw = new GatewayResource(http);
      http.gatewayCall.mockResolvedValue(makeGatewayResponse(['CODPROD'], []));

      await gw.loadRecords({
        entity: 'Produto',
        fields: 'CODPROD',
        criteria: "this.ATIVO = 'S'",
      });

      const body = http.gatewayCall.mock.calls[0][2] as Record<string, unknown>;
      const dataSet = body.dataSet as Record<string, unknown>;
      expect(dataSet.criteria).toEqual({ expression: { $: "this.ATIVO = 'S'" } });
    });

    // Regression guard for Bug #1: criteria.expression MUST be wrapped in { $: ... }.
    // Sent as a raw string, the Sankhya server silently ignores the filter (HTTP 200,
    // status "1") and returns the first page of unfiltered rows.
    it('wraps criteria.expression in the Gateway { $: ... } envelope', async () => {
      const http = createMockHttp();
      const gw = new GatewayResource(http);
      http.gatewayCall.mockResolvedValue(makeGatewayResponse(['NUNOTA'], []));

      await gw.loadRecords({
        entity: 'CabecalhoNota',
        fields: 'NUNOTA',
        criteria: 'this.NUNOTA = 1378934',
      });

      const body = http.gatewayCall.mock.calls[0][2] as Record<string, unknown>;
      const dataSet = body.dataSet as Record<string, unknown>;
      const criteria = dataSet.criteria as { expression: unknown };
      expect(criteria.expression).toEqual({ $: 'this.NUNOTA = 1378934' });
      // Never a raw string — that is the exact shape of the bug.
      expect(typeof criteria.expression).toBe('object');
    });

    it('sets includePresentationFields to S when true', async () => {
      const http = createMockHttp();
      const gw = new GatewayResource(http);
      http.gatewayCall.mockResolvedValue(makeGatewayResponse(['CODPROD'], []));

      await gw.loadRecords({
        entity: 'Produto',
        fields: 'CODPROD',
        includePresentationFields: true,
      });

      const body = http.gatewayCall.mock.calls[0][2] as Record<string, unknown>;
      const dataSet = body.dataSet as Record<string, unknown>;
      expect(dataSet.includePresentationFields).toBe('S');
    });

    it('passes page parameter as offsetPage', async () => {
      const http = createMockHttp();
      const gw = new GatewayResource(http);
      http.gatewayCall.mockResolvedValue(makeGatewayResponse(['CODPROD'], []));

      await gw.loadRecords({
        entity: 'Produto',
        fields: 'CODPROD',
        page: 5,
      });

      const body = http.gatewayCall.mock.calls[0][2] as Record<string, unknown>;
      const dataSet = body.dataSet as Record<string, unknown>;
      expect(dataSet.offsetPage).toBe('5');
    });
  });

  describe('loadRecord()', () => {
    it('returns single record matching primary key', async () => {
      const http = createMockHttp();
      const gw = new GatewayResource(http);
      http.gatewayCall.mockResolvedValue(
        makeGatewayResponse(
          ['CODPROD', 'DESCRPROD'],
          [{ f0: { $: '100' }, f1: { $: 'Produto A' } }],
        ),
      );

      const result = await gw.loadRecord({
        entity: 'Produto',
        fields: 'CODPROD,DESCRPROD',
        primaryKey: { CODPROD: '100' },
      });

      expect(result).toEqual({ CODPROD: '100', DESCRPROD: 'Produto A' });

      const body = http.gatewayCall.mock.calls[0][2] as Record<string, unknown>;
      const dataSet = body.dataSet as Record<string, unknown>;
      expect(dataSet.criteria).toEqual({ expression: { $: "this.CODPROD = '100'" } });
      expect(dataSet.offsetPage).toBe('0');
    });

    it('returns null when no record found', async () => {
      const http = createMockHttp();
      const gw = new GatewayResource(http);
      http.gatewayCall.mockResolvedValue(makeGatewayResponse(['CODPROD'], []));

      const result = await gw.loadRecord({
        entity: 'Produto',
        fields: 'CODPROD',
        primaryKey: { CODPROD: '999' },
      });

      expect(result).toBeNull();
    });

    it('handles composite primary keys', async () => {
      const http = createMockHttp();
      const gw = new GatewayResource(http);
      http.gatewayCall.mockResolvedValue(makeGatewayResponse(['A', 'B'], []));

      await gw.loadRecord({
        entity: 'Test',
        fields: 'A,B',
        primaryKey: { CODPROD: '1', CODEMP: '2' },
      });

      const body = http.gatewayCall.mock.calls[0][2] as Record<string, unknown>;
      const dataSet = body.dataSet as Record<string, unknown>;
      expect(dataSet.criteria).toEqual({
        expression: { $: "this.CODPROD = '1' AND this.CODEMP = '2'" },
      });
    });
  });

  describe('saveRecord()', () => {
    it('serializes input and calls gatewayCall with saveRecord service', async () => {
      const http = createMockHttp();
      const gw = new GatewayResource(http);
      http.gatewayCall.mockResolvedValue(
        makeGatewayResponse(
          ['CODPROD', 'DESCRPROD'],
          [{ f0: { $: '100' }, f1: { $: 'Novo Produto' } }],
        ),
      );

      const result = await gw.saveRecord({
        entity: 'Produto',
        fields: 'CODPROD,DESCRPROD',
        data: { CODPROD: '100', DESCRPROD: 'Novo Produto' },
      });

      expect(http.gatewayCall).toHaveBeenCalledWith('mge', 'CRUDServiceProvider.saveRecord', {
        dataSet: {
          rootEntity: 'Produto',
          includePresentationFields: 'N',
          entity: {
            fieldset: { list: 'CODPROD,DESCRPROD' },
            CODPROD: { $: '100' },
            DESCRPROD: { $: 'Novo Produto' },
          },
        },
      });

      expect(result).toEqual({ CODPROD: '100', DESCRPROD: 'Novo Produto' });
    });

    it('returns empty object when no rows in response', async () => {
      const http = createMockHttp();
      const gw = new GatewayResource(http);
      http.gatewayCall.mockResolvedValue(makeGatewayResponse(['CODPROD'], []));

      const result = await gw.saveRecord({
        entity: 'Produto',
        fields: 'CODPROD',
        data: { CODPROD: '999' },
      });

      expect(result).toEqual({});
    });
  });

  // Bug #3: defense-in-depth canary for a silently-ignored criteria filter.
  describe('filter-ignored warning', () => {
    function makeFullDefaultPage() {
      return {
        entities: {
          total: '50',
          hasMoreResult: 'true',
          offsetPage: '0',
          metadata: { fields: { field: [{ name: 'NUNOTA' }] } },
          entity: Array.from({ length: 50 }, (_, i) => ({ f0: { $: String(i) } })),
        },
      };
    }

    it('warns when a criteria filter returns the full default page (Bug #1 symptom)', async () => {
      const http = createMockHttp();
      const gw = new GatewayResource(http);
      http.gatewayCall.mockResolvedValue(makeFullDefaultPage());

      await gw.loadRecords({
        entity: 'CabecalhoNota',
        fields: 'NUNOTA',
        criteria: 'this.NUNOTA = 1378934',
      });

      expect(mockLogger.warn).toHaveBeenCalledTimes(1);
      expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining('filtro'));
    });

    it('does NOT warn when no criteria was sent', async () => {
      const http = createMockHttp();
      const gw = new GatewayResource(http);
      http.gatewayCall.mockResolvedValue(makeFullDefaultPage());

      await gw.loadRecords({ entity: 'CabecalhoNota', fields: 'NUNOTA' });

      expect(mockLogger.warn).not.toHaveBeenCalled();
    });

    it('does NOT warn when the filtered result is smaller than the default page', async () => {
      const http = createMockHttp();
      const gw = new GatewayResource(http);
      http.gatewayCall.mockResolvedValue(
        makeGatewayResponse(['NUNOTA'], [{ f0: { $: '1378934' } }]),
      );

      await gw.loadRecords({
        entity: 'CabecalhoNota',
        fields: 'NUNOTA',
        criteria: 'this.NUNOTA = 1378934',
      });

      expect(mockLogger.warn).not.toHaveBeenCalled();
    });
  });
});
