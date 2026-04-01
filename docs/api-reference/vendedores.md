# sankhya.vendedores

Módulo para consulta de vendedores.

**API Layer:** REST v1
**Base path:** `/v1/vendedores`

---

## Métodos

### `listar(params?)`

Lista vendedores paginados.

```typescript
sankhya.vendedores.listar(params?: ListarVendedoresParams): Promise<PaginatedResult<Vendedor>>
```

| Parâmetro | Tipo | Obrigatório | Descrição |
|-----------|------|-------------|-----------|
| `page` | `number` | Não (default: 0) | Página (inicia em 0) |
| `modifiedSince` | `string` | Não | Retorna registros modificados desde (`AAAA-MM-DDTHH:MM:SS`) |

**Exemplo:**

```typescript
const resultado = await sankhya.vendedores.listar();

for (const vendedor of resultado.data) {
  console.log(`${vendedor.nome} (${vendedor.tipo}) — ${vendedor.nomeRegiao}`);
}
```

**Paginação automática:**

```typescript
for await (const page of sankhya.vendedores.listarTodos()) {
  for (const vendedor of page.data) {
    console.log(vendedor.nome);
  }
}
```

**Endpoint REST:** `GET /v1/vendedores?page={page}`

---

### `buscar(codigoVendedor)`

Busca um vendedor específico por código.

```typescript
sankhya.vendedores.buscar(codigoVendedor: number): Promise<Vendedor>
```

**Exemplo:**

```typescript
const vendedor = await sankhya.vendedores.buscar(10);
console.log(vendedor.nome);            // "João Silva"
console.log(vendedor.comissaoVenda);    // 5.0
console.log(vendedor.nomeRegiao);       // "Sudeste"
```

**Endpoint REST:** `GET /v1/vendedores/{codigoVendedor}`

---

## Tipos de Vendedor

O campo `tipo` identifica a função do vendedor:

| Valor | Enum | Descrição |
|-------|------|-----------|
| 1 | `TipoVendedor.Comprador` | Comprador |
| 2 | `TipoVendedor.Executante` | Executante |
| 3 | `TipoVendedor.Gerente` | Gerente |
| 4 | `TipoVendedor.Vendedor` | Vendedor |
| 5 | `TipoVendedor.Supervisor` | Supervisor |
| 6 | `TipoVendedor.Tecnico` | Técnico |
| 7 | `TipoVendedor.Representante` | Representante |

---

## Links

- [Tipos: Vendedor, TipoVendedor](./tipos.md#vendedores)
- [SankhyaClient](./cliente-sdk.md)
