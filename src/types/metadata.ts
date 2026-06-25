/**
 * Tipos para o recurso de metadata de entidades.
 *
 * Permite descobrir as colunas reais de uma entidade Sankhya (incluindo campos
 * personalizados `AD_*`) sem precisar saber a tabela fisica Oracle por tras.
 */

/** Descricao de um campo (coluna) de uma entidade/tabela Sankhya. */
export interface EntityField {
  /** Nome da coluna (ex: `NUNOTA`, `AD_CODRASTREIO`). */
  name: string;
  /** Tipo de dado Oracle (ex: `NUMBER`, `VARCHAR2`, `DATE`, `FLOAT`). */
  type: string;
  /**
   * `DATA_LENGTH` bruto do Oracle (bytes). Para tipos `VARCHAR2`/`CHAR` e o
   * tamanho util; para `NUMBER`/`FLOAT` e o tamanho interno de armazenamento
   * (geralmente 22) — use `precision`/`scale` para a faixa numerica real.
   */
  length: number;
  /** `true` se a coluna aceita `NULL`. */
  nullable: boolean;
  /** Precisao numerica (`DATA_PRECISION`), quando aplicavel. */
  precision?: number;
  /** Escala numerica (`DATA_SCALE`), quando aplicavel. */
  scale?: number;
  /** `true` se for campo personalizado Sankhya (prefixo `AD_`). */
  custom: boolean;
}

/** Opcoes para `metadata.listFields`. */
export interface ListFieldsOptions {
  /** Retornar apenas campos personalizados `AD_*`. Default `false`. */
  customOnly?: boolean;
}
