import type { GatewayEntities } from '../types/common.js';

/**
 * Serializa dados para o formato Gateway do Sankhya: { CAMPO: valor } → { CAMPO: { "$": "valor" } }
 */
export function serialize(data: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    if (value === null || value === undefined) {
      result[key] = { $: '' };
    } else if (Array.isArray(value)) {
      result[key] = value.map((item) =>
        typeof item === 'object' && item !== null
          ? serialize(item as Record<string, unknown>)
          : { $: String(item) },
      );
    } else if (typeof value === 'object') {
      result[key] = serialize(value as Record<string, unknown>);
    } else {
      result[key] = { $: String(value) };
    }
  }
  return result;
}

/**
 * Deserializa um registro individual do formato Gateway: { CAMPO: { "$": "valor" } } → { CAMPO: "valor" }
 */
export function deserialize(data: Record<string, unknown>): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(data)) {
    if (value !== null && typeof value === 'object' && '$' in (value as Record<string, unknown>)) {
      result[key] = String((value as Record<string, unknown>).$);
    } else if (typeof value === 'string') {
      result[key] = value;
    } else {
      result[key] = String(value);
    }
  }
  return result;
}

export interface DeserializedRows {
  rows: Record<string, string>[];
  totalRecords?: number;
  hasMore: boolean;
  page: number;
}

/**
 * Deserializa a resposta real do Gateway loadRecords.
 *
 * Formato real da API:
 * {
 *   "entities": {
 *     "total": "50",
 *     "hasMoreResult": "true",
 *     "offsetPage": "0",
 *     "metadata": {
 *       "fields": {
 *         "field": [{ "name": "CODPROD" }, { "name": "DESCRPROD" }, ...]
 *       }
 *     },
 *     "entity": [
 *       { "_rmd": {...}, "f0": { "$": "10398" }, "f1": { "$": "MELATONINA" }, ... }
 *     ]
 *   }
 * }
 *
 * Retorna linhas com nomes de campos reais mapeados a partir do metadata.
 */
export function deserializeRows(responseBody: unknown): DeserializedRows {
  if (!responseBody || typeof responseBody !== 'object') {
    return { rows: [], totalRecords: 0, hasMore: false, page: 0 };
  }

  const body = responseBody as { entities?: GatewayEntities<Record<string, unknown>> };
  const entities = body.entities;

  if (!entities) {
    return { rows: [], totalRecords: 0, hasMore: false, page: 0 };
  }

  // Extrair nomes dos campos do metadata
  const fieldNames: string[] = [];
  const fields = entities.metadata?.fields?.field;
  if (Array.isArray(fields)) {
    for (const field of fields) {
      fieldNames.push(field.name);
    }
  }

  // Extrair entidades
  const rawEntities = entities.entity;
  if (!rawEntities) {
    return {
      rows: [],
      totalRecords: Number.parseInt(entities.total ?? '0', 10) || 0,
      hasMore: entities.hasMoreResult === 'true',
      page: Number.parseInt(entities.offsetPage ?? '0', 10) || 0,
    };
  }

  const entityArray = Array.isArray(rawEntities) ? rawEntities : [rawEntities];

  const rows = entityArray.map((entity) => {
    const row: Record<string, string> = {};

    // Se temos metadata, mapear f0→fieldNames[0], f1→fieldNames[1], etc.
    if (fieldNames.length > 0) {
      for (let i = 0; i < fieldNames.length; i++) {
        const fieldKey = `f${i}`;
        const value = entity[fieldKey];
        const fieldName = fieldNames[i];
        if (fieldName === undefined) continue;

        if (value !== null && value !== undefined && typeof value === 'object' && '$' in value) {
          const raw = value.$;
          row[fieldName] =
            raw === null || raw === undefined
              ? ''
              : typeof raw === 'object'
                ? JSON.stringify(raw)
                : String(raw);
        } else if (value !== null && value !== undefined) {
          row[fieldName] = typeof value === 'object' ? JSON.stringify(value) : String(value);
        }
      }
    } else {
      // Fallback: sem metadata, deserializar campos diretamente
      for (const [key, value] of Object.entries(entity)) {
        if (key === '_rmd') continue;
        if (
          value !== null &&
          typeof value === 'object' &&
          '$' in (value as Record<string, unknown>)
        ) {
          row[key] = String((value as Record<string, unknown>).$);
        }
      }
    }

    return row;
  });

  return {
    rows,
    totalRecords: Number.parseInt(entities.total ?? '0', 10) || undefined,
    hasMore: entities.hasMoreResult === 'true',
    page: Number.parseInt(entities.offsetPage ?? '0', 10) || 0,
  };
}
