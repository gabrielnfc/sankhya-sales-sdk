import { SankhyaError } from '../core/errors.js';
import { deserializeRows, serialize } from '../core/gateway-serializer.js';
import type { HttpClient } from '../core/http.js';
import type { LoadRecordParams, LoadRecordsParams, SaveRecordParams } from '../types/gateway.js';

const VALID_FIELD_NAME = /^[A-Za-z_][A-Za-z0-9_]*$/;
const BLOCKED_FIELD_NAMES = new Set(['__proto__', 'constructor', 'prototype']);

/**
 * Acesso direto ao Gateway Sankhya para operacoes genericas (CRUD).
 *
 * Use este recurso para entidades que nao possuem resource dedicado.
 * Acesse via `sankhya.gateway`.
 */
export class GatewayResource {
  constructor(private readonly http: HttpClient) {}

  /**
   * Carrega multiplos registros de uma entidade via Gateway.
   *
   * @param params - Entidade, campos, filtro e paginacao.
   * @returns Array de registros como dicionarios chave-valor (string).
   * @throws {GatewayError} Em erro de negocio Sankhya.
   * @throws {AuthError} Se autenticacao falhar.
   * @example
   * ```ts
   * const rows = await sankhya.gateway.loadRecords({
   *   entity: 'Parceiro',
   *   fields: 'CODPARC,NOMEPARC',
   *   criteria: 'this.ATIVO = \'S\'',
   * });
   * ```
   */
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

  /**
   * Carrega um unico registro pela chave primaria via Gateway.
   *
   * @param params - Entidade, campos e chave primaria.
   * @returns Registro encontrado ou `null` se nao existir.
   * @throws {GatewayError} Em erro de negocio Sankhya.
   * @throws {AuthError} Se autenticacao falhar.
   * @example
   * ```ts
   * const parceiro = await sankhya.gateway.loadRecord({
   *   entity: 'Parceiro',
   *   fields: 'CODPARC,NOMEPARC',
   *   primaryKey: { CODPARC: '123' },
   * });
   * ```
   */
  async loadRecord(params: LoadRecordParams): Promise<Record<string, string> | null> {
    for (const key of Object.keys(params.primaryKey)) {
      if (!VALID_FIELD_NAME.test(key) || BLOCKED_FIELD_NAMES.has(key)) {
        throw new SankhyaError(
          `Nome de campo invalido na primaryKey: '${key}'. Apenas letras, numeros e underscore sao permitidos.`,
          'VALIDATION_ERROR',
        );
      }
    }

    const pkEntries = Object.entries(params.primaryKey);
    const expression = pkEntries
      .map(([key, val]) => {
        const escaped = String(val).replace(/'/g, "''");
        return `this.${key} = '${escaped}'`;
      })
      .join(' AND ');

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

  /**
   * Salva (cria ou atualiza) um registro via Gateway.
   *
   * @param params - Entidade, campos e dados a salvar.
   * @returns Registro salvo como dicionario chave-valor.
   * @throws {GatewayError} Em erro de negocio Sankhya.
   * @throws {AuthError} Se autenticacao falhar.
   * @example
   * ```ts
   * const result = await sankhya.gateway.saveRecord({
   *   entity: 'Parceiro',
   *   fields: 'CODPARC,NOMEPARC,CGC_CPF',
   *   data: { NOMEPARC: 'Teste', CGC_CPF: '12345678000199' },
   * });
   * ```
   */
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
