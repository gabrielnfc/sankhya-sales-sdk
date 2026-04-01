# Módulo de Autenticação (Interno)

O módulo de autenticação é **interno** ao SDK — o usuário não interage diretamente com ele na maioria dos casos. O SDK gerencia tokens automaticamente.

## Como Funciona

### Fluxo OAuth 2.0 Client Credentials

```
┌──────────────┐     POST /authenticate      ┌──────────────────┐
│  SDK          │ ────────────────────────────▶│  Sankhya Auth    │
│  (auth module)│     client_id + secret       │  Server          │
│               │     + X-Token header         │                  │
│               │ ◀────────────────────────────│                  │
│               │     access_token             │                  │
│               │     expires_in: 1800         │                  │
└──────┬───────┘                              └──────────────────┘
       │
       ▼
┌──────────────┐
│  Token Cache │  TTL = expires_in - 60s (margem de segurança)
│  (memória)   │
└──────────────┘
```

### Endpoint

```
POST https://api.sankhya.com.br/authenticate
Content-Type: application/x-www-form-urlencoded
X-Token: {xToken}

grant_type=client_credentials&client_id={clientId}&client_secret={clientSecret}
```

### Resposta

```typescript
interface AuthResponse {
  access_token: string;       // JWT Bearer token
  expires_in: number;         // Tempo de expiração em segundos (default: 1800)
  refresh_expires_in: number;
  token_type: string;         // "Bearer"
  'not-before-policy': number;
  scope: string;
}
```

## Credenciais Necessárias

| Credencial | Origem | Descrição |
|------------|--------|-----------|
| `clientId` | Portal do Desenvolvedor Sankhya | Identificador da aplicação |
| `clientSecret` | Portal do Desenvolvedor Sankhya | Segredo da aplicação |
| `xToken` | ERP Sankhya Om → Configurações Gateway | Token de acesso ao Gateway |

> **Atenção:** Tokens de sandbox e produção são **independentes**. Um token de sandbox não funciona com credenciais de produção, e vice-versa.

## Token Cache

### Default: Memória

Por padrão, o token é armazenado em memória com TTL de `expires_in - 60` segundos (margem de segurança para evitar usar token prestes a expirar).

### Custom: Redis ou outro provider

Injetar via `tokenCacheProvider` na configuração:

```typescript
const sankhya = new SankhyaClient({
  // ...credenciais
  tokenCacheProvider: {
    async get(key: string): Promise<string | null> {
      return redis.get(key);
    },
    async set(key: string, value: string, ttlSeconds: number): Promise<void> {
      await redis.set(key, value, 'EX', ttlSeconds);
    },
    async del(key: string): Promise<void> {
      await redis.del(key);
    },
  },
});
```

## Auto-Refresh com Mutex

Quando múltiplos requests simultâneos detectam token expirado, o SDK usa **mutex** (Promise-based) para garantir que apenas uma autenticação aconteça:

```
t=0  Request A → token expirado → inicia refresh (cria Promise)
t=0  Request B → token expirado → detecta refresh em andamento → aguarda Promise
t=0  Request C → token expirado → detecta refresh em andamento → aguarda Promise
t=1  Refresh completo → A, B e C recebem o novo token
```

Isso evita:
- Múltiplas chamadas desnecessárias ao endpoint de autenticação
- Race conditions no cache de token
- Rate limiting no servidor de auth

## Tratamento de 401

Quando um request retorna HTTP 401:

1. Token em cache é invalidado
2. Novo token é obtido automaticamente
3. Request original é **retentado** com o novo token
4. Se falhar novamente → `AuthError` é lançado

```typescript
try {
  const produtos = await sankhya.produtos.listar();
} catch (error) {
  if (error instanceof AuthError) {
    // Credenciais inválidas ou X-Token incorreto
    console.error('Falha na autenticação:', error.message);
  }
}
```

## Sessão

| Propriedade | Valor |
|-------------|-------|
| Expiração padrão | 30 minutos de inatividade |
| Configurável via | Parâmetro `INATSESSTIMEOUT` no Sankhya Om |
| Range configurável | 1 a 30 minutos |

> **Importante:** O fluxo legado (usuário/senha) será **descontinuado em 30/04/2026**. O SDK usa exclusivamente OAuth 2.0 Client Credentials.

## Erros de Autenticação

| Código HTTP | Descrição | Erro do SDK |
|-------------|-----------|-------------|
| `400` | Parâmetros ausentes ou incorretos | `AuthError` |
| `401` | Credenciais inválidas (client_id, client_secret ou X-Token) | `AuthError` |
| `500` | Erro interno no servidor de autenticação | `SankhyaError` |

## Links

- [SankhyaClient](./cliente-sdk.md)
- [Tipos](./tipos.md)
- [Guia de Autenticação](../guia/autenticacao.md)
