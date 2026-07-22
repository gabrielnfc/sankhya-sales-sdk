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

### Resilience (optional)

All knobs ship with safe defaults -- configure only if you need to tune:

```typescript
const sankhya = new SankhyaClient({
  // ...credentials...
  timeout: 30_000,   // per-request AND per-auth-attempt timeout (ms)
  retries: 3,        // HTTP retries for reads (429/5xx/timeout)
  authRetry: {
    // OAuth authentication retry -- ONLY for transient failures (timeout, 5xx, network).
    // HTTP 400/401/403 (invalid credentials) fails immediately, no retry.
    maxRetries: 3,    // extra attempts (default: 3)
    baseDelayMs: 500, // exponential backoff: base * 2^attempt, jitter +-50%
  },
  circuitBreaker: {
    // after N consecutive auth failures, fail fast with CircuitOpenError
    threshold: 3,           // failures to open (default: 3)
    resetTimeoutMs: 30_000, // reopen window + jitter (default: 30s)
  },
});
```

Retry semantics: **reads** (REST GET and Gateway reads such as `loadRecords`,
`loadRecord`, `metadata.listFields`) are retried automatically on transient
errors, even though they are POST at the transport level. **Writes**
(create/confirm/cancel/`saveRecord`) are **never** retried automatically --
this prevents duplication in the ERP; use `idempotencyKey` and handle write
idempotency in the consumer.

> **Defaults since 1.3.0** (they change behavior even with no config): auth
> retries 3x on transient failures -- worst-case token acquisition under a
> total outage is ~2min -- and each auth attempt's timeout follows `timeout`
> (previously hardcoded 30s). `authRetry: { maxRetries: 0 }` restores the
> previous fail-fast behavior.

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

// Create order — dates accepted as ISO (yyyy-MM-dd), converted internally
const { codigoPedido } = await sankhya.pedidos.criar({
  notaModelo: 1,
  data: '2026-04-01',
  hora: '10:00:00',
  codigoCliente: 123,
  codigoVendedor: 10,
  valorTotal: 255.0,
  itens: [
    {
      codigoProduto: 1001,
      quantidade: 10,
      valorUnitario: 25.5,
      codigoLocalEstoque: 101, // required when the product has per-location stock control
      // `controle` is optional; the SDK sends ' ' (no control) when omitted
      // `sequencia` is auto-filled (1, 2, 3...)
    },
  ],
  financeiros: [
    // canonical names: tipoPagamento / valorParcela (legacy
    // codigoTipoPagamento / valor / numeroParcela still accepted as aliases)
    { tipoPagamento: 1, valorParcela: 255.0, dataVencimento: '2026-05-01' },
  ],
});

// Confirm (required — via Gateway)
await sankhya.pedidos.confirmar({ codigoPedido });
```

### Custom fields (`AD_*`)

Every Sankhya install has its own custom fields (`AD_*`). Send them without
changing types:

```typescript
// Discover an entity's AD_ fields
const adFields = await sankhya.metadata.listFields('CabecalhoNota', { customOnly: true });

// Order: camposExtras (flat) — also overrides values inherited from the model
await sankhya.pedidos.criar({
  notaModelo: 1, data: '2026-04-01', hora: '10:00:00', codigoCliente: 123, valorTotal: 100,
  camposExtras: { AD_NUMPEDIDO: 'ECOM-9876', AD_CODRASTREIO: 'BR123' },
  itens: [{ codigoProduto: 1001, quantidade: 1, valorUnitario: 100, codigoLocalEstoque: 101 }],
  financeiros: [{ tipoPagamento: 1, valorParcela: 100, dataVencimento: '2026-05-01' }],
});

// Customer: camposAdicionais (nested object, per the official contract)
await sankhya.clientes.criar({
  nome: 'John Doe',
  tipo: 'PF', // 'PF'/'PJ' (canonical); 'F'/'J' accepted as legacy aliases
  cnpjCpf: '11144477735',
  camposAdicionais: { AD_IDEXTERNO: 'EXT-42' },
  endereco: {
    logradouro: 'Av Paulista', numero: '1000', bairro: 'Bela Vista',
    cidade: 'São Paulo', codigoIbge: '3550308', uf: 'SP', cep: '01310100',
  },
});
```

### Financial: query debt, register and settle

```typescript
// Open titles of a customer
const debts = await sankhya.financeiros.listarReceitas({
  codigoParceiro: 123,
  statusFinanceiro: 1, // StatusFinanceiro.Aberto
});

// Register a revenue title (dates as ISO or dd/MM/yyyy)
const { codigoFinanceiro } = await sankhya.financeiros.registrarReceita({
  codigoEmpresa: 1, codigoTipoOperacao: 1650, codigoNatureza: 1010101,
  codigoParceiro: 123, codigoTipoPagamento: 2,
  dataNegociacao: '2026-04-01', dataVencimento: '2026-05-01',
  numeroNota: 99001, numeroParcela: 1, valorParcela: 150.0,
});

// Settle (baixa) — pass the account when there is more than one
await sankhya.financeiros.baixarReceita({
  codigoFinanceiro, dataBaixa: '2026-05-01', valorBaixa: 150.0, codigoContaBancaria: 2,
});
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
| `sankhya.financeiros` | 13 | Customer debt, revenue, expenses, settlements | [financeiros](./api-reference/financeiros.md) |
| `sankhya.cadastros` | 11 | Operations, natures, companies, negotiation types | [cadastros](./api-reference/cadastros.md) |
| `sankhya.fiscal` | 2 | Tax calculation, NFS-e import | [fiscal](./api-reference/fiscal.md) |
| `sankhya.metadata` | 1 | Field discovery (incl. `AD_*`) per entity | [metadata](./api-reference/metadata.md) |
| `sankhya.gateway` | 3 | Generic CRUD (any entity) | [gateway](./api-reference/gateway-crud.md) |

## Features

- **Zero dependencies** -- native `fetch` only (Node 20+)
- **Full type safety** -- all inputs/outputs with strict TypeScript types
- **Normalized pagination** -- consistent interface across 3 API pagination patterns
- **Automatic auth** -- token cache, auto-refresh, mutex
- **Injectable token cache** -- in-memory (default) or Redis/custom
- **Typed errors** -- `AuthError`, `ApiError`, `GatewayError`, `TimeoutError`, `CircuitOpenError`
- **Gateway HTTP 200 errors** -- automatically detected
- **Retry with backoff** -- reads (REST and Gateway) retried on transient errors (429, 5xx, timeout) with jitter and `Retry-After` support; writes never
- **Resilient auth** -- exponential backoff on OAuth (transient only) + configurable circuit breaker with a typed error (`CircuitOpenError`)
- **AsyncGenerator** -- automatic pagination with `for await...of`

## Error Handling

The SDK exports type guards to identify each error type:

```typescript
import {
  isApiError,
  isGatewayError,
  isAuthError,
  isCircuitOpenError,
  isTimeoutError,
} from 'sankhya-sales-sdk';

try {
  await sankhya.pedidos.criar({ /* ... */ });
} catch (error) {
  if (isCircuitOpenError(error)) {
    // LOCAL circuit breaker is open -- the server was NOT contacted on this call.
    // error.retryAfterMs tells you when to try again.
    console.error(`Breaker open, wait ${error.retryAfterMs}ms`);
  } else if (isAuthError(error)) {
    // Invalid credentials or expired token
    // (CircuitOpenError is also an AuthError -- check isCircuitOpenError first)
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
