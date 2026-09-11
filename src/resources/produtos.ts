import { SankhyaError } from '../core/errors.js';
import type { HttpClient } from '../core/http.js';
import {
  createPaginator,
  extractRestData,
  extractRestRecordOrThrow,
  normalizePagination,
} from '../core/pagination.js';
import type { PaginatedResult } from '../types/common.js';
import type { DegradedInfo, ResourceDescriptor } from '../types/pagination-contracts.js';
import type {
  ComponenteProduto,
  GrupoProduto,
  ListarProdutosParams,
  Produto,
  ProdutoAlternativo,
  SetTipoControleInput,
  Volume,
} from '../types/produtos.js';
import { type DatasetResource, datasetRecord } from './dataset.js';
import type { DbExplorerResource } from './db-explorer.js';

const DESCRITOR_PRODUTOS: ResourceDescriptor = {
  resourceKey: 'produtos',
  contract: 'rest',
  expectPagination: true,
  endpoint: '/produtos',
};

const DESCRITOR_COMPONENTES: ResourceDescriptor = {
  // resourceKey null: endpoint nao mensuravel neste sandbox (ver §10 do design).
  // Mantem o comportamento legado de primeiro array; sem deteccao de degradacao.
  resourceKey: null,
  contract: 'rest',
  expectPagination: false,
  endpoint: '/produtos/{id}/componentes',
};

const DESCRITOR_ALTERNATIVOS: ResourceDescriptor = {
  // resourceKey null: endpoint nao mensuravel neste sandbox (ver §10 do design).
  // Mantem o comportamento legado de primeiro array; sem deteccao de degradacao.
  resourceKey: null,
  contract: 'rest',
  expectPagination: false,
  endpoint: '/produtos/{id}/alternativos',
};

const DESCRITOR_VOLUMES_PRODUTO: ResourceDescriptor = {
  resourceKey: 'volumesProduto',
  contract: 'rest',
  expectPagination: true,
  endpoint: '/produtos/{id}/volumes',
};

const DESCRITOR_VOLUMES: ResourceDescriptor = {
  resourceKey: 'volumes',
  contract: 'rest',
  expectPagination: true,
  endpoint: '/volumes-produtos',
};

const DESCRITOR_GRUPOS: ResourceDescriptor = {
  resourceKey: 'grupos',
  contract: 'rest',
  expectPagination: true,
  endpoint: '/grupos-produto',
};

/** Campos do `save` da virada (`spike-raw/virada/t05e.ts:15`). */
const CAMPOS_TIPO_CONTROLE = ['CODPROD', 'TIPCONTEST', 'USALOTEDTVAL'] as const;

/** Dependencias opcionais injetadas pelo `SankhyaClient`. */
export interface ProdutosDeps {
  /** Necessaria para `setTipoControle` (escrita em `Produto`). */
  readonly dataset?: DatasetResource;
  /** Necessaria para `setTipoControle` (prova de saldo e reserva zero). */
  readonly dbExplorer?: DbExplorerResource;
}

/**
 * Linha de `TGFEST` lida na prova de saldo zero.
 *
 * `Record<string, string>` e nao uma interface de colunas: `dbExplorer.query`
 * exige `DbExplorerRow`, e uma interface fechada nao satisfaz a index signature.
 * As colunas vem do SELECT medido — `CODEMP`, `CODLOCAL`, `CONTROLE`,
 * `ESTOQUE`, `RESERVADO`.
 */
type LinhaSaldo = Record<string, string>;

/**
 * Parse estrito de coluna numerica da prova de saldo.
 *
 * `safeParseNumber` devolveria `0` para vazio (`src/core/parse-utils.ts:11-21`),
 * e `0` aqui **autoriza a virada**. Vazio ou nao-numerico lanca.
 *
 * @throws {SankhyaError} `PARSE_ERROR`.
 */
function parseSaldoEstrito(valor: string | undefined, coluna: string): number {
  if (valor === undefined || valor.trim() === '') {
    throw new SankhyaError(
      `produtos.setTipoControle: coluna ${coluna} veio vazia em TGFEST. Nenhum 0 foi inventado — 0 autorizaria a virada. Nada foi gravado.`,
      'PARSE_ERROR',
    );
  }
  const numero = Number(valor);
  if (!Number.isFinite(numero)) {
    throw new SankhyaError(
      `produtos.setTipoControle: coluna ${coluna} nao e numerica em TGFEST. Nenhum 0 foi inventado — 0 autorizaria a virada. Nada foi gravado.`,
      'PARSE_ERROR',
    );
  }
  return numero;
}

/** Operacoes de produtos no Sankhya ERP. Acesse via `sankhya.produtos`. */
export class ProdutosResource {
  constructor(
    private readonly http: HttpClient,
    private readonly deps?: ProdutosDeps,
  ) {}

  /**
   * Vira o controle de lote do produto (`TGFPRO.TIPCONTEST`) — **so com saldo e
   * reserva zerados em TODAS as linhas de `TGFEST`** (REQ-VIR-3).
   *
   * A trava e de saldo, nao de permissao: o gatilho `TRG_INC_UPD_TGFPRO` recusa
   * a alteracao com `SELECT … FROM TGFEST WHERE CODPROD = :NEW.CODPROD AND
   * ESTOQUE <> 0` — **sem filtro de empresa, local ou controle** (M103). Por
   * isso o `SELECT` desta prova e **global**: filtrar por `CODEMP` provaria a
   * empresa errada e a virada seria recusada pelo ERP com saldo em outra.
   *
   * A prova e um `SELECT` **independente**. O eco do `save` nunca e prova — foi
   * exatamente assim que a gravacao de `'L'` ficou **(b) parcial** no spike
   * (M104): o `save` respondeu OK e ninguem releu a tabela (I3).
   *
   * `RESERVADO` tambem trava, embora o gatilho so olhe `ESTOQUE`: com reserva
   * viva a baixa que zera o saldo e recusada (`DISPONIVEL = ESTOQUE -
   * RESERVADO`, M102), e virar o controle sob reserva deixa pedido aberto
   * apontando para um controle que mudou. **A liberacao das reservas e ordem de
   * negocio sobre pedidos e fica FORA do SDK** (passo 1 da §4.2.3 do design);
   * aqui o SDK apenas recusa.
   *
   * Fail-closed declarado (G9): `SELECT` com **0 linhas** tambem e recusado.
   * Ausencia de dado nao e dado ausente (I4) — a linha de `TGFEST` some quando
   * zera (M91), entao 0 linhas pode ser "zerado" ou "nunca teve", e as duas
   * hipoteses nao se separam por esta leitura. Consequencia medida e declarada:
   * a receita de M104 fez a virada com o read-back devolvendo `rows: []`
   * (`spike-raw/virada/T05E_RB_EST_ZERO_GLOBAL.json`), logo **este metodo recusa
   * um caminho que o ERP aceita**; falso positivo de guarda, custo de uma linha
   * (I9), contra um falso negativo que viraria controle com saldo vivo.
   *
   * @param input - Produto, tipo alvo e `USALOTEDTVAL`.
   * @param input.codProd - `CODPROD` (inteiro positivo).
   * @param input.tipo - `'L'` liga o controle por lote, `'N'` desliga.
   * @param input.usaLoteDtVal - `true` grava `'S'`, `false` grava `'N'`.
   * @returns Nada: o `result` do `save` so devolve o que foi mandado gravar.
   * @throws {SankhyaError} `VALIDATION_ERROR` se faltar `dbExplorer`/`dataset`
   * (nomeando a dep), se `codProd` nao for inteiro positivo, se `tipo` nao for
   * `'L'`/`'N'`, se o `SELECT` nao devolver linha alguma, ou se houver saldo
   * (`/saldo/`) ou reserva (`/reserva/`) em qualquer linha — em todos os casos
   * **nada e gravado**; `PARSE_ERROR` em coluna vazia ou nao-numerica.
   * @throws {GatewayError} Em erro de negocio Sankhya.
   * @throws {AuthError} Se autenticacao falhar.
   * @example
   * ```ts
   * await sankhya.produtos.setTipoControle({ codProd: 10015, tipo: 'L', usaLoteDtVal: true });
   * ```
   */
  async setTipoControle(input: SetTipoControleInput): Promise<void> {
    if (
      typeof input.codProd !== 'number' ||
      !Number.isInteger(input.codProd) ||
      input.codProd <= 0
    ) {
      throw new SankhyaError(
        `produtos.setTipoControle: codProd precisa ser um inteiro positivo (recebido: ${typeof input.codProd === 'number' ? String(input.codProd) : typeof input.codProd}). Nada foi gravado.`,
        'VALIDATION_ERROR',
      );
    }
    if (input.tipo !== 'L' && input.tipo !== 'N') {
      throw new SankhyaError(
        `produtos.setTipoControle: tipo precisa ser 'L' ou 'N'. Nada foi gravado.`,
        'VALIDATION_ERROR',
      );
    }

    const dbExplorer = this.deps?.dbExplorer;
    if (dbExplorer === undefined) {
      throw new SankhyaError(
        'produtos.setTipoControle exige a dependencia dbExplorer, que so o SankhyaClient injeta — sem ela nao ha como provar saldo zero, e o eco do save nao e prova. Use `sankhya.produtos`. Nada foi gravado.',
        'VALIDATION_ERROR',
      );
    }
    const dataset = this.deps?.dataset;
    if (dataset === undefined) {
      throw new SankhyaError(
        'produtos.setTipoControle exige a dependencia dataset, que so o SankhyaClient injeta. Use `sankhya.produtos`. Nada foi gravado.',
        'VALIDATION_ERROR',
      );
    }

    // SELECT GLOBAL: sem CODEMP/CODLOCAL. O gatilho e global (M103).
    // Forma medida em spike-raw/virada/t05e.ts:3.
    const linhas = await dbExplorer.query<LinhaSaldo>(
      `SELECT CODEMP, CODLOCAL, CONTROLE, ESTOQUE, RESERVADO FROM TGFEST WHERE CODPROD = ${input.codProd} ORDER BY CODEMP, CODLOCAL`,
    );

    if (linhas.length === 0) {
      throw new SankhyaError(
        `produtos.setTipoControle: o SELECT global nao devolveu nenhuma linha em TGFEST para o CODPROD ${input.codProd}. Sem linhas em TGFEST nao ha prova de saldo zero — a linha zerada some da tabela (M91), entao 0 linhas nao distingue "zerado" de "nunca teve" (I4). Nada foi gravado.`,
        'VALIDATION_ERROR',
      );
    }

    for (const linha of linhas) {
      const onde = `CODEMP ${linha.CODEMP ?? '?'}, CODLOCAL ${linha.CODLOCAL ?? '?'}`;
      const estoque = parseSaldoEstrito(linha.ESTOQUE, 'ESTOQUE');
      if (estoque !== 0) {
        throw new SankhyaError(
          `produtos.setTipoControle: ha saldo em TGFEST (${onde}, ESTOQUE ${estoque}). O gatilho TRG_INC_UPD_TGFPRO olha TODAS as empresas e locais (M103) — zere o saldo global antes. Nada foi gravado.`,
          'VALIDATION_ERROR',
        );
      }
      const reservado = parseSaldoEstrito(linha.RESERVADO, 'RESERVADO');
      if (reservado !== 0) {
        throw new SankhyaError(
          `produtos.setTipoControle: ha reserva em TGFEST (${onde}, RESERVADO ${reservado}). Reserva bloqueia a baixa que zeraria o saldo (DISPONIVEL = ESTOQUE - RESERVADO, M102); a liberacao e ordem de negocio sobre pedidos e fica fora do SDK. Nada foi gravado.`,
          'VALIDATION_ERROR',
        );
      }
    }

    await dataset.save({
      entityName: 'Produto',
      fields: CAMPOS_TIPO_CONTROLE,
      records: [
        datasetRecord(CAMPOS_TIPO_CONTROLE, {
          pk: { CODPROD: String(input.codProd) },
          set: { TIPCONTEST: input.tipo, USALOTEDTVAL: input.usaLoteDtVal ? 'S' : 'N' },
        }),
      ],
    });
  }

  /**
   * Lista produtos paginados.
   *
   * @param params - Filtros e paginacao.
   * @returns Resultado paginado com produtos.
   * @throws {ApiError} Em erro HTTP.
   * @throws {AuthError} Se autenticacao falhar.
   * @example
   * ```ts
   * const resultado = await sankhya.produtos.listar();
   * ```
   */
  async listar(params?: ListarProdutosParams): Promise<PaginatedResult<Produto>> {
    const query: Record<string, string> = { page: String(params?.page ?? 0) };
    if (params?.modifiedSince) query.modifiedSince = params.modifiedSince;

    const raw = await this.http.restGet<Record<string, unknown>>('/produtos', query);
    const { data, degraded, degradedInfo } = extractRestData<Produto>(raw, DESCRITOR_PRODUTOS);
    return normalizePagination(
      data,
      raw,
      DESCRITOR_PRODUTOS,
      degraded,
      this.http.getLogger(),
      degradedInfo,
    );
  }

  /**
   * Busca um produto pelo codigo.
   *
   * @param codigoProduto - Codigo do produto.
   * @returns Produto encontrado.
   * @throws {ApiError} Em erro HTTP (404 se nao encontrado).
   * @throws {AuthError} Se autenticacao falhar.
   */
  async buscar(codigoProduto: number): Promise<Produto> {
    /** Sandbox retorna { produtos: { ...campos } } — precisa extrair o objeto interno */
    const raw = await this.http.restGet<Record<string, unknown>>(`/produtos/${codigoProduto}`);
    if (raw && typeof raw === 'object' && 'produtos' in raw) {
      return raw.produtos as Produto;
    }
    return raw as unknown as Produto;
  }

  /**
   * Lista componentes de um produto (kit/composicao).
   *
   * @param codigoProduto - Codigo do produto.
   * @returns Array de componentes.
   * @throws {ApiError} Em erro HTTP.
   * @throws {AuthError} Se autenticacao falhar.
   */
  async componentes(codigoProduto: number): Promise<ComponenteProduto[]> {
    const raw = await this.http.restGet<Record<string, unknown>>(
      `/produtos/${codigoProduto}/componentes`,
    );
    const { data } = extractRestData<ComponenteProduto>(raw, DESCRITOR_COMPONENTES);
    return data;
  }

  /**
   * Lista produtos alternativos de um produto.
   *
   * @param codigoProduto - Codigo do produto.
   * @returns Array de produtos alternativos.
   * @throws {ApiError} Em erro HTTP.
   * @throws {AuthError} Se autenticacao falhar.
   */
  async alternativos(codigoProduto: number): Promise<ProdutoAlternativo[]> {
    const raw = await this.http.restGet<Record<string, unknown>>(
      `/produtos/${codigoProduto}/alternativos`,
    );
    const { data } = extractRestData<ProdutoAlternativo>(raw, DESCRITOR_ALTERNATIVOS);
    return data;
  }

  /**
   * Lista volumes de um produto especifico.
   *
   * @param codigoProduto - Codigo do produto.
   * @returns Array de volumes.
   * @throws {ApiError} Em erro HTTP.
   * @throws {AuthError} Se autenticacao falhar.
   * @remarks
   * Este endpoint devolve bloco `pagination` real, que versoes anteriores
   * descartavam — o metodo entregava so a primeira pagina. Agora percorre
   * todas as paginas internamente, entao pode fazer N requisicoes e falhar
   * no meio de uma varredura longa.
   */
  async volumes(codigoProduto: number): Promise<Volume[]> {
    const paginar = async (page: number) => {
      const raw = await this.http.restGet<Record<string, unknown>>(
        `/produtos/${codigoProduto}/volumes`,
        { page: String(page) },
      );
      const { data, degraded, degradedInfo } = extractRestData<Volume>(
        raw,
        DESCRITOR_VOLUMES_PRODUTO,
      );
      return normalizePagination(
        data,
        raw,
        DESCRITOR_VOLUMES_PRODUTO,
        degraded,
        this.http.getLogger(),
        degradedInfo,
      );
    };

    const todos: Volume[] = [];
    for await (const volume of createPaginator(paginar, 0, { logger: this.http.getLogger() })) {
      todos.push(volume);
    }
    return todos;
  }

  /**
   * Lista todos os volumes do sistema paginados.
   *
   * @param params - Paginacao.
   * @returns Resultado paginado com volumes.
   * @throws {ApiError} Em erro HTTP.
   * @throws {AuthError} Se autenticacao falhar.
   */
  async listarVolumes(params?: { page?: number }): Promise<PaginatedResult<Volume>> {
    const query: Record<string, string> = { page: String(params?.page ?? 0) };
    const raw = await this.http.restGet<Record<string, unknown>>('/volumes-produtos', query);
    const { data, degraded, degradedInfo } = extractRestData<Volume>(raw, DESCRITOR_VOLUMES);
    return normalizePagination(
      data,
      raw,
      DESCRITOR_VOLUMES,
      degraded,
      this.http.getLogger(),
      degradedInfo,
    );
  }

  /**
   * Busca um volume pelo codigo.
   *
   * @param codigoVolume - Codigo do volume (string).
   * @returns Volume encontrado.
   * @throws {ApiError} Em erro HTTP.
   * @throws {AuthError} Se autenticacao falhar.
   */
  async buscarVolume(codigoVolume: string): Promise<Volume> {
    const raw = await this.http.restGet<Record<string, unknown>>(
      `/volumes-produtos/${codigoVolume}`,
    );
    return extractRestRecordOrThrow<Volume>(raw, `Volume ${codigoVolume} nao encontrado`);
  }

  /**
   * Lista grupos de produto paginados.
   *
   * @param params - Filtros e paginacao.
   * @returns Resultado paginado com grupos.
   * @throws {ApiError} Em erro HTTP.
   * @throws {AuthError} Se autenticacao falhar.
   */
  async listarGrupos(params?: ListarProdutosParams): Promise<PaginatedResult<GrupoProduto>> {
    const query: Record<string, string> = { page: String(params?.page ?? 0) };
    if (params?.modifiedSince) query.modifiedSince = params.modifiedSince;

    const raw = await this.http.restGet<Record<string, unknown>>('/grupos-produto', query);
    const { data, degraded, degradedInfo } = extractRestData<GrupoProduto>(raw, DESCRITOR_GRUPOS);
    return normalizePagination(
      data,
      raw,
      DESCRITOR_GRUPOS,
      degraded,
      this.http.getLogger(),
      degradedInfo,
    );
  }

  /**
   * Busca um grupo de produto pelo codigo.
   *
   * @param codigoGrupoProduto - Codigo do grupo.
   * @returns Grupo de produto encontrado.
   * @throws {ApiError} Em erro HTTP.
   * @throws {AuthError} Se autenticacao falhar.
   */
  async buscarGrupo(codigoGrupoProduto: number): Promise<GrupoProduto> {
    const raw = await this.http.restGet<Record<string, unknown>>(
      `/grupos-produto/${codigoGrupoProduto}`,
    );
    return extractRestRecordOrThrow<GrupoProduto>(
      raw,
      `Grupo de produto ${codigoGrupoProduto} nao encontrado`,
    );
  }

  /**
   * Itera sobre todos os produtos automaticamente.
   *
   * @param params - Filtros (sem paginacao).
   * @returns AsyncGenerator que emite produtos individualmente.
   * @throws {ApiError} Em erro HTTP.
   * @throws {AuthError} Se autenticacao falhar.
   */
  listarTodos(
    params?: Omit<ListarProdutosParams, 'page'> & {
      onDegraded?: ((info: DegradedInfo) => void) | undefined;
    },
  ): AsyncGenerator<Produto> {
    const { onDegraded, ...filtros } = params ?? {};
    return createPaginator((page) => this.listar({ ...filtros, page }), 0, {
      onDegraded,
      logger: this.http.getLogger(),
    });
  }
}
