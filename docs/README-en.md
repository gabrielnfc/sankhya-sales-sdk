# sankhya-sales-sdk

[![npm version](https://img.shields.io/npm/v/sankhya-sales-sdk.svg)](https://www.npmjs.com/package/sankhya-sales-sdk)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

TypeScript SDK for **Sankhya ERP commercial APIs**. Full type safety, zero dependencies, normalized pagination, and automatic authentication management.

> **[Versao em portugues](./README.md)**

## Scope

Covers Sankhya Om (v4.34+) commercial operations: **sales, customers, products, prices, inventory, orders, financial, and tax**. 67 total operations (55 REST v1 + 12 Gateway).

## Installation

```bash
npm install sankhya-sales-sdk
```

## Quick Start

### Setup

```typescript
import { SankhyaClient } from 'sankhya-sales-sdk';

const sankhya = new SankhyaClient({
  baseUrl: 'https://api.sankhya.com.br',
  clientId: process.env.SANKHYA_CLIENT_ID!,
  clientSecret: process.env.SANKHYA_CLIENT_SECRET!,
  xToken: process.env.SANKHYA_X_TOKEN!,
});
```

### List products

```typescript
const products = await sankhya.produtos.listar({ page: 0 });

for (const product of products.data) {
  console.log(`${product.codigoProduto} — ${product.nome}`);
}
```

### Contextualized pricing + create order

```typescript
// Get real price with business rules applied
const prices = await sankhya.precos.contextualizado({
  codigoEmpresa: 1,
  codigoCliente: 123,
  codigoVendedor: 10,
  codigoTipoOperacao: 1100,
  codigoTipoNegociacao: 1,
  produtos: [{ codigoProduto: 1001, quantidade: 10 }],
});

// Create order
const { codigoPedido } = await sankhya.pedidos.criar({
  notaModelo: 1,
  data: '01/04/2026',
  hora: '10:00:00',
  codigoCliente: 123,
  codigoVendedor: 10,
  valorTotal: 255.00,
  itens: [
    { codigoProduto: 1001, quantidade: 10, valorUnitario: 25.50, unidade: 'UN' },
  ],
  financeiros: [
    { codigoTipoPagamento: 1, valor: 255.00, dataVencimento: '01/05/2026', numeroParcela: 1 },
  ],
});

// Confirm (required — via Gateway)
await sankhya.pedidos.confirmar({ codigoPedido });
```

## Modules

| Module | Methods | Description | Docs |
|--------|---------|-------------|------|
| `sankhya.clientes` | 5 | Customers and contacts | [clientes](./docs/api-reference/clientes.md) |
| `sankhya.vendedores` | 2 | Sales representatives | [vendedores](./docs/api-reference/vendedores.md) |
| `sankhya.produtos` | 9 | Product catalog, components, volumes, groups | [produtos](./docs/api-reference/produtos.md) |
| `sankhya.precos` | 4 | Price tables and contextualized pricing | [precos](./docs/api-reference/precos.md) |
| `sankhya.estoque` | 5 | Inventory and storage locations | [estoque](./docs/api-reference/estoque.md) |
| `sankhya.pedidos` | 9 | Create, query, confirm, invoice orders | [pedidos](./docs/api-reference/pedidos.md) |
| `sankhya.financeiros` | 13 | Revenue, expenses, payment types | [financeiros](./docs/api-reference/financeiros.md) |
| `sankhya.cadastros` | 11 | Operations, natures, companies, negotiation types | [cadastros](./docs/api-reference/cadastros.md) |
| `sankhya.fiscal` | 2 | Tax calculation, NFS-e import | [fiscal](./docs/api-reference/fiscal.md) |
| `sankhya.gateway` | 3 | Generic CRUD (any entity) | [gateway](./docs/api-reference/gateway-crud.md) |

## Features

- **Zero dependencies** — native `fetch` only (Node 20+)
- **Full type safety** — all inputs/outputs with strict TypeScript types
- **Normalized pagination** — consistent interface across 3 API pagination patterns
- **Automatic auth** — token cache, auto-refresh, mutex
- **Injectable token cache** — in-memory (default) or Redis/custom
- **Typed errors** — `AuthError`, `ApiError`, `GatewayError`, `TimeoutError`
- **Gateway HTTP 200 errors** — automatically detected
- **Retry with backoff** — for transient errors (429, 5xx)
- **AsyncGenerator** — automatic pagination with `for await...of`

## Requirements

- **Node.js** >= 20.0.0
- **TypeScript** >= 5.0 (recommended)
- **Sankhya Om** >= 4.34

## Documentation

| Type | Link |
|------|------|
| **Quick Start** | [docs/guia/inicio-rapido.md](./docs/guia/inicio-rapido.md) |
| **Authentication** | [docs/guia/autenticacao.md](./docs/guia/autenticacao.md) |
| **Pagination** | [docs/guia/paginacao.md](./docs/guia/paginacao.md) |
| **Error Handling** | [docs/guia/tratamento-erros.md](./docs/guia/tratamento-erros.md) |
| **Complete Sales Flow** | [docs/guia/fluxo-venda-completo.md](./docs/guia/fluxo-venda-completo.md) |
| **API Reference** | [docs/api-reference/](./docs/api-reference/) |
| **Architecture** | [docs/projeto/arquitetura.md](./docs/projeto/arquitetura.md) |
| **Types** | [docs/api-reference/tipos.md](./docs/api-reference/tipos.md) |

> Note: Documentation is primarily in Portuguese (PT-BR) to align with the Sankhya ERP API naming conventions. Code examples use the SDK's Portuguese method names.

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for setup instructions, conventions, and PR process.

## License

[MIT](./LICENSE)
