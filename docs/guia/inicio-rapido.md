# Guia de Início Rápido

Comece a usar o `sankhya-sales-sdk` em 5 minutos.

## Pré-requisitos

- **Node.js** >= 20.0.0
- **Credenciais Sankhya:** `client_id`, `client_secret`, `X-Token`
  - `client_id` e `client_secret`: obtidos no [Portal do Desenvolvedor Sankhya](https://developer.sankhya.com.br/)
  - `X-Token`: gerado na tela **Configurações Gateway** do Sankhya Om

## 1. Instalação

```bash
npm install sankhya-sales-sdk
```

## 2. Configuração

Crie um arquivo `.env` na raiz do seu projeto:

```env
SANKHYA_BASE_URL=https://api.sankhya.com.br
SANKHYA_CLIENT_ID=seu_client_id
SANKHYA_CLIENT_SECRET=seu_client_secret
SANKHYA_X_TOKEN=seu_x_token
```

| Variável | Descrição |
|----------|-----------|
| `SANKHYA_BASE_URL` | URL base da API (produção ou sandbox) |
| `SANKHYA_CLIENT_ID` | OAuth 2.0 client_id |
| `SANKHYA_CLIENT_SECRET` | OAuth 2.0 client_secret |
| `SANKHYA_X_TOKEN` | Token de acesso ao Gateway |

## 3. Primeiro Request

```typescript
import { SankhyaClient } from 'sankhya-sales-sdk';

const sankhya = new SankhyaClient({
  baseUrl: process.env.SANKHYA_BASE_URL!,
  clientId: process.env.SANKHYA_CLIENT_ID!,
  clientSecret: process.env.SANKHYA_CLIENT_SECRET!,
  xToken: process.env.SANKHYA_X_TOKEN!,
});

// Listar produtos (primeira página)
const produtos = await sankhya.produtos.listar({ page: 0 });

console.log(`Total: ${produtos.totalRecords} produtos`);
for (const produto of produtos.data) {
  console.log(`${produto.codigoProduto} — ${produto.nome} (${produto.marca})`);
}
```

> O SDK autentica automaticamente no primeiro request. Não é necessário chamar `authenticate()` manualmente.

## 4. Mais Exemplos

### Buscar preço contextualizado

```typescript
const precos = await sankhya.precos.contextualizado({
  codigoEmpresa: 1,
  codigoCliente: 123,
  codigoVendedor: 10,
  codigoTipoOperacao: 1100,
  codigoTipoNegociacao: 1,
  produtos: [
    { codigoProduto: 1001, quantidade: 10 },
  ],
});

console.log(`Preço: R$ ${precos[0].valor}`);
```

### Criar pedido de venda

```typescript
const { codigoPedido } = await sankhya.pedidos.criar({
  notaModelo: 1,
  data: '01/04/2026',
  hora: '10:00:00',
  codigoCliente: 123,
  codigoVendedor: 10,
  valorTotal: 255.00,
  itens: [
    {
      codigoProduto: 1001,
      quantidade: 10,
      valorUnitario: 25.50,
      unidade: 'UN',
    },
  ],
  financeiros: [
    {
      codigoTipoPagamento: 1,
      valor: 255.00,
      dataVencimento: '01/05/2026',
      numeroParcela: 1,
    },
  ],
});

console.log(`Pedido criado: ${codigoPedido}`);

// Confirmar o pedido (obrigatório)
await sankhya.pedidos.confirmar({ codigoPedido });
console.log('Pedido confirmado!');
```

## 5. Ambientes

| Ambiente | Base URL | Uso |
|----------|----------|-----|
| **Produção** | `https://api.sankhya.com.br` | Dados reais |
| **Sandbox** | `https://api.sandbox.sankhya.com.br` | Testes |

> **Atenção:** Cada ambiente gera tokens independentes. Credenciais de sandbox **não funcionam** com produção, e vice-versa.

## Próximos Passos

- [Autenticação](./autenticacao.md) — como funciona token cache e refresh
- [Paginação](./paginacao.md) — como iterar sobre resultados paginados
- [Tratamento de Erros](./tratamento-erros.md) — como lidar com erros da API
- [Fluxo de Venda Completo](./fluxo-venda-completo.md) — produto → preço → pedido → confirmar → faturar
- [API Reference](../api-reference/cliente-sdk.md) — referência completa de todos os módulos
