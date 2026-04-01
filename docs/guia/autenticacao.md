# Guia de Autenticação

Como o `sankhya-sales-sdk` gerencia autenticação OAuth 2.0 com a API Sankhya.

## Visão Geral

A API Sankhya usa **OAuth 2.0 Client Credentials**. O SDK gerencia todo o ciclo de vida do token automaticamente:

1. Obtém token no primeiro request
2. Cacheia em memória (ou provider customizado)
3. Auto-refresh quando expira
4. Mutex para evitar refreshes duplicados
5. Retry automático em caso de 401

**Você não precisa fazer nada** — basta configurar as credenciais e usar o SDK normalmente.

## Credenciais

Três credenciais são necessárias:

| Credencial | Onde obter | Descrição |
|------------|-----------|-----------|
| `clientId` | [Portal do Desenvolvedor](https://developer.sankhya.com.br/) | Identificador da aplicação |
| `clientSecret` | Portal do Desenvolvedor | Segredo da aplicação |
| `xToken` | ERP Sankhya Om → Configurações Gateway | Token de acesso ao Gateway |

```typescript
const sankhya = new SankhyaClient({
  baseUrl: 'https://api.sankhya.com.br',
  clientId: process.env.SANKHYA_CLIENT_ID!,
  clientSecret: process.env.SANKHYA_CLIENT_SECRET!,
  xToken: process.env.SANKHYA_X_TOKEN!,
});
```

## Token Cache em Memória (Default)

Por padrão, o token é armazenado em memória:

- **TTL:** `expires_in - 60` segundos (margem de segurança)
- **Sessão padrão:** 30 minutos de inatividade
- **Refresh:** automático quando o cache expira

Isso funciona bem para a maioria dos casos. Não requer nenhuma configuração extra.

## Token Cache Customizado (Redis, etc.)

Para cenários onde você precisa compartilhar o token entre múltiplas instâncias (ex: serverless, múltiplos workers), injete um provider customizado:

```typescript
import Redis from 'ioredis';

const redis = new Redis();

const sankhya = new SankhyaClient({
  baseUrl: 'https://api.sankhya.com.br',
  clientId: process.env.SANKHYA_CLIENT_ID!,
  clientSecret: process.env.SANKHYA_CLIENT_SECRET!,
  xToken: process.env.SANKHYA_X_TOKEN!,
  tokenCacheProvider: {
    async get(key) {
      return redis.get(key);
    },
    async set(key, value, ttlSeconds) {
      await redis.set(key, value, 'EX', ttlSeconds);
    },
    async del(key) {
      await redis.del(key);
    },
  },
});
```

A interface `TokenCacheProvider` é simples:

```typescript
interface TokenCacheProvider {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttlSeconds: number): Promise<void>;
  del(key: string): Promise<void>;
}
```

## Mutex no Refresh

Quando múltiplos requests simultâneos detectam que o token expirou, o SDK garante que **apenas um** faz o refresh:

```
Request A ─┐
Request B ─┤── token expirado ──▶ apenas A faz refresh
Request C ─┘                      B e C aguardam a Promise de A
                                  todos recebem o novo token
```

Isso evita chamadas desnecessárias ao servidor de autenticação e race conditions no cache.

## Auto-Retry em 401

Se um request retorna HTTP 401 (token expirado/inválido):

1. Token é invalidado no cache
2. Novo token é obtido
3. Request original é retentado com o novo token
4. Se falhar novamente → `AuthError`

```typescript
import { AuthError } from 'sankhya-sales-sdk';

try {
  const produtos = await sankhya.produtos.listar();
} catch (error) {
  if (error instanceof AuthError) {
    console.error('Credenciais inválidas:', error.message);
    // Verifique client_id, client_secret e X-Token
  }
}
```

## Ambientes Separados

Produção e sandbox usam tokens **completamente independentes**:

```typescript
// Produção
const sankhyaProd = new SankhyaClient({
  baseUrl: 'https://api.sankhya.com.br',
  clientId: process.env.SANKHYA_PROD_CLIENT_ID!,
  clientSecret: process.env.SANKHYA_PROD_CLIENT_SECRET!,
  xToken: process.env.SANKHYA_PROD_X_TOKEN!,
});

// Sandbox
const sankhyaDev = new SankhyaClient({
  baseUrl: 'https://api.sandbox.sankhya.com.br',
  clientId: process.env.SANKHYA_DEV_CLIENT_ID!,
  clientSecret: process.env.SANKHYA_DEV_CLIENT_SECRET!,
  xToken: process.env.SANKHYA_DEV_X_TOKEN!,
});
```

> **Atenção:** Um token de sandbox não funciona em produção, e vice-versa.

## Importante

O fluxo legado de autenticação (usuário/senha) será **descontinuado em 30/04/2026**. O SDK usa exclusivamente OAuth 2.0 Client Credentials.

## Links

- [Início Rápido](./inicio-rapido.md)
- [Referência: Módulo Auth](../api-reference/autenticacao.md)
- [Tipos: AuthResponse, TokenCacheProvider](../api-reference/tipos.md#auth)
