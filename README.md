# sankhya-sales-sdk

[![npm version](https://img.shields.io/npm/v/sankhya-sales-sdk.svg)](https://www.npmjs.com/package/sankhya-sales-sdk)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

SDK TypeScript para integração com as **APIs comerciais do Sankhya ERP**. Tipagem completa, zero dependencies, paginação normalizada e gerenciamento automático de autenticação.

> **[English version](./README.en.md)**

## Pre-requisitos

- Node.js >= 20
- Credenciais OAuth 2.0 do Sankhya (Client ID, Client Secret, X-Token)

## Escopo

Cobre operações comerciais do Sankhya Om (v4.34+): **vendas, clientes, produtos, preços, estoque, pedidos, financeiro e fiscal**. Total de 67 operações (55 REST v1 + 12 Gateway).

## Instalação

```bash
npm install sankhya-sales-sdk
```

## Quick Start

### Variaveis de ambiente

```bash
export SANKHYA_BASE_URL=https://api.sankhya.com.br
export SANKHYA_CLIENT_ID=seu-client-id
export SANKHYA_CLIENT_SECRET=seu-client-secret
export SANKHYA_X_TOKEN=seu-x-token
```

### Configuracao

```typescript
import { SankhyaClient } from 'sankhya-sales-sdk';

const sankhya = new SankhyaClient({
  baseUrl: process.env.SANKHYA_BASE_URL!,
  clientId: process.env.SANKHYA_CLIENT_ID!,
  clientSecret: process.env.SANKHYA_CLIENT_SECRET!,
  xToken: process.env.SANKHYA_X_TOKEN!,
});
```

### Listar produtos

```typescript
const produtos = await sankhya.produtos.listar({ page: 0 });

for (const produto of produtos.data) {
  console.log(`${produto.codigoProduto} — ${produto.nome}`);
}
```

### Preço contextualizado + criar pedido

```typescript
// Obter preço real com regras de negócio
const precos = await sankhya.precos.contextualizado({
  codigoEmpresa: 1,
  codigoCliente: 123,
  codigoVendedor: 10,
  codigoTipoOperacao: 1100,
  codigoTipoNegociacao: 1,
  produtos: [{ codigoProduto: 1001, quantidade: 10 }],
});

// Criar pedido
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

// Confirmar (obrigatório — via Gateway)
await sankhya.pedidos.confirmar({ codigoPedido });
```

## Módulos

| Módulo | Métodos | Descrição | Docs |
|--------|---------|-----------|------|
| `sankhya.clientes` | 5 | Clientes e contatos | [clientes](./docs/api-reference/clientes.md) |
| `sankhya.vendedores` | 2 | Consulta de vendedores | [vendedores](./docs/api-reference/vendedores.md) |
| `sankhya.produtos` | 9 | Catálogo, componentes, volumes, grupos | [produtos](./docs/api-reference/produtos.md) |
| `sankhya.precos` | 4 | Tabelas de preço e preço contextualizado | [precos](./docs/api-reference/precos.md) |
| `sankhya.estoque` | 5 | Estoque e locais de armazenamento | [estoque](./docs/api-reference/estoque.md) |
| `sankhya.pedidos` | 9 | Criar, consultar, confirmar, faturar | [pedidos](./docs/api-reference/pedidos.md) |
| `sankhya.financeiros` | 13 | Receitas, despesas, pagamentos | [financeiros](./docs/api-reference/financeiros.md) |
| `sankhya.cadastros` | 11 | TOPs, naturezas, empresas, tipos negociação | [cadastros](./docs/api-reference/cadastros.md) |
| `sankhya.fiscal` | 2 | Cálculo de impostos, NFS-e | [fiscal](./docs/api-reference/fiscal.md) |
| `sankhya.gateway` | 3 | CRUD genérico (qualquer entidade) | [gateway](./docs/api-reference/gateway-crud.md) |

## Features

- **Zero dependencies** — apenas `fetch` nativo (Node 20+)
- **Tipagem completa** — todos os inputs/outputs com tipos TypeScript
- **Paginação normalizada** — interface consistente para os 3 padrões da API
- **Auth automático** — token cache, auto-refresh, mutex
- **Token cache injetável** — memória (default) ou Redis/custom
- **Erros tipados** — `AuthError`, `ApiError`, `GatewayError`, `TimeoutError`
- **Gateway HTTP 200 errors** — detectados automaticamente
- **Retry com backoff** — para erros transientes (429, 5xx)
- **AsyncGenerator** — paginação automática com `for await...of`

## Tratamento de Erros

O SDK exporta type guards para identificar cada tipo de erro:

```typescript
import { isApiError, isGatewayError, isAuthError, isTimeoutError } from 'sankhya-sales-sdk';

try {
  await sankhya.pedidos.criar({ /* ... */ });
} catch (error) {
  if (isAuthError(error)) {
    // Credenciais invalidas ou token expirado
    console.error('Falha na autenticacao:', error.message);
  } else if (isGatewayError(error)) {
    // Erro de negocio Sankhya (HTTP 200, mas erro no body)
    console.error(`Erro Sankhya [${error.tsErrorCode}]: ${error.message}`);
  } else if (isApiError(error)) {
    // Erro HTTP (4xx/5xx)
    console.error(`HTTP ${error.statusCode} em ${error.method} ${error.endpoint}`);
  } else if (isTimeoutError(error)) {
    // Timeout na requisicao
    console.error('Timeout:', error.message);
  }
}
```

Veja o [guia completo de tratamento de erros](./docs/guia/tratamento-erros.md).

## Exemplos

Exemplos completos e executaveis em [`examples/`](./examples/):

| Exemplo | Descricao |
|---------|-----------|
| [01-quick-start.ts](./examples/01-quick-start.ts) | Configuracao e primeira chamada |
| [02-listar-produtos.ts](./examples/02-listar-produtos.ts) | Paginacao com listarTodos |
| [03-criar-pedido.ts](./examples/03-criar-pedido.ts) | Fluxo completo de pedido |
| [04-error-handling.ts](./examples/04-error-handling.ts) | Tratamento de cada tipo de erro |
| [05-gateway-generico.ts](./examples/05-gateway-generico.ts) | CRUD via Gateway generico |

## Referencia da API

Gere a documentacao completa localmente:

```bash
npm run docs
open docs/api/index.html
```

## Requisitos

- **Node.js** >= 20.0.0
- **TypeScript** >= 5.0 (recomendado)
- **Sankhya Om** >= 4.34

## Documentacao

| Tipo | Link |
|------|------|
| **Início Rápido** | [docs/guia/inicio-rapido.md](./docs/guia/inicio-rapido.md) |
| **Autenticação** | [docs/guia/autenticacao.md](./docs/guia/autenticacao.md) |
| **Paginação** | [docs/guia/paginacao.md](./docs/guia/paginacao.md) |
| **Tratamento de Erros** | [docs/guia/tratamento-erros.md](./docs/guia/tratamento-erros.md) |
| **Fluxo de Venda Completo** | [docs/guia/fluxo-venda-completo.md](./docs/guia/fluxo-venda-completo.md) |
| **API Reference** | [docs/api-reference/](./docs/api-reference/) |
| **Arquitetura** | [docs/projeto/arquitetura.md](./docs/projeto/arquitetura.md) |
| **Tipos** | [docs/api-reference/tipos.md](./docs/api-reference/tipos.md) |

## Contribuindo

Veja [CONTRIBUTING.md](./CONTRIBUTING.md) para instruções de setup, convenções e processo de PR.

## Licença

[MIT](./LICENSE)
