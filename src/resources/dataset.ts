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

/**
 * Celula da resposta do Dataset como string.
 *
 * `null`, `undefined` e `{}` viram string vazia — `{}` e a forma medida de campo
 * vazio do Gateway (`src/core/parse-utils.ts:14-17`), e `String({})` daria
 * `'[object Object]'`, um valor inventado. Qualquer outro objeto ou array
 * **lanca**: forma nao medida nao virou dado aqui (divergencia declarada de
 * `db-explorer.ts` da D2.1, que converte qualquer celula com `String()`; este
 * recurso e escrita e prefere falhar alto).
 *
 * @param cell - Celula crua.
 * @param where - Posicao na resposta, para a mensagem de erro (ex: `result[0][2]`).
 * @throws {SankhyaError} `DATASET_SAVE_MALFORMED_RESPONSE` em objeto/array nao vazio.
 */
function cellToString(cell: unknown, where: string): string {
  if (cell === null || cell === undefined) return '';
  if (typeof cell === 'object') {
    if (!Array.isArray(cell) && Object.keys(cell).length === 0) return '';
    throw new SankhyaError(
      `dataset.save: ${where} veio como objeto/array nao vazio, forma nao prevista para uma celula. Nenhum valor foi convertido — '[object Object]' seria um dado inventado.`,
      'DATASET_SAVE_MALFORMED_RESPONSE',
    );
  }
  return String(cell);
}

/**
 * `true` para a celula de metadata que o `DatasetSP` acrescenta DEPOIS das
 * celulas dos `fields`.
 *
 * Fato medido (a), fixtures de 06/09 `spike-raw/faturamento/S1_DS_ITENS_1813.json`
 * e `S1_DS_ESTOQUE_DATAS.json` (`/res/result`): cada linha vem com N celulas de
 * campo mais uma final
 * `{"_rmd": {"provider": "PRODUTORMP", "CODPROD": {"decVlr": 4, ...}}}` —
 * casas decimais e rotulo de lote para a tela do ERP, nada que uma escrita
 * precise. Nao e valor de campo, e por isso nao vira celula (RD-8).
 *
 * O reconhecimento e pela chave `_rmd`, nao pela posicao: excedente que nao
 * seja exatamente esta forma continua reprovando — resposta inesperada de
 * fronteira externa nao vira silencio.
 */
function ehMetadataRmd(cell: unknown): boolean {
  return (
    typeof cell === 'object' && cell !== null && !Array.isArray(cell) && Object.hasOwn(cell, '_rmd')
  );
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

/** Descreve a FORMA de um valor invalido sem ecoar o valor em si. */
function kindOf(value: unknown): string {
  if (value === undefined) return 'undefined';
  if (value === null) return 'null';
  if (typeof value === 'string') return 'string vazia';
  return typeof value;
}

/**
 * Uma pk utilizavel: ao menos uma chave, e **todo** valor uma string nao vazia.
 *
 * Contar chaves nao basta. `JSON.stringify` (`src/core/http.ts:272`) descarta
 * par com valor `undefined`, entao `{ NUNOTA: undefined }` tem `Object.keys`
 * igual a 1 e chega ao servidor como `{}` — o filtro vazio que apaga a entidade
 * inteira (R2, e o `undefined` em qualquer profundidade que G3 manda recusar).
 * String vazia ou so espacos tem o mesmo efeito pratico no filtro.
 *
 * @param pk - Chave candidata.
 * @param index - Posicao na lista, para a mensagem de erro.
 * @param entityName - Entidade alvo, para a mensagem de erro.
 * @throws {SankhyaError} `VALIDATION_ERROR` citando a chave culpada.
 */
function assertPkUsable(pk: unknown, index: number, entityName: string): void {
  if (pk === null || typeof pk !== 'object' || Array.isArray(pk)) {
    throw new SankhyaError(
      `dataset.removeRecord: pks[${index}] nao e um objeto de chaves (recebido: ${kindOf(pk)}). Nenhuma chamada foi feita.`,
      'VALIDATION_ERROR',
    );
  }

  const entries = Object.entries(pk);
  if (entries.length === 0) {
    throw new SankhyaError(
      `dataset.removeRecord: pks[${index}] nao tem nenhuma chave. Um filtro vazio apagaria todos os registros de ${entityName}. Nenhuma chamada foi feita.`,
      'VALIDATION_ERROR',
    );
  }

  for (const [key, value] of entries) {
    if (typeof value !== 'string' || value.trim() === '') {
      throw new SankhyaError(
        `dataset.removeRecord: pks[${index}].${key} nao e uma string preenchida (recebido: ${kindOf(value)}). A serializacao descartaria a chave e o servidor receberia um filtro vazio, apagando todos os registros de ${entityName}. Nenhuma chamada foi feita.`,
        'VALIDATION_ERROR',
      );
    }
  }
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
   * @throws {SankhyaError} `VALIDATION_ERROR` se `records` vier vazio (efeito de
   * 0 registros nao medido — nenhuma chamada e feita);
   * `DATASET_SAVE_MALFORMED_RESPONSE` se a resposta nao
   * trouxer `total` ou `result` em forma utilizavel (I11 — ambiguidade nunca
   * vira estado terminal em silencio); `PARSE_ERROR` se `total` nao for numero.
   * @throws {GatewayError} Em erro de negocio Sankhya.
   * @throws {AuthError} Se autenticacao falhar.
   *
   * @remarks
   * **Celula `_rmd` (RD-8, D2.2b).** O `DatasetSP` devolve, depois das celulas
   * dos `fields`, uma celula de metadata de renderizacao
   * (`{"_rmd": {"provider": …, "<CAMPO>": {"decVlr": …}}}`) — medida nos
   * fixtures de 06/09 `S1_DS_ITENS_1813.json` e `S1_DS_ESTOQUE_DATAS.json`.
   * Ela e DESCARTADA: `result` traz so as celulas dos campos. A metadata **nao**
   * e exposta no retorno de proposito — sao casas decimais e rotulo de lote para
   * a tela do ERP, sem uso para quem escreve, e expo-la ampliaria a superficie
   * publica por um dado que ninguem pediu. Excedente de outra forma, ou objeto
   * nao vazio em posicao de campo, continua lancando.
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
    if (!Array.isArray(params.records) || params.records.length === 0) {
      throw new SankhyaError(
        'dataset.save: records vazio. O efeito de um save com 0 registros nao foi medido no Sankhya — nenhuma chamada foi feita.',
        'VALIDATION_ERROR',
      );
    }

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

      // Excedente de UMA celula que seja a metadata `_rmd` e descartado (RD-8);
      // qualquer outro excedente reprova. Linha mais CURTA que `fields` segue
      // valida: e a forma medida da insercao multi-record (M88), em que o
      // servidor devolve so a chave gerada.
      const excedente = row.length - params.fields.length;
      let celulas = row;
      if (excedente === 1 && ehMetadataRmd(row[params.fields.length])) {
        celulas = row.slice(0, params.fields.length);
      } else if (excedente > 0) {
        throw new SankhyaError(
          `dataset.save: result[${index}] tem ${row.length} celulas e fields tem ${params.fields.length}; o excedente nao e a metadata '_rmd'. Resposta inconsistente — nenhuma linha parcial foi devolvida.`,
          'DATASET_SAVE_MALFORMED_RESPONSE',
        );
      }

      return celulas.map((cell, position) => cellToString(cell, `result[${index}][${position}]`));
    });

    return { total: safeParseNumber(raw.total, 'DatasetSP.save.total'), result };
  }

  /**
   * Remove registros via `DatasetSP.removeRecord`.
   *
   * Guarda contra "apagar tudo" (R2), verificada **antes** de tocar a rede:
   * `pks` vazia e recusada, cada pk precisa de ao menos uma chave, e **todo**
   * valor precisa ser string nao vazia — `{ NUNOTA: undefined }` ou
   * `{ NUNOTA: '' }` chegariam ao servidor como filtro vazio e apagariam a
   * entidade inteira (G3: `undefined` em qualquer profundidade).
   *
   * @param params - Entidade, chaves a remover e `standAlone` (default `false`).
   * @param options - Opcoes de requisicao (timeout, `signal`).
   * @returns Nada: o servico nao devolve corpo util.
   * @throws {SankhyaError} `VALIDATION_ERROR` se `pks` estiver vazia, se alguma
   * pk nao tiver chave ou se algum valor nao for string preenchida (citando a
   * chave culpada) — nesse caso nenhuma chamada e feita.
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
      assertPkUsable(pk, index, params.entityName);
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
