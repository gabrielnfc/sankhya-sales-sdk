import { SankhyaError } from '../core/errors.js';
import type { HttpClient } from '../core/http.js';
import {
  createPaginator,
  extractRestData,
  extractRestRecordOrThrow,
  normalizePagination,
} from '../core/pagination.js';
import type { PaginatedResult } from '../types/common.js';
import type { Estoque, EstoqueLote, LocalEstoque } from '../types/estoque.js';
import type { DegradedInfo, ResourceDescriptor } from '../types/pagination-contracts.js';
import type { DbExplorerResource } from './db-explorer.js';

const DESCRITOR_POR_PRODUTO: ResourceDescriptor = {
  resourceKey: 'estoque',
  contract: 'rest',
  expectPagination: false,
  endpoint: '/estoque/produtos/{id}',
};

const DESCRITOR_ESTOQUE: ResourceDescriptor = {
  resourceKey: 'estoque',
  contract: 'rest',
  expectPagination: true,
  endpoint: '/estoque/produtos',
};

const DESCRITOR_LOCAIS: ResourceDescriptor = {
  resourceKey: 'locais',
  contract: 'rest',
  expectPagination: true,
  endpoint: '/estoque/locais',
};

/**
 * Colunas de `TGFEST` lidas por `porLote`.
 *
 * **Escolhidas a partir** de `spike-raw/virada/D1_EST_10015_TODAS.json:2`, com
 * **ordem propria**: aquele SELECT medido le
 * `CODEMP, CODLOCAL, CONTROLE, ESTOQUE, RESERVADO, WMSBLOQUEADO, STATUSLOTE,
 * DTVAL, DTFABRICACAO, TIPO, CODPARC, ATIVO` — aqui `CODPROD` foi acrescentado
 * (a leitura pode ser global) e `WMSBLOQUEADO`/`ATIVO` ficaram de fora
 * (`WMSBLOQUEADO` nao e gate, M98). Nao e a fixture reproduzida (R14).
 */
const COLUNAS_TGFEST = [
  'CODEMP',
  'CODLOCAL',
  'CODPROD',
  'CONTROLE',
  'TIPO',
  'CODPARC',
  'ESTOQUE',
  'RESERVADO',
  'DTVAL',
  'DTFABRICACAO',
  'STATUSLOTE',
] as const;

/** Exige inteiro positivo em valor que entra em SQL **interpolado** (G3). */
function assertInteiroPositivo(valor: unknown, where: string): void {
  if (typeof valor !== 'number' || !Number.isInteger(valor) || valor <= 0) {
    throw new SankhyaError(
      `${where} precisa ser um inteiro positivo (recebido: ${typeof valor === 'number' ? String(valor) : typeof valor}). Nenhuma consulta foi feita.`,
      'VALIDATION_ERROR',
    );
  }
}

/**
 * Parse estrito de coluna numerica de `TGFEST`.
 *
 * Nao usa `safeParseNumber`: ela devolve `0` para `''`, `null` e `{}`
 * (`src/core/parse-utils.ts:11-21`), e `0` num saldo significaria "zerado" — a
 * conclusao que autoriza a virada de lote (M103) e a baixa (M102). Vazio e
 * nao-numerico **lancam**, citando a coluna.
 *
 * @throws {SankhyaError} `PARSE_ERROR`.
 */
function parseNumeroEstrito(valor: string | undefined, coluna: string): number {
  if (valor === undefined || valor.trim() === '') {
    throw new SankhyaError(
      `estoque.porLote: coluna ${coluna} veio vazia em TGFEST. Nenhum 0 foi inventado — 0 significaria saldo zerado.`,
      'PARSE_ERROR',
    );
  }
  const numero = Number(valor);
  if (!Number.isFinite(numero)) {
    throw new SankhyaError(
      `estoque.porLote: coluna ${coluna} nao e numerica em TGFEST. Nenhum 0 foi inventado — 0 significaria saldo zerado.`,
      'PARSE_ERROR',
    );
  }
  return numero;
}

/** Coluna de texto do ERP: vazia vira `null`, nunca `''` disfarcado de valor. */
function textoOuNulo(valor: string | undefined): string | null {
  return valor === undefined || valor.trim() === '' ? null : valor;
}

/** Dependencias opcionais injetadas pelo `SankhyaClient`. */
export interface EstoqueDeps {
  /** Necessaria para `porLote` (leitura direta de `TGFEST`). */
  readonly dbExplorer?: DbExplorerResource;
}

/** Operacoes de estoque no Sankhya ERP. Acesse via `sankhya.estoque`. */
export class EstoqueResource {
  constructor(
    private readonly http: HttpClient,
    private readonly deps?: EstoqueDeps,
  ) {}

  /**
   * Le as linhas de `TGFEST` de um produto — o saldo **por lote**, que a REST v1
   * nao expoe (`/estoque/produtos/{id}` agrega por local, sem `CONTROLE`).
   *
   * Leitura pura por `dbExplorer.query`: `SELECT` em `TGFEST` com os inteiros
   * validados antes de entrar no SQL (G3 — esta rota nao tem bind parameter).
   * Sem `codEmp`/`codLocal` a leitura e **global** do produto, que e a forma que
   * a virada de lote exige (M103).
   *
   * Numeros e datas tem parse **estrito**: coluna vazia ou nao-numerica lanca em
   * vez de virar `0` — um `0` inventado em `estoque`/`reservado` seria lido como
   * "pode baixar" ou "pode virar o controle".
   *
   * @param input - Produto e, opcionalmente, empresa e local.
   * @param input.codProd - `CODPROD` (inteiro positivo).
   * @param input.codEmp - `CODEMP` (inteiro positivo). Omitido: todas as empresas.
   * @param input.codLocal - `CODLOCAL` (inteiro positivo). Omitido: todos os locais.
   * @returns Uma entrada por linha de `TGFEST`; `[]` quando nao ha linha — o que
   * **nao** prova saldo zero nem produto sem lote (I4): a linha zerada some da
   * tabela (M91).
   * @throws {SankhyaError} `VALIDATION_ERROR` se faltar o `dbExplorer` (nomeando
   * a dep) ou se algum codigo nao for inteiro positivo — nesse caso nenhuma
   * consulta e feita; `PARSE_ERROR` em coluna vazia ou nao-numerica.
   * @throws {GatewayError} Em erro de negocio Sankhya.
   * @throws {AuthError} Se autenticacao falhar.
   * @example
   * ```ts
   * const lotes = await sankhya.estoque.porLote({ codProd: 10077, codEmp: 2 });
   * ```
   */
  async porLote(input: {
    codProd: number;
    codEmp?: number;
    codLocal?: number;
  }): Promise<EstoqueLote[]> {
    assertInteiroPositivo(input.codProd, 'estoque.porLote: codProd');
    if (input.codEmp !== undefined) {
      assertInteiroPositivo(input.codEmp, 'estoque.porLote: codEmp');
    }
    if (input.codLocal !== undefined) {
      assertInteiroPositivo(input.codLocal, 'estoque.porLote: codLocal');
    }

    const dbExplorer = this.deps?.dbExplorer;
    if (dbExplorer === undefined) {
      throw new SankhyaError(
        'estoque.porLote exige a dependencia dbExplorer, que so o SankhyaClient injeta. Use `sankhya.estoque` ou passe `new EstoqueResource(http, { dbExplorer })`. Nenhuma consulta foi feita.',
        'VALIDATION_ERROR',
      );
    }

    const filtros = [`CODPROD = ${input.codProd}`];
    if (input.codEmp !== undefined) filtros.push(`CODEMP = ${input.codEmp}`);
    if (input.codLocal !== undefined) filtros.push(`CODLOCAL = ${input.codLocal}`);

    const linhas = await dbExplorer.query<Record<string, string>>(
      `SELECT ${COLUNAS_TGFEST.join(', ')} FROM TGFEST WHERE ${filtros.join(' AND ')} ORDER BY CODEMP, CODLOCAL, CONTROLE`,
    );

    return linhas.map((linha) => ({
      codEmp: parseNumeroEstrito(linha.CODEMP, 'CODEMP'),
      codLocal: parseNumeroEstrito(linha.CODLOCAL, 'CODLOCAL'),
      codProd: parseNumeroEstrito(linha.CODPROD, 'CODPROD'),
      controle: linha.CONTROLE ?? '',
      tipo: linha.TIPO ?? '',
      codParc: parseNumeroEstrito(linha.CODPARC, 'CODPARC'),
      estoque: parseNumeroEstrito(linha.ESTOQUE, 'ESTOQUE'),
      reservado: parseNumeroEstrito(linha.RESERVADO, 'RESERVADO'),
      dtVal: textoOuNulo(linha.DTVAL),
      dtFab: textoOuNulo(linha.DTFABRICACAO),
      statusLote: linha.STATUSLOTE ?? '',
    }));
  }

  /**
   * Consulta estoque de um produto em todos os locais.
   *
   * @param codigoProduto - Codigo do produto.
   * @returns Array de posicoes de estoque por local.
   * @throws {ApiError} Em erro HTTP.
   * @throws {AuthError} Se autenticacao falhar.
   * @example
   * ```ts
   * const posicoes = await sankhya.estoque.porProduto(123);
   * ```
   */
  async porProduto(codigoProduto: number): Promise<Estoque[]> {
    const raw = await this.http.restGet<Record<string, unknown>>(
      `/estoque/produtos/${codigoProduto}`,
    );
    const { data, degraded, degradedInfo } = extractRestData<Estoque>(raw, DESCRITOR_POR_PRODUTO);
    if (degraded) {
      this.http
        .getLogger()
        .error(
          `Resposta degradada em /estoque/produtos/${codigoProduto}: ${degradedInfo?.reason ?? 'formato inesperado'}`,
        );
    }
    return data;
  }

  /**
   * Lista posicoes de estoque paginadas.
   *
   * @param params - Paginacao.
   * @returns Resultado paginado com posicoes de estoque.
   * @throws {ApiError} Em erro HTTP.
   * @throws {AuthError} Se autenticacao falhar.
   * @remarks
   * `totalRecords` deste endpoint NAO e censo: conta produtos, enquanto o
   * array conta linhas por local de estoque. Medido: a pagina 0 devolve
   * 422 linhas com `total` 50. Nao use para verificar completude.
   */
  async listar(params?: { page?: number }): Promise<PaginatedResult<Estoque>> {
    const query: Record<string, string> = { page: String(params?.page ?? 0) };
    const raw = await this.http.restGet<Record<string, unknown>>('/estoque/produtos', query);
    const { data, degraded, degradedInfo } = extractRestData<Estoque>(raw, DESCRITOR_ESTOQUE);
    return normalizePagination(
      data,
      raw,
      DESCRITOR_ESTOQUE,
      degraded,
      this.http.getLogger(),
      degradedInfo,
    );
  }

  /**
   * Lista locais de estoque paginados.
   *
   * @param params - Paginacao.
   * @returns Resultado paginado com locais de estoque.
   * @throws {ApiError} Em erro HTTP.
   * @throws {AuthError} Se autenticacao falhar.
   */
  async listarLocais(params?: { page?: number }): Promise<PaginatedResult<LocalEstoque>> {
    const query: Record<string, string> = { page: String(params?.page ?? 0) };
    const raw = await this.http.restGet<Record<string, unknown>>('/estoque/locais', query);
    const { data, degraded, degradedInfo } = extractRestData<LocalEstoque>(raw, DESCRITOR_LOCAIS);
    return normalizePagination(
      data,
      raw,
      DESCRITOR_LOCAIS,
      degraded,
      this.http.getLogger(),
      degradedInfo,
    );
  }

  /**
   * Busca um local de estoque pelo codigo.
   *
   * @param codigoLocal - Codigo do local de estoque.
   * @returns Local de estoque encontrado.
   * @throws {ApiError} Em erro HTTP.
   * @throws {AuthError} Se autenticacao falhar.
   */
  async buscarLocal(codigoLocal: number): Promise<LocalEstoque> {
    const raw = await this.http.restGet<Record<string, unknown>>(`/estoque/locais/${codigoLocal}`);
    return extractRestRecordOrThrow<LocalEstoque>(
      raw,
      `Local de estoque ${codigoLocal} nao encontrado`,
    );
  }

  /**
   * Itera sobre todas as posicoes de estoque automaticamente.
   *
   * @param params - Callback opcional de degradacao (sem filtros disponiveis).
   * @returns AsyncGenerator que emite posicoes individualmente.
   * @throws {ApiError} Em erro HTTP.
   * @throws {AuthError} Se autenticacao falhar.
   */
  listarTodos(params?: {
    onDegraded?: ((info: DegradedInfo) => void) | undefined;
  }): AsyncGenerator<Estoque> {
    const { onDegraded } = params ?? {};
    return createPaginator((page) => this.listar({ page }), 0, {
      onDegraded,
      logger: this.http.getLogger(),
    });
  }
}
