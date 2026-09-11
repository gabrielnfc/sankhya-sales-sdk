/**
 * Linha do DbExplorer normalizada: toda celula como string.
 *
 * Alias nomeado em vez de `Record<string, string>` inline na assinatura de
 * `query` porque o contador de metodos publicos da fase D (B5) usa
 * `grep -E '^  (async )?[a-zA-Z][a-zA-Z0-9]*(<[^>]*>)?\('`, que nao casa
 * generico aninhado (`<T extends Record<string, string>>` tem `>` interno) e
 * deixaria o metodo invisivel na contagem. Semantica identica.
 */
export type DbExplorerRow = Record<string, string>;

/**
 * Resposta crua de `DbExplorerSP.executeQuery`, como o Gateway devolve.
 *
 * Formato posicional: `rows[i][j]` corresponde a `fieldsMetadata[j].name`.
 * As celulas **nao** chegam sempre como string — medido no spike legado
 * (`tools/sankhya-spike/lib.ts:80`, `CODLOCAL` veio `number`) — por isso o tipo
 * e `unknown[][]` e a conversao para string e explicita no resource.
 */
export interface DbExplorerRawResponse {
  /**
   * Nomes das colunas, na ordem das celulas de cada linha.
   *
   * Opcional porque e fronteira externa: resposta sem metadata existe (consulta
   * sem resultado) e nao pode derrubar o processo com `TypeError`.
   */
  fieldsMetadata?: { name: string }[];
  /** Linhas posicionais. Ausente quando a consulta nao retorna nada. */
  rows?: unknown[][];
}
