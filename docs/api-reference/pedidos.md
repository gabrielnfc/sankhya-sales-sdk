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

---

## Métodos Gateway

### `confirmar(input)` — CRÍTICO

Confirma um pedido no ERP. **Obrigatório** após criação via REST v1.

```typescript
sankhya.pedidos.confirmar(input: ConfirmarPedidoInput): Promise<void>
```

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| `codigoPedido` | `number` | Sim | NUNOTA |
| `compensarAutomaticamente` | `boolean` | Não | Compensar automaticamente (default: false) |

> **Não existe endpoint REST v1** para confirmação. O SDK usa internamente o Gateway `CACSP.confirmarNota` com body `ServicosNfeSP.confirmarNota` (divergência URL/body é comportamento esperado).

**Exemplo:**

```typescript
await sankhya.pedidos.confirmar({ codigoPedido: 98765 });
```

**Endpoint Gateway:** `CACSP.confirmarNota` (MGECOM)
**Body serviceName:** `ServicosNfeSP.confirmarNota`

**O que a confirmação faz:**
- Gera financeiro no ERP
- Reserva estoque
- Permite faturamento posterior
- Permite cancelamento via ERP

---

### `faturar(input)`

Fatura um pedido confirmado.

```typescript
sankhya.pedidos.faturar(input: FaturarPedidoInput): Promise<void>
```

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| `codigoPedido` | `number` | Sim | NUNOTA |
| `codigoTipoOperacao` | `number` | Sim | CODTIPOPER para faturamento |
| `dataFaturamento` | `string` | Sim | `dd/mm/aaaa` |
| `tipoFaturamento` | `TipoFaturamento` | Não | Default: `Normal` |
| `faturarTodosItens` | `boolean` | Não | Default: `true` |

**Tipos de faturamento:**

| Enum | Valor | Descrição |
|------|-------|-----------|
| `TipoFaturamento.Normal` | `FaturamentoNormal` | Fatura todos os itens |
| `TipoFaturamento.Estoque` | `FaturamentoEstoque` | Apenas itens com estoque |
| `TipoFaturamento.EstoqueDeixandoPendente` | `FaturamentoEstoqueDeixandoPendente` | Fatura estoque, pendencia o resto |
| `TipoFaturamento.Direto` | `FaturamentoDireto` | Faturamento direto |

> **Pré-requisito:** O pedido **deve estar confirmado**.

**Exemplo:**

```typescript
import { TipoFaturamento } from 'sankhya-sales-sdk';

await sankhya.pedidos.faturar({
  codigoPedido: 98765,
  codigoTipoOperacao: 167,
  dataFaturamento: '01/04/2026',
  tipoFaturamento: TipoFaturamento.Normal,
});
```

**Endpoint Gateway:** `SelecaoDocumentoSP.faturar` (MGECOM)

---

### `incluirNotaGateway(input)`

Inclui pedido via Gateway (alternativa ao REST v1).

```typescript
sankhya.pedidos.incluirNotaGateway(input: IncluirNotaGatewayInput): Promise<{ codigoPedido: number }>
```

**Endpoint Gateway:** `CACSP.incluirNota` (MGECOM)

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

### `simularImpostos(codigoPedido)`

Simula impostos e valores de um pedido.

```typescript
sankhya.pedidos.simularImpostos(codigoPedido: number): Promise<unknown>
```

**Endpoint Gateway:** `CentralVendaRapidaSP.simularValoresNota` (MGECOM)

---

## Fluxo Completo

```
1. criar()           →  Pedido "A CONFIRMAR" (REST v1)
2. confirmar()        →  Pedido confirmado (Gateway)
3. faturar()          →  Nota fiscal gerada (Gateway)
```

Veja o [Guia: Fluxo de Venda Completo](../guia/fluxo-venda-completo.md) para código detalhado.

---

## Links

- [Tipos: PedidoVendaInput, PedidoVenda, ConfirmarPedidoInput, FaturarPedidoInput](./tipos.md#pedidos)
- [Preços Contextualizados](./precos.md#contextualizadoinput--crítico)
- [Fluxo de Venda Completo](../guia/fluxo-venda-completo.md)
- [SankhyaClient](./cliente-sdk.md)
