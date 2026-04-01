# sankhya.estoque

Módulo para consulta de estoque e locais de armazenamento.

**API Layer:** REST v1 + Gateway
**Base path:** `/v1/estoque`, Gateway MGECOM

---

## Métodos

### `porProduto(codigoProduto)`

Consulta estoque de um produto específico.

```typescript
sankhya.estoque.porProduto(codigoProduto: number): Promise<Estoque[]>
```

**Exemplo:**

```typescript
const estoques = await sankhya.estoque.porProduto(1001);

for (const est of estoques) {
  console.log(`Empresa ${est.codigoEmpresa}, Local ${est.codigoLocal}: ${est.estoque} un`);
}
```

**Endpoint REST:** `GET /v1/estoque/produtos/{codigoProduto}`

**Regras importantes:**
- Retorna apenas estoque do ERP (sem WMS)
- Considera apenas estoque próprio (ignora terceiros)
- Produtos sem movimentação **não aparecem** na resposta (não retorna `estoque = 0`)

---

### `listar(params?)`

Lista estoque de vários produtos paginado.

```typescript
sankhya.estoque.listar(params?: PaginationParams): Promise<PaginatedResult<Estoque>>
```

| Parâmetro | Tipo | Obrigatório | Descrição |
|-----------|------|-------------|-----------|
| `page` | `number` | Não (default: 1) | Página (50 registros/página) |

**Paginação automática:**

```typescript
for await (const page of sankhya.estoque.listarTodos()) {
  for (const est of page.data) {
    console.log(`Produto ${est.codigoProduto}: ${est.estoque}`);
  }
}
```

**Endpoint REST:** `GET /v1/estoque/produtos?page={page}`

---

### `listarLocais(params?)`

Lista locais de estoque.

```typescript
sankhya.estoque.listarLocais(params?: PaginationParams): Promise<PaginatedResult<LocalEstoque>>
```

**Endpoint REST:** `GET /v1/estoque/locais?page={page}`

---

### `buscarLocal(codigoLocal)`

Busca um local de estoque específico.

```typescript
sankhya.estoque.buscarLocal(codigoLocal: number): Promise<LocalEstoque>
```

**Endpoint REST:** `GET /v1/estoque/locais/{codigoLocal}`

---

### `detalhes(codigoProduto)` — Gateway

Consulta detalhada de estoque via Gateway (mais informações que o REST v1).

```typescript
sankhya.estoque.detalhes(codigoProduto: number): Promise<unknown>
```

**Endpoint Gateway:** `ConsultaProdutosSP.getDetalhesEstoques` (MGECOM)

> Utilize quando precisar de detalhes adicionais de estoque que o REST v1 não fornece (ex: estoque por lote, controle de série, etc.).

---

## Campos do Estoque

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `codigoProduto` | `number` | CODPROD |
| `codigoEmpresa` | `number` | CODEMP |
| `codigoLocal` | `number` | Código do local de armazenamento |
| `controle` | `string?` | Controle (série, lote, etc.) — vazio se sem controle |
| `estoque` | `number` | Quantidade em estoque |

---

## Notas

- **Cache:** Estoque é altamente volátil. TTL recomendado: 1–3 minutos.
- **Over-selling:** Sempre consulte estoque em tempo real antes de confirmar um pedido. Não confie em cache longo.
- **Estoque zero:** A API não retorna produtos com estoque zero. Se um produto não aparece, significa que não há estoque.

---

## Links

- [Tipos: Estoque, LocalEstoque](./tipos.md#estoque)
- [Produtos](./produtos.md)
- [Pedidos](./pedidos.md)
- [SankhyaClient](./cliente-sdk.md)
