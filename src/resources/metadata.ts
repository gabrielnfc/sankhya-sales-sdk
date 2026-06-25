import { SankhyaError } from '../core/errors.js';
import type { HttpClient } from '../core/http.js';
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

    const sql = `SELECT COLUMN_NAME, DATA_TYPE, DATA_LENGTH, NULLABLE, DATA_PRECISION, DATA_SCALE FROM USER_TAB_COLUMNS WHERE TABLE_NAME = '${table}' ORDER BY COLUMN_ID`;

    const result = await this.http.gatewayCall<DbExplorerResponse>(
      'mge',
      'DbExplorerSP.executeQuery',
      { sql },
    );

    const rows = result.rows ?? [];
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

  /** Resolve entidade logica -> tabela fisica, com passthrough e validacao. */
  private resolveTable(entityOrTable: string): string {
    if (typeof entityOrTable !== 'string' || entityOrTable.trim() === '') {
      throw new SankhyaError(
        'entityOrTable e obrigatorio e deve ser uma string nao-vazia',
        'METADATA_INVALID_INPUT',
      );
    }
    const trimmed = entityOrTable.trim();
    const mapped = ENTITY_TABLE_MAP[trimmed.toLowerCase()];
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
      length: this.toNumber(row[2]),
      nullable: String(row[3] ?? '').toUpperCase() === 'Y',
      custom: name.toUpperCase().startsWith('AD_'),
    };
    if (row[4] != null) field.precision = this.toNumber(row[4]);
    if (row[5] != null) field.scale = this.toNumber(row[5]);
    return field;
  }

  private toNumber(value: unknown): number {
    const n = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(n) ? n : 0;
  }
}
