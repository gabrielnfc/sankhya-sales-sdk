# sankhya.faturamento

Faturamento de pedido de venda pelo wizard, com **guard de estado antes** e **prova por
read-back depois**.

**API Layer:** Gateway + DbExplorer
**Módulo:** MGECOM
**Serviço:** `SelecaoDocumentoSP.faturar`
**Novo em:** 1.6.0

> `faturar` é escrita e está fora da allowlist de idempotentes
> (`src/core/http.ts:8-10`): não é retentado automaticamente.

---

## Métodos

### `faturar(input, options?)`

```typescript
sankhya.faturamento.faturar(
  input: FaturarInput,
  options?: RequestOptions,
): Promise<FaturarResult>
```

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| `nunotaPedido` | `number` | Sim | NUNOTA do **pedido**. Inteiro positivo, validado antes de qualquer consulta |
| `codigoTipoOperacao` | `number` | Sim | TOP de faturamento (ex.: `1101`). Inteiro positivo |
| `serie` | `string` | Não (default `'1'`) | Série da nota gerada (medida em M49) |

**Retorno (`FaturarResult`):**

| Campo | Tipo | O que é |
|---|---|---|
| `faturado` | `boolean` | `true` **só** quando ESTA chamada gerou a nota |
| `nunotaNota` | `number \| null` | NUNOTA da nota, **sempre lida em `TGFVAR`**; `null` quando não há nota |
| `motivo` | `FaturarMotivo` | `'FATURADO'` · `'JA_FATURADO'` · `'NAO_PENDENTE'` |

```typescript
const r = await sankhya.faturamento.faturar({ nunotaPedido: 1889309, codigoTipoOperacao: 1101 });
if (r.nunotaNota === null) console.log('nada foi faturado:', r.motivo);
```

Pedido que **já estava** faturado devolve `faturado: false` com `nunotaNota` preenchido:
o chamador tem a 1101 sem poder confundi-la com um faturamento novo.

**Erros:**

| Código | Quando |
|---|---|
| `VALIDATION_ERROR` | algum inteiro inválido — **antes de qualquer consulta** |
| `FATURAR_DESFECHO_INDETERMINADO` | o gateway aceitou (ou recusou por "não pendente") e `TGFVAR` não mostra nota |
| `FATURAR_VAR_INVALIDA` | o read-back devolveu coluna não numérica |
| `TimeoutError` | o gateway não respondeu **e** o read-back seguiu vazio (o erro original sobe como veio) |
| `GATEWAY_ERROR` | erro de negócio que não seja a recusa conhecida |

---

### `consultarVar(nunotaPedido, options?)`

Lê os vínculos pedido → nota em `TGFVAR` — a prova do faturamento.

```typescript
sankhya.faturamento.consultarVar(
  nunotaPedido: number,
  options?: RequestOptions,
): Promise<VarLinha[]>
```

**Retorno:** uma entrada por linha, com `nunota`, `sequencia`, `sequenciaOrig` e
`qtdAtendida` já convertidos para número; `[]` quando o pedido não gerou nota.

```typescript
const vinculos = await sankhya.faturamento.consultarVar(1889309);
if (vinculos.length > 0) console.log('ja faturado na nota', vinculos[0].nunota);
```

SQL derivado do read-back medido (`spike-raw/faturamento/ped.ts:18`, `RB_VAR`):

```sql
SELECT V.NUNOTA, V.SEQUENCIA, V.SEQUENCIAORIG, V.QTDATENDIDA
FROM TGFVAR V JOIN TGFCAB C ON C.NUNOTA = V.NUNOTA
WHERE V.NUNOTAORIG = <nunotaPedido>
```

O `JOIN TGFCAB` é o da medição e fica: garante que a nota apontada por `TGFVAR.NUNOTA`
**existe** — vínculo órfão não conta como faturamento.

`NUNOTA`, `SEQUENCIA` e `SEQUENCIAORIG` exigem **inteiro positivo**; `QTDATENDIDA` pode ser
fracionária. Célula ausente, vazia ou não numérica **lança** `FATURAR_VAR_INVALIDA` em vez
de virar `0` ou `NaN` — um `NaN` vazaria para `nunotaNota` e o chamador confirmaria a nota
errada (I11).

---

## O que o ERP exige

### A ordem, toda medida no spike S2

1. **`TGFVAR` por `NUNOTAORIG`** — já tem linha? `JA_FATURADO`, **sem rede**.
2. **`TGFCAB.PENDENTE` por `NUNOTA`** — `<> 'S'`? `NAO_PENDENTE`, **sem rede**.
3. **`SelecaoDocumentoSP.faturar`** com o corpo de `buildFaturarWizardPayload`.
4. **`TGFVAR` de novo** — a linha é a **única** prova de que a nota nasceu (I3).

### Os dois guards são necessários juntos (M81)

`TGFVAR` vazio não basta: o pedido pode não estar pendente por outro motivo, e o ERP
recusaria. `PENDENTE='S'` não basta: o flag é **reversível** — a 1101 pode ser excluída e
ele volta. Faturar duas vezes um pedido que já gerou nota é o dano que este guard existe
para evitar.

Linha ausente em `TGFCAB` conta como **não pendente**: leitura vazia não vira "pode
faturar" (I4, G2).

### A recusa conhecida não decide sozinha (M79)

```
O pedido 255607 não esta pendente.
```

Medido em `spike-raw/faturamento/attempts.ndjson:16`, `n: 6`, label
`S2_FATURAR_2_IDENTICO`. A regex é **ancorada nas duas pontas**
(`src/resources/faturamento.ts:42`), no mesmo padrão de `notas.confirmar`: uma regex larga
aceitaria `Erro ao faturar: o item X nao esta pendente. Estoque insuficiente.` — um erro
virando sucesso.

E casar a mensagem **não decide nada sozinho**, porque a idempotência do faturamento é
reversível:

| Situação | Desfecho |
|---|---|
| recusa "não pendente" **com** linha em `TGFVAR` | `JA_FATURADO` |
| recusa "não pendente" **sem** linha em `TGFVAR` | lança `FATURAR_DESFECHO_INDETERMINADO` — o ERP diz que não há o que faturar e o banco não mostra nota: "não sei" nunca vira sucesso (fail-closed, G9) |
| camada `TIMEOUT` **com** linha em `TGFVAR` | `FATURADO` — o comando foi executado no servidor |
| camada `TIMEOUT` **sem** linha | o erro original sobe **como veio** |
| `NEGOCIO`/`AUTH_FAIL` fora da recusa conhecida | o erro original sobe cru |
| HTTP 200 **sem** linha em `TGFVAR` | lança `FATURAR_DESFECHO_INDETERMINADO` — HTTP 200 não é prova (I3) |

### O payload do wizard: 16 chaves, com booleano em STRING

O corpo vem inteiro de `buildFaturarWizardPayload` (`src/core/faturamento-payload.ts`),
**fonte única** — nenhum outro lugar do SDK monta este corpo. As 16 chaves estão medidas
em `spike-raw/faturamento/S2_FATURAR_1.json` + `attempts.ndjson` (`ok: true`, 06/09 12:03):

```jsonc
{ "notas": {
  "codTipOper": "1101", "dtFaturamento": "", "serie": "1",
  "tipoFaturamento": "FaturamentoNormal", "dataValidada": "true",
  "notasComMoeda": {}, "nota": [{ "$": "1889309" }],
  "codLocalDestino": "", "faturarTodosItens": "true", "umaNotaParaCada": "false",
  "ehWizardFaturamento": "true", "dtFixaVenc": "", "ehPedidoWeb": "false",
  "nfeDevolucaoViaRecusa": "false", "serieNFDevolucao": "", "ehJejum": "false"
} }
```

- `nota` é um **ARRAY** de `{ $: '<NUNOTA>' }`; objeto único é recusado.
- `notasComMoeda` é `{}`; omitir a chave faz o 4midware recusar.
- os booleanos são **STRING** (`'true'`/`'false'`), não booleano de verdade.
- `dtFaturamento: ''` faz o wizard usar a data corrente do ERP.

> **Faturamento parcial não existe (M82).** `faturarTodosItens: false` **lança antes de
> qualquer chamada de rede** — 0 de 4 formas testadas geraram a 1101.

---

## Qual faturar usar

Os dois chamam o mesmo serviço com o mesmo corpo (a fonte única é
`buildFaturarWizardPayload`), mas são contratos diferentes e ambos ficam:

| Use | Quando |
|---|---|
| [`pedidos.faturar`](./pedidos.md#faturarinput) | quer o **disparo cru**, sem consulta ao banco |
| `faturamento.faturar` | quer o **guard** e a **prova**: lê `TGFVAR` e `TGFCAB.PENDENTE` antes de mandar e devolve a NUNOTA lida no banco depois |

---

## Limite declarado (b)

**`dtFaturamento` PREENCHIDO nunca foi medido** (D-10, emenda de 2026-09-11). Todas as
medições usam `''`. A lane de integração não consegue medi-lo: ela nunca fatura — objeto
em `STATUSNOTA='L'` vira resíduo permanente no sandbox. Passar uma data em
`FaturarPedidoInput.dataFaturamento` é caminho **não medido**.

---

## Links

- [Tipos: `FaturarInput`, `FaturarResult`, `FaturarMotivo`, `VarLinha`](./tipos.md#faturamento)
- [Notas (mesma regra de read-back)](./notas.md)
- [Pedidos](./pedidos.md)
- [DbExplorer](./db-explorer.md)
- [SankhyaClient](./cliente-sdk.md)
