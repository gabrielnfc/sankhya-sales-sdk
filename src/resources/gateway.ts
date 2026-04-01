import { deserializeRows, serialize } from '../core/gateway-serializer.js';
import type { HttpClient } from '../core/http.js';
import type { LoadRecordParams, LoadRecordsParams, SaveRecordParams } from '../types/gateway.js';

export class GatewayResource {
  constructor(private readonly http: HttpClient) {}

  async loadRecords(params: LoadRecordsParams): Promise<Record<string, string>[]> {
    const result = await this.http.gatewayCall<Record<string, unknown>>(
      'mge',
      'CRUDServiceProvider.loadRecords',
      {
        dataSet: {
          rootEntity: params.entity,
          includePresentationFields: params.includePresentationFields ? 'S' : 'N',
          offsetPage: String(params.page ?? 0),
          ...(params.criteria ? { criteria: { expression: params.criteria } } : {}),
          entity: {
            fieldset: { list: params.fields },
          },
        },
      },
    );

    return deserializeRows(result).rows;
  }

  async loadRecord(params: LoadRecordParams): Promise<Record<string, string> | null> {
    const pkEntries = Object.entries(params.primaryKey);
    const expression = pkEntries.map(([key, val]) => `this.${key} = ${val}`).join(' AND ');

    const result = await this.http.gatewayCall<Record<string, unknown>>(
      'mge',
      'CRUDServiceProvider.loadRecords',
      {
        dataSet: {
          rootEntity: params.entity,
          includePresentationFields: 'N',
          offsetPage: '0',
          criteria: { expression },
          entity: {
            fieldset: { list: params.fields },
          },
        },
      },
    );

    const { rows } = deserializeRows(result);
    return rows[0] ?? null;
  }

  async saveRecord(params: SaveRecordParams): Promise<Record<string, string>> {
    const serializedFields = serialize(params.data);
    const fieldsList = params.fields;

    const result = await this.http.gatewayCall<Record<string, unknown>>(
      'mge',
      'CRUDServiceProvider.saveRecord',
      {
        dataSet: {
          rootEntity: params.entity,
          includePresentationFields: 'N',
          entity: {
            fieldset: { list: fieldsList },
            ...serializedFields,
          },
        },
      },
    );

    const { rows } = deserializeRows(result);
    return rows[0] ?? {};
  }
}
