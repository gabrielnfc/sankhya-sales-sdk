import { SankhyaError } from '../core/errors.js';
import { deserializeRows } from '../core/gateway-serializer.js';
import type { HttpClient } from '../core/http.js';
import {
  createPaginator,
  extractRestData,
  extractRestRecordOrThrow,
  normalizePagination,
} from '../core/pagination.js';
import { safeParseNumber } from '../core/parse-utils.js';
import type { PaginatedResult } from '../types/common.js';
import type { DegradedInfo, ResourceDescriptor } from '../types/pagination-contracts.js';
import type {
  ComponenteProduto,
  GrupoProduto,
  ListarProdutosParams,
  Produto,
  ProdutoAlternativo,
  Volume,
  VolumeProduto,
} from '../types/produtos.js';

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

/** Entidade do Gateway que mapeia `TGFVOA`. Nome ainda nao medido no sandbox (premissa do plano D1.4). */
const ENTIDADE_VOLUME_PRODUTO = 'VolumeProduto';
const CAMPOS_VOLUME_PRODUTO = 'CODPROD,CODVOL,QUANTIDADE,LASTRO,CAMADAS,ATIVO';

const DESCRITOR_GRUPOS: ResourceDescriptor = {
  resourceKey: 'grupos',
  contract: 'rest',
  expectPagination: true,
  endpoint: '/grupos-produto',
};

/** Operacoes de produtos no Sankhya ERP. Acesse via `sankhya.produtos`. */
export class ProdutosResource {
  constructor(private readonly http: HttpClient) {}

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
   * Lista volumes de um produto especifico pelo REST v1.
   *
   * @deprecated Nao e o caminho recomendado: medido em 2026-09-03 no sandbox
   * (M54), `/produtos/{id}/volumes` devolve `[]` mesmo para produto com
   * `TGFVOA` populado. Use {@link ProdutosResource.volumesProduto}, que le a
   * mesma informacao pelo Gateway. Mantido por compatibilidade.
   *
   * @param codigoProduto - Codigo do produto.
   * @returns Array de volumes — `[]` no sandbox (M54).
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
   * Le os volumes de um produto em `TGFVOA` pelo Gateway (`CRUDServiceProvider.loadRecords`).
   *
   * Caminho recomendado para un/volume e lastro x camadas: o REST
   * {@link ProdutosResource.volumes} devolve `[]` no sandbox (M54).
   *
   * Cadastro incompleto e comum (M57: 38,4% dos PA ativos com `QUANTIDADE > 1`),
   * entao produto sem volume devolve `[]` **sem lancar** — a decisao de tratar
   * a lacuna e do consumidor (REQ-CNT-5).
   *
   * @param codigoProduto - Codigo do produto. Precisa ser inteiro: o valor
   * entra no `criteria` do Gateway, e nao-inteiro e recusado antes de qualquer
   * chamada (guarda de injecao).
   * @returns Array de volumes do produto; `[]` quando nao ha cadastro.
   * @throws {SankhyaError} `VALIDATION_ERROR` se `codigoProduto` nao for inteiro.
   * @throws {GatewayError} Em erro de negocio Sankhya.
   * @throws {AuthError} Se autenticacao falhar.
   * @example
   * ```ts
   * const [cx] = await sankhya.produtos.volumesProduto(13609);
   * // { codProd: 13609, codVol: 'CX', quantidade: 72, lastro: 12, camadas: 4, ativo: true }
   * ```
   */
  async volumesProduto(codigoProduto: number): Promise<VolumeProduto[]> {
    if (!Number.isInteger(codigoProduto)) {
      throw new SankhyaError(
        `codigoProduto precisa ser um inteiro; recebido: ${String(codigoProduto)}.`,
        'VALIDATION_ERROR',
      );
    }

    const volumes: VolumeProduto[] = [];
    let pagina = 0;
    let temMais = true;

    // Pagina ate vir pagina incompleta: `[]` precisa significar "sem cadastro",
    // nunca "a primeira pagina do Gateway acabou".
    while (temMais) {
      const result = await this.http.gatewayCall<Record<string, unknown>>(
        'mge',
        'CRUDServiceProvider.loadRecords',
        {
          dataSet: {
            rootEntity: ENTIDADE_VOLUME_PRODUTO,
            includePresentationFields: 'N',
            offsetPage: String(pagina),
            criteria: { expression: { $: `this.CODPROD = '${codigoProduto}'` } },
            entity: { fieldset: { list: CAMPOS_VOLUME_PRODUTO } },
          },
        },
        undefined,
        true, // idempotent: leitura, elegivel a retry em falha transiente
      );

      const { rows, hasMore } = deserializeRows(result, this.http.getLogger());
      for (const row of rows) {
        volumes.push({
          codProd: safeParseNumber(row.CODPROD, 'CODPROD'),
          codVol: row.CODVOL ?? '',
          quantidade: safeParseNumber(row.QUANTIDADE, 'QUANTIDADE'),
          lastro: safeParseNumber(row.LASTRO, 'LASTRO'),
          camadas: safeParseNumber(row.CAMADAS, 'CAMADAS'),
          ativo: row.ATIVO === 'S',
        });
      }

      temMais = hasMore && rows.length > 0;
      pagina += 1;
    }

    return volumes;
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
