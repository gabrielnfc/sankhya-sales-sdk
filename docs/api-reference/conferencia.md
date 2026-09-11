# sankhya.conferencia

Conferência nativa do Sankhya (`TGFCON2` / `TGFCOI2`) pelo `DatasetSP` do Gateway.

**API Layer:** Gateway (Dataset + DbExplorer)
**Módulo:** MGE
**Novo em:** 1.6.0

> **A REST v1 não tem endpoint de conferência.** O único caminho é o Dataset sobre as
> entidades MGE `CabecalhoConferencia` (`TGFCON2`) e `DetalhesConferencia` (`TGFCOI2`) —
> `TGFCON`/`TGFCOI` são a versão antiga e vazia, não use.

**Ciclo:** `carimbarSeparacao` → `abrir` → `bipar` (n×) → `fechar`.

Nenhum método daqui é retentado automaticamente: `DatasetSP.save` é escrita e está fora
da allowlist de idempotentes (`src/core/http.ts:8-10`).

---

## Métodos

### `carimbarSeparacao(input)`

Carimba a separação na nota (`AD_DTHRSEPARACAO` + `AD_NOMESEPARADOR`).

```typescript
sankhya.conferencia.carimbarSeparacao(input: CarimbarSeparacaoInput): Promise<void>
```

| Campo | Tipo | Descrição |
|---|---|---|
| `nunota` | `number` | NUNOTA da nota/pedido (inteiro positivo) |
| `dataHora` | `string` | `dd/MM/yyyy HH:mm:ss` já formatada — **o SDK não formata data** |
| `nomeSeparador` | `string` | Vai para `AD_NOMESEPARADOR` |

```typescript
await sankhya.conferencia.carimbarSeparacao({
  nunota: 1889338,
  dataHora: '06/09/2026 12:55:34',
  nomeSeparador: 'JOAO',
});
```

**Não é passo opcional:** é pré-condição de `abrir` (M76). A 1101 gerada por
`faturamento.faturar` **herda** o carimbo do pedido (M111) — conferir nela não exige um
segundo carimbo.

---

### `abrir(input)`

Abre a conferência da nota (`STATUS='A'`) e devolve o `NUCONF` gerado.

```typescript
sankhya.conferencia.abrir(input: AbrirConferenciaInput): Promise<{ nuconf: number }>
```

| Campo | Tipo | Descrição |
|---|---|---|
| `nunota` | `number` | Vira `NUNOTAORIG` (inteiro positivo) |
| `codUsuConf` | `number` | `CODUSUCONF` — usuário Sankhya (inteiro positivo) |
| `dataHora` | `string` | `DHINICONF` já formatada |

```typescript
const { nuconf } = await sankhya.conferencia.abrir({
  nunota: 1889348, codUsuConf: 69, dataHora: '06/09/2026 12:55:34',
});
```

**Ordem obrigatória, verificada em teste:** carimbo (M76) → duplicata (M110) → escrita.
Os dois guards rodam **antes** de qualquer `save`; escrever primeiro transformaria uma
recusa em conferência órfã no ERP.

O registro vai **sem** `NUCONF` em `values` (inserção, M88): o número é auto-gerado
(`TIPONUMERACAO='A'`) e volta em `result[0][0]`.

**Erros:** `VALIDATION_ERROR` · `CONFERENCIA_SEM_CARIMBO` (chame `carimbarSeparacao`
antes) · `CONFERENCIA_DUPLICADA` (citando o `NUCONF` existente) ·
`CONFERENCIA_NUCONF_AUSENTE` (o `save` não devolveu NUCONF utilizável). Nos três
primeiros casos **nenhuma escrita foi feita**.

---

### `bipar(input)`

Grava um item bipado em `DetalhesConferencia`.

```typescript
sankhya.conferencia.bipar(input: BiparInput): Promise<void>
```

| Campo | Tipo | Descrição |
|---|---|---|
| `nuconf` | `number` | Conferência aberta (inteiro positivo) |
| `seqConf` | `number` | `SEQCONF` do item (inteiro positivo) |
| `codProd` | `number` | `CODPROD` (inteiro positivo) |
| `codVol` | `string` | `CODVOL` (ex.: `'UN'`), não vazio |
| `qtdConf` | `number` | `QTDCONF` — finita e **maior que zero** |
| `codBarra` | `string` | `CODBARRA` efetivamente bipado, não vazio |
| `controle` | `string` | Lote. **String vazia é aceita** (produto sem controle de lote) |

```typescript
await sankhya.conferencia.bipar({
  nuconf: 281956, seqConf: 1, codProd: 10077, codVol: 'UN',
  qtdConf: 1, codBarra: '040141160911', controle: 'L-2026-07',
});
```

`CONTROLE` vai **no mesmo save**: o lote persiste em `TGFCOI2` (M38), e não há um segundo
passo para ele. `CODBARRA` guarda o EAN que foi bipado de fato — não o EAN principal do
cadastro.

---

### `fechar(input)`

Fecha a conferência: `DHFINCONF` + `STATUS='F'`, por `pk` do `NUCONF`.

```typescript
sankhya.conferencia.fechar(input: FecharConferenciaInput): Promise<void>
```

```typescript
await sankhya.conferencia.fechar({ nuconf: 281956, dataHora: '06/09/2026 13:10:00' });
```

`STATUS='F'` é condição **necessária** para a nota entrar em ordem de carga (medido:
60.527 notas com ordem de carga em 90 dias, 100% com `F`, zero exceções); conferência
divergente (`D`) não entra.

> **Fechar NÃO grava `TGFCAB.NUCONFATUAL` (M112).** O ponteiro é sempre escrita
> explícita — `apontarNaNota` (E1).

---

### `apontarNaNota(input)` — E1 (M107)

Aponta uma conferência no `NUCONFATUAL` da nota (escreve em `CabecalhoNota`).

```typescript
sankhya.conferencia.apontarNaNota(input: { nunota: number; nuconf: number }): Promise<void>
```

### `reapontarOrigem(input)` — E2 (M108)

Move a `NUNOTAORIG` da conferência para outra nota (escreve em `CabecalhoConferencia`).

```typescript
sankhya.conferencia.reapontarOrigem(input: { nuconf: number; nunota: number }): Promise<void>
```

**Entidades diferentes de propósito:** E1 escreve na nota, E2 escreve na conferência.

```typescript
// reaproveitar a conferência do pedido na 1101 custa O PAR (M109)
await sankhya.conferencia.apontarNaNota({ nunota: 1889349, nuconf: 281956 });
await sankhya.conferencia.reapontarOrigem({ nuconf: 281956, nunota: 1889349 });
```

> **E1 sozinha deixa a conferência invisível** a qualquer consulta que case
> `TGFCON2.NUNOTAORIG = TGFCAB.NUNOTA` — que é como o ERP enxerga conferência. A FK
> `FK_TGFCAB_TGFCON2` só exige que o `NUCONF` exista, sem reciprocidade.
>
> **E o par apaga o vínculo com o documento anterior:** depois da E2 a `NUNOTAORIG` passa a
> ser a da nota e `NUCONFORIG` fica nulo. O padrão nativo é abrir a conferência com
> `NUNOTAORIG` = a própria nota: 280.471 de 280.474 notas com `NUCONFATUAL` resolvível
> fazem isso.
>
> E2 aceita conferência já fechada (`F`) com item bipado.

---

### `listarPorNota(nunota)`

Lista as conferências de uma nota por `TGFCON2.NUNOTAORIG`.

```typescript
sankhya.conferencia.listarPorNota(nunota: number): Promise<ConferenciaDaNota[]>
```

**Retorno:** `{ nuconf: number; status: string }[]` em ordem crescente de `NUCONF`; `[]`
se não houver. `status` vem como o ERP manda (`A` aberta, `F` finalizada, `D` divergente…).

```typescript
const conferencias = await sankhya.conferencia.listarPorNota(1889338);
```

É a leitura que sustenta o guard de duplicata de `abrir`, e a única consulta que vê uma
conferência "de verdade": conferência apontada apenas por `NUCONFATUAL` (E1 sem E2)
**não** aparece aqui, por definição.

`NUCONF` não utilizável lança `CONFERENCIA_NUCONF_INVALIDO` — nenhuma lista parcial é
devolvida, porque um `NaN` aqui viraria filtro de escrita em `bipar`/`fechar`.

---

## O que o ERP exige

### Dois guards que o ERP **não** faz por nós

**Carimbo (M76).** O gatilho `TRG_B_I_TGFCON2_TRUE` recusa o `INSERT` sem
`AD_DTHRSEPARACAO` na nota, com `ORA-20101`. `abrir` lê o carimbo e lança **antes** de
escrever — errar aqui custa uma escrita recusada pelo ERP com mensagem opaca. A coluna é
lida **nua** (`SELECT AD_DTHRSEPARACAO FROM TGFCAB WHERE NUNOTA = <n>`), na forma medida
em `spike-raw/conferencia/C1_RB_P_POS_CONF.json`, que devolveu `'06092026 12:55:34'`:
o guard só precisa de "não nulo", e a `TO_CHAR`-abilidade dessa coluna nunca foi medida.
Linha ausente conta como **sem carimbo** — não deriva "nota inexistente" de leitura vazia
(I4), só recusa abrir sem a prova (fail-closed, G9).

**Duplicata (M110).** O ERP **aceita** uma 2ª conferência para a mesma `NUNOTAORIG` — 236
de 280.645 `NUNOTAORIG` do snapshot têm mais de uma — e `NUCONFATUAL` **não migra** para a
mais recente. O "abrir só se não existir" é guard do SeparaTrue, verificado por
`listarPorNota`.

### O `NUCONF` nunca é inventado

`NUCONF` é auto-gerado e só volta no `result` do `save` — a primeira célula da primeira
linha. Célula ausente, vazia ou não numérica **lança** `CONFERENCIA_NUCONF_AUSENTE`:
devolver `0` seria um NUCONF inventado, que o chamador usaria em `bipar`/`fechar` e
escreveria no registro errado (I11). A mensagem diz que a conferência **pode ter sido
criada** — confira por `listarPorNota` antes de repetir.

### Campos de cada save (fixtures)

| Operação | Entidade | `fields` | Fixture |
|---|---|---|---|
| `carimbarSeparacao` | `CabecalhoNota` | `NUNOTA, AD_DTHRSEPARACAO, AD_NOMESEPARADOR` | `C1_CARIMBO_P.json` |
| `abrir` | `CabecalhoConferencia` | `NUCONF, NUNOTAORIG, DHINICONF, CODUSUCONF, STATUS` | `C1_ABRIR_CONF_P.json` |
| `bipar` | `DetalhesConferencia` | `NUCONF, SEQCONF, CODPROD, CODVOL, QTDCONF, CODBARRA, CONTROLE` | `C1_BIPAR_CONF_P.json` |
| `fechar` | `CabecalhoConferencia` | `NUCONF, DHFINCONF, STATUS` | `C1_FECHAR_CONF_P.json` |
| `apontarNaNota` (E1) | `CabecalhoNota` | `NUNOTA, NUCONFATUAL` | `C3_E1_SET_NUCONFATUAL_N.json` |
| `reapontarOrigem` (E2) | `CabecalhoConferencia` | `NUCONF, NUNOTAORIG` | `C3_E2_SET_NUNOTAORIG_CONF.json` |

Todas em `spike-raw/conferencia/`. Todo `save` usa `datasetRecord` — nunca índice à mão.

---

## Links

- [Tipos: `CarimbarSeparacaoInput`, `AbrirConferenciaInput`, `BiparInput`, `ConferenciaDaNota`](./tipos.md#conferencia)
- [Dataset (o caminho de escrita)](./dataset.md)
- [Faturamento (a 1101 herda o carimbo)](./faturamento.md)
- [SankhyaClient](./cliente-sdk.md)
