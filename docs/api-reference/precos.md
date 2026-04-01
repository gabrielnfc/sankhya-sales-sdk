# sankhya.precos

Módulo para consulta de preços por tabela, por produto e preço contextualizado.

**API Layer:** REST v1
**Base path:** `/v1/precos`

---

## Métodos

### `porProdutoETabela(params)`

Obtém preços de um produto em uma tabela de preço específica.

```typescript
sankhya.precos.porProdutoETabela(params: PrecosPorProdutoETabelaParams): Promise<PaginatedResult<Preco>>
```

| Parâmetro | Tipo | Obrigatório | Descrição |
|-----------|------|-------------|-----------|
| `codigoProduto` | `number` | Sim | CODPROD |
| `codigoTabela` | `number` | Sim | CODTAB |
| `pagina` | `number` | Não (default: 1) | Página (inicia em 1, 50 registros/página) |

> **Nota:** Pode haver múltiplos preços para um mesmo produto, pois o preço pode variar por: volume alternativo, local de armazenamento e controle (sabor, cor, tamanho, etc.).

**Exemplo:**

```typescript
const precos = await sankhya.precos.porProdutoETabela({
  codigoProduto: 1001,
  codigoTabela: 1,
});

for (const preco of precos.data) {
  console.log(`${preco.unidade}: R$ ${preco.valor}`);
}
```

**Endpoint REST:** `GET /v1/precos/produto/{codigoProduto}/tabela/{codigoTabela}?pagina={pagina}`

**Quando usar:** Catálogo offline — cachear preços de uma tabela específica para um produto.

---

### `porProduto(codigoProduto, pagina?)`

Obtém preços de um produto em **todas** as tabelas de preço.

```typescript
sankhya.precos.porProduto(codigoProduto: number, pagina?: number): Promise<PaginatedResult<Preco>>
```

**Exemplo:**

```typescript
const precos = await sankhya.precos.porProduto(1001);
// Retorna preços de TODAS as tabelas vinculadas ao produto
```

**Endpoint REST:** `GET /v1/precos/produto/{codigoProduto}?pagina={pagina}`

**Quando usar:** Ver todas as tabelas de preço de um produto específico.

---

### `porTabela(params)`

Obtém preços de **todos os produtos** de uma tabela de preço.

```typescript
sankhya.precos.porTabela(params: PrecosPorTabelaParams): Promise<PaginatedResult<Preco>>
```

| Parâmetro | Tipo | Obrigatório | Descrição |
|-----------|------|-------------|-----------|
| `codigoTabela` | `number` | Sim | CODTAB |
| `pagina` | `number` | Não (default: 1) | Página (inicia em 1, 50 registros/página) |

**Endpoint REST:** `GET /v1/precos/tabela/{codigoTabela}?pagina={pagina}`

**Quando usar:** Sincronizar todos os preços de uma tabela para cache local.

---

### `contextualizado(input)` — CRÍTICO

Obtém preços calculados considerando o **contexto completo da negociação**: empresa, cliente, vendedor, tipo de operação e tipo de negociação.

```typescript
sankhya.precos.contextualizado(input: PrecoContextualizadoInput): Promise<Preco[]>
```

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| `codigoEmpresa` | `number` | Sim | CODEMP |
| `codigoCliente` | `number` | Sim | CODPARC |
| `codigoVendedor` | `number` | Sim | CODVEND |
| `codigoTipoOperacao` | `number` | Sim | CODTIPOPER |
| `codigoTipoNegociacao` | `number` | Sim | CODTIPVENDA |
| `dataNegociacao` | `string` | Não | Data da negociação |
| `simularInclusao` | `boolean` | Não | Simula inclusão item por item. **Baixa performance** — usar apenas quando cliente tem preços personalizados fora do padrão. |
| `produtos` | `PrecoContextualizadoProduto[]` | Sim | Lista de produtos |

**Exemplo:**

```typescript
const precos = await sankhya.precos.contextualizado({
  codigoEmpresa: 1,
  codigoCliente: 123,
  codigoVendedor: 10,
  codigoTipoOperacao: 1100,
  codigoTipoNegociacao: 1,
  produtos: [
    { codigoProduto: 1001, quantidade: 10 },
    { codigoProduto: 1002, quantidade: 5, unidade: 'CX' },
  ],
});

for (const preco of precos) {
  console.log(`Produto ${preco.codigoProduto}: R$ ${preco.valor}`);
}
```

**Endpoint REST:** `POST /v1/precos/contextualizado`

> **Este é o endpoint mais importante para força de vendas B2B.** O preço retornado leva em conta regras de negócio do ERP: descontos por cliente, promoções, forma de pagamento, localização, etc. Deve ser usado **no momento do pedido**, não para catálogo.

**Quando usar cada endpoint de preço:**

| Endpoint | Caso de uso |
|----------|-------------|
| `porProdutoETabela` | Catálogo offline — cache de preços |
| `porProduto` | Ver todas as tabelas de um produto |
| `porTabela` | Sync batch de uma tabela inteira |
| `contextualizado` | **No momento do pedido** — preço real com regras de negócio |

---

## Links

- [Tipos: Preco, PrecoContextualizadoInput](./tipos.md#precos)
- [Pedidos](./pedidos.md)
- [Fluxo de Venda Completo](../guia/fluxo-venda-completo.md)
- [SankhyaClient](./cliente-sdk.md)
