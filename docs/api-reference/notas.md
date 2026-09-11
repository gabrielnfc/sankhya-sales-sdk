# sankhya.notas

Confirmação, exclusão e cancelamento de notas e pedidos via Gateway `CACSP` — com a
idempotência e a prova por read-back que o ERP **não** dá de graça.

**API Layer:** Gateway
**Módulo:** MGECOM
**Serviços:** `CACSP.confirmarNota`, `CACSP.excluirNotas`, `CACSP.cancelarNota`
**Novo em:** 1.6.0

> **Os três métodos são escrita** e estão fora da allowlist de idempotentes
> (`src/core/http.ts:8-10`): nenhum é retentado automaticamente.

---

## Métodos

### `confirmar(nunota, options?)`

Confirma uma nota/pedido, de forma **idempotente**.

```typescript
sankhya.notas.confirmar(
  nunota: number,
  options?: RequestOptions,
): Promise<ConfirmarNotaResult>
```

| Parâmetro | Tipo | Obrigatório | Descrição |
|-----------|------|-------------|-----------|
| `nunota` | `number` | Sim | NUNOTA — **inteiro positivo**, validado antes da rede |
| `options` | `RequestOptions` | Não | `timeout`, `signal` |

**Retorno:** `{ confirmada: true; jaEstavaConfirmada: boolean }`. `confirmada` é sempre
`true` — o método ou resolve confirmado, ou lança.

```typescript
const r = await sankhya.notas.confirmar(1889309);
if (r.jaEstavaConfirmada) console.log('nada a fazer');
```

**Erros:** `VALIDATION_ERROR` (NUNOTA não inteiro positivo, antes da rede) ·
`GATEWAY_ERROR` em erro de negócio que **não** seja o de idempotência · `AUTH_ERROR`.
Qualquer erro que não seja o de idempotência passa por `classifyFailure` (a camada vai
para o log) e é **re-lançado como veio** — envolver o erro esconderia `tsErrorCode`.

---

### `excluir(nunotas, options?)`

Exclui notas/pedidos.

```typescript
sankhya.notas.excluir(
  nunotas: readonly number[],
  options?: RequestOptions,
): Promise<void>
```

| Parâmetro | Tipo | Obrigatório | Descrição |
|-----------|------|-------------|-----------|
| `nunotas` | `readonly number[]` | Sim | Ao menos um; todos inteiros positivos |

```typescript
await sankhya.notas.excluir([1889304, 1889305]);
```

**Erros:** `VALIDATION_ERROR` se a lista vier vazia ou algum NUNOTA não for inteiro
positivo — nesse caso **nenhuma chamada é feita** · `GATEWAY_ERROR` · `AUTH_ERROR`.

> **Falha de camada `TIMEOUT` é re-lançada como veio, acompanhada de um `warn`** dizendo
> que a exclusão **pode ter sido executada** no servidor. Aqui não há read-back barato:
> a prova seria a **ausência** da nota, e ausência de dado não é dado ausente (I4).
> Confira em `TGFCAB` antes de repetir.

---

### `cancelar(input, options?)`

Cancela uma nota e **prova o efeito por read-back**.

```typescript
sankhya.notas.cancelar(
  input: CancelarNotaInput,
  options?: RequestOptions,
): Promise<CancelarNotaResult>
```

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| `nunota` | `number` | Sim | Inteiro positivo |
| `justificativa` | `string` | Sim | Não vazia — vai para `TGFCAN.MOTCANCEL` e é o único rastro do cancelamento |

**Retorno (`CancelarNotaResult`):**

| Campo | Tipo | O que é |
|---|---|---|
| `totalNotasCanceladas` | `number` | O que o **Gateway disse**; `0` se ausente |
| `gerouRecebimento` | `boolean` | O que o **Gateway disse**; `false` se ausente |
| `confirmadoPorReadBack` | `boolean` | O que o **banco mostra** — **a única prova** |
| `statusNfe` | `string \| null` | `TGFCAB.STATUSNFE` da linha lida; `null` se ausente ou vazia |
| `avisoRespostaGateway` | `string?` | Presente **só** quando a resposta do gateway não chegou e o estado veio do read-back |

```typescript
const r = await sankhya.notas.cancelar({ nunota: 1889277, justificativa: 'devolucao' });
if (!r.confirmadoPorReadBack) throw new Error('cancelamento nao aconteceu');
```

**Erros:**

| Código | Quando |
|---|---|
| `VALIDATION_ERROR` | `nunota` não inteiro positivo ou `justificativa` vazia — antes da rede |
| `CANCELAR_NOTA_READ_BACK_INDISPONIVEL` | o read-back falhou **depois** do comando ter sido enviado |
| `CANCELAR_NOTA_DESFECHO_INDETERMINADO` | a resposta do gateway faltou **e** o read-back não achou linha |
| `PARSE_ERROR` | `totalNotasCanceladas` veio com valor não numérico |

---

## O que o ERP exige

### `confirmarNota`: "já confirmada" é sucesso, e só esta forma (M80)

Nota já confirmada responde, literalmente:

```
A nota 1889308 já foi confirmada.
```

Medido em `spike-raw/faturamento/attempts.ndjson`, `n: 4`, label
`S3_CONFIRMAR_1101_2_IDENTICO`, `service: CACSP.confirmarNota` — **com zero efeito
colateral**. O SDK trata isso como sucesso equivalente.

O reconhecimento tem **três** condições, todas necessárias: o erro é um `GatewayError`
(HTTP 200 com recusa no corpo — um `TimeoutError` com o mesmo texto é desfecho
desconhecido, não sucesso), veio **deste** serviço, e a mensagem casa a forma inteira.
A regex é **ancorada nas duas pontas** (`src/resources/notas.ts:32`): uma regex larga
como `/ja foi/` aceitaria `A nota 1 ja foi cancelada.` ou
`Erro ao gravar: A nota 1 ja foi confirmada. Verifique o estoque.` — um erro virando
sucesso. Tolera apenas o que o Gateway não garante: o acento em `ja`/`já`, o ponto final
e a caixa.

### `excluirNotas`: um único formato aceito (M73)

```jsonc
{ "notas": { "nota": [{ "NUNOTA": "1889304" }] } }
```

Lista sob `nota`, NUNOTA em **string**. Formatos alternativos (`notas.NUNOTA[]`, lista na
raiz) foram medidos e **recusados** — não invente variante.

> **Para pedido de venda (TOP 1001) confirmado, exclusão é o caminho real de desfazer**
> — não `cancelarNota` (M73/M95).

### `cancelarNota`: HTTP 200 cancelando zero (M75/M94)

A resposta é **aninhada**, e os campos vêm como string
(`spike-raw/cancelamento/C5_CANCELARNOTA_1101_V7.json`):

```jsonc
{ "resultadoCancelamento": { "totalNotasCanceladas": "0", "gerouRecebimento": "false" } }
```

Ler `totalNotasCanceladas` da **raiz** devolve `undefined` para sempre — e mascararia um
cancelamento bem-sucedido. Por isso o número do Gateway é informativo e
`confirmadoPorReadBack` é a prova (I3): o SDK sempre consulta

```sql
SELECT CAN.NUNOTA, CAB.STATUSNFE
FROM TGFCAN CAN LEFT JOIN TGFCAB CAB ON CAB.NUNOTA = CAN.NUNOTA
WHERE CAN.NUNOTA = <nunota>
```

O `LEFT JOIN` parte de `TGFCAN` de propósito: a existência da linha **em TGFCAN** é o que
prova o cancelamento; `STATUSNFE` é contexto da NFe e pode faltar.

### Como `cancelar` decide quando o gateway não responde (RD-4)

| Camada da falha (`classifyFailure`) | O que acontece |
|---|---|
| `NEGOCIO` / `AUTH_FAIL` | propaga cru — o comando não foi aceito, não há o que consultar, e não gasta uma consulta |
| `TIMEOUT` | **não** propaga: o cancelamento pode ter sido executado (I11/R8). O resultado vem do banco e traz `avisoRespostaGateway` |
| `TIMEOUT` **e** read-back sem linha | lança `CANCELAR_NOTA_DESFECHO_INDETERMINADO` — devolver `confirmadoPorReadBack: false` leria como "não cancelou", quando o correto é "não sei" (fail-closed, G9) |

---

## Qual confirmar usar

Os dois chamam `CACSP.confirmarNota`, mas são contratos diferentes e **ambos ficam** nesta
versão (D-09, a decisão de qual morre é posterior):

| Use | Quando |
|---|---|
| [`pedidos.confirmar`](./pedidos.md#confirmarinput--crítico) | precisa do **corpo** da resposta (avisos e `liberacoes` normalizadas) e quer que "já confirmada" seja **erro** |
| `notas.confirmar` | quer **idempotência** (M80): nota já confirmada resolve com `jaEstavaConfirmada: true` — o que um retry ou uma reexecução de fila precisa |

---

## Links

- [Tipos: `ConfirmarNotaResult`, `CancelarNotaInput`, `CancelarNotaResult`](./tipos.md#notas)
- [Faturamento (mesma regra de read-back)](./faturamento.md)
- [Pedidos](./pedidos.md)
- [SankhyaClient](./cliente-sdk.md)
