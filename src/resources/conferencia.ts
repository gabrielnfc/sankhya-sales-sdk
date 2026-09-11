import { SankhyaError } from '../core/errors.js';
import type {
  AbrirConferenciaInput,
  AbrirConferenciaResult,
  ApontarNaNotaInput,
  BiparInput,
  CarimbarSeparacaoInput,
  CarimboReadRow,
  ConferenciaDaNota,
  FecharConferenciaInput,
  ReapontarOrigemInput,
} from '../types/conferencia.js';
import { type DatasetResource, datasetRecord } from './dataset.js';
import type { DbExplorerResource } from './db-explorer.js';

/** Campos de `CabecalhoConferencia` na abertura (fixture `C1_ABRIR_CONF_P.json`). */
const CAMPOS_ABRIR = ['NUCONF', 'NUNOTAORIG', 'DHINICONF', 'CODUSUCONF', 'STATUS'] as const;
/** Campos de `DetalhesConferencia` ao bipar (fixture `C1_BIPAR_CONF_P.json`). */
const CAMPOS_BIPAR = [
  'NUCONF',
  'SEQCONF',
  'CODPROD',
  'CODVOL',
  'QTDCONF',
  'CODBARRA',
  'CONTROLE',
] as const;
/** Campos do fechamento (fixture `C1_FECHAR_CONF_P.json`). */
const CAMPOS_FECHAR = ['NUCONF', 'DHFINCONF', 'STATUS'] as const;
/** Campos do carimbo de separacao (fixture `C1_CARIMBO_P.json`). */
const CAMPOS_CARIMBO = ['NUNOTA', 'AD_DTHRSEPARACAO', 'AD_NOMESEPARADOR'] as const;
/** Campos do E1 (fixture `C3_E1_SET_NUCONFATUAL_N.json`). */
const CAMPOS_E1 = ['NUNOTA', 'NUCONFATUAL'] as const;
/** Campos do E2 (fixture `C3_E2_SET_NUNOTAORIG_CONF.json`). */
const CAMPOS_E2 = ['NUCONF', 'NUNOTAORIG'] as const;

/**
 * Exige inteiro positivo em identificador que entra em SQL **interpolado** ou em
 * payload de escrita.
 *
 * O DbExplorer nao tem bind parameter nesta rota (`src/resources/db-explorer.ts`),
 * e todo valor de `values`/`pk` vai como `String(n)`: `1.5` viraria `'1.5'` e
 * `NaN` viraria `'NaN'` — valores que o ERP recusa ou, pior, interpreta.
 * Validar antes da rede e guarda de injecao (G3) e guarda de payload de uma vez.
 *
 * @throws {SankhyaError} `VALIDATION_ERROR` citando a posicao culpada.
 */
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

/**
 * Le o NUCONF gerado do `result` do `save`, **ou lanca**.
 *
 * `NUCONF` e auto-gerado (`TIPONUMERACAO='A'`) e so volta no `result` — a
 * primeira celula da primeira linha, na ordem de `CAMPOS_ABRIR`. Celula ausente,
 * vazia ou nao-numerica **lanca**: devolver `0` seria um NUCONF inventado, que o
 * chamador usaria em `bipar`/`fechar` e escreveria no registro errado (I11).
 *
 * @throws {SankhyaError} `CONFERENCIA_NUCONF_AUSENTE`.
 */
function lerNuconfGerado(result: readonly (readonly string[])[]): number {
  const celula = result[0]?.[0];
  const numero = celula === undefined || celula.trim() === '' ? Number.NaN : Number(celula);
  if (!Number.isInteger(numero) || numero <= 0) {
    throw new SankhyaError(
      'conferencia.abrir: o save nao devolveu um NUCONF utilizavel em result[0][0]. A conferencia pode ter sido criada no ERP — confira por listarPorNota antes de repetir. Nenhum NUCONF foi inventado.',
      'CONFERENCIA_NUCONF_AUSENTE',
    );
  }
  return numero;
}

/**
 * Conferencia nativa do Sankhya (`TGFCON2`/`TGFCOI2`) pelo `DatasetSP` do Gateway.
 *
 * A REST v1 **nao** tem endpoint de conferencia: o unico caminho e o Dataset
 * sobre as entidades MGE `CabecalhoConferencia` (TGFCON2) e
 * `DetalhesConferencia` (TGFCOI2) — `TGFCON`/`TGFCOI` sao a versao antiga e
 * vazia, nao use.
 *
 * Ciclo: `carimbarSeparacao` → `abrir` → `bipar` (n vezes) → `fechar`.
 *
 * Acesse via `sankhya.conferencia`.
 *
 * @remarks
 * Dois guards que o ERP **nao** faz por nos:
 * - **carimbo (M76):** o gatilho `TRG_B_I_TGFCON2_TRUE` recusa `INSERT` sem
 *   `AD_DTHRSEPARACAO` na nota (`ORA-20101`). `abrir` le o carimbo e lanca
 *   **antes** de escrever — errar aqui custa uma escrita recusada pelo ERP com
 *   mensagem opaca;
 * - **duplicata (M110):** o ERP **aceita** uma 2a conferencia para a mesma
 *   `NUNOTAORIG` (236 de 280.645 `NUNOTAORIG` do snapshot tem mais de uma) e
 *   `NUCONFATUAL` nao migra para a mais recente. O "abrir so se nao existir" e
 *   guard do SeparaTrue, verificado por `listarPorNota`.
 *
 * Nenhum metodo daqui e retentado automaticamente: `DatasetSP.save` e escrita e
 * esta fora da allowlist de idempotentes (`src/core/http.ts:8-10`).
 */
export class ConferenciaResource {
  constructor(
    private readonly dataset: DatasetResource,
    private readonly dbExplorer: DbExplorerResource,
  ) {}

  /**
   * Carimba a separacao na nota (`AD_DTHRSEPARACAO` + `AD_NOMESEPARADOR`).
   *
   * Pre-condicao de `abrir` (M76), nao passo opcional. A 1101 gerada por
   * `faturamento.faturar` **herda** o carimbo do pedido (M111) — conferir nela
   * nao exige um segundo carimbo.
   *
   * @param input - NUNOTA, data/hora `dd/MM/yyyy HH:mm:ss` e nome do separador.
   * @param input.nunota - NUNOTA da nota/pedido (inteiro positivo).
   * @param input.dataHora - Data/hora ja formatada; o SDK nao formata data.
   * @param input.nomeSeparador - Vai para `AD_NOMESEPARADOR`.
   * @returns Nada: o `result` do save so devolve o que foi gravado.
   * @throws {SankhyaError} `VALIDATION_ERROR` se `nunota` nao for inteiro
   * positivo ou se `dataHora`/`nomeSeparador` vierem vazios — antes da rede.
   * @throws {GatewayError} Em erro de negocio Sankhya.
   * @throws {AuthError} Se autenticacao falhar.
   * @example
   * ```ts
   * await sankhya.conferencia.carimbarSeparacao({
   *   nunota: 1889338,
   *   dataHora: '06/09/2026 12:55:34',
   *   nomeSeparador: 'JOAO',
   * });
   * ```
   */
  async carimbarSeparacao(input: CarimbarSeparacaoInput): Promise<void> {
    assertInteiroPositivo(input.nunota, 'conferencia.carimbarSeparacao: nunota');
    assertTextoPreenchido(input.dataHora, 'conferencia.carimbarSeparacao: dataHora');
    assertTextoPreenchido(input.nomeSeparador, 'conferencia.carimbarSeparacao: nomeSeparador');

    const fields = [...CAMPOS_CARIMBO];
    await this.dataset.save({
      entityName: 'CabecalhoNota',
      fields,
      records: [
        datasetRecord(fields, {
          pk: { NUNOTA: String(input.nunota) },
          set: { AD_DTHRSEPARACAO: input.dataHora, AD_NOMESEPARADOR: input.nomeSeparador },
        }),
      ],
    });
  }

  /**
   * Abre a conferencia da nota (`STATUS='A'`) e devolve o `NUCONF` gerado.
   *
   * Ordem **obrigatoria** e verificada em teste: carimbo (M76) → duplicata
   * (M110) → escrita. Os dois guards rodam antes de qualquer `save`; escrever
   * primeiro transformaria uma recusa em conferencia orfa no ERP.
   *
   * O registro vai **sem** `NUCONF` em `values` (insercao, M88): o numero e
   * auto-gerado (`TIPONUMERACAO='A'`) e volta em `result[0][0]`.
   *
   * @param input - NUNOTA, `CODUSUCONF` e `DHINICONF` (`dd/MM/yyyy HH:mm:ss`).
   * @param input.nunota - Vira `NUNOTAORIG` (inteiro positivo).
   * @param input.codUsuConf - Usuario Sankhya da conferencia (inteiro positivo).
   * @param input.dataHora - `DHINICONF` ja formatada.
   * @returns `{ nuconf }` lido do `result` do save.
   * @throws {SankhyaError} `VALIDATION_ERROR` se algum identificador nao for
   * inteiro positivo ou `dataHora` vier vazia; `CONFERENCIA_SEM_CARIMBO` se a
   * nota nao tiver `AD_DTHRSEPARACAO` (chame `carimbarSeparacao` primeiro);
   * `CONFERENCIA_DUPLICADA` se a nota ja tiver conferencia (citando o NUCONF);
   * `CONFERENCIA_NUCONF_AUSENTE` se o save nao devolver NUCONF utilizavel. Nos
   * tres primeiros casos **nenhuma** escrita foi feita.
   * @throws {GatewayError} Em erro de negocio Sankhya.
   * @throws {AuthError} Se autenticacao falhar.
   * @example
   * ```ts
   * const { nuconf } = await sankhya.conferencia.abrir({
   *   nunota: 1889348,
   *   codUsuConf: 69,
   *   dataHora: '06/09/2026 12:55:34',
   * });
   * ```
   */
  async abrir(input: AbrirConferenciaInput): Promise<AbrirConferenciaResult> {
    assertInteiroPositivo(input.nunota, 'conferencia.abrir: nunota');
    assertInteiroPositivo(input.codUsuConf, 'conferencia.abrir: codUsuConf');
    assertTextoPreenchido(input.dataHora, 'conferencia.abrir: dataHora');

    await this.assertCarimbada(input.nunota);

    const existentes = await this.listarPorNota(input.nunota);
    if (existentes.length > 0) {
      const descricao = existentes.map((c) => `${c.nuconf} (STATUS ${c.status})`).join(', ');
      throw new SankhyaError(
        `conferencia.abrir: a nota ${input.nunota} ja tem conferencia — NUCONF ${descricao}. O ERP aceitaria uma segunda (M110) e o NUCONFATUAL nao migraria para ela; nenhuma escrita foi feita. Use a existente ou remova-a antes.`,
        'CONFERENCIA_DUPLICADA',
      );
    }

    const fields = [...CAMPOS_ABRIR];
    const { result } = await this.dataset.save({
      entityName: 'CabecalhoConferencia',
      fields,
      records: [
        datasetRecord(fields, {
          set: {
            NUNOTAORIG: String(input.nunota),
            DHINICONF: input.dataHora,
            CODUSUCONF: String(input.codUsuConf),
            STATUS: 'A',
          },
        }),
      ],
    });

    return { nuconf: lerNuconfGerado(result) };
  }

  /**
   * Grava um item bipado em `DetalhesConferencia` (`TGFCOI2`).
   *
   * `CONTROLE` vai junto no mesmo save: o lote persiste em `TGFCOI2` (M38), e
   * nao ha um segundo passo para ele. `CODBARRA` guarda o EAN que foi bipado de
   * fato — nao o EAN principal do cadastro.
   *
   * @param input - NUCONF, sequencia, produto, volume, quantidade, EAN e lote.
   * @param input.nuconf - Conferencia aberta (inteiro positivo).
   * @param input.seqConf - `SEQCONF` do item (inteiro positivo).
   * @param input.codProd - `CODPROD` (inteiro positivo).
   * @param input.codVol - `CODVOL` (ex: `'UN'`), nao vazio.
   * @param input.qtdConf - `QTDCONF`, finita e maior que zero.
   * @param input.codBarra - `CODBARRA` bipado, nao vazio.
   * @param input.controle - Lote; string vazia aceita (produto sem lote).
   * @returns Nada: o `result` do save so repete o que foi gravado.
   * @throws {SankhyaError} `VALIDATION_ERROR` se algum identificador nao for
   * inteiro positivo, se `qtdConf` nao for numero finito maior que zero, ou se
   * `codVol`/`codBarra` vierem vazios — antes da rede.
   * @throws {GatewayError} Em erro de negocio Sankhya.
   * @throws {AuthError} Se autenticacao falhar.
   * @example
   * ```ts
   * await sankhya.conferencia.bipar({
   *   nuconf: 281956, seqConf: 1, codProd: 10077, codVol: 'UN',
   *   qtdConf: 1, codBarra: '040141160911', controle: 'L-2026-07',
   * });
   * ```
   */
  async bipar(input: BiparInput): Promise<void> {
    assertInteiroPositivo(input.nuconf, 'conferencia.bipar: nuconf');
    assertInteiroPositivo(input.seqConf, 'conferencia.bipar: seqConf');
    assertInteiroPositivo(input.codProd, 'conferencia.bipar: codProd');
    assertTextoPreenchido(input.codVol, 'conferencia.bipar: codVol');
    assertTextoPreenchido(input.codBarra, 'conferencia.bipar: codBarra');
    if (
      typeof input.qtdConf !== 'number' ||
      !Number.isFinite(input.qtdConf) ||
      input.qtdConf <= 0
    ) {
      throw new SankhyaError(
        `conferencia.bipar: qtdConf precisa ser um numero finito maior que zero (recebido: ${typeof input.qtdConf === 'number' ? String(input.qtdConf) : typeof input.qtdConf}). Quantidade zero ou negativa nao tem efeito medido em TGFCOI2 — nenhuma chamada foi feita.`,
        'VALIDATION_ERROR',
      );
    }
    if (typeof input.controle !== 'string') {
      throw new SankhyaError(
        `conferencia.bipar: controle precisa ser string (vazia e aceita para produto sem lote; recebido: ${typeof input.controle}). Nenhuma chamada foi feita.`,
        'VALIDATION_ERROR',
      );
    }

    const fields = [...CAMPOS_BIPAR];
    await this.dataset.save({
      entityName: 'DetalhesConferencia',
      fields,
      records: [
        datasetRecord(fields, {
          set: {
            NUCONF: String(input.nuconf),
            SEQCONF: String(input.seqConf),
            CODPROD: String(input.codProd),
            CODVOL: input.codVol,
            QTDCONF: String(input.qtdConf),
            CODBARRA: input.codBarra,
            CONTROLE: input.controle,
          },
        }),
      ],
    });
  }

  /**
   * Fecha a conferencia: `DHFINCONF` + `STATUS='F'`, por `pk` do `NUCONF`.
   *
   * `STATUS='F'` e condicao **necessaria** para a nota entrar em ordem de carga
   * (medido: 60.527 notas com ordem de carga em 90 dias, 100% com `F`, zero
   * excecoes); conferencia divergente (`D`) nao entra.
   *
   * Fechar **nao** grava `TGFCAB.NUCONFATUAL` (M112): o ponteiro e sempre
   * escrita explicita — `apontarNaNota` (E1).
   *
   * @param input - NUCONF e `DHFINCONF` (`dd/MM/yyyy HH:mm:ss`).
   * @param input.nuconf - Conferencia a fechar (inteiro positivo).
   * @param input.dataHora - `DHFINCONF` ja formatada.
   * @returns Nada.
   * @throws {SankhyaError} `VALIDATION_ERROR` se `nuconf` nao for inteiro
   * positivo ou `dataHora` vier vazia — antes da rede.
   * @throws {GatewayError} Em erro de negocio Sankhya.
   * @throws {AuthError} Se autenticacao falhar.
   * @example
   * ```ts
   * await sankhya.conferencia.fechar({ nuconf: 281956, dataHora: '06/09/2026 13:10:00' });
   * ```
   */
  async fechar(input: FecharConferenciaInput): Promise<void> {
    assertInteiroPositivo(input.nuconf, 'conferencia.fechar: nuconf');
    assertTextoPreenchido(input.dataHora, 'conferencia.fechar: dataHora');

    const fields = [...CAMPOS_FECHAR];
    await this.dataset.save({
      entityName: 'CabecalhoConferencia',
      fields,
      records: [
        datasetRecord(fields, {
          pk: { NUCONF: String(input.nuconf) },
          set: { DHFINCONF: input.dataHora, STATUS: 'F' },
        }),
      ],
    });
  }

  /**
   * **E1 (M107)** — aponta uma conferencia no `NUCONFATUAL` da nota
   * (`CabecalhoNota`).
   *
   * A FK `FK_TGFCAB_TGFCON2` so exige que o `NUCONF` exista, sem reciprocidade:
   * a 1101 pode apontar a conferencia do pedido. **Mas E1 sozinha deixa a
   * conferencia invisivel** a qualquer consulta que case
   * `TGFCON2.NUNOTAORIG = TGFCAB.NUNOTA` — e como o ERP enxerga conferencia.
   * Reaproveitar a conferencia do pedido na 1101 custa **E1 + E2** (M109), e o
   * par **apaga o vinculo com o pedido** (a `NUNOTAORIG` passa a ser a da nota).
   * O padrao nativo e abrir a conferencia com `NUNOTAORIG` = a propria nota:
   * 280.471 de 280.474 notas com `NUCONFATUAL` resolvivel fazem isso.
   *
   * @param input - NUNOTA que recebe o ponteiro e NUCONF apontado.
   * @param input.nunota - Nota alvo (inteiro positivo).
   * @param input.nuconf - Conferencia existente (inteiro positivo).
   * @returns Nada.
   * @throws {SankhyaError} `VALIDATION_ERROR` se algum identificador nao for
   * inteiro positivo — antes da rede.
   * @throws {GatewayError} Em erro de negocio Sankhya.
   * @throws {AuthError} Se autenticacao falhar.
   * @example
   * ```ts
   * await sankhya.conferencia.apontarNaNota({ nunota: 1889349, nuconf: 281956 });
   * await sankhya.conferencia.reapontarOrigem({ nuconf: 281956, nunota: 1889349 }); // o par
   * ```
   */
  async apontarNaNota(input: ApontarNaNotaInput): Promise<void> {
    assertInteiroPositivo(input.nunota, 'conferencia.apontarNaNota: nunota');
    assertInteiroPositivo(input.nuconf, 'conferencia.apontarNaNota: nuconf');

    const fields = [...CAMPOS_E1];
    await this.dataset.save({
      entityName: 'CabecalhoNota',
      fields,
      records: [
        datasetRecord(fields, {
          pk: { NUNOTA: String(input.nunota) },
          set: { NUCONFATUAL: String(input.nuconf) },
        }),
      ],
    });
  }

  /**
   * **E2 (M108)** — move a `NUNOTAORIG` da conferencia para outra nota
   * (`CabecalhoConferencia`).
   *
   * Entidade **diferente** da E1 de proposito: E1 escreve na nota
   * (`NUCONFATUAL`), E2 escreve na conferencia (`NUNOTAORIG`). Aceita
   * conferencia ja fechada (`F`) com item bipado. **O vinculo com o documento
   * anterior se perde** — `NUCONFORIG` fica nulo apos o E2 (a). Sem a E1, a
   * nota continua sem `NUCONFATUAL`.
   *
   * @param input - NUCONF a reapontar e NUNOTA que passa a ser a origem.
   * @param input.nuconf - Conferencia existente (inteiro positivo).
   * @param input.nunota - Nova `NUNOTAORIG` (inteiro positivo).
   * @returns Nada.
   * @throws {SankhyaError} `VALIDATION_ERROR` se algum identificador nao for
   * inteiro positivo — antes da rede.
   * @throws {GatewayError} Em erro de negocio Sankhya.
   * @throws {AuthError} Se autenticacao falhar.
   * @example
   * ```ts
   * await sankhya.conferencia.reapontarOrigem({ nuconf: 281956, nunota: 1889349 });
   * ```
   */
  async reapontarOrigem(input: ReapontarOrigemInput): Promise<void> {
    assertInteiroPositivo(input.nuconf, 'conferencia.reapontarOrigem: nuconf');
    assertInteiroPositivo(input.nunota, 'conferencia.reapontarOrigem: nunota');

    const fields = [...CAMPOS_E2];
    await this.dataset.save({
      entityName: 'CabecalhoConferencia',
      fields,
      records: [
        datasetRecord(fields, {
          pk: { NUCONF: String(input.nuconf) },
          set: { NUNOTAORIG: String(input.nunota) },
        }),
      ],
    });
  }

  /**
   * Lista as conferencias de uma nota por `TGFCON2.NUNOTAORIG`.
   *
   * Leitura que sustenta o guard de duplicata de `abrir` (M110) e a unica
   * consulta que ve uma conferencia "de verdade": conferencia apontada apenas
   * por `NUCONFATUAL` (E1 sem E2) **nao** aparece aqui, por definicao.
   *
   * @param nunota - NUNOTA (inteiro positivo; interpolado no SQL apos validar).
   * @returns Conferencias em ordem crescente de `NUCONF`; `[]` se nao houver.
   * @throws {SankhyaError} `VALIDATION_ERROR` se `nunota` nao for inteiro
   * positivo — antes da rede.
   * @throws {GatewayError} Em erro de negocio Sankhya.
   * @throws {AuthError} Se autenticacao falhar.
   * @example
   * ```ts
   * const conferencias = await sankhya.conferencia.listarPorNota(1889338);
   * ```
   */
  async listarPorNota(nunota: number): Promise<ConferenciaDaNota[]> {
    assertInteiroPositivo(nunota, 'conferencia.listarPorNota: nunota');

    const rows = await this.dbExplorer.query<{ NUCONF: string; STATUS: string }>(
      `SELECT TO_CHAR(K.NUCONF) NUCONF, K.STATUS FROM TGFCON2 K WHERE K.NUNOTAORIG = ${nunota} ORDER BY K.NUCONF`,
    );

    return rows.map((row) => ({ nuconf: Number(row.NUCONF), status: row.STATUS }));
  }

  /**
   * Guard de carimbo (M76): lanca se a nota nao tiver `AD_DTHRSEPARACAO`.
   *
   * Roda **antes** de qualquer escrita de `abrir`. Linha ausente conta como sem
   * carimbo — nao deriva "nota inexistente" de leitura vazia (I4), so recusa
   * abrir sem a prova do carimbo (fail-closed, G9).
   *
   * @throws {SankhyaError} `CONFERENCIA_SEM_CARIMBO`, citando `carimbarSeparacao`.
   */
  private async assertCarimbada(nunota: number): Promise<void> {
    const rows = await this.dbExplorer.query<CarimboReadRow>(
      `SELECT TO_CHAR(C.AD_DTHRSEPARACAO,'DD/MM/YYYY HH24:MI:SS') AD_DTHRSEPARACAO, TO_CHAR(C.NUNOTA) NUNOTA FROM TGFCAB C WHERE C.NUNOTA = ${nunota}`,
    );

    const carimbo = rows[0]?.AD_DTHRSEPARACAO ?? '';
    if (carimbo.trim() === '') {
      throw new SankhyaError(
        `conferencia.abrir: a nota ${nunota} nao tem AD_DTHRSEPARACAO. O gatilho TRG_B_I_TGFCON2_TRUE recusaria o INSERT (ORA-20101, M76) — chame carimbarSeparacao antes. Nenhuma escrita foi feita.`,
        'CONFERENCIA_SEM_CARIMBO',
      );
    }
  }
}
