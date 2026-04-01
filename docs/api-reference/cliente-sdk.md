# SankhyaClient — Entry Point

O `SankhyaClient` é o ponto de entrada do SDK. Através dele você acessa todos os recursos da API Sankhya.

## Importação

```typescript
import { SankhyaClient } from 'sankhya-sales-sdk';
```

## Construtor

```typescript
const sankhya = new SankhyaClient(config: SankhyaConfig);
```

### `SankhyaConfig`

| Parâmetro | Tipo | Obrigatório | Default | Descrição |
|-----------|------|-------------|---------|-----------|
| `baseUrl` | `string` | Sim | — | URL base da API (`https://api.sankhya.com.br` ou `https://api.sandbox.sankhya.com.br`) |
| `clientId` | `string` | Sim | — | OAuth 2.0 client_id (Portal do Desenvolvedor) |
| `clientSecret` | `string` | Sim | — | OAuth 2.0 client_secret |
| `xToken` | `string` | Sim | — | Token Gateway (gerado na tela Configurações Gateway do Sankhya Om) |
| `timeout` | `number` | Não | `30000` | Timeout em milissegundos |
| `retries` | `number` | Não | `3` | Número de retentativas para erros transientes |
| `tokenCacheProvider` | `TokenCacheProvider` | Não | Memória | Provider customizado para cache de token |
| `logger` | `LoggerOptions` | Não | `{ level: 'warn' }` | Configuração do logger |

### Exemplo Básico

```typescript
const sankhya = new SankhyaClient({
  baseUrl: 'https://api.sankhya.com.br',
  clientId: process.env.SANKHYA_CLIENT_ID!,
  clientSecret: process.env.SANKHYA_CLIENT_SECRET!,
  xToken: process.env.SANKHYA_X_TOKEN!,
});
```

### Exemplo com Redis Token Cache

```typescript
import Redis from 'ioredis';

const redis = new Redis();

const sankhya = new SankhyaClient({
  baseUrl: 'https://api.sankhya.com.br',
  clientId: process.env.SANKHYA_CLIENT_ID!,
  clientSecret: process.env.SANKHYA_CLIENT_SECRET!,
  xToken: process.env.SANKHYA_X_TOKEN!,
  tokenCacheProvider: {
    async get(key) { return redis.get(key); },
    async set(key, value, ttl) { await redis.set(key, value, 'EX', ttl); },
    async del(key) { await redis.del(key); },
  },
});
```

## Resources (Propriedades)

Cada propriedade dá acesso a um módulo da API:

| Propriedade | Tipo | Descrição | Docs |
|-------------|------|-----------|------|
| `sankhya.clientes` | `ClientesResource` | Gerenciamento de clientes e contatos | [clientes.md](./clientes.md) |
| `sankhya.vendedores` | `VendedoresResource` | Consulta de vendedores | [vendedores.md](./vendedores.md) |
| `sankhya.produtos` | `ProdutosResource` | Catálogo, componentes, volumes, grupos | [produtos.md](./produtos.md) |
| `sankhya.precos` | `PrecosResource` | Tabelas de preço e preço contextualizado | [precos.md](./precos.md) |
| `sankhya.estoque` | `EstoqueResource` | Consulta de estoque e locais | [estoque.md](./estoque.md) |
| `sankhya.pedidos` | `PedidosResource` | Criar, consultar, confirmar, faturar pedidos | [pedidos.md](./pedidos.md) |
| `sankhya.financeiros` | `FinanceirosResource` | Receitas, despesas, pagamentos, moedas | [financeiros.md](./financeiros.md) |
| `sankhya.cadastros` | `CadastrosResource` | TOPs, naturezas, empresas, tipos negociação | [cadastros.md](./cadastros.md) |
| `sankhya.fiscal` | `FiscalResource` | Cálculo de impostos, NFS-e | [fiscal.md](./fiscal.md) |
| `sankhya.gateway` | `GatewayResource` | CRUD genérico (loadRecords, loadRecord, saveRecord) | [gateway-crud.md](./gateway-crud.md) |

## Métodos

### `sankhya.authenticate()`

Força autenticação manual. Normalmente desnecessário — o SDK autentica automaticamente no primeiro request.

```typescript
await sankhya.authenticate(): Promise<void>
```

### `sankhya.invalidateToken()`

Invalida o token em cache, forçando re-autenticação no próximo request.

```typescript
await sankhya.invalidateToken(): Promise<void>
```

## Exemplo Completo

```typescript
import { SankhyaClient, TipoFaturamento } from 'sankhya-sales-sdk';

const sankhya = new SankhyaClient({
  baseUrl: process.env.SANKHYA_BASE_URL!,
  clientId: process.env.SANKHYA_CLIENT_ID!,
  clientSecret: process.env.SANKHYA_CLIENT_SECRET!,
  xToken: process.env.SANKHYA_X_TOKEN!,
});

// Listar produtos
const produtos = await sankhya.produtos.listar({ page: 0 });

// Preço contextualizado
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

// Confirmar
await sankhya.pedidos.confirmar({ codigoPedido });

// Faturar
await sankhya.pedidos.faturar({
  codigoPedido,
  codigoTipoOperacao: 167,
  dataFaturamento: '01/04/2026',
  tipoFaturamento: TipoFaturamento.Normal,
});
```

## Links

- [Tipos](./tipos.md)
- [Autenticação](./autenticacao.md)
- [Guia de Início Rápido](../guia/inicio-rapido.md)
