import { SankhyaError } from '../core/errors.js';
import type { HttpClient } from '../core/http.js';
import { safeParseNumber } from '../core/parse-utils.js';
import type { EntityField, ListFieldsOptions } from '../types/metadata.js';

/**
 * Mapa curado de entidades logicas Sankhya -> tabela fisica Oracle.
 *
 * Cobre os dominios comerciais mais comuns. Tabelas verificadas em ambiente
 * real (Sankhya Om). Entidades fora deste mapa caem no passthrough: o argumento
 * e tratado como nome de tabela fisica.
 */
const ENTITY_TABLE_MAP: Record<string, string> = {
  cabecalhonota: 'TGFCAB',
  itemnota: 'TGFITE',
  parceiro: 'TGFPAR',
  produto: 'TGFPRO',
  vendedor: 'TGFVEN',
  tipooperacao: 'TGFTOP',
  modelonota: 'TGFTOP',
  preco: 'TGFPRC',
  estoque: 'TGFEST',
  natureza: 'TGFNAT',
  grupoproduto: 'TGFGRU',
  financeiro: 'TGFFIN',
  empresa: 'TSIEMP',
};

/** Apenas letras maiusculas, numeros e underscore — guarda contra SQL injection. */
const VALID_TABLE_NAME = /^[A-Z0-9_]+$/;

interface DbExplorerResponse {
  rows?: unknown[][];
  /** `true` quando o DbExplorer truncou o resultado por limite de linhas. */
  burstLimit?: boolean;
}

/** Extrai linhas de forma defensiva — tolera `rows` ausente ou nao-array. */
function rowsOf(result: DbExplorerResponse): unknown[][] {
  return Array.isArray(result.rows) ? result.rows : [];
}

/**
 * Descoberta de metadata de entidades Sankhya.
 *
 * Lista as colunas reais de uma entidade (incluindo campos personalizados
 * `AD_*`) sem o consumidor precisar saber a tabela fisica Oracle nem montar
 * SQL contra `USER_TAB_COLUMNS` na mao.
 *
 * Acesse via `sankhya.metadata`.
 *
 * @remarks
 * Implementado sobre `DbExplorerSP.executeQuery` — o unico provedor de metadata
 * disponivel a partir do Sankhya Om (`MetadataProvider`/`DynamicEntityMetadataSP`
 * nao existem). Requer que o usuario OAuth tenha permissao para executar o
 * DbExplorer; sem ela o servidor retorna `GatewayError`.
 */
export class MetadataResource {
  constructor(private readonly http: HttpClient) {}

  /**
   * Lista os campos (colunas) de uma entidade Sankhya.
   *
   * Aceita o nome logico da entidade (ex: `CabecalhoNota`) — resolvido via mapa
   * curado — ou o nome da tabela fisica diretamente (ex: `TGFCAB`).
   *
   * @param entityOrTable - Nome logico da entidade ou tabela fisica Oracle.
   * @param options - Filtros opcionais (ex: apenas campos `AD_*`).
   * @returns Array de campos com nome, tipo, tamanho, nulabilidade e flag `custom`.
   * @throws {SankhyaError} Se o nome resolvido for invalido ou a entidade nao existir.
   * @throws {AuthError} Se autenticacao falhar.
   * @example
   * ```ts
   * // por entidade logica
   * const campos = await sankhya.metadata.listFields('CabecalhoNota');
   *
   * // por tabela fisica + apenas campos personalizados
   * const custom = await sankhya.metadata.listFields('TGFCAB', { customOnly: true });
   * ```
   */
  async listFields(entityOrTable: string, options?: ListFieldsOptions): Promise<EntityField[]> {
    const table = this.resolveTable(entityOrTable);

    // USER_TAB_COLUMNS so lista tabelas do schema conectado. Em instalacoes
    // multi-schema a tabela e alcancada via synonym/grant de outro schema, e a
    // primeira consulta vem vazia — cai no fallback ALL_TAB_COLUMNS (tabelas
    // acessiveis ao usuario, possivelmente de outros schemas).
    let result = await this.queryColumns('USER_TAB_COLUMNS', table);
    if (rowsOf(result).length === 0) {
      result = await this.queryColumns('ALL_TAB_COLUMNS', table);
    }

    const rows = rowsOf(result);
    if (rows.length === 0) {
      throw new SankhyaError(
        `Entidade ou tabela '${entityOrTable}' (resolvida para '${table}') nao retornou colunas. Verifique o nome ou passe a tabela fisica Oracle diretamente.`,
        'METADATA_EMPTY',
      );
    }

    if (result.burstLimit === true) {
      this.http
        .getLogger()
        .warn(
          `metadata: DbExplorer truncou as colunas de '${table}' (burstLimit). A lista de campos pode estar incompleta.`,
        );
    }

    const fields = rows.map((row) => this.toField(row));
    return options?.customOnly ? fields.filter((f) => f.custom) : fields;
  }

  /**
   * Consulta as colunas de `table` numa view de dicionario Oracle. `view` e um
   * literal interno (nao entrada do usuario); `table` ja passou pelo guard
   * anti-injection em resolveTable.
   *
   * `ALL_TAB_COLUMNS` cruza schemas: se a mesma `TABLE_NAME` existir em mais de
   * um OWNER acessivel, sem filtro as colunas viriam duplicadas e intercaladas.
   * Por isso fixamos um unico OWNER deterministico (`MIN(OWNER)`). Ressalva: se
   * dois schemas tiverem tabelas DIFERENTES com o mesmo nome, retorna a do owner
   * alfabeticamente menor — improvavel dado o naming global unico do Sankhya.
   */
  private queryColumns(
    view: 'USER_TAB_COLUMNS' | 'ALL_TAB_COLUMNS',
    table: string,
  ): Promise<DbExplorerResponse> {
    const select = `SELECT COLUMN_NAME, DATA_TYPE, DATA_LENGTH, NULLABLE, DATA_PRECISION, DATA_SCALE FROM ${view} WHERE TABLE_NAME = '${table}'`;
    const ownerClause =
      view === 'ALL_TAB_COLUMNS'
        ? ` AND OWNER = (SELECT MIN(OWNER) FROM ALL_TAB_COLUMNS WHERE TABLE_NAME = '${table}')`
        : '';
    const sql = `${select}${ownerClause} ORDER BY COLUMN_ID`;
    return this.http.gatewayCall<DbExplorerResponse>('mge', 'DbExplorerSP.executeQuery', { sql });
  }

  /** Resolve entidade logica -> tabela fisica, com passthrough e validacao. */
  private resolveTable(entityOrTable: string): string {
    if (typeof entityOrTable !== 'string' || entityOrTable.trim() === '') {
      throw new SankhyaError(
        'entityOrTable e obrigatorio e deve ser uma string nao-vazia',
        'METADATA_INVALID_INPUT',
      );
    }
    const trimmed = entityOrTable.trim();
    // Object.hasOwn evita resolver chaves herdadas do prototype
    // (`__proto__`, `constructor`, `toString`) para membros do Object.prototype.
    const key = trimmed.toLowerCase();
    const mapped = Object.hasOwn(ENTITY_TABLE_MAP, key) ? ENTITY_TABLE_MAP[key] : undefined;
    const table = (mapped ?? trimmed).toUpperCase();

    if (!VALID_TABLE_NAME.test(table)) {
      throw new SankhyaError(
        `Nome de tabela invalido: '${entityOrTable}'. Use apenas letras, numeros e underscore.`,
        'METADATA_INVALID_INPUT',
      );
    }
    return table;
  }

  /** Converte uma row do DbExplorer (array posicional) em EntityField. */
  private toField(row: unknown[]): EntityField {
    const name = String(row[0] ?? '');
    const field: EntityField = {
      name,
      type: String(row[1] ?? ''),
      length: safeParseNumber(row[2], 'DATA_LENGTH'),
      nullable: String(row[3] ?? '').toUpperCase() === 'Y',
      custom: name.toUpperCase().startsWith('AD_'),
    };
    if (row[4] != null) field.precision = safeParseNumber(row[4], 'DATA_PRECISION');
    if (row[5] != null) field.scale = safeParseNumber(row[5], 'DATA_SCALE');
    return field;
  }
}
