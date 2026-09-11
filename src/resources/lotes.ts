import { SankhyaError } from '../core/errors.js';
import type { BaixaLoteInput, EntradaLoteInput, NotaDeLoteResult } from '../types/lotes.js';
import { type DatasetResource, datasetRecord } from './dataset.js';
import type { NotasResource } from './notas.js';

/**
 * Campos de `CabecalhoNota` da nota de ajuste/entrada.
 *
 * Copiados do payload medido (`spike-raw/faturamento/s1.ts:8` para a 1813 e
 * `spike-raw/virada/t05e.ts:6` para a 1811 — a **mesma** lista nos dois).
 * `NUNOTA` fica no indice 0 e **nao** e preenchido: e auto-gerado e volta no
 * `result` (M88).
 */
const CAMPOS_CABECALHO = [
  'NUNOTA',
  'NUMNOTA',
  'CODPARC',
  'DTNEG',
  'CODTIPOPER',
  'CODTIPVENDA',
  'CODVEND',
  'CODEMP',
  'TIPMOV',
  'CODNAT',
  'CODCENCUS',
  'OBSERVACAO',
] as const;

/** Campos de `ItemNota` na entrada por lote (`spike-raw/faturamento/s1.ts:14`). */
const CAMPOS_ITEM_ENTRADA = [
  'NUNOTA',
  'CODPROD',
  'QTDNEG',
  'VLRUNIT',
  'CODVOL',
  'CODLOCALORIG',
  'CONTROLE',
  'ATUALESTOQUE',
] as const;

/** Campos de `ItemNota` na baixa sem lote (`spike-raw/virada/t05e.ts:5`). */
const CAMPOS_ITEM_BAIXA = [
  'NUNOTA',
  'CODPROD',
  'QTDNEG',
  'VLRUNIT',
  'CODVOL',
  'CODLOCALORIG',
  'ATUALESTOQUE',
] as const;

/** Campos de `ItemNota` na baixa **com** lote: os da baixa + `CONTROLE`. */
const CAMPOS_ITEM_BAIXA_COM_LOTE = [...CAMPOS_ITEM_BAIXA, 'CONTROLE'] as const;

/**
 * Campos do `save` de `Estoque` que grava as datas do lote
 * (`spike-raw/faturamento/s1.ts:18`). A PK tem **6 colunas** (M36/M88).
 */
const CAMPOS_ESTOQUE_DATAS = [
  'CODEMP',
  'CODLOCAL',
  'CODPROD',
  'CONTROLE',
  'TIPO',
  'CODPARC',
  'DTVAL',
  'DTFABRICACAO',
] as const;

/**
 * Constantes do payload copiadas do spike, **sem regra de negocio medida por
 * tras** — sao o que funcionou no sandbox em 06/09/2026, nao um contrato.
 *
 * `CODNAT` (natureza) e `CODCENCUS` (centro de custo) valem para a empresa
 * daquele sandbox; `TIPMOV='Q'` e o que as 5 TOPs de ajuste usam (M100);
 * `CODVOL='UN'`, `CODPARC='0'`, `TIPO='P'`, `NUMNOTA='0'`, `CODTIPVENDA='0'` e
 * `CODVEND='0'` idem. **(b)** — confirme com o dono/contabilidade antes de rodar
 * contra outra base.
 */
const PADROES_MEDIDOS = {
  NUMNOTA: '0',
  CODPARC: '0',
  CODTIPVENDA: '0',
  CODVEND: '0',
  TIPMOV: 'Q',
  CODNAT: '99010000',
  CODCENCUS: '204004',
  CODVOL: 'UN',
  TIPO_ESTOQUE: 'P',
  /** `VLRUNIT` da baixa: a baixa nao tem preco de entrada; o spike usou `'1'`. **(b)** */
  VLRUNIT_BAIXA: '1',
} as const;

/** TOP de entrada de estoque com lote e validade (M36). */
const TOP_ENTRADA = '1813';

/**
 * TOP de ajuste de baixa.
 *
 * A **1814** ("AJUSTE BAIXA DE ESTOQUE - GERENCIAL"), que seria a natural,
 * existe e esta ativa mas e recusada com `TOP nao encontrada.` para o mesmo
 * payload; a 1811 e a 1815 aceitam (M100/M101).
 */
const TOP_BAIXA = '1811';

/** Exige inteiro positivo em valor que vai para `values`/`pk` como `String(n)`. */
function assertInteiroPositivo(valor: unknown, where: string): void {
  if (typeof valor !== 'number' || !Number.isInteger(valor) || valor <= 0) {
    throw new SankhyaError(
      `${where} precisa ser um inteiro positivo (recebido: ${typeof valor === 'number' ? String(valor) : typeof valor}). Nenhuma chamada foi feita.`,
      'VALIDATION_ERROR',
    );
  }
}

/** Exige string preenchida em campo que o ERP nao aceita vazio. */
function assertTextoPreenchido(valor: unknown, where: string): void {
  if (typeof valor !== 'string' || valor.trim() === '') {
    throw new SankhyaError(
      `${where} precisa ser uma string preenchida (recebido: ${typeof valor}). Nenhuma chamada foi feita.`,
      'VALIDATION_ERROR',
    );
  }
}

/** Exige quantidade finita e maior que zero — `0` nao move estoque e `-1` inverteria o sinal. */
function assertQuantidade(valor: unknown, where: string): void {
  if (typeof valor !== 'number' || !Number.isFinite(valor) || valor <= 0) {
    throw new SankhyaError(
      `${where}: quantidade precisa ser um numero maior que zero (recebido: ${typeof valor === 'number' ? String(valor) : typeof valor}). Nenhuma chamada foi feita.`,
      'VALIDATION_ERROR',
    );
  }
}

/** Exige lista com ao menos um item — um `save` de 0 registros nao foi medido. */
function assertItensPreenchidos(itens: unknown, where: string): void {
  if (!Array.isArray(itens) || itens.length === 0) {
    throw new SankhyaError(
      `${where}: itens vazio. Uma nota sem item nao move estoque e o efeito nao foi medido. Nenhuma chamada foi feita.`,
      'VALIDATION_ERROR',
    );
  }
}

/**
 * Le o `NUNOTA` gerado do `result` do `save` de `CabecalhoNota`, **ou lanca**.
 *
 * Mesmo motivo do NUCONF em `conferencia.abrir`: devolver `0` seria um NUNOTA
 * inventado, e os passos seguintes (`ItemNota`, `Estoque`, `confirmar`)
 * escreveriam na nota errada (I11). A nota pode ter sido criada — confira antes
 * de repetir.
 *
 * @throws {SankhyaError} `LOTES_NUNOTA_AUSENTE`.
 */
function lerNunotaGerado(result: readonly (readonly string[])[], metodo: string): number {
  const celula = result[0]?.[0];
  const numero = celula === undefined || celula.trim() === '' ? Number.NaN : Number(celula);
  if (!Number.isInteger(numero) || numero <= 0) {
    throw new SankhyaError(
      `${metodo}: o save de CabecalhoNota nao devolveu um NUNOTA utilizavel em result[0][0]. A nota pode ter sido criada no ERP — confira antes de repetir. Nenhum NUNOTA foi inventado.`,
      'LOTES_NUNOTA_AUSENTE',
    );
  }
  return numero;
}

/**
 * Entrada e baixa de estoque por lote, via `DatasetSP` (M36, M97, M100, M102).
 *
 * Acesse via `sankhya.lotes`.
 *
 * @remarks
 * Nenhum metodo daqui e retentado automaticamente: `DatasetSP.save` e escrita e
 * esta fora da allowlist de idempotentes (`src/core/http.ts:8-10`) — uma
 * reexecucao criaria uma segunda nota e moveria o estoque duas vezes.
 */
export class LotesResource {
  constructor(
    private readonly dataset: DatasetResource,
    private readonly notas: NotasResource,
  ) {}

  /**
   * Da entrada de N lotes de um produto por nota TOP **1813**, com validade.
   *
   * A ordem das quatro escritas e **obrigatoria** e nao e estilo:
   * `CabecalhoNota` → `ItemNota` (`ATUALESTOQUE='1'`, com `CONTROLE`) →
   * `Estoque` (`DTVAL`/`DTFABRICACAO`, PK de 6 colunas) → `notas.confirmar`.
   *
   * Confirmar antes de gravar as datas e recusado com *"Falta informar Data de
   * Validade e/ou Data de Fabricacao em alguns produtos"* — **e o estoque ja se
   * moveu**, porque o `ItemNota` com `ATUALESTOQUE=1` o moveu antes da recusa.
   * Pior: o estado nao se desfaz se a unidade ja estiver reservada
   * (`ORA-20101 ESTOQUE INSUFICIENTE`). Por isso as datas vao **antes** (M97).
   *
   * @param input - Empresa, local, produto, data, observacao e os lotes.
   * @returns `{ nunota }` da nota criada, lido do `result` do `save`.
   * @throws {SankhyaError} `VALIDATION_ERROR` se algum campo faltar ou `itens`
   * vier vazio — nesse caso **nenhuma** escrita e feita;
   * `LOTES_NUNOTA_AUSENTE` se o `save` nao devolver o NUNOTA.
   * @throws {GatewayError} Em erro de negocio Sankhya.
   * @throws {AuthError} Se autenticacao falhar.
   * @example
   * ```ts
   * const { nunota } = await sankhya.lotes.entrada1813({
   *   codEmp: 2, codLocal: 30301, codProd: 10077,
   *   dtNeg: '06/09/2026', observacao: 'entrada lote',
   *   itens: [{ controle: 'L-A', quantidade: 10, vlrUnit: 1, dtVal: '06/09/2027', dtFab: '06/09/2026' }],
   * });
   * ```
   */
  async entrada1813(input: EntradaLoteInput): Promise<NotaDeLoteResult> {
    const metodo = 'lotes.entrada1813';
    assertInteiroPositivo(input.codEmp, `${metodo}: codEmp`);
    assertInteiroPositivo(input.codLocal, `${metodo}: codLocal`);
    assertInteiroPositivo(input.codProd, `${metodo}: codProd`);
    assertTextoPreenchido(input.dtNeg, `${metodo}: dtNeg`);
    assertTextoPreenchido(input.observacao, `${metodo}: observacao`);
    assertItensPreenchidos(input.itens, metodo);

    for (const [i, item] of input.itens.entries()) {
      assertTextoPreenchido(item.controle, `${metodo}: itens[${i}].controle`);
      assertQuantidade(item.quantidade, `${metodo}: itens[${i}]`);
      if (typeof item.vlrUnit !== 'number' || !Number.isFinite(item.vlrUnit) || item.vlrUnit < 0) {
        throw new SankhyaError(
          `${metodo}: itens[${i}].vlrUnit precisa ser um numero finito nao negativo. Nenhuma chamada foi feita.`,
          'VALIDATION_ERROR',
        );
      }
      assertTextoPreenchido(item.dtVal, `${metodo}: itens[${i}].dtVal`);
      assertTextoPreenchido(item.dtFab, `${metodo}: itens[${i}].dtFab`);
    }

    const cabecalho = await this.dataset.save({
      entityName: 'CabecalhoNota',
      fields: CAMPOS_CABECALHO,
      records: [
        datasetRecord(CAMPOS_CABECALHO, {
          set: {
            NUMNOTA: PADROES_MEDIDOS.NUMNOTA,
            CODPARC: PADROES_MEDIDOS.CODPARC,
            DTNEG: input.dtNeg,
            CODTIPOPER: TOP_ENTRADA,
            CODTIPVENDA: PADROES_MEDIDOS.CODTIPVENDA,
            CODVEND: PADROES_MEDIDOS.CODVEND,
            CODEMP: String(input.codEmp),
            TIPMOV: PADROES_MEDIDOS.TIPMOV,
            CODNAT: PADROES_MEDIDOS.CODNAT,
            CODCENCUS: PADROES_MEDIDOS.CODCENCUS,
            OBSERVACAO: input.observacao,
          },
        }),
      ],
    });

    const nunota = lerNunotaGerado(cabecalho.result, metodo);

    await this.dataset.save({
      entityName: 'ItemNota',
      fields: CAMPOS_ITEM_ENTRADA,
      records: input.itens.map((item) =>
        datasetRecord(CAMPOS_ITEM_ENTRADA, {
          set: {
            NUNOTA: String(nunota),
            CODPROD: String(input.codProd),
            QTDNEG: String(item.quantidade),
            VLRUNIT: String(item.vlrUnit),
            CODVOL: PADROES_MEDIDOS.CODVOL,
            CODLOCALORIG: String(input.codLocal),
            CONTROLE: item.controle,
            ATUALESTOQUE: '1',
          },
        }),
      ),
    });

    await this.dataset.save({
      entityName: 'Estoque',
      fields: CAMPOS_ESTOQUE_DATAS,
      records: input.itens.map((item) =>
        datasetRecord(CAMPOS_ESTOQUE_DATAS, {
          pk: {
            CODEMP: String(input.codEmp),
            CODLOCAL: String(input.codLocal),
            CODPROD: String(input.codProd),
            CONTROLE: item.controle,
            TIPO: PADROES_MEDIDOS.TIPO_ESTOQUE,
            CODPARC: PADROES_MEDIDOS.CODPARC,
          },
          set: { DTVAL: item.dtVal, DTFABRICACAO: item.dtFab },
        }),
      ),
    });

    await this.notas.confirmar(nunota);

    return { nunota };
  }

  /**
   * Baixa estoque de N locais de um produto por nota de ajuste TOP **1811**.
   *
   * *"1811 como TOP de ajuste e decisao do dono/contabilidade; o impacto fiscal
   * nao foi medido (M100)."* A 1814, que seria a TOP natural de ajuste de baixa,
   * e recusada com `TOP nao encontrada.` apesar de ativa, e a causa nao foi
   * isolada (M101).
   *
   * *"reserva bloqueia a baixa: `DISPONIVEL = ESTOQUE - RESERVADO`; libere as
   * reservas antes (M102)."* O gatilho `TRG_UPT_TGFEST_AFTER` recusa o `save`
   * inteiro — as outras linhas do mesmo `save` **tambem** nao se movem.
   *
   * A nota **nao** e confirmada: fica em `STATUSNOTA='A'`, e enquanto estiver
   * em `A` a baixa e reversivel por `CACSP.excluirNotas` (M81/M104). Confirmar
   * seria fechar a porta de volta sem que a task pedisse.
   *
   * @param input - Empresa, produto, data, observacao e as linhas a baixar.
   * @returns `{ nunota }` da nota criada, lido do `result` do `save`.
   * @throws {SankhyaError} `VALIDATION_ERROR` se algum campo faltar, se `itens`
   * vier vazio, se alguma quantidade nao for maior que zero ou se `controle`
   * estiver em parte dos itens e nao em todos — nesse caso **nenhuma** escrita
   * e feita; `LOTES_NUNOTA_AUSENTE` se o `save` nao devolver o NUNOTA.
   * @throws {GatewayError} Em erro de negocio Sankhya (inclusive `ORA-20101` de
   * reserva).
   * @throws {AuthError} Se autenticacao falhar.
   * @example
   * ```ts
   * const { nunota } = await sankhya.lotes.baixa1811({
   *   codEmp: 1, codProd: 10015, dtNeg: '06/09/2026', observacao: 'ajuste',
   *   itens: [{ codLocal: 30201, quantidade: 2 }],
   * });
   * ```
   */
  async baixa1811(input: BaixaLoteInput): Promise<NotaDeLoteResult> {
    const metodo = 'lotes.baixa1811';
    assertInteiroPositivo(input.codEmp, `${metodo}: codEmp`);
    assertInteiroPositivo(input.codProd, `${metodo}: codProd`);
    assertTextoPreenchido(input.dtNeg, `${metodo}: dtNeg`);
    assertTextoPreenchido(input.observacao, `${metodo}: observacao`);
    assertItensPreenchidos(input.itens, metodo);

    for (const [i, item] of input.itens.entries()) {
      assertInteiroPositivo(item.codLocal, `${metodo}: itens[${i}].codLocal`);
      assertQuantidade(item.quantidade, `${metodo}: itens[${i}]`);
    }

    const comLote = input.itens.filter(
      (item) => typeof item.controle === 'string' && item.controle.trim() !== '',
    ).length;
    if (comLote !== 0 && comLote !== input.itens.length) {
      throw new SankhyaError(
        `${metodo}: controle informado em ${comLote} de ${input.itens.length} itens. O save usa um unico fields — ou todos informam CONTROLE, ou nenhum, senao parte das linhas cairia no controle flutuante ' ' (M92). Nenhuma chamada foi feita.`,
        'VALIDATION_ERROR',
      );
    }
    const campos = comLote === 0 ? CAMPOS_ITEM_BAIXA : CAMPOS_ITEM_BAIXA_COM_LOTE;

    const cabecalho = await this.dataset.save({
      entityName: 'CabecalhoNota',
      fields: CAMPOS_CABECALHO,
      records: [
        datasetRecord(CAMPOS_CABECALHO, {
          set: {
            NUMNOTA: PADROES_MEDIDOS.NUMNOTA,
            CODPARC: PADROES_MEDIDOS.CODPARC,
            DTNEG: input.dtNeg,
            CODTIPOPER: TOP_BAIXA,
            CODTIPVENDA: PADROES_MEDIDOS.CODTIPVENDA,
            CODVEND: PADROES_MEDIDOS.CODVEND,
            CODEMP: String(input.codEmp),
            TIPMOV: PADROES_MEDIDOS.TIPMOV,
            CODNAT: PADROES_MEDIDOS.CODNAT,
            CODCENCUS: PADROES_MEDIDOS.CODCENCUS,
            OBSERVACAO: input.observacao,
          },
        }),
      ],
    });

    const nunota = lerNunotaGerado(cabecalho.result, metodo);

    await this.dataset.save({
      entityName: 'ItemNota',
      fields: campos,
      records: input.itens.map((item) =>
        datasetRecord(campos, {
          set: {
            NUNOTA: String(nunota),
            CODPROD: String(input.codProd),
            QTDNEG: String(item.quantidade),
            VLRUNIT: PADROES_MEDIDOS.VLRUNIT_BAIXA,
            CODVOL: PADROES_MEDIDOS.CODVOL,
            CODLOCALORIG: String(item.codLocal),
            ATUALESTOQUE: '-1',
            ...(comLote === 0 ? {} : { CONTROLE: item.controle ?? '' }),
          },
        }),
      ),
    });

    return { nunota };
  }
}
