# Error Handling Guide

How the `sankhya-sales-sdk` handles Sankhya API errors and how you should handle them.

## Error Hierarchy

```
SankhyaError (base)
├── AuthError         — Authentication failure (401, invalid credentials)
├── ApiError          — REST v1 API error (4xx, 5xx)
├── GatewayError      — Gateway business error (HTTP 200, status "0")
└── TimeoutError      — Communication timeout
```

All errors extend `SankhyaError`, which extends `Error`. You can use `instanceof` for specific handling.

## Import

```typescript
import {
  SankhyaError,
  AuthError,
  ApiError,
  GatewayError,
  TimeoutError,
} from 'sankhya-sales-sdk';
```

## The Gateway HTTP 200 Problem

The most important quirk of the Sankhya API: **the Gateway returns HTTP 200 even for business errors**. The actual error is in the response body:

```json
{
  "serviceName": "CRUDServiceProvider.loadRecords",
  "status": "0",
  "statusMessage": "Entity 'NonExistentProduct' not found",
  "tsError": {
    "tsErrorCode": "XXXX",
    "tsErrorLevel": "ERROR"
  }
}
```

The SDK detects this automatically (`status === "0"`) and throws a `GatewayError` -- you never need to check manually.

## Handling Examples

### Generic handling

```typescript
try {
  const products = await sankhya.produtos.listar();
} catch (error) {
  if (error instanceof SankhyaError) {
    console.error(`Sankhya error [${error.code}]: ${error.message}`);
  }
}
```

### Specific handling by type

```typescript
try {
  const { codigoPedido } = await sankhya.pedidos.criar(order);
  await sankhya.pedidos.confirmar({ codigoPedido });
} catch (error) {
  if (error instanceof AuthError) {
    // Invalid credentials or incorrect X-Token
    // Action: check environment variables
    console.error('Authentication failure:', error.message);

  } else if (error instanceof GatewayError) {
    // Business rule error (e.g., insufficient stock, invalid operation type)
    // Action: display message to user, adjust data
    console.error(`Business error [${error.serviceName}]: ${error.message}`);
    console.error(`Code: ${error.tsErrorCode}`);

  } else if (error instanceof ApiError) {
    // HTTP error from REST v1 API (400, 404, 409, 500, etc.)
    // Action: depends on statusCode
    console.error(`API error [${error.statusCode}] ${error.method} ${error.endpoint}: ${error.message}`);

  } else if (error instanceof TimeoutError) {
    // Timeout -- server took too long to respond
    // Action: retry or notify user
    console.error('Timeout:', error.message);
  }
}
```

### Handling common order errors

```typescript
try {
  const { codigoPedido } = await sankhya.pedidos.criar(order);
} catch (error) {
  if (error instanceof ApiError && error.statusCode === 400) {
    // Invalid data -- validate input
    console.error('Invalid order data:', error.message);
  }
  if (error instanceof ApiError && error.statusCode === 409) {
    // Conflict -- duplicate order
    console.error('Order already exists');
  }
}
```

## Automatic Retry

The SDK automatically retries with **exponential backoff** for transient errors:

| Error | Retry? | Description |
|-------|--------|-------------|
| HTTP 429 | Yes | Too many requests (rate limiting) |
| HTTP 5xx | Yes | Server error (500, 502, 503, 504) |
| `ECONNRESET` | Yes | Connection reset |
| `ETIMEDOUT` | Yes | Connection timeout |
| HTTP 4xx (except 429) | **No** | Client error -- fail fast |
| `GatewayError` | **No** | Business error -- retrying won't help |
| `AuthError` | **No** | Invalid credentials -- won't improve with retry |

Retry configuration:

```typescript
const sankhya = new SankhyaClient({
  // ...credentials
  retries: 3,        // Number of attempts (default: 3)
  timeout: 30000,    // Timeout per request in ms (default: 30000)
});
```

### Exponential backoff

```
Attempt 1: immediate
Attempt 2: after ~1s
Attempt 3: after ~2s
Attempt 4: after ~4s (if retries=4)
```

## API HTTP Status Codes

| Code | Description | SDK Error |
|------|-------------|-----------|
| `200` | Success (or business error on Gateway) | -- or `GatewayError` |
| `400` | Invalid data | `ApiError` |
| `401` | Expired/invalid token | `AuthError` (with auto-retry) |
| `403` | No permission | `ApiError` |
| `404` | Not found | `ApiError` |
| `409` | Conflict (e.g., duplicate record) | `ApiError` |
| `429` | Rate limiting | Automatic retry |
| `500` | Internal error | Automatic retry |
| `502` | Bad gateway | Automatic retry |
| `503` | Service unavailable | Automatic retry |
| `504` | Gateway timeout | Automatic retry |

## Error Properties

### `SankhyaError` (base)

```typescript
error.code        // string -- e.g., 'AUTH_ERROR', 'API_ERROR', 'GATEWAY_ERROR'
error.message     // string -- descriptive message
error.statusCode  // number? -- HTTP status code
error.details     // unknown? -- additional details
```

### `ApiError`

```typescript
error.endpoint    // string -- e.g., '/v1/vendas/pedidos'
error.method      // string -- e.g., 'POST'
```

### `GatewayError`

```typescript
error.serviceName  // string -- e.g., 'ServicosNfeSP.confirmarNota'
error.tsErrorCode  // string? -- Sankhya error code
error.tsErrorLevel // string? -- 'ERROR', 'WARNING'
```

## Type Guards

The SDK exports type guards for each error class. Use them in `catch` blocks for safe narrowing:

```typescript
import {
  isSankhyaError,
  isAuthError,
  isApiError,
  isGatewayError,
  isTimeoutError,
} from 'sankhya-sales-sdk';
```

### Complete handling with type guards

```typescript
try {
  const order = await sankhya.pedidos.criar({
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
} catch (error) {
  if (isAuthError(error)) {
    // Invalid credentials or expired token
    // error.code === 'AUTH_ERROR'
    // error.statusCode may be 401 or undefined
    console.error('Authentication failure:', error.message);
  } else if (isTimeoutError(error)) {
    // Request timeout (AbortController)
    // error.code === 'TIMEOUT_ERROR'
    console.error('Timeout:', error.message);
  } else if (isGatewayError(error)) {
    // Sankhya business error (HTTP 200, but error in body)
    // error.serviceName, error.tsErrorCode and error.tsErrorLevel available
    console.error(`Sankhya error [${error.tsErrorCode}]: ${error.message}`);
  } else if (isApiError(error)) {
    // HTTP error (4xx/5xx)
    // error.statusCode (number), error.endpoint (string), error.method (string)
    console.error(`HTTP ${error.statusCode} at ${error.method} ${error.endpoint}`);
  } else if (isSankhyaError(error)) {
    // Any other SDK error
    console.error(`SDK error [${error.code}]: ${error.message}`);
  } else {
    throw error; // Unknown error, propagate
  }
}
```

### Switch with SankhyaErrorCode

For exhaustive handling based on error code:

```typescript
import type { SankhyaErrorCode } from 'sankhya-sales-sdk';

function handleError(code: SankhyaErrorCode) {
  switch (code) {
    case 'AUTH_ERROR':
      // renew credentials
      break;
    case 'API_ERROR':
      // check endpoint and status
      break;
    case 'GATEWAY_ERROR':
      // Sankhya business rule error
      break;
    case 'TIMEOUT_ERROR':
      // retry or increase timeout
      break;
    default:
      // exhaustive check
      const _exhaustive: never = code;
  }
}
```

## Links

- [Types: SankhyaError, AuthError, ApiError, GatewayError, TimeoutError](../api-reference/tipos.md#errors)
- [Quick Start](../guia/inicio-rapido.md)
- [Orders](../api-reference/pedidos.md)
