# sankhya.gateway

Módulo para operações CRUD genéricas via Gateway Services. Permite acessar **qualquer entidade** do ERP Sankhya.

**API Layer:** Gateway
**Módulo:** MGE
**Base path:** `/gateway/v1/mge/service.sbr`

---

## Métodos

### `loadRecords(params)`

Consulta múltiplos registros de qualquer entidade.

```typescript
sankhya.gateway.loadRecords(params: LoadRecordsParams): Promise<GatewayDataRow[]>
```

| Parâmetro | Tipo | Obrigatório | Descrição |
|-----------|------|-------------|-----------|
| `entity` | `string` | Sim | Nome da entidade (ex: `'Produto'`, `'Parceiro'`, `'Financeiro'`) |
| `fields` | `string` | Sim | Campos separados por vírgula |
| `criteria` | `string` | Não | Filtro SQL-like (ex: `"this.ATIVO = 'S'"`) |
| `page` | `number` | Não (default: 0) | offsetPage (0-based) |
| `includePresentationFields` | `boolean` | Não (default: false) | Incluir campos de apresentação |

**Exemplo:**

```typescript
// Listar produtos ativos
const produtos = await sankhya.gateway.loadRecords({
  entity: 'Produto',
  fields: 'CODPROD,DESCRPROD,MARCA,CODVOL,ATIVO',
  criteria: "this.ATIVO = 'S'",
  page: 0,
});

for (const row of produtos) {
  console.log(`${row.fields.CODPROD} — ${row.fields.DESCRPROD}`);
}
```

**Exemplo — Tipos de Negociação (sem REST v1):**

```typescript
const tipos = await sankhya.gateway.loadRecords({
  entity: 'TipoNegociacao',
  fields: 'CODTIPVENDA,DESCRTIPVENDA,TAXAJURO,ATIVO',
  criteria: "ATIVO = 'S'",
});
```

**Exemplo — Modelos de Nota (sem REST v1):**

```typescript
const modelos = await sankhya.gateway.loadRecords({
  entity: 'ModeloNota',
  fields: 'NUMODELO,DESCRICAO,CODTIPOPER,CODTIPVENDA,CODEMP,CODNAT,CODCENCUS',
});
```

**Endpoint Gateway:** `CRUDServiceProvider.loadRecords`

> O SDK deserializa automaticamente o formato Gateway (`{ "$": "valor" }` → valor plano).

---

### `loadRecord(params)`

Consulta um registro único por chave primária.

```typescript
sankhya.gateway.loadRecord(params: LoadRecordParams): Promise<GatewayDataRow>
```

| Parâmetro | Tipo | Obrigatório | Descrição |
|-----------|------|-------------|-----------|
| `entity` | `string` | Sim | Nome da entidade |
| `fields` | `string` | Sim | Campos separados por vírgula |
| `primaryKey` | `Record<string, string>` | Sim | Chave primária (ex: `{ CODPROD: '1001' }`) |

**Exemplo:**

```typescript
const produto = await sankhya.gateway.loadRecord({
  entity: 'Produto',
  fields: 'CODPROD,DESCRPROD,MARCA,CODVOL',
  primaryKey: { CODPROD: '1001' },
});

console.log(produto.fields.DESCRPROD);
```

**Endpoint Gateway:** `CRUDServiceProvider.loadRecord`

---

### `saveRecord(params)`

Inclui ou altera um registro. Se a chave primária estiver presente nos dados → **UPDATE**. Se ausente → **INSERT**.

```typescript
sankhya.gateway.saveRecord(params: SaveRecordParams): Promise<GatewayDataRow>
```

| Parâmetro | Tipo | Obrigatório | Descrição |
|-----------|------|-------------|-----------|
| `entity` | `string` | Sim | Nome da entidade |
| `fields` | `string` | Sim | Campos para retorno |
| `data` | `Record<string, string>` | Sim | Campos e valores |

**Exemplo — INSERT (novo parceiro):**

```typescript
const novo = await sankhya.gateway.saveRecord({
  entity: 'Parceiro',
  fields: 'CODPARC,NOMEPARC,TIPPESSOA,CGC_CPF',
  data: {
    NOMEPARC: 'Novo Cliente B2B Ltda',
    TIPPESSOA: 'J',
    CGC_CPF: '12345678000199',
    CODCID: '5100',
    ATIVO: 'S',
    CLIENTE: 'S',
  },
});
```

**Exemplo — UPDATE (com PK):**

```typescript
await sankhya.gateway.saveRecord({
  entity: 'Parceiro',
  fields: 'CODPARC,NOMEPARC',
  data: {
    CODPARC: '123',  // PK presente → UPDATE
    NOMEPARC: 'Nome Atualizado',
  },
});
```

**Endpoint Gateway:** `CRUDServiceProvider.saveRecord`

---

## Entidades Úteis

| Entidade | Tabela | Uso |
|----------|--------|-----|
| `Produto` | `TGFPRO` | Consultas avançadas de catálogo |
| `Parceiro` | `TGFPAR` | Consultas avançadas de clientes |
| `TipoNegociacao` | `TGFTPV` | **Sem REST v1** — condições comerciais |
| `ModeloNota` | — | **Sem REST v1** — modelos para pedidos |
| `Financeiro` | `TGFFIN` | Consultas avançadas de títulos |
| `CabecalhoNota` | `TGFCAB` | Cabeçalhos de notas/pedidos |
| `ItemNota` | `TGFITE` | Itens de notas/pedidos |

## Serialização

O Gateway usa um formato proprietário onde valores são encapsulados em `{ "$": valor }`. O SDK faz essa conversão automaticamente:

```
Input do usuário:   { CODPROD: '1001', DESCRPROD: 'Produto' }
Enviado ao Gateway: { CODPROD: { "$": "1001" }, DESCRPROD: { "$": "Produto" } }
Retornado ao user:  { CODPROD: '1001', DESCRPROD: 'Produto' }
```

---

## Quando Usar Gateway vs REST v1?

| Cenário | Usar |
|---------|------|
| Endpoint REST v1 existe | REST v1 (tipagem mais forte) |
| Sem endpoint REST v1 (TipoNegociacao, ModeloNota) | **Gateway** |
| Consulta com filtros complexos (joins, subqueries) | Gateway |
| Consulta de entidade customizada | Gateway |
| Operações CRUD em entidades arbitrárias | Gateway |

---

## Links

- [Tipos: LoadRecordsParams, LoadRecordParams, SaveRecordParams, GatewayDataRow](./tipos.md#gateway-crud-genérico)
- [Cadastros (wrappers de alto nível)](./cadastros.md)
- [SankhyaClient](./cliente-sdk.md)
