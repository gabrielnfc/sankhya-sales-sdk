import { SankhyaError } from '../core/errors.js';
import type { HttpClient } from '../core/http.js';
import type { RequestOptions } from '../types/config.js';
import type { DbExplorerRawResponse, DbExplorerRow } from '../types/db-explorer.js';

/**
 * SELECT puro: inicio `SELECT` (espacos a esquerda ok, caixa livre) e nenhum
 * `;` em lugar algum — mesma semantica de `tools/sankhya-spike/lib.ts`
 * (`isReadOnlySql`). O `;` e recusado porque o DbExplorer aceita mais de um
 * comando por chamada: `SELECT 1 FROM DUAL; DROP TABLE X` passaria no prefixo.
 */
const PURE_SELECT = /^\s*SELECT\b/i;

/** Celula do DbExplorer como string: `null`/`undefined` viram string vazia. */
function cellToString(cell: unknown): string {
  return cell === null || cell === undefined ? '' : String(cell);
}

/**
 * Consulta SQL somente-leitura via `DbExplorerSP.executeQuery`.
 *
 * Escape hatch tipado para o que nenhum resource dedicado cobre: o SDK recusa
 * qualquer SQL que nao seja um `SELECT` puro **antes** de tocar a rede, e
 * devolve as linhas como dicionarios chave-valor (string), casando
 * `rows[i][j]` com `fieldsMetadata[j].name`.
 *
 * Acesse via `sankhya.dbExplorer`.
 *
 * @remarks
 * Requer que o usuario OAuth tenha permissao para executar o DbExplorer; sem
 * ela o servidor retorna `GatewayError`.
 */
export class DbExplorerResource {
  constructor(private readonly http: HttpClient) {}

  /**
   * Executa um `SELECT` e devolve as linhas como dicionarios chave-valor.
   *
   * Toda celula e convertida para string (`null`/`undefined` viram `''`): o
   * DbExplorer nao garante string — `CODLOCAL` chega como `number`.
   *
   * @param sql - `SELECT` puro, sem `;`. Interpolacao e responsabilidade do chamador.
   * @param options - Opcoes de requisicao (timeout, `signal`).
   * @returns Array de linhas; `[]` quando a consulta nao retorna nada.
   * @throws {SankhyaError} `VALIDATION_ERROR` se o SQL nao for um SELECT puro
   * (verificado antes da rede); `DB_EXPLORER_ROW_MISMATCH` se alguma linha tiver
   * numero de colunas diferente de `fieldsMetadata`.
   * @throws {GatewayError} Em erro de negocio Sankhya.
   * @throws {AuthError} Se autenticacao falhar.
   * @example
   * ```ts
   * const rows = await sankhya.dbExplorer.query<{ NUNOTA: string; STATUSNOTA: string }>(
   *   "SELECT NUNOTA, STATUSNOTA FROM TGFCAB WHERE NUNOTA = 1889309",
   * );
   * ```
   */
  async query<T extends DbExplorerRow>(sql: string, options?: RequestOptions): Promise<T[]> {
    if (typeof sql !== 'string' || !PURE_SELECT.test(sql) || sql.includes(';')) {
      throw new SankhyaError(
        'dbExplorer.query aceita apenas SELECT puro (sem ";" e sem outro comando). SQL recusado antes da chamada ao Sankhya.',
        'VALIDATION_ERROR',
      );
    }

    const result = await this.http.gatewayCall<DbExplorerRawResponse>(
      'mge',
      'DbExplorerSP.executeQuery',
      { sql },
      options,
      true, // idempotent: leitura (SELECT), elegivel a retry — allowlist em src/core/http.ts:10
    );

    const columns = (result.fieldsMetadata ?? []).map((field) => field.name);
    const rows = Array.isArray(result.rows) ? result.rows : [];

    return rows.map((row, index) => {
      if (row.length !== columns.length) {
        throw new SankhyaError(
          `dbExplorer.query: linha ${index} tem ${row.length} colunas e fieldsMetadata tem ${columns.length}. Resposta inconsistente — nenhum objeto parcial foi devolvido.`,
          'DB_EXPLORER_ROW_MISMATCH',
        );
      }
      const entries = columns.map((name, position) => [name, cellToString(row[position])]);
      return Object.fromEntries(entries) as T;
    });
  }
}
