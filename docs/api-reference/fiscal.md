# sankhya.fiscal

Módulo para operações fiscais: cálculo de impostos e importação de NFS-e.

**API Layer:** REST v1
**Base path:** `/v1/fiscal`

---

## Métodos

### `calcularImpostos(input)`

Calcula impostos incidentes sobre uma operação de venda.

```typescript
sankhya.fiscal.calcularImpostos(input: CalculoImpostoInput): Promise<ResultadoCalculoImposto[]>
```

> A parametrização tributária **deve estar previamente configurada** no Sankhya Om — o endpoint apenas aplica as regras já definidas. Disponível a partir da versão 4.31.

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| `notaModelo` | `number` | Sim | Modelo de nota (define empresa, TOP, natureza) |
| `codigoCliente` | `number` | Sim | CODPARC |
| `codigoEmpresa` | `number` | Não | Se omitido, assume a empresa da Nota Modelo |
| `codigoTipoOperacao` | `number` | Não | Se omitido, assume o TOP da Nota Modelo |
| `finalidadeOperacao` | `number` | Não | Finalidade (NUFOP) |
| `despesasAcessorias` | `DespesasAcessorias` | Não | Frete, seguro e outras despesas |
| `produtos` | `ProdutoCalculoImposto[]` | Sim | Lista de produtos |

**Objeto `produtos[]`:**

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| `codigoProduto` | `number` | Sim | CODPROD |
| `quantidade` | `number` | Sim | Quantidade |
| `valorUnitario` | `number` | Sim | Preço unitário |
| `unidade` | `string` | Não | CODVOL |
| `valorDesconto` | `number` | Não | Desconto no item |

**Exemplo:**

```typescript
const impostos = await sankhya.fiscal.calcularImpostos({
  notaModelo: 1,
  codigoCliente: 123,
  produtos: [
    { codigoProduto: 1001, quantidade: 10, valorUnitario: 25.50 },
    { codigoProduto: 1002, quantidade: 5, valorUnitario: 51.00 },
  ],
});

for (const produto of impostos) {
  console.log(`Produto ${produto.codigoProduto}:`);
  for (const imposto of produto.impostos) {
    console.log(`  ${imposto.tipo}: ${imposto.aliquota}% = R$ ${imposto.valorImposto}`);
  }
}
```

**Resposta — campos de cada imposto:**

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `tipo` | `TipoImposto` | icms, st, ipi, pis, cofins, irf, cssl, ibsuf, ibsmun, cbs |
| `cst` | `string?` | Código de Situação Tributária |
| `aliquota` | `number` | Alíquota do imposto |
| `valorBase` | `number` | Base de cálculo |
| `valorImposto` | `number` | Valor calculado |
| `percentualFCP` | `number?` | Percentual FCP |
| `valorFCP` | `number?` | Valor FCP |

**Endpoint REST:** `POST /v1/fiscal/impostos/calculo`

> **Uso no Força de Vendas:** Permite ao representante visualizar o valor final com impostos antes de confirmar o pedido. Essencial para transparência em negociações B2B.

---

### `importarNfse(dados)`

Importa NFS-e (Nota Fiscal de Serviço eletrônica).

```typescript
sankhya.fiscal.importarNfse(dados: Record<string, unknown>): Promise<unknown>
```

**Endpoint REST:** `POST /v1/fiscal/servicos-tomados/nfse`

---

## Links

- [Tipos: CalculoImpostoInput, ResultadoCalculoImposto, ImpostoCalculado, TipoImposto](./tipos.md#fiscal)
- [Pedidos](./pedidos.md)
- [Fluxo de Venda Completo](../guia/fluxo-venda-completo.md)
- [SankhyaClient](./cliente-sdk.md)
