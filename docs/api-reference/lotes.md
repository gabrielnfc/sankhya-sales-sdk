# sankhya.lotes

Entrada e baixa de estoque **por lote**, via notas de ajuste montadas no `DatasetSP`.

**API Layer:** Gateway (Dataset)
**Módulo:** MGE
**Novo em:** 1.6.0

> **Nada aqui é retentado automaticamente.** `DatasetSP.save` é escrita e está fora da
> allowlist de idempotentes (`src/core/http.ts:8-10`) — uma reexecução criaria uma segunda
> nota e moveria o estoque duas vezes.

> **R21 vale aqui.** Escrita de saldo exige snapshot, plano de reversão, aprovação e
> read-back. Use [`estoque.porLote`](./estoque.md#porloteinput) para o snapshot e para a
> conferência depois.

---

## Métodos

### `entrada1813(input)`

Dá entrada de N lotes de um produto por nota **TOP 1813**, com validade.

```typescript
sankhya.lotes.entrada1813(input: EntradaLoteInput): Promise<{ nunota: number }>
```

| Campo | Tipo | Descrição |
|---|---|---|
| `codEmp` | `number` | `CODEMP` da nota e da PK de `Estoque` |
| `codLocal` | `number` | `CODLOCALORIG` do item e `CODLOCAL` da PK de `Estoque` |
| `codProd` | `number` | Uma entrada por produto, N lotes |
| `dtNeg` | `string` | `DTNEG` em `dd/MM/yyyy` — o SDK não formata data |
| `observacao` | `string` | `OBSERVACAO`. Use um marcador rastreável em ambiente compartilhado (R12) |
| `itens` | `ReadonlyArray<EntradaLoteItem>` | Lista vazia é recusada antes de qualquer escrita |

`EntradaLoteItem`: `controle` (string preenchida) · `quantidade` (> 0) · `vlrUnit` (>= 0) ·
`dtVal` e `dtFab` (`dd/MM/yyyy`, **obrigatórias**).

```typescript
const { nunota } = await sankhya.lotes.entrada1813({
  codEmp: 2, codLocal: 30301, codProd: 10077,
  dtNeg: '06/09/2026', observacao: 'entrada lote',
  itens: [{ controle: 'L-A', quantidade: 10, vlrUnit: 1, dtVal: '06/09/2027', dtFab: '06/09/2026' }],
});
```

**Erros:** `VALIDATION_ERROR` (campo faltando, `itens` vazio) — nesse caso **nenhuma**
escrita é feita · `LOTES_NUNOTA_AUSENTE` (o `save` não devolveu o NUNOTA) ·
`GATEWAY_ERROR` · `AUTH_ERROR`.

---

### `baixa1811(input)`

Baixa estoque de N locais de um produto por nota de ajuste **TOP 1811**.

```typescript
sankhya.lotes.baixa1811(input: BaixaLoteInput): Promise<{ nunota: number }>
```

| Campo | Tipo | Descrição |
|---|---|---|
| `codEmp` | `number` | Uma nota por empresa (M104) |
| `codProd` | `number` | Uma baixa por produto, N locais |
| `dtNeg` | `string` | `dd/MM/yyyy` |
| `observacao` | `string` | `OBSERVACAO` |
| `itens` | `ReadonlyArray<BaixaLoteItem>` | `codLocal` · `quantidade` (> 0) · `controle?` |

```typescript
const { nunota } = await sankhya.lotes.baixa1811({
  codEmp: 1, codProd: 10015, dtNeg: '06/09/2026', observacao: 'ajuste',
  itens: [{ codLocal: 30201, quantidade: 2 }],
});
```

> **Ou todos os itens informam `controle`, ou nenhum.** O `save` usa um único `fields`;
> mandar `CONTROLE` vazio para parte das linhas jogaria essas linhas no controle
> flutuante `' '` de `TGFEST` (M92). Misturar lança `VALIDATION_ERROR` dizendo em quantos
> de quantos itens o `controle` veio, **sem** nenhuma chamada.

> **A nota de baixa NÃO é confirmada.** Fica em `STATUSNOTA='A'`, e enquanto estiver em
> `A` a baixa é reversível por `CACSP.excluirNotas` (M81/M104) — veja
> [`notas.excluir`](./notas.md#excluirnunotas-options). Confirmar seria fechar a porta de
> volta sem ninguém ter pedido.

---

## O que o ERP exige

### A ordem das 4 escritas da entrada é obrigatória (M97)

```
CabecalhoNota (TOP 1813)
  → ItemNota (ATUALESTOQUE='1', com CONTROLE)
    → Estoque (DTVAL/DTFABRICACAO, PK de 6 colunas)
      → notas.confirmar
```

Confirmar **antes** de gravar as datas é recusado com *"Falta informar Data de Validade
e/ou Data de Fabricação em alguns produtos"* — **e o estoque já se moveu**, porque o
`ItemNota` com `ATUALESTOQUE=1` o moveu antes da recusa. Pior: o estado não se desfaz se
a unidade já estiver reservada (`ORA-20101 ESTOQUE INSUFICIENTE`). Por isso as datas vão
antes.

### A PK de `Estoque` tem 6 colunas (M36/M88)

`CODEMP`, `CODLOCAL`, `CODPROD`, `CONTROLE`, `TIPO`, `CODPARC` — fixture
`spike-raw/faturamento/s1.ts:18`. Reduzir a PK grava na linha errada.

### A TOP de baixa é a 1811, não a 1814 (M100/M101)

A **1814** ("AJUSTE BAIXA DE ESTOQUE - GERENCIAL"), que seria a natural, existe e está
ativa, mas é recusada com `TOP nao encontrada.` para o mesmo payload; a 1811 e a 1815
aceitam. A causa não foi isolada.

> **1811 como TOP de ajuste é decisão do dono/contabilidade; o impacto fiscal não foi
> medido (M100).** Se a escolha mudar, o método vira `baixaAjuste(top)` num follow-up.

### Reserva bloqueia a baixa (M102)

`DISPONÍVEL = ESTOQUE − RESERVADO`. O gatilho `TRG_UPT_TGFEST_AFTER` recusa o `save`
**inteiro** — as outras linhas do mesmo `save` também não se movem. Libere as reservas
antes; a liberação é ordem de negócio sobre pedidos e fica **fora do SDK**.

### Campos e constantes do payload

| Save | `fields` | Fixture |
|---|---|---|
| Cabeçalho (1813 e 1811) | `NUNOTA, NUMNOTA, CODPARC, DTNEG, CODTIPOPER, CODTIPVENDA, CODVEND, CODEMP, TIPMOV, CODNAT, CODCENCUS, OBSERVACAO` | `faturamento/s1.ts:8` · `virada/t05e.ts:6` |
| Item da entrada | os do item + `CONTROLE, ATUALESTOQUE` | `faturamento/s1.ts:14` |
| Item da baixa | `NUNOTA, CODPROD, QTDNEG, VLRUNIT, CODVOL, CODLOCALORIG, ATUALESTOQUE` | `virada/t05e.ts:5` |
| Datas do lote | `CODEMP, CODLOCAL, CODPROD, CONTROLE, TIPO, CODPARC, DTVAL, DTFABRICACAO` | `faturamento/s1.ts:18` |

`NUNOTA` fica no índice 0 e **não** é preenchido: é auto-gerado e volta no `result`
(M88). Célula ausente ou não numérica lança `LOTES_NUNOTA_AUSENTE` — a nota pode ter sido
criada; confira antes de repetir. Nenhum NUNOTA é inventado.

**Constantes do payload, medidas (a) em 06/09/2026** — aparecem literais em payload que o
ERP aceitou (`faturamento/s1.ts:9,15,20`, `virada/t05e.ts:6,9`): `NUMNOTA='0'`,
`CODPARC='0'`, `CODTIPVENDA='0'`, `CODVEND='0'`, `TIPMOV='Q'`, `CODNAT='99010000'`,
`CODCENCUS='204004'`, `CODVOL='UN'`, `TIPO='P'` na PK de `Estoque`.

> **O que é (b) é a GENERALIDADE.** `CODNAT` (natureza) e `CODCENCUS` (centro de custo)
> valem para a empresa daquele sandbox, e nenhuma regra de negócio por trás deles foi
> medida — **confirme com o dono/contabilidade antes de rodar contra outra base**.
> `VLRUNIT='1'` na baixa também é (b): a baixa não tem preço de entrada e o spike usou
> `'1'`.
>
> **Baixa COM lote é (b).** Nenhuma fixture do spike faz baixa informando `CONTROLE`
> (`t05e` baixa sem lote). A posição de `CONTROLE` ao fim de `fields` é escolha nossa;
> o ERP pode exigir outra. Meça antes de usar em produção.

---

## Links

- [Tipos: `EntradaLoteInput`, `BaixaLoteInput`, `NotaDeLoteResult`](./tipos.md#lotes)
- [Estoque por lote (snapshot e read-back)](./estoque.md#porloteinput)
- [Produtos: `setTipoControle` (a virada)](./produtos.md#settipocontroleinput)
- [Dataset (o caminho de escrita)](./dataset.md)
- [Notas (`confirmar` / `excluir`)](./notas.md)
