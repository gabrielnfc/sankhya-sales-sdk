import { SankhyaError } from '../core/errors.js';
import type { HttpClient } from '../core/http.js';
import { safeParseNumber } from '../core/parse-utils.js';
import type { RequestOptions } from '../types/config.js';
import type {
  DatasetLoadParams,
  DatasetRecord,
  DatasetRemoveParams,
  DatasetSaveParams,
  DatasetSaveRawResponse,
  DatasetSaveResult,
} from '../types/dataset.js';
import { GatewayResource } from './gateway.js';

/** Celula do Dataset como string: `null`/`undefined` viram string vazia. */
function cellToString(cell: unknown): string {
  return cell === null || cell === undefined ? '' : String(cell);
}

/**
 * `total` presente e utilizavel na resposta de `DatasetSP.save`.
 *
 * `null` e `''` contam como ausentes de proposito: `safeParseNumber` os
 * converteria para `0`, e `0` significaria "nenhum registro gravado" — a
 * conclusao errada quando na verdade nao sabemos (I11).
 */
function hasUsableTotal(total: unknown): boolean {
  return total !== undefined && total !== null && total !== '';
}

/**
 * Monta um `DatasetRecord` resolvendo cada nome de campo para o seu indice
 * POSICIONAL em `fields` — que e o formato que `DatasetSP.save` exige.
 *
 * E funcao de modulo (nao metodo) porque o chamador precisa dela para montar o
 * array `records` **antes** de ter um resource em maos.
 *
 * @param fields - Campos na mesma ordem que sera enviada em `DatasetSaveParams.fields`.
 * @param input - `set` = valores por nome de campo; `pk` = chave do registro a
 * atualizar (omita para inserir, M88).
 * @returns Registro com `values` indexado pela posicao em `fields`.
 * @throws {SankhyaError} `VALIDATION_ERROR` se algum campo de `set` nao estiver
 * em `fields` — citando o campo. Silenciar isso enviaria o valor no indice
 * errado, gravando no campo errado do ERP.
 * @example
 * ```ts
 * datasetRecord(['NUNOTA', 'NUCONFATUAL'], {
 *   pk: { NUNOTA: '1889349' },
 *   set: { NUCONFATUAL: '281956' },
 * });
 * // => { pk: { NUNOTA: '1889349' }, values: { '1': '281956' } }
 * ```
 */
export function datasetRecord(
  fields: readonly string[],
  input: { readonly pk?: Record<string, string>; readonly set: Record<string, string> },
): DatasetRecord {
  const values: Record<string, string> = {};

  for (const [name, value] of Object.entries(input.set)) {
    const position = fields.indexOf(name);
    if (position === -1) {
      throw new SankhyaError(
        `datasetRecord: campo '${name}' nao esta em fields [${fields.join(', ')}]. Indice posicional indeterminado — nada foi montado.`,
        'VALIDATION_ERROR',
      );
    }
    values[String(position)] = value;
  }

  return input.pk === undefined ? { values } : { pk: input.pk, values };
}

/**
 * Escrita e leitura tipadas sobre o `DatasetSP` do Gateway (M36, M88, M113).
 *
 * `save` e `removeRecord` sao **escritas**: nao estao na allowlist de servicos
 * idempotentes (`src/core/http.ts:8-10`) e por isso nunca sao retentadas
 * automaticamente — uma reexecucao duplicaria o registro. `load` e leitura e
 * delega ao caminho ja medido `CRUDServiceProvider.loadRecords`.
 *
 * Acesse via `sankhya.dataset`.
 *
 * @remarks
 * Fail-closed declarado (G9): resposta malformada de `save` **lanca**; nunca
 * devolve `total: 0` ou `result: []`, que o chamador leria como "nada a fazer".
 */
export class DatasetResource {
  private readonly gateway: GatewayResource;

  constructor(private readonly http: HttpClient) {
    this.gateway = new GatewayResource(http);
  }

  /**
   * Insere ou atualiza registros via `DatasetSP.save`.
   *
   * Registro **sem** `pk` insere; **com** `pk` atualiza (M88). Monte cada
   * registro com `datasetRecord()` — `values` e indexado pela posicao em
   * `fields`, nao pelo nome.
   *
   * @param params - Entidade, campos, registros e `standAlone` (default `false`).
   * @param options - Opcoes de requisicao (timeout, `signal`).
   * @returns `total` convertido para numero e `result` com toda celula em string.
   * @throws {SankhyaError} `DATASET_SAVE_MALFORMED_RESPONSE` se a resposta nao
   * trouxer `total` ou `result` em forma utilizavel (I11 — ambiguidade nunca
   * vira estado terminal em silencio); `PARSE_ERROR` se `total` nao for numero.
   * @throws {GatewayError} Em erro de negocio Sankhya.
   * @throws {AuthError} Se autenticacao falhar.
   * @example
   * ```ts
   * const fields = ['NUNOTA', 'NUCONFATUAL'];
   * await sankhya.dataset.save({
   *   entityName: 'CabecalhoNota',
   *   fields,
   *   records: [datasetRecord(fields, { pk: { NUNOTA: '1889349' }, set: { NUCONFATUAL: '281956' } })],
   * });
   * ```
   */
  async save(params: DatasetSaveParams, options?: RequestOptions): Promise<DatasetSaveResult> {
    const raw = await this.http.gatewayCall<DatasetSaveRawResponse>(
      'mge',
      'DatasetSP.save',
      {
        entityName: params.entityName,
        standAlone: params.standAlone ?? false,
        fields: params.fields,
        records: params.records,
      },
      options,
      // Sem `idempotent`: DatasetSP.save e ESCRITA e nao esta na allowlist de
      // src/core/http.ts:8-10 — retry duplicaria registro.
    );

    if (raw === null || typeof raw !== 'object' || !hasUsableTotal(raw.total)) {
      throw new SankhyaError(
        `dataset.save: resposta de DatasetSP.save sem 'total'. O efeito no ERP e indeterminado — nenhum total foi inventado. Confira o registro antes de repetir a chamada.`,
        'DATASET_SAVE_MALFORMED_RESPONSE',
      );
    }
    if (!Array.isArray(raw.result)) {
      throw new SankhyaError(
        `dataset.save: resposta de DatasetSP.save sem 'result' em forma de lista. O efeito no ERP e indeterminado — nenhuma lista vazia foi inventada.`,
        'DATASET_SAVE_MALFORMED_RESPONSE',
      );
    }

    const result = raw.result.map((row, index) => {
      if (!Array.isArray(row)) {
        throw new SankhyaError(
          `dataset.save: result[${index}] nao e uma linha (array). Resposta inconsistente — nenhuma linha parcial foi devolvida.`,
          'DATASET_SAVE_MALFORMED_RESPONSE',
        );
      }
      return row.map(cellToString);
    });

    return { total: safeParseNumber(raw.total, 'DatasetSP.save.total'), result };
  }

  /**
   * Remove registros via `DatasetSP.removeRecord`.
   *
   * Guarda contra "apagar tudo" (R2), verificada **antes** de tocar a rede:
   * `pks` vazia e recusada, e cada pk precisa de ao menos uma chave — um `{}` na
   * lista e um filtro vazio, que o servidor poderia interpretar como toda a
   * entidade.
   *
   * @param params - Entidade, chaves a remover e `standAlone` (default `false`).
   * @param options - Opcoes de requisicao (timeout, `signal`).
   * @returns Nada: o servico nao devolve corpo util.
   * @throws {SankhyaError} `VALIDATION_ERROR` se `pks` estiver vazia ou se
   * alguma pk nao tiver chave — nesse caso nenhuma chamada e feita.
   * @throws {GatewayError} Em erro de negocio Sankhya.
   * @throws {AuthError} Se autenticacao falhar.
   * @example
   * ```ts
   * await sankhya.dataset.removeRecord({
   *   entityName: 'ItemNota',
   *   pks: [{ NUNOTA: '1889280', SEQUENCIA: '1' }],
   * });
   * ```
   */
  async removeRecord(params: DatasetRemoveParams, options?: RequestOptions): Promise<void> {
    if (!Array.isArray(params.pks) || params.pks.length === 0) {
      throw new SankhyaError(
        'dataset.removeRecord: pks vazia. Informe ao menos uma chave — uma lista vazia apagaria indiscriminadamente. Nenhuma chamada foi feita.',
        'VALIDATION_ERROR',
      );
    }

    for (const [index, pk] of params.pks.entries()) {
      if (pk === null || typeof pk !== 'object' || Object.keys(pk).length === 0) {
        throw new SankhyaError(
          `dataset.removeRecord: pks[${index}] nao tem nenhuma chave. Um filtro vazio apagaria todos os registros de ${params.entityName}. Nenhuma chamada foi feita.`,
          'VALIDATION_ERROR',
        );
      }
    }

    await this.http.gatewayCall<unknown>(
      'mge',
      'DatasetSP.removeRecord',
      {
        entityName: params.entityName,
        standAlone: params.standAlone ?? false,
        pks: params.pks,
      },
      options,
      // Sem `idempotent`: DatasetSP.removeRecord e ESCRITA (src/core/http.ts:8-10).
    );
  }

  /**
   * Le registros da entidade pelo caminho medido `CRUDServiceProvider.loadRecords`.
   *
   * Delega a `gateway.loadRecords` (D1.1) em vez de usar um `DatasetSP.load`:
   * esse servico nao foi medido, e o SDK nao inventa rota. Por isso tambem nao
   * aceita `RequestOptions` — o caminho delegado nao os repassa, e aceitar um
   * parametro ignorado seria mentira de assinatura.
   *
   * @param params - Entidade, campos, filtro e pagina (base 0).
   * @returns Registros como dicionarios chave-valor (string); `[]` quando nada casa.
   * @throws {GatewayError} Em erro de negocio Sankhya.
   * @throws {AuthError} Se autenticacao falhar.
   * @example
   * ```ts
   * const itens = await sankhya.dataset.load({
   *   entityName: 'ItemNota',
   *   fields: ['NUNOTA', 'CONTROLE'],
   *   criteria: 'this.NUNOTA = 1889280',
   * });
   * ```
   */
  async load(params: DatasetLoadParams): Promise<Record<string, string>[]> {
    return this.gateway.loadRecords({
      entity: params.entityName,
      fields: params.fields.join(','),
      ...(params.criteria === undefined ? {} : { criteria: params.criteria }),
      ...(params.page === undefined ? {} : { page: params.page }),
    });
  }
}
