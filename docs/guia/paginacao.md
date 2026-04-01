# Guia de Paginação

Como o `sankhya-sales-sdk` normaliza os diferentes padrões de paginação da API Sankhya.

## O Problema

A API Sankhya tem **3 padrões diferentes** de paginação:

| Padrão | Param | Início | Endpoints |
|--------|-------|--------|-----------|
| `page` (0-based) | `page=0` | 0 | vendedores, produtos, estoque |
| `page` (1-based) | `page=1` | 1 | clientes, pedidos |
| `pagina` (1-based) | `pagina=1` | 1 | preços |
| `offsetPage` (0-based) | `offsetPage=0` | 0 | Gateway CRUD |

Cada um também retorna de forma diferente se há mais páginas:
- `temMaisRegistros: true/false`
- `metadados.totalPaginas`
- `totalRecords` no Gateway

## A Solução: PaginatedResult

O SDK normaliza **todos** os padrões para uma interface consistente:

```typescript
interface PaginatedResult<T> {
  data: T[];           // Registros da página
  page: number;        // Número da página atual
  hasMore: boolean;    // true se há mais páginas
  totalRecords?: number; // Total de registros (quando disponível)
}
```

Você não precisa se preocupar com qual padrão cada endpoint usa.

## Paginação Manual (page by page)

Itere página por página usando o campo `hasMore`:

```typescript
let page = 0;
let hasMore = true;

while (hasMore) {
  const resultado = await sankhya.produtos.listar({ page });

  for (const produto of resultado.data) {
    console.log(produto.nome);
  }

  hasMore = resultado.hasMore;
  page++;
}
```

Ou usando `do...while`:

```typescript
let page = 0;
let resultado;

do {
  resultado = await sankhya.produtos.listar({ page });
  processarProdutos(resultado.data);
  page++;
} while (resultado.hasMore);
```

## Paginação Automática (AsyncGenerator)

Para conveniência, cada resource com listagem oferece um método `*Todos()` que retorna um AsyncGenerator:

```typescript
// Itera automaticamente por TODAS as páginas
for await (const pagina of sankhya.produtos.listarTodos()) {
  for (const produto of pagina.data) {
    console.log(produto.nome);
  }
}
```

O AsyncGenerator:
- Faz requests sob demanda (lazy)
- Para automaticamente quando `hasMore === false`
- Permite `break` para parar a qualquer momento

### Coletar todos os registros em um array

```typescript
const todosProdutos: Produto[] = [];

for await (const pagina of sankhya.produtos.listarTodos()) {
  todosProdutos.push(...pagina.data);
}

console.log(`Total: ${todosProdutos.length} produtos`);
```

### Parar quando encontrar um produto específico

```typescript
let encontrado: Produto | undefined;

for await (const pagina of sankhya.produtos.listarTodos()) {
  encontrado = pagina.data.find(p => p.referencia === 'REF-001');
  if (encontrado) break; // Para de paginar
}
```

## Métodos com Paginação Automática

| Resource | Método manual | Método automático |
|----------|--------------|-------------------|
| `clientes` | `listar(params)` | `listarTodos()` |
| `vendedores` | `listar(params)` | `listarTodos()` |
| `produtos` | `listar(params)` | `listarTodos()` |
| `estoque` | `listar(params)` | `listarTodos()` |
| `financeiros` | `listarReceitas(filtro)` | — |
| `cadastros` | `listarTiposOperacao(params)` | — |

> Endpoints que tipicamente retornam poucos registros (tipos de pagamento, empresas, etc.) não possuem `*Todos()` pois raramente precisam de iteração multi-página.

## Tamanho de Página

Todos os endpoints REST v1 retornam **50 registros por página**. O Gateway (`offsetPage`) também retorna um número fixo de registros por página.

Não é possível alterar o tamanho da página — é definido pela API Sankhya.

## Sync Incremental com `modifiedSince`

Para sincronização eficiente, combine paginação com `modifiedSince`:

```typescript
// Buscar apenas produtos modificados desde a última sync
const ultimaSync = '2026-03-30T00:00:00';

for await (const pagina of sankhya.produtos.listarTodos({ modifiedSince: ultimaSync })) {
  for (const produto of pagina.data) {
    await atualizarCacheLocal(produto);
  }
}
```

> Nem todos os endpoints suportam `modifiedSince`. Verifique a documentação de cada resource.

## Links

- [Referência de Tipos: PaginatedResult](../api-reference/tipos.md#paginatedresultt)
- [Produtos](../api-reference/produtos.md)
- [Clientes](../api-reference/clientes.md)
