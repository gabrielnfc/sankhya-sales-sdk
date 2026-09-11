import { SankhyaError } from '../core/errors.js';
import { deserializeRows, serialize } from '../core/gateway-serializer.js';
import type { HttpClient } from '../core/http.js';
import { validateLoadRecordsParams, validateSaveRecordParams } from '../core/validators.js';
import type { RequestOptions } from '../types/config.js';
import type { LoadRecordParams, LoadRecordsParams, SaveRecordParams } from '../types/gateway.js';

const VALID_FIELD_NAME = /^[A-Za-z_][A-Za-z0-9_]*$/;
const BLOCKED_FIELD_NAMES = new Set(['__proto__', 'constructor', 'prototype']);

/**
 * Recusa nomes de campo fora de `[A-Za-z_][A-Za-z0-9_]*` e nomes que poluem o prototipo.
 *
 * @param record - Pares campo-valor a validar.
 * @param contexto - Nome do parametro para a mensagem de erro (ex: `'primaryKey'`).
 * @throws {SankhyaError} Com codigo `VALIDATION_ERROR` no primeiro nome invalido.
 */
function assertFieldNames(record: Record<string, string>, contexto: string): void {
  for (const key of Object.keys(record)) {
    if (!VALID_FIELD_NAME.test(key) || BLOCKED_FIELD_NAMES.has(key)) {
      throw new SankhyaError(
        `Nome de campo invalido na ${contexto}: '${key}'. Apenas letras, numeros e underscore sao permitidos.`,
        'VALIDATION_ERROR',
      );
    }
  }
}

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
    validateLoadRecordsParams(params, 'LoadRecordsParams');
    const result = await this.http.gatewayCall<Record<string, unknown>>(
      'mge',
      'CRUDServiceProvider.loadRecords',
      {
        dataSet: {
          rootEntity: params.entity,
          includePresentationFields: params.includePresentationFields ? 'S' : 'N',
          offsetPage: String(params.page ?? 0),
          ...(params.criteria ? { criteria: { expression: { $: params.criteria } } } : {}),
          entity: {
            fieldset: { list: params.fields },
          },
        },
      },
      undefined,
      true, // idempotent: leitura, elegivel a retry em falha transiente
    );

    return deserializeRows(result, this.http.getLogger()).rows;
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
    assertFieldNames(params.primaryKey, 'primaryKey');

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
          criteria: { expression: { $: expression } },
          entity: {
            fieldset: { list: params.fields },
          },
        },
      },
      undefined,
      true, // idempotent: leitura, elegivel a retry em falha transiente
    );

    return deserializeRows(result, this.http.getLogger()).rows[0] ?? null;
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
    validateSaveRecordParams(params, 'SaveRecordParams');
    assertFieldNames(params.primaryKey ?? {}, 'primaryKey');
    assertFieldNames(params.data, 'data');

    const dataRow: Record<string, unknown> = { localFields: serialize(params.data) };
    if (params.primaryKey && Object.keys(params.primaryKey).length > 0) {
      dataRow.key = serialize(params.primaryKey);
    }

    const result = await this.http.gatewayCall<Record<string, unknown>>(
      'mge',
      'CRUDServiceProvider.saveRecord',
      {
        dataSet: {
          rootEntity: params.entity,
          includePresentationFields: 'N',
          dataRow,
          entity: { fieldset: { list: params.fields } },
        },
      },
    );

    const { rows } = deserializeRows(result, this.http.getLogger());
    return rows[0] ?? {};
  }

  /**
   * Chama um servico arbitrario do Gateway e devolve o `responseBody` cru.
   *
   * Escape hatch para servicos sem metodo dedicado no SDK. A escrita nunca e
   * retentada automaticamente.
   *
   * @param modulo - Modulo do Gateway (`'mge'` ou `'mgecom'`).
   * @param serviceName - Nome do servico (ex: `'CACSP.confirmarNota'`).
   * @param body - Corpo do `requestBody`, ja no formato do servico.
   * @param options - Opcoes de requisicao (timeout, `idempotencyKey`).
   * @returns O `responseBody` da resposta, sem transformacao.
   * @throws {GatewayError} Em erro de negocio Sankhya.
   * @throws {AuthError} Se autenticacao falhar.
   * @example
   * ```ts
   * const out = await sankhya.gateway.call('mgecom', 'CACSP.confirmarNota', {
   *   nota: { NUNOTA: { $: '1378934' } },
   * });
   * ```
   */
  async call<T>(
    modulo: 'mge' | 'mgecom',
    serviceName: string,
    body: Record<string, unknown>,
    options?: RequestOptions,
  ): Promise<T> {
    return this.http.gatewayCall<T>(modulo, serviceName, body, options);
  }
}
