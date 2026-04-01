# Guia para Contribuidores

Obrigado por considerar contribuir com o `sankhya-sales-sdk`! Este guia explica como configurar o ambiente, convenções do projeto e processo de contribuição.

## Setup do Ambiente

### Pré-requisitos

- **Node.js** >= 20.0.0
- **npm** >= 10
- **Git**

### Instalação

```bash
git clone https://github.com/seu-usuario/sankhya-sales-sdk.git
cd sankhya-sales-sdk
npm install
```

### Scripts

```bash
npm run build      # Build (ESM + CJS via tsup)
npm run test       # Rodar testes (vitest)
npm run test:watch # Testes em modo watch
npm run lint       # Lint + format check (Biome)
npm run lint:fix   # Lint + format fix
npm run typecheck  # TypeScript type checking
```

## Estrutura do Projeto

```
sankhya-sales-sdk/
├── src/
│   ├── index.ts              # Exports públicos
│   ├── client.ts             # SankhyaClient (entry point)
│   ├── core/                 # Módulos internos
│   │   ├── auth.ts           # Autenticação OAuth 2.0
│   │   ├── http.ts           # HTTP client (fetch)
│   │   ├── errors.ts         # Hierarquia de erros
│   │   ├── gateway-serializer.ts
│   │   ├── pagination.ts
│   │   ├── retry.ts
│   │   ├── date.ts
│   │   └── logger.ts
│   ├── resources/            # Módulos de domínio
│   │   ├── clientes.ts
│   │   ├── vendedores.ts
│   │   ├── produtos.ts
│   │   ├── precos.ts
│   │   ├── estoque.ts
│   │   ├── pedidos.ts
│   │   ├── financeiros.ts
│   │   ├── cadastros.ts
│   │   ├── fiscal.ts
│   │   └── gateway.ts
│   └── types/                # Interfaces e tipos
│       ├── config.ts
│       ├── auth.ts
│       ├── common.ts
│       └── ...               # Um arquivo por domínio
├── tests/
│   ├── core/
│   └── resources/
├── docs/                     # Documentação
├── LICENSE
├── README.md
└── package.json
```

## Convenções de Código

### TypeScript

- **Strict mode:** `strict: true` no tsconfig.json
- **Sem `any`:** Use `unknown` quando o tipo é indefinido
- **Interfaces sobre types:** Prefira `interface` para objetos extensíveis
- **Enums numéricos:** Para valores que vêm da API Sankhya (ex: `TipoVendedor`)
- **Readonly:** Marque propriedades imutáveis com `readonly`

### Estilo

- **Biome** para lint e formatação (substitui ESLint + Prettier)
- **Indentação:** 2 espaços
- **Aspas:** simples (`'`)
- **Ponto e vírgula:** sim
- **Trailing comma:** yes

### Nomenclatura

| Elemento | Convenção | Exemplo |
|----------|-----------|---------|
| Arquivos | kebab-case | `gateway-serializer.ts` |
| Classes | PascalCase | `SankhyaClient` |
| Interfaces/Types | PascalCase | `PedidoVendaInput` |
| Enums | PascalCase | `TipoFaturamento` |
| Funções/Métodos | camelCase | `listarClientes()` |
| Constantes | UPPER_SNAKE_CASE | `DEFAULT_TIMEOUT` |
| Variáveis | camelCase | `codigoPedido` |

### Nomes em português

Os nomes de domínio (resources, tipos, métodos) seguem o português para alinhar com a API Sankhya:

- `sankhya.clientes.listar()` (não `clients.list()`)
- `sankhya.pedidos.criar()` (não `orders.create()`)
- `Vendedor`, `Produto`, `Preco` (não `Seller`, `Product`, `Price`)

Core/infra usa inglês: `auth`, `http`, `errors`, `retry`, `pagination`.

## Testes

### Ferramentas

- **Vitest** para testes unitários
- **Mocking** do HTTP client para testes sem API real

### Convenções

- Um arquivo de teste por módulo: `clientes.test.ts`
- Colocados em `tests/` espelhando `src/`
- Mocking de HTTP responses para cada cenário
- Coverage target: 90%+

### Rodar testes

```bash
npm run test              # Uma vez
npm run test:watch        # Watch mode
npm run test -- --coverage  # Com coverage
```

## Como Adicionar um Novo Resource/Endpoint

1. **Tipos**: Crie as interfaces em `src/types/{dominio}.ts`
2. **Resource**: Crie o resource em `src/resources/{dominio}.ts`
3. **Client**: Registre o resource em `src/client.ts`
4. **Export**: Adicione exports em `src/index.ts`
5. **Testes**: Adicione testes em `tests/resources/{dominio}.test.ts`
6. **Docs**: Crie `docs/api-reference/{dominio}.md`

### Template de Resource

```typescript
// src/resources/novo-dominio.ts
import type { HttpClient } from '../core/http';
import type { PaginatedResult } from '../types/common';
import type { NovoTipo } from '../types/novo-dominio';

export class NovoDominioResource {
  constructor(private readonly http: HttpClient) {}

  async listar(params?: { page?: number }): Promise<PaginatedResult<NovoTipo>> {
    return this.http.get('/v1/novo-dominio', params);
  }

  async buscar(id: number): Promise<NovoTipo> {
    return this.http.get(`/v1/novo-dominio/${id}`);
  }
}
```

## Processo de PR

1. **Fork** o repositório
2. **Branch:** crie a partir de `main` com nome descritivo
   - `feat/nome-feature`
   - `fix/descricao-bug`
   - `docs/o-que-mudou`
3. **Implemente** seguindo as convenções
4. **Testes:** garanta que todos passam (`npm run test`)
5. **Lint:** garanta que passa (`npm run lint`)
6. **Commit:** mensagens claras em português
   - `feat: adicionar resource de vendedores`
   - `fix: corrigir paginação de clientes`
   - `docs: atualizar guia de autenticação`
7. **PR:** abra com descrição clara do que mudou e por quê
8. **Review:** aguarde review de pelo menos 1 maintainer

## Code of Conduct

- Seja respeitoso e construtivo
- Foque em fatos técnicos, não opiniões pessoais
- Aceite feedback com mente aberta
- Ajude outros contribuidores quando possível
- Reportar comportamento inadequado aos maintainers

## Dúvidas?

Abra uma [issue](https://github.com/seu-usuario/sankhya-sales-sdk/issues) com a label `question`.
