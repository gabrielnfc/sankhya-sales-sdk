# sankhya-sales-sdk

[![npm version](https://img.shields.io/npm/v/sankhya-sales-sdk.svg)](https://www.npmjs.com/package/sankhya-sales-sdk)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

TypeScript SDK for integration with the **Sankhya ERP commercial APIs**. Full type safety, zero dependencies, normalized pagination, and automatic authentication management.

> **[Versao em Portugues](../README.md)**

## Prerequisites

- Node.js >= 20
- Sankhya OAuth 2.0 credentials (Client ID, Client Secret, X-Token)

## Scope

Covers Sankhya Om (v4.34+) commercial operations: **sales, customers, products, prices, inventory, orders, financial, and tax**. 67 total operations (55 REST v1 + 12 Gateway).

## Installation

```bash
npm install sankhya-sales-sdk
```

## Quick Start

### Environment variables

```bash
export SANKHYA_BASE_URL=https://api.sankhya.com.br
export SANKHYA_CLIENT_ID=your-client-id
export SANKHYA_CLIENT_SECRET=your-client-secret
export SANKHYA_X_TOKEN=your-x-token
```

### Configuration

```typescript
import { SankhyaClient } from 'sankhya-sales-sdk';

const sankhya = new SankhyaClient({
  baseUrl: process.env.SANKHYA_BASE_URL!,
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
// Get the real price with business rules applied
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
| `sankhya.clientes` | 5 | Customers and contacts | [clientes](./api-reference/clientes.md) |
| `sankhya.vendedores` | 2 | Sales representatives | [vendedores](./api-reference/vendedores.md) |
| `sankhya.produtos` | 9 | Product catalog, components, volumes, groups | [produtos](./api-reference/produtos.md) |
| `sankhya.precos` | 4 | Price tables and contextualized pricing | [precos](./api-reference/precos.md) |
| `sankhya.estoque` | 5 | Inventory and storage locations | [estoque](./api-reference/estoque.md) |
| `sankhya.pedidos` | 9 | Create, query, confirm, invoice orders | [pedidos](./api-reference/pedidos.md) |
| `sankhya.financeiros` | 13 | Revenue, expenses, payment types | [financeiros](./api-reference/financeiros.md) |
| `sankhya.cadastros` | 11 | Operations, natures, companies, negotiation types | [cadastros](./api-reference/cadastros.md) |
| `sankhya.fiscal` | 2 | Tax calculation, NFS-e import | [fiscal](./api-reference/fiscal.md) |
| `sankhya.gateway` | 3 | Generic CRUD (any entity) | [gateway](./api-reference/gateway-crud.md) |

## Features

- **Zero dependencies** -- native `fetch` only (Node 20+)
- **Full type safety** -- all inputs/outputs with strict TypeScript types
- **Normalized pagination** -- consistent interface across 3 API pagination patterns
- **Automatic auth** -- token cache, auto-refresh, mutex
- **Injectable token cache** -- in-memory (default) or Redis/custom
- **Typed errors** -- `AuthError`, `ApiError`, `GatewayError`, `TimeoutError`
- **Gateway HTTP 200 errors** -- automatically detected
- **Retry with backoff** -- for transient errors (429, 5xx)
- **AsyncGenerator** -- automatic pagination with `for await...of`

## Error Handling

The SDK exports type guards to identify each error type:

```typescript
import { isApiError, isGatewayError, isAuthError, isTimeoutError } from 'sankhya-sales-sdk';

try {
  await sankhya.pedidos.criar({ /* ... */ });
} catch (error) {
  if (isAuthError(error)) {
    // Invalid credentials or expired token
    console.error('Authentication failure:', error.message);
  } else if (isGatewayError(error)) {
    // Sankhya business error (HTTP 200, but error in body)
    console.error(`Sankhya error [${error.tsErrorCode}]: ${error.message}`);
  } else if (isApiError(error)) {
    // HTTP error (4xx/5xx)
    console.error(`HTTP ${error.statusCode} at ${error.method} ${error.endpoint}`);
  } else if (isTimeoutError(error)) {
    // Request timeout
    console.error('Timeout:', error.message);
  }
}
```

See the [complete error handling guide](./en/error-handling.md).

## Examples

Complete and runnable examples in [`examples/`](../examples/):

| Example | Description |
|---------|-------------|
| [01-quick-start.ts](../examples/01-quick-start.ts) | Configuration and first call |
| [02-listar-produtos.ts](../examples/02-listar-produtos.ts) | Pagination with listarTodos |
| [03-criar-pedido.ts](../examples/03-criar-pedido.ts) | Complete order flow |
| [04-error-handling.ts](../examples/04-error-handling.ts) | Handling each error type |
| [05-gateway-generico.ts](../examples/05-gateway-generico.ts) | CRUD via generic Gateway |

## API Reference

Generate the full documentation locally:

```bash
npm run docs
open docs/api/index.html
```

## Requirements

- **Node.js** >= 20.0.0
- **TypeScript** >= 5.0 (recommended)
- **Sankhya Om** >= 4.34

## Documentation

| Type | Link |
|------|------|
| **Quick Start** | [docs/guia/inicio-rapido.md](./guia/inicio-rapido.md) |
| **Authentication** | [docs/guia/autenticacao.md](./guia/autenticacao.md) |
| **Pagination** | [docs/guia/paginacao.md](./guia/paginacao.md) |
| **Error Handling** | [docs/en/error-handling.md](./en/error-handling.md) |
| **Complete Sales Flow** | [docs/guia/fluxo-venda-completo.md](./guia/fluxo-venda-completo.md) |
| **API Reference** | [docs/api-reference/](./api-reference/) |
| **Architecture** | [docs/projeto/arquitetura.md](./projeto/arquitetura.md) |
| **Types** | [docs/api-reference/tipos.md](./api-reference/tipos.md) |

> Note: Guide documentation is primarily in Portuguese (PT-BR) to align with the Sankhya ERP API naming conventions. Code examples use the SDK's Portuguese method names. The error handling guide is available in [English](./en/error-handling.md).

## Contributing

See [CONTRIBUTING.md](../CONTRIBUTING.md) for setup instructions, conventions, and PR process.

## License

[MIT](../LICENSE)
