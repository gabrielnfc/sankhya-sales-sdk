/**
 * Contratos de paginacao expostos pela API Sankhya.
 *
 * A API apresenta tres formatos REST incompativeis sob a mesma fachada.
 * Medidos em 29/08/2026; ver o design em
 * docs/superpowers/specs/2026-08-29-paginacao-degradada-design.md
 */
export type PaginationContract = 'rest' | 'financeiro' | 'precos';

/**
 * Paginacao dos endpoints financeiros (`/financeiros/receitas`,
 * `/financeiros/despesas`). Numeros e booleano, pagina base 1, e `total`
 * e censo real — diferente de todo o resto da API.
 */
export interface FinanceiroPagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasMore: boolean;
}

/**
 * Paginacao dos endpoints de preco (`/precos/tabela/{t}`,
 * `/precos/produto/{p}`). Nao ha bloco `pagination`: os campos vem na
 * raiz do corpo. Pagina base 1 — `pagina=0` devolve HTTP 400.
 */
export interface PrecosPagination {
  pagina: number;
  numeroRegistros: number;
  temMaisRegistros: boolean;
}

/**
 * Declaracao do contrato de um endpoint, fornecida pelo call site.
 *
 * O SDK nao consegue inferir estes valores: a chave do array varia por
 * endpoint e o formato de paginacao varia por familia de endpoint.
 * Declarar transforma deteccao de degradacao em verificacao
 * deterministica, checada em tempo de compilacao.
 */
export interface ResourceDescriptor {
  /**
   * Chave do corpo que carrega os registros (ex.: `'produtos'`, `'data'`).
   *
   * `null` significa **chave nao medida**: o endpoint nao pode ser sondado
   * neste sandbox, entao o SDK mantem o comportamento legado de pegar o
   * primeiro array do corpo. Nao ha deteccao de degradacao nesses casos.
   * Marcado explicitamente para ficar greppavel — ver §10 do design.
   */
  resourceKey: string | null;
  /** Formato de paginacao deste endpoint. */
  contract: PaginationContract;
  /** `true` se o endpoint devolve metadado de paginacao. */
  expectPagination: boolean;
}

/** Diagnostico de uma resposta degradada. */
export interface DegradedInfo {
  /** Motivo legivel da classificacao. Sempre presente. */
  reason: string;
  /**
   * Chave declarada que o SDK esperava encontrar. Ausente quando a
   * degradacao foi detectada pelo paginador, que nao conhece o descritor.
   */
  expectedKey?: string | undefined;
  /** Chaves realmente presentes no corpo, quando conhecidas. */
  receivedKeys?: string[] | undefined;
  /** Pagina em que ocorreu, quando aplicavel. */
  page?: number | undefined;
}
