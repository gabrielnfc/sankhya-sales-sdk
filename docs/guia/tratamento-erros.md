# Guia de Tratamento de Erros

Como o `sankhya-sales-sdk` lida com erros da API Sankhya e como você deve tratá-los.

## Hierarquia de Erros

```
SankhyaError (base)
├── AuthError         — Falha de autenticação (401, credenciais inválidas)
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
  ApiError,
  GatewayError,
  TimeoutError,
} from 'sankhya-sales-sdk';
```

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

Configuração de retry:

```typescript
const sankhya = new SankhyaClient({
  // ...credenciais
  retries: 3,        // Número de tentativas (default: 3)
  timeout: 30000,    // Timeout por request em ms (default: 30000)
});
```

### Backoff exponencial

```
Tentativa 1: imediata
Tentativa 2: após ~1s
Tentativa 3: após ~2s
Tentativa 4: após ~4s (se retries=4)
```

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

## Links

- [Tipos: SankhyaError, AuthError, ApiError, GatewayError, TimeoutError](../api-reference/tipos.md#errors)
- [Início Rápido](./inicio-rapido.md)
- [Pedidos](../api-reference/pedidos.md)
