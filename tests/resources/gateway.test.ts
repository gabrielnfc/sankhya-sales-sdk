import { describe, expect, it, vi } from 'vitest';
import type { HttpClient } from '../../src/core/http.js';
import { GatewayResource } from '../../src/resources/gateway.js';

function createMockHttp() {
  return {
    restGet: vi.fn(),
    restPost: vi.fn(),
    restPut: vi.fn(),
    gatewayCall: vi.fn(),
  } as unknown as HttpClient & {
    restGet: ReturnType<typeof vi.fn>;
    restPost: ReturnType<typeof vi.fn>;
    restPut: ReturnType<typeof vi.fn>;
    gatewayCall: ReturnType<typeof vi.fn>;
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
      expect(dataSet.criteria).toEqual({ expression: "this.ATIVO = 'S'" });
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
      expect(dataSet.criteria).toEqual({ expression: "this.CODPROD = '100'" });
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
        expression: "this.CODPROD = '1' AND this.CODEMP = '2'",
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
});
