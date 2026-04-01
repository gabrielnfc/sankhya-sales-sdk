# Arquitetura do SDK

## Diagrama Geral

```
┌─────────────────────────────────────────────────────────────────────┐
│                        sankhya-sales-sdk                            │
│                                                                     │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │                      SankhyaClient                            │  │
│  │  (entry point — expõe todos os resources como propriedades)   │  │
│  └──────────┬────────────────────────────────────────────────────┘  │
│             │                                                       │
│  ┌──────────▼────────────────────────────────────────────────────┐  │
│  │                      Resources Layer                          │  │
│  │                                                               │  │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────────┐ │  │
│  │  │ clientes │ │ produtos │ │ pedidos  │ │ financeiros      │ │  │
│  │  └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────────────┘ │  │
│  │  ┌────┴─────┐ ┌────┴─────┐ ┌────┴─────┐ ┌────┴─────────────┐ │  │
│  │  │vendedores│ │  precos  │ │ estoque  │ │ cadastros        │ │  │
│  │  └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────────────┘ │  │
│  │  ┌────┴─────┐ ┌────┴─────┐                                   │  │
│  │  │  fiscal  │ │ gateway  │                                   │  │
│  │  └────┬─────┘ └────┬─────┘                                   │  │
│  └───────┼─────────────┼────────────────────────────────────────┘  │
│          │             │                                           │
│  ┌───────▼─────────────▼────────────────────────────────────────┐  │
│  │                       Core Layer                              │  │
│  │                                                               │  │
│  │  ┌────────┐ ┌──────┐ ┌────────┐ ┌───────────────────────────┐│  │
│  │  │  auth  │ │ http │ │ errors │ │ gateway-serializer        ││  │
│  │  └────────┘ └──────┘ └────────┘ └───────────────────────────┘│  │
│  │  ┌────────────┐ ┌────────┐ ┌───────┐ ┌─────────────────────┐│  │
│  │  │ pagination │ │  retry │ │ date  │ │ logger              ││  │
│  │  └────────────┘ └────────┘ └───────┘ └─────────────────────┘│  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                       Types Layer                             │  │
│  │  45 interfaces / types / enums                                │  │
│  └──────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
         │                              │
         ▼                              ▼
┌─────────────────┐          ┌─────────────────────┐
│ REST v1 API     │          │ Gateway Services    │
│ /v1/{recurso}   │          │ /gateway/v1/{mod}/  │
└─────────────────┘          │ service.sbr         │
                             └─────────────────────┘
```

## Camadas

### 1. SankhyaClient (Entry Point)

Classe principal que o usuário instancia. Recebe configuração e expõe todos os resources.

```typescript
const sankhya = new SankhyaClient({
  baseUrl: 'https://api.sankhya.com.br',
  clientId: '...',
  clientSecret: '...',
  xToken: '...',
});

// Acesso via propriedades:
sankhya.clientes.listar(...)
sankhya.produtos.buscar(...)
sankhya.pedidos.criar(...)
```

### 2. Resources Layer

Cada domínio de negócio é um resource independente:

| Resource | Métodos | API Layer |
|----------|---------|-----------|
| `clientes` | 5 | REST v1 |
| `vendedores` | 2 | REST v1 |
| `produtos` | 9 | REST v1 + Gateway |
| `precos` | 4 | REST v1 |
| `estoque` | 5 | REST v1 + Gateway |
| `pedidos` | 9 | REST v1 + Gateway |
| `financeiros` | 13 | REST v1 |
| `cadastros` | 11 | REST v1 + Gateway |
| `fiscal` | 2 | REST v1 |
| `gateway` | 3 | Gateway genérico |

### 3. Core Layer

Módulos internos compartilhados por todos os resources:

| Módulo | Responsabilidade |
|--------|-----------------|
| **auth** | OAuth 2.0 Client Credentials, token cache (memória), auto-refresh, mutex |
| **http** | Cliente HTTP (fetch nativo), headers, interceptors |
| **errors** | Hierarquia de erros tipados (SankhyaError, AuthError, ApiError, GatewayError, TimeoutError) |
| **gateway-serializer** | Serialização/deserialização do formato Gateway (`{ "$": "valor" }`) |
| **pagination** | Normalização dos 3 padrões de paginação (page, pagina, offsetPage) |
| **retry** | Retry com exponential backoff para erros transientes |
| **date** | Conversão entre formatos de data (dd/mm/aaaa, AAAA-MM-DDTHH:MM:SS) |
| **logger** | Logger interno (injetável, desabilitável) |

### 4. Types Layer

Todas as interfaces, types e enums do SDK:

- **Config types**: SankhyaConfig, TokenCacheProvider, LogLevel
- **Auth types**: AuthResponse, TokenData
- **Request types**: PaginationParams, GatewayRequest, CriteriaExpression
- **Response types**: RestResponse, GatewayResponse, PaginatedResult
- **Domain types**: Cliente, Vendedor, Produto, Preco, Estoque, PedidoVenda, ItemPedido, etc.
- **Error types**: SankhyaError, AuthError, ApiError, GatewayError, TimeoutError
- **Enums**: TipoVendedor, TipoMovimento, SubTipoPagamento, TipoControleEstoque, TipoFaturamento

[Lista completa em tipos.md](../api-reference/tipos.md)

## Decisões Técnicas

| Decisão | Escolha | Justificativa |
|---------|---------|---------------|
| Runtime HTTP | `fetch` nativo | Zero deps, Node 20+ padrão, streaming support |
| Token storage | Memória (default) | Simplicidade. Redis/custom via `tokenCacheProvider` injetável |
| Token refresh | Mutex (Promise-based) | Evita race condition em requests paralelos |
| Serialização Gateway | Módulo dedicado | Formato `{ "$": value }` é complexo e propenso a erros |
| Paginação | AsyncGenerator + manual | Flexibilidade: `for await` ou page-by-page |
| Erros | Classe hierarchy | `instanceof` check, informações estruturadas |
| Gateway errors | Detecção automática | `status === "0"` em HTTP 200 → throw GatewayError |
| Formato de data | Conversão automática | SDK aceita Date/ISO, converte para formato Sankhya |
| Retry | Exponential backoff | 429, 5xx, ECONNRESET → retry. 4xx → fail fast |
| Tipos | Strict, sem `any` | DX superior, autocomplete, refactoring seguro |
| Build | tsup (esbuild) | ESM + CJS dual output, tree-shakeable |
| Testes | Vitest | Rápido, TypeScript nativo, mocking integrado |
| Lint/Format | Biome | Substitui ESLint + Prettier, mais rápido |

## Padrões

### Mutex no Token Refresh

Quando múltiplos requests paralelos detectam token expirado, apenas **um** faz o refresh. Os demais aguardam a mesma Promise.

```
Request A ──┐
Request B ──┤── detectam 401 ──▶ apenas A faz refresh
Request C ──┘                    B e C aguardam a Promise de A
                                 todos recebem o novo token
```

### Normalização de Paginação

A API Sankhya tem 3 padrões de paginação:

| Padrão | Endpoints | Início | Campo |
|--------|-----------|--------|-------|
| `page` (0-based) | vendedores, produtos, estoque | 0 | `temMaisRegistros` |
| `page` (1-based) | clientes, pedidos | 1 | `temMaisRegistros` / `metadados.totalPaginas` |
| `pagina` (1-based) | preços | 1 | `temMaisRegistros` |
| `offsetPage` (0-based) | Gateway | 0 | `totalRecords` |

O SDK normaliza todos para uma interface consistente:

```typescript
interface PaginatedResult<T> {
  data: T[];
  page: number;
  hasMore: boolean;
  totalRecords?: number;
}
```

### Serialização Gateway

O Gateway usa um formato proprietário onde valores são wrappados em `{ "$": value }`:

```json
// Input do Gateway
{ "CODPROD": { "$": "1001" }, "DESCRPROD": { "$": "Produto" } }

// Output do SDK (deserializado)
{ "CODPROD": "1001", "DESCRPROD": "Produto" }
```

O módulo `gateway-serializer` faz essa conversão automaticamente em ambas as direções.

## Estrutura de Diretórios (src/)

```
src/
├── index.ts                    # Export público
├── client.ts                   # SankhyaClient
├── core/
│   ├── auth.ts                 # Autenticação OAuth 2.0
│   ├── http.ts                 # HTTP client (fetch)
│   ├── errors.ts               # Hierarquia de erros
│   ├── gateway-serializer.ts   # Serialização Gateway
│   ├── pagination.ts           # Normalização paginação
│   ├── retry.ts                # Retry com backoff
│   ├── date.ts                 # Conversão de datas
│   └── logger.ts               # Logger injetável
├── resources/
│   ├── clientes.ts
│   ├── vendedores.ts
│   ├── produtos.ts
│   ├── precos.ts
│   ├── estoque.ts
│   ├── pedidos.ts
│   ├── financeiros.ts
│   ├── cadastros.ts
│   ├── fiscal.ts
│   └── gateway.ts
└── types/
    ├── config.ts
    ├── auth.ts
    ├── common.ts
    ├── clientes.ts
    ├── vendedores.ts
    ├── produtos.ts
    ├── precos.ts
    ├── estoque.ts
    ├── pedidos.ts
    ├── financeiros.ts
    ├── cadastros.ts
    ├── fiscal.ts
    └── gateway.ts
```

## Links

- [Visão Geral](./visao-geral.md)
- [Roadmap](./roadmap.md)
- [Referência de Tipos](../api-reference/tipos.md)
- [SankhyaClient](../api-reference/cliente-sdk.md)
