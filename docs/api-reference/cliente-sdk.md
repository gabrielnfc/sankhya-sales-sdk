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
| `allowProduction` | `boolean` | Não | `false` | **Novo em 1.6.0.** Libera explicitamente um host de produção. Sem ela, host de produção **aborta** a construção do cliente. Ligada, o SDK emite `logger.warn` citando **só o host** |
| `allowedHosts` | `readonly string[]` | Não | `[]` | **Novo em 1.6.0.** Hosts extras aceitos pela allowlist (ex.: um ERP interno de homologação). Host exato, comparação case-insensitive, **sem** subdomínio implícito. Host de sandbox já passa sem constar aqui |
| `authRetry` | `AuthRetryConfig` | Não | `{ maxRetries: 3, baseDelayMs: 500 }` | Retry da autenticação OAuth — só para falhas transientes |
| `circuitBreaker` | `CircuitBreakerConfig` | Não | `{ threshold: 3, resetTimeoutMs: 30000 }` | Circuit breaker local de autenticação |
| `onDegradedResponse` | `'flag'` | Não | `'flag'` | Política para resposta degradada. **Sem efeito hoje**: o SDK não lê o valor, porque só existe uma política implementada. O default passa a `'throw'` na 2.0.0 |

### Guarda de ambiente (allowlist de host, fail-closed) — novo em 1.6.0

O construtor decide o host **antes** de instanciar `AuthManager`/`HttpClient`: nenhum
recurso de rede é criado para um host que a guarda recusaria. A ordem está travada em
teste (`tests/core/environment-guard-order.test.ts`).

| Host | Sobe? | Erro quando não |
|---|---|---|
| produção (qualquer host de `PRODUCTION_HOSTS`, e subdomínios) | só com `allowProduction: true`, e sai `logger.warn` com o host | `PRODUCTION_BLOCKED` |
| contém `sandbox` (ex.: `api.sandbox.sankhya.com.br`) | sim, sem aviso e sem precisar de `allowedHosts` | — |
| consta de `allowedHosts` (host exato) | sim, sem aviso | — |
| qualquer outro, e `baseUrl` que não parseia | **aborta** | `VALIDATION_ERROR` |

**Produção é avaliada PRIMEIRO.** Nem `allowedHosts`, nem o marcador `sandbox` num
subdomínio liberam produção — se liberassem, produção subiria sem flag e sem rastro no
log. Sufixo falso não conta: `<prod>.evil.com` e `evil-<prod>` são recusados por não
estarem na allowlist.

**Nenhuma mensagem de erro ecoa a `baseUrl` crua** — ela pode carregar `user:senha@`; o
erro cita apenas o host. O `warn` de produção também cita só o host, nunca token ou secret.

```typescript
// ERP interno de homologação: amplie a allowlist, não a flag de produção
const sankhya = new SankhyaClient({
  baseUrl: 'https://erp.interno.example.local',
  allowedHosts: ['erp.interno.example.local'],
  // ...credenciais...
});
```

**Helpers exportados**, para quem precisa decidir antes de construir o cliente:

```typescript
import {
  isAllowedHost,      // (host, allowedHosts?) => boolean — NÃO diz nada sobre produção
  isProductionHost,   // (host) => boolean — o host ou um subdomínio dele
  assertAllowedHost,  // (baseUrl, { allowProduction?, allowedHosts? }, logger) => void
  SANDBOX_MARKER,
  PRODUCTION_HOSTS,
} from 'sankhya-sales-sdk';
```

Uma trava de repo (`tests/security/allow-production-flag.test.ts`) reprova qualquer
arquivo de `src/`, `tests/` ou `.github/` que ligue `allowProduction`.

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
| `sankhya.metadata` | `MetadataResource` | Descoberta de campos (incl. `AD_*`) por entidade | [metadata.md](./metadata.md) |
| `sankhya.gateway` | `GatewayResource` | CRUD genérico + `call()` para qualquer serviço | [gateway-crud.md](./gateway-crud.md) |
| `sankhya.dbExplorer` | `DbExplorerResource` | **Novo em 1.6.0.** `SELECT` puro somente-leitura | [db-explorer.md](./db-explorer.md) |
| `sankhya.dataset` | `DatasetResource` | **Novo em 1.6.0.** Escrita/leitura tipada sobre o `DatasetSP` | [dataset.md](./dataset.md) |
| `sankhya.notas` | `NotasResource` | **Novo em 1.6.0.** Confirmar (idempotente), excluir, cancelar com read-back | [notas.md](./notas.md) |
| `sankhya.faturamento` | `FaturamentoResource` | **Novo em 1.6.0.** Faturar com guard e prova | [faturamento.md](./faturamento.md) |
| `sankhya.conferencia` | `ConferenciaResource` | **Novo em 1.6.0.** Conferência nativa `TGFCON2`/`TGFCOI2` | [conferencia.md](./conferencia.md) |
| `sankhya.lotes` | `LotesResource` | **Novo em 1.6.0.** Entrada 1813 / baixa 1811 | [lotes.md](./lotes.md) |

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

## Classificar uma falha — `classifyFailure()`

Não é método do client: é função exportada do pacote. Diz em que **camada** a falha caiu,
que é o que decide se dá para repetir.

```typescript
import { classifyFailure } from 'sankhya-sales-sdk';

try {
  await sankhya.pedidos.confirmar({ codigoPedido });
} catch (err) {
  switch (classifyFailure(err)) {
    case 'AUTH_FAIL': /* credencial/breaker — o passo não foi aceito; retry é seguro */ break;
    case 'NEGOCIO':   /* o ERP entendeu e recusou — TERMINAL, nunca retry */ break;
    case 'TIMEOUT':   /* desfecho DESCONHECIDO — decida por read-back, jamais por suposição */ break;
  }
}
```

| Erro | Camada |
|---|---|
| `AuthError` (e `CircuitOpenError`) | `AUTH_FAIL` |
| `ApiError` 401/403 | `AUTH_FAIL` |
| `ApiError` **408**, 429, 5xx | `TIMEOUT` — ambiguidade de **transporte**: o servidor pode ter executado |
| `ApiError` 4xx restante (409 incluso) | `NEGOCIO` |
| `TimeoutError` | `TIMEOUT` |
| `GatewayError` (HTTP 200 com erro no corpo) | `NEGOCIO` |
| qualquer outra coisa, e status ausente | `TIMEOUT` — desconhecido nunca é terminal |

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
- [DbExplorer](./db-explorer.md) · [Dataset](./dataset.md) · [Notas](./notas.md) · [Faturamento](./faturamento.md) · [Conferência](./conferencia.md) · [Lotes](./lotes.md)
- [CHANGELOG — migrando de 1.5 para 1.6](../../CHANGELOG.md)
- [Autenticação](./autenticacao.md)
- [Guia de Início Rápido](../guia/inicio-rapido.md)
