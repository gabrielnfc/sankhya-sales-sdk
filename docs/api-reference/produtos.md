# sankhya.produtos

Módulo para consulta de catálogo de produtos, componentes, alternativos, volumes e grupos.

**API Layer:** REST v1 + Gateway
**Base path:** `/v1/produtos`, `/v1/grupos-produto`, Gateway MGE

---

## Métodos

### `listar(params?)`

Lista produtos paginados.

```typescript
sankhya.produtos.listar(params?: ListarProdutosParams): Promise<PaginatedResult<Produto>>
```

| Parâmetro | Tipo | Obrigatório | Descrição |
|-----------|------|-------------|-----------|
| `page` | `number` | Não (default: 0) | Página (inicia em 0) |
| `modifiedSince` | `string` | Não | Sync incremental (`AAAA-MM-DDTHH:MM:SS`). Requer Log de Alterações habilitado no Sankhya Om. |

**Exemplo:**

```typescript
const resultado = await sankhya.produtos.listar({ page: 0 });

for (const produto of resultado.data) {
  console.log(`${produto.codigoProduto} — ${produto.nome} (${produto.marca})`);
}
```

**Paginação automática:**

```typescript
for await (const page of sankhya.produtos.listarTodos()) {
  // processa cada página
}
```

**Endpoint REST:** `GET /v1/produtos?page={page}&modifiedSince={modifiedSince}`

---

### `buscar(codigoProduto)`

Busca um produto específico.

```typescript
sankhya.produtos.buscar(codigoProduto: number): Promise<Produto>
```

**Exemplo:**

```typescript
const produto = await sankhya.produtos.buscar(1001);
console.log(produto.nome);
console.log(produto.volume);  // "UN"
console.log(produto.ncm);     // "1234.56.78"
```

**Endpoint REST:** `GET /v1/produtos/{codigoProduto}`

---

### `componentes(codigoProduto)`

Retorna os componentes de um produto composto (kit, combo).

```typescript
sankhya.produtos.componentes(codigoProduto: number): Promise<ComponenteProduto[]>
```

**Exemplo:**

```typescript
const componentes = await sankhya.produtos.componentes(1001);
for (const comp of componentes) {
  console.log(`${comp.nome} — Qtd: ${comp.quantidade} ${comp.unidade}`);
}
```

**Endpoint REST:** `GET /v1/produtos/{codigoProduto}/componentes`

---

### `alternativos(codigoProduto)`

Retorna produtos alternativos/substitutos.

```typescript
sankhya.produtos.alternativos(codigoProduto: number): Promise<ProdutoAlternativo[]>
```

> Útil para sugestão ao representante quando o produto principal está indisponível.

**Exemplo:**

```typescript
const alternativas = await sankhya.produtos.alternativos(1001);
```

**Endpoint REST:** `GET /v1/produtos/{codigoProduto}/alternativos`

---

### `volumes(codigoProduto)`

Retorna os volumes (unidades de medida) do produto.

```typescript
sankhya.produtos.volumes(codigoProduto: number): Promise<Volume[]>
```

**Exemplo:**

```typescript
const volumes = await sankhya.produtos.volumes(1001);
// [{ codigoVolume: "UN", nome: "Unidade" }, { codigoVolume: "CX", nome: "Caixa" }]
```

**Endpoint REST:** `GET /v1/produtos/{codigoProduto}/volumes`

---

### `listarVolumes(params?)`

Lista todos os volumes (unidades de medida) do sistema.

```typescript
sankhya.produtos.listarVolumes(params?: PaginationParams): Promise<PaginatedResult<Volume>>
```

**Endpoint REST:** `GET /v1/produtos/volumes?page={page}`

---

### `buscarVolume(codigoVolume)`

Busca um volume específico.

```typescript
sankhya.produtos.buscarVolume(codigoVolume: string): Promise<Volume>
```

**Endpoint REST:** `GET /v1/produtos/volumes/{codigoVolume}`

---

### `listarGrupos(params?)`

Lista grupos de produto.

```typescript
sankhya.produtos.listarGrupos(params?: ListarProdutosParams): Promise<PaginatedResult<GrupoProduto>>
```

**Exemplo:**

```typescript
const grupos = await sankhya.produtos.listarGrupos();

for (const grupo of grupos.data) {
  console.log(`${grupo.nome} (grau: ${grupo.grau}, analítico: ${grupo.analitico})`);
}
```

> Os grupos são hierárquicos — use `codigoGrupoProdutoPai` e `grau` para montar a árvore de categorias.

**Endpoint REST:** `GET /v1/grupos-produto?page={page}&modifiedSince={modifiedSince}`

---

### `buscarGrupo(codigoGrupoProduto)`

Busca um grupo de produto específico.

```typescript
sankhya.produtos.buscarGrupo(codigoGrupoProduto: number): Promise<GrupoProduto>
```

**Endpoint REST:** `GET /v1/grupos-produto/{codigoGrupoProduto}`

---

## Campos do Produto

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `codigoProduto` | `number` | Código do produto (PK — CODPROD) |
| `nome` | `string` | Nome do produto |
| `complemento` | `string?` | Complemento da descrição |
| `caracteristicas` | `string?` | Informações detalhadas |
| `referencia` | `string?` | Referência do produto |
| `codigoGrupoProduto` | `number?` | Código do grupo |
| `nomeGrupoProduto` | `string?` | Nome do grupo |
| `volume` | `string` | Unidade de medida padrão (UN, CX, KG) |
| `marca` | `string?` | Marca do produto |
| `pesoBruto` | `number?` | Peso bruto |
| `agrupamentoMinimo` | `number?` | Agrupamento mínimo de venda |
| `quantidadeEmbalagem` | `number?` | Quantidade de embalagens |
| `tipoControleEstoque` | `TipoControleEstoque?` | Tipo de controle de estoque |
| `ativo` | `boolean` | Produto ativo |
| `ncm` | `string?` | Código NCM |
| `cest` | `string?` | Código Especificador ST |

---

## Links

- [Tipos: Produto, GrupoProduto, Volume, ComponenteProduto](./tipos.md#produtos)
- [Preços](./precos.md)
- [Estoque](./estoque.md)
- [SankhyaClient](./cliente-sdk.md)
