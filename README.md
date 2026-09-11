# sankhya-sales-sdk

[![npm version](https://img.shields.io/npm/v/sankhya-sales-sdk.svg)](https://www.npmjs.com/package/sankhya-sales-sdk)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

SDK TypeScript para integração com as **APIs comerciais do Sankhya ERP**. Tipagem completa, zero dependencies, paginação normalizada e gerenciamento automático de autenticação.

> **[English version](./docs/README-en.md)**

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
export SANKHYA_BASE_URL=https://api.sandbox.sankhya.com.br
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

### Guarda de ambiente (allowlist de host, fail-closed)

O cliente só sobe contra host que a allowlist aceita — **o default é recusar**.
**Produção é avaliada primeiro**, na ordem abaixo:

| Host | Sobe? |
|---|---|
| produção (`PRODUCTION_HOSTS` e subdomínios) | só com a flag `allowProduction` ligada — e sai um `logger.warn` citando **só o host**. Nem `allowedHosts`, nem um subdomínio com `sandbox` no nome liberam produção |
| contém `sandbox` (ex.: `api.sandbox.sankhya.com.br`) | sim, sem aviso |
| consta de `allowedHosts` (host exato, sem subdomínio implícito) | sim, sem aviso |
| qualquer outro host — incluindo sufixo falso de produção, e `baseUrl` que não parseia | **aborta** (`SankhyaError`) |

Comparação de host é case-insensitive, e nenhuma mensagem de erro ecoa a `baseUrl`
crua — ela pode carregar `user:senha@`; o erro cita apenas o host.

```typescript
// ERP interno de homologação: amplie a allowlist, não a flag de produção.
const sankhya = new SankhyaClient({
  baseUrl: 'https://erp.interno.example.local',
  allowedHosts: ['erp.interno.example.local'],
  // ...credenciais...
});
```

Produção exige `allowProduction` ligada explicitamente na config — decisão de quem
chama, nunca default. O repo tem uma trava (`tests/security/allow-production-flag.test.ts`)
que reprova qualquer arquivo de `src/`, `tests/` ou `.github/` que ligue a flag.

Helpers exportados para quem precisa decidir antes de construir o cliente:
`isAllowedHost(host, allowedHosts?)`, `isProductionHost(host)`, `assertAllowedHost(baseUrl, opts, logger)`,
mais as constantes `SANDBOX_MARKER` e `PRODUCTION_HOSTS`.

### Resiliência (opcional)

Todos os knobs têm defaults seguros — configure apenas se precisar ajustar:

```typescript
const sankhya = new SankhyaClient({
  // ...credenciais...
  timeout: 30_000,   // timeout por request E por tentativa de autenticação (ms)
  retries: 3,        // retries HTTP para leituras (429/5xx/timeout)
  authRetry: {
    // retry da autenticação OAuth — SÓ para falhas transientes (timeout, 5xx, rede).
    // HTTP 400/401/403 (credencial inválida) falha imediatamente, sem retry.
    maxRetries: 3,   // tentativas extras (default: 3)
    baseDelayMs: 500, // backoff exponencial: base * 2^tentativa, jitter ±50%
  },
  circuitBreaker: {
    // após N falhas consecutivas de auth, falha rápido com CircuitOpenError
    threshold: 3,          // falhas para abrir (default: 3)
    resetTimeoutMs: 30_000, // janela de reabertura + jitter (default: 30s)
  },
});
```

Semântica de retry: **leituras** (REST GET e reads do Gateway como `loadRecords`,
`loadRecord`, `metadata.listFields`) são retentadas automaticamente em erro
transiente, mesmo sendo POST no transporte. **Escritas** (criar/confirmar/
cancelar/`saveRecord`) **nunca** são retentadas automaticamente — evita
duplicação no ERP; use `idempotencyKey` e trate idempotência no consumidor.

> **Defaults desde a 1.3.0** (mudam o comportamento mesmo sem config): a
> autenticação retenta 3× em falha transiente — pior caso de obtenção de token
> sob indisponibilidade total: ~2min — e o timeout de cada tentativa de auth
> segue `timeout` (antes: 30s fixos). `authRetry: { maxRetries: 0 }` restaura
> o fail-fast anterior.

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

// Criar pedido — datas aceitas em ISO (yyyy-MM-dd) e convertidas internamente
const { codigoPedido } = await sankhya.pedidos.criar({
  notaModelo: 1,
  data: '2026-04-01',
  hora: '10:00:00',
  codigoCliente: 123,
  codigoVendedor: 10,
  valorTotal: 255.0,
  itens: [
    {
      codigoProduto: 1001,
      quantidade: 10,
      valorUnitario: 25.5,
      codigoLocalEstoque: 101, // necessário quando há controle de estoque por local
      // `controle` é opcional; o SDK envia ' ' (sem controle) quando omitido
      // `sequencia` é auto-preenchida (1, 2, 3...)
    },
  ],
  financeiros: [
    // nomes canônicos: tipoPagamento / valorParcela (os antigos
    // codigoTipoPagamento / valor / numeroParcela seguem aceitos como aliases)
    { tipoPagamento: 1, valorParcela: 255.0, dataVencimento: '2026-05-01' },
  ],
});

// Confirmar (obrigatório — via Gateway)
await sankhya.pedidos.confirmar({ codigoPedido });
```

### Campos customizados (`AD_*`)

Toda instalação Sankhya tem campos personalizados (`AD_*`) próprios. O SDK
permite enviá-los sem alterar tipos:

```typescript
// Descobrir os campos AD_ de uma entidade
const adFields = await sankhya.metadata.listFields('CabecalhoNota', { customOnly: true });

// Pedido: camposExtras (flat) — mescla AD_* e atributos do dicionário no payload;
// também sobrescreve valores herdados do modelo (CODTIPOPER, CODEMP, CODNAT)
await sankhya.pedidos.criar({
  notaModelo: 1,
  data: '2026-04-01',
  hora: '10:00:00',
  codigoCliente: 123,
  valorTotal: 100,
  camposExtras: { AD_NUMPEDIDO: 'ECOM-9876', AD_CODRASTREIO: 'BR123' },
  itens: [{ codigoProduto: 1001, quantidade: 1, valorUnitario: 100, codigoLocalEstoque: 101 }],
  financeiros: [{ tipoPagamento: 1, valorParcela: 100, dataVencimento: '2026-05-01' }],
});

// Cliente: camposAdicionais (objeto aninhado, conforme o contrato oficial)
await sankhya.clientes.criar({
  nome: 'João da Silva',
  tipo: 'PF', // 'PF'/'PJ' (canônico); 'F'/'J' aceitos como aliases legados
  cnpjCpf: '11144477735',
  camposAdicionais: { AD_IDEXTERNO: 'EXT-42' },
  endereco: {
    logradouro: 'Av Paulista', numero: '1000', bairro: 'Bela Vista',
    cidade: 'São Paulo', codigoIbge: '3550308', uf: 'SP', cep: '01310100',
  },
});
```

### Financeiro: consultar débito, registrar e baixar

```typescript
// Títulos em aberto de um cliente
const debitos = await sankhya.financeiros.listarReceitas({
  codigoParceiro: 123,
  statusFinanceiro: 1, // StatusFinanceiro.Aberto
});

// Registrar uma receita (datas em ISO ou dd/MM/yyyy)
const { codigoFinanceiro } = await sankhya.financeiros.registrarReceita({
  codigoEmpresa: 1,
  codigoTipoOperacao: 1650, // TOP com TIPMOV='I'
  codigoNatureza: 1010101,
  codigoParceiro: 123,
  codigoTipoPagamento: 2,
  dataNegociacao: '2026-04-01',
  dataVencimento: '2026-05-01',
  numeroNota: 99001,
  numeroParcela: 1,
  valorParcela: 150.0,
});

// Baixar (liquidar) o título — informe a conta quando houver mais de uma
await sankhya.financeiros.baixarReceita({
  codigoFinanceiro,
  dataBaixa: '2026-05-01',
  valorBaixa: 150.0,
  codigoContaBancaria: 2,
});
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
| `sankhya.financeiros` | 13 | Débitos do cliente, receitas, despesas, baixas | [financeiros](./docs/api-reference/financeiros.md) |
| `sankhya.cadastros` | 11 | TOPs, naturezas, empresas, tipos negociação | [cadastros](./docs/api-reference/cadastros.md) |
| `sankhya.fiscal` | 2 | Cálculo de impostos, NFS-e | [fiscal](./docs/api-reference/fiscal.md) |
| `sankhya.metadata` | 1 | Descoberta de campos (incl. `AD_*`) por entidade | [metadata](./docs/api-reference/metadata.md) |
| `sankhya.gateway` | 3 | CRUD genérico (qualquer entidade) | [gateway](./docs/api-reference/gateway-crud.md) |

## Features

- **Zero dependencies** — apenas `fetch` nativo (Node 20+)
- **Tipagem completa** — todos os inputs/outputs com tipos TypeScript
- **Campos customizados `AD_*`** — `camposExtras` (pedido/financeiro) e `camposAdicionais` (cliente), + `metadata.listFields` para descobri-los
- **Datas flexíveis** — aceita ISO (`yyyy-MM-dd`) e converte para o formato Sankhya (`dd/MM/yyyy`) automaticamente
- **Validação de entrada** — erros claros antes da chamada, com nomes de campo
- **Paginação normalizada** — interface consistente para os 3 padrões da API
- **Auth automático** — token cache, auto-refresh, mutex
- **Token cache injetável** — memória (default) ou Redis/custom
- **Erros tipados** — `AuthError`, `ApiError`, `GatewayError`, `TimeoutError`, `CircuitOpenError`
- **Gateway HTTP 200 errors** — detectados automaticamente
- **Retry com backoff** — leituras (REST e Gateway) retentadas em erro transiente (429, 5xx, timeout), com jitter e respeito a `Retry-After`; escritas nunca
- **Auth resiliente** — retry com backoff exponencial no OAuth (só transiente) + circuit breaker configurável com erro tipado (`CircuitOpenError`)
- **AsyncGenerator** — paginação automática com `for await...of`

## Tratamento de Erros

O SDK exporta type guards para identificar cada tipo de erro:

```typescript
import {
  isApiError,
  isGatewayError,
  isAuthError,
  isCircuitOpenError,
  isTimeoutError,
} from 'sankhya-sales-sdk';

try {
  await sankhya.pedidos.criar({ /* ... */ });
} catch (error) {
  if (isCircuitOpenError(error)) {
    // Circuit breaker LOCAL aberto — o servidor nao foi contatado nesta chamada.
    // error.retryAfterMs indica quando tentar de novo.
    console.error(`Breaker aberto, aguarde ${error.retryAfterMs}ms`);
  } else if (isAuthError(error)) {
    // Credenciais invalidas ou token expirado
    // (CircuitOpenError tambem e AuthError — cheque isCircuitOpenError antes)
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

## Suporte via MCP (documentação Sankhya)

A Sankhya disponibiliza um servidor **MCP** oficial com a documentação da API. Se você
desenvolve com um assistente de IA (Claude Code, Cursor, Windsurf, etc.), pode conectá-lo
para consultar a doc da API direto no seu fluxo enquanto usa este SDK — tirar dúvidas de
entidades, campos e serviços sem sair do editor.

> Não faz parte do runtime do SDK e não é instalado pelo `npm install` — é uma ferramenta
> de apoio ao **desenvolvimento**, opt-in, registrada no seu editor.

**Endpoint:** `https://developer.sankhya.com.br/mcp` (HTTP, remoto, hospedado pela Sankhya)

**Claude Code:**

```bash
claude mcp add --transport http sankhya-docs https://developer.sankhya.com.br/mcp
```

**Cursor / Windsurf / VS Code** (adicione ao `mcp.json` do editor):

```json
{
  "mcpServers": {
    "sankhya-docs": {
      "url": "https://developer.sankhya.com.br/mcp"
    }
  }
}
```

Contribuidores deste repositório já têm o servidor pré-configurado via [`.mcp.json`](./.mcp.json)
na raiz (o Claude Code detecta automaticamente).

## Lane WMS opt-in (integração no sandbox)

`tests/integration/wms-sandbox.test.ts` exercita, **contra o sandbox Sankhya**, o caminho que o
WMS usa: estoque → volume do produto → pedido em `A` → item com `CONTROLE` → `consultarVar`.
Ela **escreve** no ERP de homologação, então é opt-in duplo e fica fora do `npm test`:

```bash
# credenciais de SANDBOX no ambiente (host api.sandbox.…) + a flag explícita
SDK_INTEGRATION_WMS=1 npm run test:integration
```

Sem as credenciais **ou** sem `SDK_INTEGRATION_WMS=1` a suíte é SKIP e imprime o motivo — nunca
faz rede por acidente.

**Travado por teste, no CI de PR e sem rede** (`tests/security/ci-lanes.test.ts`):

| Garantia | Como é verificada |
|---|---|
| opt-in duplo: credencial sozinha não autoriza | comportamento — `optInSatisfeito()` é chamada com cada combinação de ambiente |
| teto de **40** chamadas HTTP, que lança antes do request | comportamento — `callBudget` e `interceptarFetch` são exercitados de verdade |
| a suíte usa esse opt-in e esse teto, prova o sandbox antes de construir o client, intercepta e restaura o `fetch`, lê `STATUSNOTA` antes de excluir, guarda contra lista de ids vazia, nunca libera nem fatura | presença no **código** da suíte (comentários e texto de log são removidos antes do match) |
| o workflow de integração não dispara em `pull_request` e `npm test` exclui `tests/integration/**` | leitura do `integration.yml` e do `package.json` |

**Não travado por teste — só a execução real da lane prova** (o dono roda e cola o resultado no
ledger): que o sandbox aceite cada passo, os números do `volumesProduto`, e o *read-back* em
`TGFCAB` provando que o teardown apagou. A lane só liga em `workflow_dispatch` com a caixa
`run_wms_lane` marcada; em `push`/`schedule` ela é SKIP.

Tudo que a execução cria nasce e morre em `A`, marcado com o prefixo `SDK-T-<hhmm>` em
`AD_NUMPEDIDO`, `OBSERVACAO` e `CONTROLE`. Nota que não estiver mais em `A` na hora do teardown
**não é apagada**: é impressa como resíduo e derruba a lane.

## Contribuindo

Veja [CONTRIBUTING.md](./CONTRIBUTING.md) para instruções de setup, convenções e processo de PR.

## Licença

[MIT](./LICENSE)
