export interface LoadRecordsParams {
  entity: string;
  fields: string;
  criteria?: string;
  page?: number;
  includePresentationFields?: boolean;
}

export interface LoadRecordParams {
  entity: string;
  fields: string;
  primaryKey: Record<string, string>;
}

export interface SaveRecordParams {
  entity: string;
  fields: string;
  data: Record<string, string>;
}

export interface GatewayDataRow {
  id: string;
  fields: Record<string, string>;
}
