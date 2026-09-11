# sankhya.gateway

Módulo para operações CRUD genéricas via Gateway Services. Permite acessar **qualquer entidade** do ERP Sankhya.

**API Layer:** Gateway
**Módulo:** MGE
**Base path:** `/gateway/v1/mge/service.sbr`

---

## Métodos

> **Formato do retorno.** `loadRecords`/`loadRecord` devolvem `Record<string, string>`
> **plano** — os nomes reais das colunas, desserializados do formato Gateway. Não existe
> `row.fields.X`: é `row.X`.

### `loadRecords(params)`

Consulta múltiplos registros de qualquer entidade.

```typescript
sankhya.gateway.loadRecords(params: LoadRecordsParams): Promise<Record<string, string>[]>
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
const produtos = await sankhya.gateway.loadRecords({
  entity: 'Produto',
  fields: 'CODPROD,DESCRPROD,MARCA,CODVOL,ATIVO',
  criteria: "this.ATIVO = 'S'",
  page: 0,
});

for (const row of produtos) {
  console.log(`${row.CODPROD} — ${row.DESCRPROD}`);
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

**Endpoint Gateway:** `CRUDServiceProvider.loadRecords` (leitura — elegível a retry)

> Devolve **uma página** (`offsetPage`), não o conjunto inteiro. Leitura paginada com
> página cheia é truncada, nunca censo: pagine até vir página incompleta antes de contar
> ou concluir "não existe".

---

### `loadRecord(params)`

Consulta um registro único por chave primária.

```typescript
sankhya.gateway.loadRecord(params: LoadRecordParams): Promise<Record<string, string> | null>
```

| Parâmetro | Tipo | Obrigatório | Descrição |
|-----------|------|-------------|-----------|
| `entity` | `string` | Sim | Nome da entidade |
| `fields` | `string` | Sim | Campos separados por vírgula |
| `primaryKey` | `Record<string, string>` | Sim | Chave primária (ex: `{ CODPROD: '1001' }`) |

**Retorno:** o registro, ou **`null`** se nada casar.

**Exemplo:**

```typescript
const produto = await sankhya.gateway.loadRecord({
  entity: 'Produto',
  fields: 'CODPROD,DESCRPROD,MARCA,CODVOL',
  primaryKey: { CODPROD: '1001' },
});

if (produto) console.log(produto.DESCRPROD);
```

**Endpoint Gateway:** `CRUDServiceProvider.loadRecords` — o SDK traduz a `primaryKey`
para um `criteria` (`this.CODPROD = '1001'`, com `'` escapado) e devolve a 1ª linha.
**Não existe um serviço `CRUDServiceProvider.loadRecord`** no caminho do SDK.

Nomes de campo da `primaryKey` são validados antes da rede: fora de
`[A-Za-z_][A-Za-z0-9_]*`, ou `__proto__`/`constructor`/`prototype`, lançam
`VALIDATION_ERROR`.

---

### `saveRecord(params)`

Insere ou altera um registro.

```typescript
sankhya.gateway.saveRecord(params: SaveRecordParams): Promise<Record<string, string>>
```

| Parâmetro | Tipo | Obrigatório | Descrição |
|-----------|------|-------------|-----------|
| `entity` | `string` | Sim | Nome da entidade |
| `fields` | `string` | Sim | Campos para retorno |
| `data` | `Record<string, string>` | Sim | Campos e valores → `dataRow.localFields` |
| `primaryKey` | `Record<string, string>` | Não | Chave do registro → `dataRow.key`. **Omita para inserir** |

> **Mudou na 1.6.0 (M34).** Até a 1.5.0 o SDK mandava os campos direto em
> `dataSet.entity`, e a documentação dizia "PK dentro de `data`". O formato que o ERP
> aceita é `dataSet.dataRow.{key, localFields}`, e a chave tem campo próprio:
>
> ```jsonc
> { "dataSet": { "rootEntity": "Produto", "includePresentationFields": "N",
>     "dataRow": {
>       "localFields": { "TIPCONTEST": { "$": "L" } },
>       "key":         { "CODPROD":    { "$": "10015" } }
>     },
>     "entity": { "fieldset": { "list": "CODPROD,TIPCONTEST" } } } }
> ```
>
> **`primaryKey: {}` é recusada** com `VALIDATION_ERROR`: um objeto vazio não diz se você
> quis inserir ou atualizar — omita o campo para inserir. Qual efeito (inserção vs.
> atualização) cada forma produz no ERP é premissa ainda **não medida** contra o sandbox.

**Exemplo — INSERT (sem `primaryKey`):**

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

**Exemplo — UPDATE (com `primaryKey`):**

```typescript
await sankhya.gateway.saveRecord({
  entity: 'Parceiro',
  fields: 'CODPARC,NOMEPARC',
  primaryKey: { CODPARC: '123' },
  data: { NOMEPARC: 'Nome Atualizado' },
});
```

**Endpoint Gateway:** `CRUDServiceProvider.saveRecord` (escrita — **nunca** retentado
automaticamente)

---

### `call(modulo, serviceName, body, options?)`

Chama um serviço **arbitrário** do Gateway e devolve o `responseBody` cru.

```typescript
sankhya.gateway.call<T>(
  modulo: 'mge' | 'mgecom',
  serviceName: string,
  body: Record<string, unknown>,
  options?: RequestOptions,
): Promise<T>
```

| Parâmetro | Tipo | Obrigatório | Descrição |
|-----------|------|-------------|-----------|
| `modulo` | `'mge' \| 'mgecom'` | Sim | Módulo do Gateway |
| `serviceName` | `string` | Sim | Nome do serviço (ex: `'CACSP.confirmarNota'`) |
| `body` | `Record<string, unknown>` | Sim | Corpo do `requestBody`, **já no formato do serviço** |
| `options` | `RequestOptions` | Não | `timeout`, `idempotencyKey` |

**Novo em 1.6.0.** Escape hatch para serviços sem método dedicado no SDK. O corpo vai como
veio — nenhuma serialização `{ "$": valor }` é aplicada — e a resposta volta sem
transformação. A escrita **nunca** é retentada automaticamente.

```typescript
const out = await sankhya.gateway.call('mgecom', 'CACSP.confirmarNota', {
  nota: { NUNOTA: { $: '1378934' } },
});
```

> Prefira o resource dedicado quando existir: [`notas`](./notas.md),
> [`faturamento`](./faturamento.md), [`dataset`](./dataset.md) e
> [`conferencia`](./conferencia.md) carregam os guards e o read-back que `call()` não tem.

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
| `Estoque` | `TGFEST` | Saldo por lote — para escrita use [`dataset`](./dataset.md) e [`lotes`](./lotes.md) |
| `CabecalhoConferencia` | `TGFCON2` | Conferência nativa — use [`conferencia`](./conferencia.md) |

## Serialização

O Gateway usa um formato proprietário onde valores são encapsulados em `{ "$": valor }`. O SDK faz essa conversão automaticamente:

```
Input do usuário:   { CODPROD: '1001', DESCRPROD: 'Produto' }
Enviado ao Gateway: { CODPROD: { "$": "1001" }, DESCRPROD: { "$": "Produto" } }
Retornado ao user:  { CODPROD: '1001', DESCRPROD: 'Produto' }
```

Em `saveRecord`, `data` e `primaryKey` passam pelo mesmo serializador, cada um no seu
lugar dentro de `dataRow`. Em `call()`, **nada** é serializado: o corpo vai como veio.

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
- [DbExplorer — leitura por SQL](./db-explorer.md)
- [Dataset — escrita tipada sobre o `DatasetSP`](./dataset.md)
- [Cadastros (wrappers de alto nível)](./cadastros.md)
- [SankhyaClient](./cliente-sdk.md)
