# sankhya.cadastros

Módulo para consulta de cadastros básicos: tipos de operação, naturezas, projetos, centros de resultado, empresas, usuários, tipos de negociação e modelos de nota.

**API Layer:** REST v1 + Gateway
**Base path:** `/v1/tipos-operacao`, `/v1/naturezas`, `/v1/projetos`, `/v1/centros-resultado`, `/v1/empresas`, `/v1/usuarios`, Gateway MGE

---

## Métodos REST v1

### `listarTiposOperacao(params?)`

Lista tipos de operação (TOP).

```typescript
sankhya.cadastros.listarTiposOperacao(params?: {
  page?: number;
  tipoMovimento?: TipoMovimento;
}): Promise<PaginatedResult<TipoOperacao>>
```

**Tipos de Movimento relevantes para Força de Vendas:**

| Valor | Enum | Descrição |
|-------|------|-----------|
| 4 | `TipoMovimento.Faturamento` | Faturar pedidos |
| 19 | `TipoMovimento.PedidoVenda` | Criar pedidos |
| 23 | `TipoMovimento.Venda` | Registro de venda |

**Exemplo:**

```typescript
const tops = await sankhya.cadastros.listarTiposOperacao({
  tipoMovimento: TipoMovimento.PedidoVenda,
});
```

**Endpoint REST:** `GET /v1/tipos-operacao?page={page}&tipoMovimento={tipo}`

### `buscarTipoOperacao(codigoTipoOperacao)`

```typescript
sankhya.cadastros.buscarTipoOperacao(codigoTipoOperacao: number): Promise<TipoOperacao>
```

**Endpoint REST:** `GET /v1/tipos-operacao/{codigoTipoOperacao}`

---

### `listarNaturezas(params?)`

```typescript
sankhya.cadastros.listarNaturezas(params?: PaginationParams): Promise<PaginatedResult<Natureza>>
```

**Endpoint REST:** `GET /v1/naturezas?page={page}`

### `buscarNatureza(codigoNatureza)`

```typescript
sankhya.cadastros.buscarNatureza(codigoNatureza: number): Promise<Natureza>
```

**Endpoint REST:** `GET /v1/naturezas/{codigoNatureza}`

---

### `listarProjetos(params?)`

```typescript
sankhya.cadastros.listarProjetos(params?: PaginationParams): Promise<PaginatedResult<Projeto>>
```

**Endpoint REST:** `GET /v1/projetos?page={page}`

### `buscarProjeto(codigoProjeto)`

```typescript
sankhya.cadastros.buscarProjeto(codigoProjeto: number): Promise<Projeto>
```

**Endpoint REST:** `GET /v1/projetos/{codigoProjeto}`

---

### `listarCentrosResultado(params?)`

```typescript
sankhya.cadastros.listarCentrosResultado(params?: PaginationParams): Promise<PaginatedResult<CentroResultado>>
```

**Endpoint REST:** `GET /v1/centros-resultado?page={page}`

### `buscarCentroResultado(codigoCentroResultado)`

```typescript
sankhya.cadastros.buscarCentroResultado(codigoCentroResultado: number): Promise<CentroResultado>
```

**Endpoint REST:** `GET /v1/centros-resultado/{codigoCentroResultado}`

---

### `listarEmpresas(params?)`

```typescript
sankhya.cadastros.listarEmpresas(params?: PaginationParams): Promise<PaginatedResult<Empresa>>
```

> **Uso obrigatório:** `codigoEmpresa` é exigido em `precos.contextualizado()` e `pedidos.consultar()`.

**Endpoint REST:** `GET /v1/empresas?page={page}`

### `buscarEmpresa(codigoEmpresa)`

```typescript
sankhya.cadastros.buscarEmpresa(codigoEmpresa: number): Promise<Empresa>
```

**Endpoint REST:** `GET /v1/empresas/{codigoEmpresa}`

---

### `listarUsuarios()`

```typescript
sankhya.cadastros.listarUsuarios(): Promise<Usuario[]>
```

**Endpoint REST:** `GET /v1/usuarios`

---

## Métodos Gateway

### `listarTiposNegociacao(params?)` — CRÍTICO

Lista tipos de negociação (condições comerciais: à vista, a prazo, parcelada, etc.).

```typescript
sankhya.cadastros.listarTiposNegociacao(params?: {
  page?: number;
  apenasAtivos?: boolean;
}): Promise<TipoNegociacao[]>
```

> **Não existe endpoint REST v1** para tipos de negociação. O campo `CODTIPVENDA` é **obrigatório** em `precos.contextualizado()` e no Gateway `CACSP.incluirNota`.

**Exemplo:**

```typescript
const tipos = await sankhya.cadastros.listarTiposNegociacao({ apenasAtivos: true });

for (const tipo of tipos) {
  console.log(`${tipo.codigoTipoNegociacao} — ${tipo.descricao} (Juros: ${tipo.taxaJuro}%)`);
}
```

**Endpoint Gateway:** `CRUDServiceProvider.loadRecords` (MGE), Entity: `TipoNegociacao`, Tabela: `TGFTPV`

> **Atenção:** O registro de TipoNegociacao é **histórico** — pode ter múltiplas versões. O SDK filtra automaticamente por `ATIVO = 'S'` quando `apenasAtivos: true`.

---

### `listarModelosNota(params?)` — CRÍTICO

Lista modelos de nota (pré-configura empresa, TOP, tipo de negociação, natureza).

```typescript
sankhya.cadastros.listarModelosNota(params?: {
  page?: number;
}): Promise<ModeloNota[]>
```

> **Não existe endpoint REST v1** para modelos de nota. O campo `notaModelo` é **obrigatório** em `pedidos.criar()`.

**Exemplo:**

```typescript
const modelos = await sankhya.cadastros.listarModelosNota();

for (const modelo of modelos) {
  console.log(`#${modelo.numeroModelo} — ${modelo.descricao} (Empresa: ${modelo.codigoEmpresa})`);
}
```

**Endpoint Gateway:** `CRUDServiceProvider.loadRecords` (MGE), Entity: `ModeloNota`

> **Dica:** Cache os modelos de nota no início do app. No fluxo de vendas B2B, selecione automaticamente o modelo com base no contexto (tipo de venda, empresa), simplificando a experiência do representante.

---

## Links

- [Tipos: TipoOperacao, Natureza, Projeto, CentroResultado, Empresa, TipoNegociacao, ModeloNota](./tipos.md#cadastros)
- [Preços Contextualizados](./precos.md)
- [Pedidos](./pedidos.md)
- [SankhyaClient](./cliente-sdk.md)
