# Guia de Tratamento de Erros

Como o `sankhya-sales-sdk` lida com erros da API Sankhya e como você deve tratá-los.

## Hierarquia de Erros

```
SankhyaError (base)
├── AuthError         — Falha de autenticação (401, credenciais inválidas)
│   └── CircuitOpenError — Circuit breaker local aberto (servidor NÃO foi contatado)
├── ApiError          — Erro da API REST v1 (4xx, 5xx)
├── GatewayError      — Erro de negócio do Gateway (HTTP 200, status "0")
└── TimeoutError      — Timeout na comunicação
```

Todos os erros estendem `SankhyaError`, que estende `Error`. Você pode usar `instanceof` para tratamento específico.

## Importação

```typescript
import {
  SankhyaError,
  AuthError,
  CircuitOpenError,
  ApiError,
  GatewayError,
  TimeoutError,
} from 'sankhya-sales-sdk';
```

> **`CircuitOpenError`** estende `AuthError` (retrocompatível: `instanceof
> AuthError` continua `true`), mas tem `code: 'CIRCUIT_OPEN'` e o campo
> `retryAfterMs` (ms até o breaker reabrir). Ele indica que o **breaker local**
> abriu após falhas consecutivas de autenticação — o servidor **não** foi
> contatado nesta chamada. Cheque `isCircuitOpenError(error)` **antes** de
> `isAuthError(error)`.

## O Problema do Gateway HTTP 200

A peculiaridade mais importante da API Sankhya: **o Gateway retorna HTTP 200 mesmo em erros de negócio**. O erro real está no body da resposta:

```json
{
  "serviceName": "CRUDServiceProvider.loadRecords",
  "status": "0",
  "statusMessage": "Entidade 'ProdutoInexistente' não encontrada",
  "tsError": {
    "tsErrorCode": "XXXX",
    "tsErrorLevel": "ERROR"
  }
}
```

O SDK detecta isso automaticamente (`status === "0"`) e lança um `GatewayError` — você nunca precisa verificar manualmente.

## Exemplos de Tratamento

### Tratamento genérico

```typescript
try {
  const produtos = await sankhya.produtos.listar();
} catch (error) {
  if (error instanceof SankhyaError) {
    console.error(`Erro Sankhya [${error.code}]: ${error.message}`);
  }
}
```

### Tratamento específico por tipo

```typescript
try {
  const { codigoPedido } = await sankhya.pedidos.criar(pedido);
  await sankhya.pedidos.confirmar({ codigoPedido });
} catch (error) {
  if (error instanceof AuthError) {
    // Credenciais inválidas ou X-Token incorreto
    // Ação: verificar variáveis de ambiente
    console.error('Falha na autenticação:', error.message);

  } else if (error instanceof GatewayError) {
    // Erro de regra de negócio (ex: estoque insuficiente, TOP inválida)
    // Ação: exibir mensagem ao usuário, ajustar dados
    console.error(`Erro de negócio [${error.serviceName}]: ${error.message}`);
    console.error(`Código: ${error.tsErrorCode}`);

  } else if (error instanceof ApiError) {
    // Erro HTTP da API REST v1 (400, 404, 409, 500, etc.)
    // Ação: depende do statusCode
    console.error(`Erro API [${error.statusCode}] ${error.method} ${error.endpoint}: ${error.message}`);

  } else if (error instanceof TimeoutError) {
    // Timeout — o servidor demorou para responder
    // Ação: retry ou notificar o usuário
    console.error('Timeout:', error.message);
  }
}
```

### Tratamento de erros comuns em pedidos

```typescript
try {
  const { codigoPedido } = await sankhya.pedidos.criar(pedido);
} catch (error) {
  if (error instanceof ApiError && error.statusCode === 400) {
    // Dados inválidos — validar input
    console.error('Dados do pedido inválidos:', error.message);
  }
  if (error instanceof ApiError && error.statusCode === 409) {
    // Conflito — pedido duplicado
    console.error('Pedido já existe');
  }
}
```

## Retry Automático

O SDK faz retry automático com **exponential backoff** para erros transientes:

| Erro | Retry? | Descrição |
|------|--------|-----------|
| HTTP 429 | Sim | Too many requests (rate limiting) |
| HTTP 5xx | Sim | Erro no servidor (500, 502, 503, 504) |
| `ECONNRESET` | Sim | Conexão resetada |
| `ETIMEDOUT` | Sim | Timeout de conexão |
| HTTP 4xx (exceto 429) | **Não** | Erro do cliente — fail fast |
| `GatewayError` | **Não** | Erro de negócio — não faz sentido retried |
| `AuthError` | **Não** | Credenciais inválidas — não melhora com retry |

**Retry segue a semântica da operação, não o método HTTP do transporte:**

| Operação | Retry automático? |
|----------|-------------------|
| Leituras REST (`GET`) | Sim |
| Leituras do Gateway (`loadRecords`, `loadRecord`, `metadata.listFields`) — POST no transporte | Sim |
| Escritas (criar/confirmar/cancelar/`saveRecord`, REST `POST`/`PUT`/`DELETE`) | **Nunca** — risco de duplicação no ERP; use `idempotencyKey` |

O header `Retry-After` do servidor, quando presente, é respeitado no delay —
com teto de 60s por espera.

A **autenticação OAuth** tem política própria (`authRetry`): backoff exponencial
com jitter só para falha transiente (timeout, 5xx, rede); HTTP 400/401/403
(credencial inválida) falha imediatamente, sem retry. Após falhas consecutivas,
o **circuit breaker** (`circuitBreaker`) abre e lança `CircuitOpenError`.

Configuração de retry:

```typescript
const sankhya = new SankhyaClient({
  // ...credenciais
  retries: 3,        // Número de tentativas HTTP (default: 3)
  timeout: 30000,    // Timeout por request e por tentativa de auth, em ms (default: 30000)
  authRetry: { maxRetries: 3, baseDelayMs: 500 },        // retry do OAuth (transiente)
  circuitBreaker: { threshold: 3, resetTimeoutMs: 30000 }, // breaker de auth
});
```

> **Defaults desde a 1.3.0:** sem nenhuma config, a autenticação retenta 3× em
> falha transiente (pior caso de obtenção de token sob indisponibilidade total:
> ~2min) e o timeout de cada tentativa de auth segue `timeout` (antes: 30s
> fixos). `authRetry: { maxRetries: 0 }` restaura o fail-fast pré-1.3.0.

### Backoff exponencial

```
Tentativa 1: imediata
Tentativa 2: após ~1s
Tentativa 3: após ~2s
Tentativa 4: após ~4s (se retries=4)
```

### Envelope de pior caso (retries aninhados)

Em degradação severa, os retries se **multiplicam** entre camadas para uma
leitura idempotente: cada passe da cascata de 401 (até 3 passes) executa até
`1 + retries` fetches HTTP, e cada passe pode disparar uma autenticação com
até `1 + authRetry.maxRetries` tentativas (cada uma limitada por `timeout`,
que vale por tentativa — não pela chamada inteira).

Com os defaults (`retries: 3`, `authRetry.maxRetries: 3`), o pior caso teórico
de UMA chamada de leitura chega a ~12 fetches de API + ~12 fetches de auth, e
o tempo de relógio pode alcançar vários minutos. Escritas não participam: são
sempre 1 única tentativa HTTP por passe. Para falhar mais rápido, reduza
`retries`, `authRetry.maxRetries` e/ou `timeout` — o circuit breaker corta as
tentativas de auth após `threshold` falhas consecutivas.

## Códigos HTTP da API

| Código | Descrição | Erro do SDK |
|--------|-----------|-------------|
| `200` | Sucesso (ou erro de negócio no Gateway) | — ou `GatewayError` |
| `400` | Dados inválidos | `ApiError` |
| `401` | Token expirado/inválido | `AuthError` (com auto-retry) |
| `403` | Sem permissão | `ApiError` |
| `404` | Não encontrado | `ApiError` |
| `409` | Conflito (ex: cadastro duplicado) | `ApiError` |
| `429` | Rate limiting | Retry automático |
| `500` | Erro interno | Retry automático |
| `502` | Bad gateway | Retry automático |
| `503` | Serviço indisponível | Retry automático |
| `504` | Gateway timeout | Retry automático |

## Propriedades dos Erros

### `SankhyaError` (base)

```typescript
error.code        // string — ex: 'AUTH_ERROR', 'API_ERROR', 'GATEWAY_ERROR'
error.message     // string — mensagem descritiva
error.statusCode  // number? — código HTTP
error.details     // unknown? — detalhes adicionais
```

### `ApiError`

```typescript
error.endpoint    // string — ex: '/v1/vendas/pedidos'
error.method      // string — ex: 'POST'
```

### `GatewayError`

```typescript
error.serviceName  // string — ex: 'ServicosNfeSP.confirmarNota'
error.tsErrorCode  // string? — código de erro do Sankhya
error.tsErrorLevel // string? — 'ERROR', 'WARNING'
```

## Type Guards

O SDK exporta type guards para cada classe de erro. Use em blocos `catch` para narrowing seguro:

```typescript
import {
  isSankhyaError,
  isAuthError,
  isApiError,
  isGatewayError,
  isTimeoutError,
} from 'sankhya-sales-sdk';
```

### Tratamento completo com type guards

```typescript
try {
  const pedido = await sankhya.pedidos.criar({
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
    // Credenciais invalidas ou token expirado
    // error.code === 'AUTH_ERROR'
    // error.statusCode pode ser 401 ou undefined
    console.error('Falha na autenticacao:', error.message);
  } else if (isTimeoutError(error)) {
    // Timeout na requisicao (AbortController)
    // error.code === 'TIMEOUT_ERROR'
    console.error('Timeout:', error.message);
  } else if (isGatewayError(error)) {
    // Erro de negocio Sankhya (HTTP 200, mas erro no body)
    // error.serviceName, error.tsErrorCode e error.tsErrorLevel disponiveis
    console.error(`Erro Sankhya [${error.tsErrorCode}]: ${error.message}`);
  } else if (isApiError(error)) {
    // Erro HTTP (4xx/5xx)
    // error.statusCode (number), error.endpoint (string), error.method (string)
    console.error(`HTTP ${error.statusCode} em ${error.method} ${error.endpoint}`);
  } else if (isSankhyaError(error)) {
    // Qualquer outro erro do SDK
    console.error(`Erro SDK [${error.code}]: ${error.message}`);
  } else {
    throw error; // Erro desconhecido, propagar
  }
}
```

### Switch com SankhyaErrorCode

Para tratamento exaustivo baseado no codigo de erro:

```typescript
import type { SankhyaErrorCode } from 'sankhya-sales-sdk';

function handleError(code: SankhyaErrorCode) {
  switch (code) {
    case 'AUTH_ERROR':
      // renovar credenciais
      break;
    case 'API_ERROR':
      // verificar endpoint e status
      break;
    case 'GATEWAY_ERROR':
      // erro de regra de negocio Sankhya
      break;
    case 'TIMEOUT_ERROR':
      // retry ou aumentar timeout
      break;
    default:
      // exhaustive check
      const _exhaustive: never = code;
  }
}
```

## Links

- [Tipos: SankhyaError, AuthError, ApiError, GatewayError, TimeoutError](../api-reference/tipos.md#errors)
- [Inicio Rapido](./inicio-rapido.md)
- [Pedidos](../api-reference/pedidos.md)
