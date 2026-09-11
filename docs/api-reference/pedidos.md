# sankhya.pedidos

Módulo para gerenciamento completo de pedidos de venda: criar, consultar, atualizar, cancelar, confirmar e faturar.

**API Layer:** REST v1 + Gateway
**Base path:** `/v1/vendas/pedidos`, Gateway MGECOM

---

## Métodos REST v1

### `criar(pedido)`

Inclui um pedido de venda.

```typescript
sankhya.pedidos.criar(pedido: PedidoVendaInput): Promise<{ codigoPedido: number }>
```

> **Importante:** O pedido é criado **SEMPRE com status "A CONFIRMAR"**. Os financeiros são registrados como pendentes, não baixados. Totalizadores do cabeçalho são calculados automaticamente pelo Sankhya com base nos impostos dos itens.

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| `notaModelo` | `number` | Sim | Modelo de nota (define empresa, TOP, natureza) |
| `data` | `string` | Sim | Data de emissão (`dd/mm/aaaa`) |
| `hora` | `string` | Sim | Hora de emissão (`hh:mm:ss`) |
| `codigoVendedor` | `number` | Não | CODVEND |
| `codigoCliente` | `number` | Não | CODPARC (opcional se enviar `cliente`) |
| `cliente` | `Partial<Cliente>` | Não | Objeto cliente (ver regras abaixo) |
| `observacao` | `string` | Não | Observações |
| `valorFrete` | `number` | Não | Frete |
| `valorSeguro` | `number` | Não | Seguro |
| `valorOutros` | `number` | Não | Outros valores |
| `valorTotal` | `number` | Sim | Valor total final |
| `itens` | `ItemPedidoInput[]` | Sim | Itens do pedido |
| `financeiros` | `FinanceiroPedidoInput[]` | Sim | Parcelas/pagamentos |

**Regras do campo `cliente`:**
1. Sem `cliente` e sem `codigoCliente` → usa o CODPARC da nota modelo
2. Com `cliente.cnpjCpf` apenas → tenta localizar o cliente pelo documento
3. Com `cliente` completo → inclui ou atualiza o parceiro automaticamente

**Exemplo:**

```typescript
const { codigoPedido } = await sankhya.pedidos.criar({
  notaModelo: 1,
  data: '01/04/2026',
  hora: '10:00:00',
  codigoCliente: 123,
  codigoVendedor: 10,
  valorTotal: 510.00,
  itens: [
    { codigoProduto: 1001, quantidade: 10, valorUnitario: 25.50, unidade: 'UN' },
    { codigoProduto: 1002, quantidade: 5, valorUnitario: 51.00, unidade: 'UN' },
  ],
  financeiros: [
    { codigoTipoPagamento: 1, valor: 255.00, dataVencimento: '01/05/2026', numeroParcela: 1 },
    { codigoTipoPagamento: 1, valor: 255.00, dataVencimento: '01/06/2026', numeroParcela: 2 },
  ],
});

console.log(`Pedido criado: ${codigoPedido}`);
```

**Endpoint REST:** `POST /v1/vendas/pedidos`

---

### `atualizar(codigoPedido, pedido)`

Atualiza um pedido de venda.

```typescript
sankhya.pedidos.atualizar(
  codigoPedido: number,
  pedido: PedidoVendaInput
): Promise<{ codigoPedido: number }>
```

> **Regra:** A atualização de um pedido já confirmado só é permitida se a TOP do pedido estiver configurada com "Permitir Alteração após Confirmar". Na alteração, **sempre enviar itens e financeiros completos** (substituição total).

**Endpoint REST:** `PUT /v1/vendas/pedidos/{codigoPedido}`

---

### `cancelar(input)`

Cancela um pedido de venda.

```typescript
sankhya.pedidos.cancelar(input: CancelarPedidoInput): Promise<{ codigoPedido: number }>
```

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| `codigoPedido` | `number` | Sim | NUNOTA |
| `motivo` | `string` | Não | Motivo do cancelamento |

> **Regra:** Pedidos já **faturados NÃO serão cancelados**.

**Endpoint REST:** `POST /v1/vendas/pedidos/{codigoPedido}/cancela`

---

### `consultar(params)`

Consulta pedidos de venda com filtros.

```typescript
sankhya.pedidos.consultar(params: ConsultarPedidosParams): Promise<PaginatedResult<PedidoVenda>>
```

| Parâmetro | Tipo | Obrigatório | Descrição |
|-----------|------|-------------|-----------|
| `page` | `number` | Sim | Página (>= 1) |
| `codigoEmpresa` | `number` | **Sim** | CODEMP (escopo obrigatório) |
| `modifiedSince` | `string` | Não | `AAAA-MM-DDTHH:MM:SS` |
| `codigoNota` | `number` | Não | NUNOTA |
| `numeroNota` | `number` | Não | NUMNOTA |
| `serieNota` | `string` | Não | Série da nota |
| `dataNegociacaoInicio` | `string` | Não | `dd/mm/aaaa` |
| `dataNegociacaoFinal` | `string` | Não | `dd/mm/aaaa` |
| `codigoCliente` | `number` | Não | CODPARC |
| `confirmada` | `boolean` | Não | Filtrar confirmadas |
| `pendente` | `boolean` | Não | Filtrar pendentes |
| `codigoNatureza` | `number` | Não | CODNAT |
| `codigoCentroResultado` | `number` | Não | Centro de resultado |
| `codigoProjeto` | `number` | Não | Projeto |
| `codigoOrdemCarga` | `number` | Não | Ordem de carga |

**Exemplo:**

```typescript
const pedidos = await sankhya.pedidos.consultar({
  page: 1,
  codigoEmpresa: 1,
  codigoCliente: 123,
  confirmada: false,
});

for (const pedido of pedidos.data) {
  console.log(`Pedido ${pedido.codigoNota} — R$ ${pedido.valorNota} — Confirmado: ${pedido.confirmada}`);
}
```

**Endpoint REST:** `GET /v1/vendas/pedidos?page={page}&codigoEmpresa={codigoEmpresa}&...`

**Paginação automática:**

```typescript
for await (const page of sankhya.pedidos.consultarTodos({ codigoEmpresa: 1 })) {
  for (const pedido of page.data) { /* ... */ }
}
```

---

## Métodos Gateway

### `confirmar(input)` — CRÍTICO

Confirma um pedido no ERP. **Obrigatório** após criação via REST v1.

```typescript
sankhya.pedidos.confirmar(input: ConfirmarPedidoInput): Promise<ConfirmarPedidoResult>
```

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| `codigoPedido` | `number` | Sim | NUNOTA |
| `compensarAutomaticamente` | `boolean` | Não | Compensar automaticamente (default: false) |

> **Não existe endpoint REST v1** para confirmação. O SDK usa o Gateway
> `CACSP.confirmarNota`.

**Retorno (desde a 1.4.0):** `{ responseBody? }` normalizado — `liberacoes.liberacao`,
objeto ou array, vira SEMPRE `liberacoes: ConfirmarPedidoLiberacao[]`; corpo vazio/ausente
vira `responseBody: undefined`. `status "0"` continua lançando `GatewayError`. Quem
ignorava o retorno `void` anterior segue funcionando.

**Exemplo:**

```typescript
const { responseBody } = await sankhya.pedidos.confirmar({ codigoPedido: 98765 });
if (responseBody?.liberacoes?.length) {
  // a nota ficou STATUSNOTA='A' aguardando liberação de crédito
}
```

**Endpoint Gateway:** `CACSP.confirmarNota` (MGECOM)

**O que a confirmação faz:**
- Gera financeiro no ERP
- Reserva estoque
- Permite faturamento posterior
- Permite cancelamento via ERP

> **Precisa de idempotência?** Use [`notas.confirmar`](./notas.md#confirmarnunota-options):
> nota já confirmada resolve `{ confirmada: true, jaEstavaConfirmada: true }` em vez de
> lançar (M80). As duas portas coexistem nesta versão — veja
> [`notas.confirmar` × `pedidos.confirmar`](./notas.md#qual-confirmar-usar).

---

### `faturar(input)`

Fatura um pedido confirmado. Dispara o wizard **sem consultar o banco**.

```typescript
sankhya.pedidos.faturar(input: FaturarPedidoInput): Promise<void>
```

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| `codigoPedido` | `number` | Sim | NUNOTA. **Inteiro** — mudou na 1.6.0 |
| `codigoTipoOperacao` | `number` | Sim | CODTIPOPER para faturamento. **Inteiro** — mudou na 1.6.0 |
| `dataFaturamento` | `string` | Não | `dd/MM/yyyy`. Omitida ou vazia, o wizard usa a data corrente do ERP (`dtFaturamento: ''` medido em M51) |
| `tipoFaturamento` | `TipoFaturamento` | Não | Default: `FaturamentoNormal` |
| `faturarTodosItens` | `boolean` | Não | Default: `true`. **`false` lança** (M82) |
| `serie` | `string` | Não | Default `'1'` (medida em M49) |
| `codigoLocalDestino` | `string` | Não | `CODLOCALDEST`; default `''` = o do cadastro |
| `umaNotaParaCada` | `boolean` | Não | Default `false` |

> **Aperto de contrato na 1.6.0 (D-11).** `validateFaturarPedidoInput` — que é export
> público — passou a exigir **inteiro** em `codigoPedido` e `codigoTipoOperacao`. Antes
> qualquer número finito passava e `'1.5'` chegava ao payload do ERP.

**Tipos de faturamento:**

| Enum | Valor | Descrição |
|------|-------|-----------|
| `TipoFaturamento.Normal` | `FaturamentoNormal` | Fatura todos os itens |
| `TipoFaturamento.Estoque` | `FaturamentoEstoque` | Apenas itens com estoque |
| `TipoFaturamento.EstoqueDeixandoPendente` | `FaturamentoEstoqueDeixandoPendente` | Fatura estoque, pendencia o resto |
| `TipoFaturamento.Direto` | `FaturamentoDireto` | Faturamento direto |

> **Pré-requisito:** o pedido **deve estar confirmado**.
>
> **Faturamento parcial não existe (M82).** `faturarTodosItens: false` lança
> `VALIDATION_ERROR` antes de qualquer chamada — 0 de 4 formas testadas geraram a 1101.
> Ajuste as quantidades do pedido antes de faturar.

**Exemplo:**

```typescript
import { TipoFaturamento } from 'sankhya-sales-sdk';

await sankhya.pedidos.faturar({
  codigoPedido: 98765,
  codigoTipoOperacao: 1101,
  tipoFaturamento: TipoFaturamento.Normal,
});
```

**Endpoint Gateway:** `SelecaoDocumentoSP.faturar` (MGECOM)

O corpo vem inteiro de `buildFaturarWizardPayload` — as **16 chaves** medidas em
`spike-raw/faturamento/S2_FATURAR_1.json`, com os booleanos em **string** e `nota` como
**array**. A lista está em [faturamento.md](./faturamento.md#o-payload-do-wizard-16-chaves-com-booleano-em-string).

> **Quer guard e prova?** [`faturamento.faturar`](./faturamento.md#faturarinput-options)
> lê `TGFVAR` e `TGFCAB.PENDENTE` **antes** de mandar e devolve a NUNOTA da 1101 lida no
> banco **depois** — o HTTP 200 do Gateway não prova que a nota nasceu (M79/M81).

---

### `incluirNotaGateway(input)`

Inclui pedido/nota via Gateway, no formato aceito pelo 4midware (M34/M46).

```typescript
sankhya.pedidos.incluirNotaGateway(
  input: IncluirNotaGatewayInput,
): Promise<{ codigoPedido: number }>
```

**Cabeçalho — campos tipados:**

| Campo | Sankhya | Obrigatório | Descrição |
|-------|---------|-------------|-----------|
| `codigoCliente` | `CODPARC` | Sim | — |
| `dataNegociacao` | `DTNEG` | Sim | — |
| `codigoTipoOperacao` | `CODTIPOPER` | Sim | — |
| `codigoTipoNegociacao` | `CODTIPVENDA` | Sim | — |
| `codigoVendedor` | `CODVEND` | Sim | — |
| `codigoEmpresa` | `CODEMP` | Sim | — |
| `tipoMovimento` | `TIPMOV` | Sim | — |
| `observacao` | `OBSERVACAO` | Não | Omitido, o campo não vai no cabeçalho |
| `statusNota` | `STATUSNOTA` | Não | **Novo em 1.6.0.** `'A'` aberta, `'L'` liberada. Omitido, o ERP aplica o default do TOP |
| `numeroPedidoExterno` | `AD_NUMPEDIDO` | Não | **Novo em 1.6.0.** Número do pedido no sistema de origem (marketplace/e-commerce) |
| `informarPreco` | `itens.INFORMARPRECO` | Não (default `true`) | **Novo em 1.6.0.** Serializado como a STRING `'True'`/`'False'` (M46) |
| `camposExtras` | — | Não | **Novo em 1.6.0.** Campos crus do cabeçalho (`AD_MARKET_PLACE`, `CIF_FOB`, `CODCENCUS`, …) |

**Itens (`ItemNotaGatewayInput`):**

| Campo | Sankhya | Obrigatório | Descrição |
|-------|---------|-------------|-----------|
| `codigoProduto` | `CODPROD` | Sim | — |
| `quantidade` | `QTDNEG` | Sim | Finita, **> 0** |
| `valorUnitario` | `VLRUNIT` | Sim | Finito, >= 0. Vai **cru**, sem arredondamento |
| `unidade` | `CODVOL` | Sim | — |
| `codigoLocalOrigem` | `CODLOCALORIG` | Não | — |
| `percentualDesconto` | `PERCDESC` | Não (default **0**) | **Novo em 1.6.0.** Finito, em `[0, 100]` |
| `valorTotal` | `VLRTOT` | Não (default `valorUnitario × quantidade` **em centavos**) | **Novo em 1.6.0.** Finito, >= 0 |

**Exemplo:**

```typescript
const { codigoPedido } = await sankhya.pedidos.incluirNotaGateway({
  codigoCliente: 312984,
  dataNegociacao: '06/09/2026',
  codigoTipoOperacao: 1001,
  codigoTipoNegociacao: 1,
  codigoVendedor: 0,
  codigoEmpresa: 2,
  tipoMovimento: 'P',
  statusNota: 'A',
  numeroPedidoExterno: 'SDK-T-1200',
  camposExtras: { CODNAT: '01010101', CODCENCUS: '204004', CIF_FOB: 'C' },
  itens: [
    { codigoProduto: 10077, quantidade: 1, valorUnitario: 10, unidade: 'UN', codigoLocalOrigem: 30301 },
  ],
});
```

**Endpoint Gateway:** `CACSP.incluirNota` (MGECOM)

#### O que o ERP exige

**`NUNOTA: {}` — objeto vazio, não `{ $: '' }` — no cabeçalho E em cada item** (M34/M46).
`itens.INFORMARPRECO` é a STRING `'True'`/`'False'`, fora do serializador. Não
"simplificar".

**`PERCDESC` e `VLRTOT` são do ITEM, e não são decorativos.** Sem o percentual,
`CACSP.incluirNota` recusa com `O campo 'Perc. desconto' deve ser informado.`
(`CORE_E03235`) — medido duas vezes na lane em 2026-09-11, e a recusa **sobreviveu** a
`PERCDESC` no cabeçalho. O item aceito em 06/09 (`spike-raw/faturamento/ped.ts:6`,
`S2_INCLUIR_P1.json`) tem 8 chaves, com os dois. O SDK manda `PERCDESC: 0` quando o
chamador não informa, em vez de omitir a chave.

**`VLRTOT` default é calculado em CENTAVOS.** `1.01 × 3` em ponto flutuante serializa como
`'3.0300000000000002'`, e 19,17% dos pares medidos (preço de 2 casas entre R$1 e R$500 ×
quantidade 1–20) passavam de 2 casas — e a reação do ERP a uma 17ª casa num campo de
dinheiro é **desconhecida**. Implicações declaradas: meio centavo sobe (`0.005 × 1` →
`'0.01'`), preço abaixo de meio centavo colapsa em `'0'`, e `VLRUNIT` vai **cru** — logo
`VLRUNIT × QTDNEG` pode diferir do `VLRTOT` em até 1 centavo. Informe `valorTotal`
explicitamente quando o total não for o produto direto (desconto embutido, rateio de
frete, arredondamento próprio).

**`camposExtras` é obrigatório na prática (D-14).** O SDK tipa **11** chaves de cabeçalho;
o cabeçalho que o ERP aceitou em 06/09 tem **29** (`spike-raw/faturamento/ped.ts:8`, o
cabeçalho de referência). A lane mediu que pelo menos `CODNAT` é exigido — `CORE_E00899`,
parâmetro `EXIGNATCFR` ligado, valor aceito medido `01010101` —, 2 de 2 chamadas
recusadas. Use `camposExtras` para o resto.

**`camposExtras` não pode escrever em campo tipado.** Citar qualquer uma das 11 chaves
(`NUNOTA`, `CODPARC`, `DTNEG`, `CODTIPOPER`, `CODTIPVENDA`, `CODVEND`, `CODEMP`, `TIPMOV`,
`OBSERVACAO`, `STATUSNOTA`, `AD_NUMPEDIDO`) **lança** `VALIDATION_ERROR`, sem rede —
inclusive quando o campo tipado correspondente foi omitido nesta chamada. Nada é
sobrescrito nem contrabandeado em silêncio.

> Semântica **oposta** à de `pedidos.criar()`, cujo `camposExtras` faz `Object.assign` sem
> guarda de colisão (D-02).

**O NUNOTA de retorno é lido em `pk.NUNOTA.$` → `nota.NUNOTA.$` → raiz `NUNOTA`**, nessa
ordem. Ausente nos três, o método **lança** `API_ERROR` em vez de devolver `0`: NUNOTA `0`
não existe, e um id silencioso seria levado para `confirmar`/`faturar`.

---

### `incluirAlterarItem(codigoPedido, itens)`

Inclui ou altera itens de um pedido via Gateway.

```typescript
sankhya.pedidos.incluirAlterarItem(
  codigoPedido: number,
  itens: ItemNotaGatewayInput[]
): Promise<void>
```

**Endpoint Gateway:** `CACSP.incluirAlterarItemNota` (MGECOM)

---

### `excluirItem(codigoPedido, sequencia)`

Exclui um item do pedido via Gateway.

```typescript
sankhya.pedidos.excluirItem(codigoPedido: number, sequencia: number): Promise<void>
```

**Endpoint Gateway:** `CACSP.excluirItemNota` (MGECOM)

---

## Fluxo Completo

```
1. criar()           →  Pedido "A CONFIRMAR" (REST v1)
2. confirmar()        →  Pedido confirmado (Gateway)
3. faturar()          →  Nota fiscal gerada (Gateway)
```

Veja o [Guia: Fluxo de Venda Completo](../guia/fluxo-venda-completo.md) para código detalhado.

No caminho do WMS (expedição), os passos 2 e 3 ganham guards e prova por read-back:
[`notas.confirmar`](./notas.md), [`faturamento.faturar`](./faturamento.md) e
[`conferencia.*`](./conferencia.md).

---

## Links

- [Tipos: PedidoVendaInput, PedidoVenda, ConfirmarPedidoInput, FaturarPedidoInput](./tipos.md#pedidos)
- [Preços Contextualizados](./precos.md#contextualizadoinput--crítico)
- [Faturamento com guard e read-back](./faturamento.md)
- [Notas: confirmar idempotente, excluir, cancelar](./notas.md)
- [Fluxo de Venda Completo](../guia/fluxo-venda-completo.md)
- [SankhyaClient](./cliente-sdk.md)
