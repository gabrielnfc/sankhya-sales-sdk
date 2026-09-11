# sankhya.dataset

Escrita e leitura tipadas sobre o `DatasetSP` do Gateway — o caminho que o ERP usa para
gravar em entidades MGE que a REST v1 não expõe (conferência, estoque por lote,
`TIPCONTEST`).

**API Layer:** Gateway
**Módulo:** MGE
**Serviços:** `DatasetSP.save`, `DatasetSP.removeRecord`, `CRUDServiceProvider.loadRecords`
**Novo em:** 1.6.0

> **Nada aqui é retentado automaticamente.** `save` e `removeRecord` são escrita e estão
> fora da allowlist de idempotentes (`src/core/http.ts:8-10`) — uma reexecução duplicaria
> o registro.

---

## `datasetRecord(fields, { pk?, set })`

Monta um registro resolvendo cada nome de campo para o seu **índice posicional** em
`fields` — que é o formato que `DatasetSP.save` exige.

```typescript
import { datasetRecord } from 'sankhya-sales-sdk';

datasetRecord(
  fields: readonly string[],
  input: { pk?: Record<string, string>; set: Record<string, string> },
): DatasetRecord
```

```typescript
datasetRecord(['NUNOTA', 'NUCONFATUAL'], {
  pk: { NUNOTA: '1889349' },
  set: { NUCONFATUAL: '281956' },
});
// => { pk: { NUNOTA: '1889349' }, values: { '1': '281956' } }
```

**Use sempre.** Escrever o índice à mão é a fonte de bug mais provável desta API: um
índice errado grava no campo errado do ERP, em silêncio. Campo de `set` que não está em
`fields` **lança** `VALIDATION_ERROR` citando o campo, e nada é montado.

É função de módulo, não método: o chamador precisa dela para montar `records` **antes**
de ter um resource em mãos.

---

## Métodos

### `save(params, options?)`

Insere ou atualiza registros.

```typescript
sankhya.dataset.save(
  params: DatasetSaveParams,
  options?: RequestOptions,
): Promise<DatasetSaveResult>
```

| Parâmetro | Tipo | Obrigatório | Descrição |
|-----------|------|-------------|-----------|
| `entityName` | `DatasetEntity` | Sim | União fechada de 7 entidades (ver abaixo) |
| `fields` | `readonly string[]` | Sim | Campos na ordem que indexa `records[].values` |
| `records` | `readonly DatasetRecord[]` | Sim | Ao menos 1; cada um com ao menos 1 valor |
| `standAlone` | `boolean` | Não (default `false`) | `true` desliga as regras/gatilhos da entidade no servidor |

**Registro sem `pk` insere; com `pk` atualiza** (M88). Inserção multi-record é suportada
e o servidor devolve só a chave gerada.

**Retorno:** `{ total: number; result: readonly (readonly string[])[] }` — `total`
convertido, `result` com toda célula em string.

```typescript
const fields = ['NUNOTA', 'NUCONFATUAL'];
const { total } = await sankhya.dataset.save({
  entityName: 'CabecalhoNota',
  fields,
  records: [datasetRecord(fields, { pk: { NUNOTA: '1889349' }, set: { NUCONFATUAL: '281956' } })],
});
```

**Erros:**

| Código | Quando |
|---|---|
| `VALIDATION_ERROR` | `records` vazio, ou algum record sem nenhum valor — **nenhuma chamada é feita** |
| `DATASET_SAVE_MALFORMED_RESPONSE` | a resposta não traz `total` ou `result` em forma utilizável, ou uma célula veio como objeto/array não previsto |
| `PARSE_ERROR` | `total` não é número |
| `GATEWAY_ERROR` / `AUTH_ERROR` | erro de negócio / autenticação |

> **Fail-closed declarado (G9).** Resposta malformada **lança**; nunca devolve
> `total: 0` ou `result: []`, que o chamador leria como "nada a fazer". Como o `throw`
> acontece **depois** da escrita, a mensagem diz explicitamente que o efeito no ERP é
> indeterminado e exige read-back antes de repetir (I3/I11).

---

### `removeRecord(params, options?)`

Remove registros por chave.

```typescript
sankhya.dataset.removeRecord(
  params: DatasetRemoveParams,
  options?: RequestOptions,
): Promise<void>
```

| Parâmetro | Tipo | Obrigatório | Descrição |
|-----------|------|-------------|-----------|
| `entityName` | `DatasetEntity` | Sim | Entidade alvo |
| `pks` | `ReadonlyArray<Record<string, string>>` | Sim | Chaves a remover |
| `standAlone` | `boolean` | Não (default `false`) | Desliga regras/gatilhos |

```typescript
await sankhya.dataset.removeRecord({
  entityName: 'ItemNota',
  pks: [{ NUNOTA: '1889280', SEQUENCIA: '1' }],
});
```

**Guarda contra "apagar tudo" (R2/G3), toda verificada antes da rede:**

| Entrada | Resultado |
|---|---|
| `pks: []` | `VALIDATION_ERROR` |
| `pks: [{}]` | `VALIDATION_ERROR` — filtro vazio apagaria a entidade inteira |
| `pks: [{ '': '1' }]` | `VALIDATION_ERROR` — nome de campo em branco é filtro vazio com outro nome |
| `pks: [{ NUNOTA: undefined }]` | `VALIDATION_ERROR` — `JSON.stringify` descarta o par e o servidor receberia `{}` |
| `pks: [{ NUNOTA: '' }]` ou `'   '` | `VALIDATION_ERROR` — mesmo efeito prático no filtro |

A mensagem cita a chave culpada e diz que **nenhuma chamada foi feita**.

---

### `load(params)`

Lê registros da entidade.

```typescript
sankhya.dataset.load(params: DatasetLoadParams): Promise<Record<string, string>[]>
```

| Parâmetro | Tipo | Obrigatório | Descrição |
|-----------|------|-------------|-----------|
| `entityName` | `DatasetEntity` | Sim | Entidade alvo |
| `fields` | `readonly string[]` | Sim | Campos a trazer |
| `criteria` | `string` | Não | Filtro SQL-like (ex: `"this.NUNOTA = 1889280"`) |
| `page` | `number` | Não | Página de offset (base 0) |

```typescript
const itens = await sankhya.dataset.load({
  entityName: 'ItemNota',
  fields: ['NUNOTA', 'CONTROLE'],
  criteria: 'this.NUNOTA = 1889280',
});
```

> **Por que não aceita `options`.** `load` delega a `gateway.loadRecords`
> (`CRUDServiceProvider.loadRecords`), que é o caminho medido — não existe um
> `DatasetSP.load` medido, e o SDK não inventa rota. O caminho delegado não repassa
> `RequestOptions`, e aceitar um parâmetro ignorado seria mentira de assinatura.

---

## Entidades (`DatasetEntity`)

União **fechada** de propósito: `save` escreve no ERP, e uma string livre abriria a porta
para qualquer entidade, inclusive as que movem saldo.

| Entidade | Tabela | Uso |
|---|---|---|
| `CabecalhoNota` | `TGFCAB` | Cabeçalho de nota/pedido, carimbo de separação, `NUCONFATUAL` |
| `ItemNota` | `TGFITE` | Itens, com `CONTROLE` e `ATUALESTOQUE` |
| `Estoque` | `TGFEST` | Datas do lote (`DTVAL`/`DTFABRICACAO`) — PK de **6 colunas** |
| `Produto` | `TGFPRO` | `TIPCONTEST` / `USALOTEDTVAL` |
| `CabecalhoConferencia` | `TGFCON2` | Conferência nativa |
| `DetalhesConferencia` | `TGFCOI2` | Itens bipados |
| `ContagemEstoque` | — | **SOMENTE leitura/histórico** |

> **`ContagemEstoque` não move estoque (M105).** Ela registra a contagem; o acerto de
> saldo continua sendo feito por nota com `ATUALESTOQUE`. A rota foi medida e descartada
> — não use `dataset.save` sobre ela esperando efeito em `TGFEST`.

## O que o ERP exige

**`values` é POSICIONAL.** O payload aceito indexa os valores pela posição em `fields`,
como string (`'0'`, `'1'`, …), não pelo nome do campo. É por isso que `datasetRecord`
existe.

**A resposta traz uma célula a mais: a metadata `_rmd` (RD-8).** Cada linha de `result`
vem com N células dos `fields` **mais** uma final:

```jsonc
{ "_rmd": { "provider": "PRODUTORMP", "CODPROD": { "decVlr": 4, "decQtd": 4 } } }
```

Medida em `spike-raw/faturamento/S1_DS_ITENS_1813.json` e `S1_DS_ESTOQUE_DATAS.json`
(06/09). São casas decimais e rótulo de lote para a tela do ERP — nada que uma escrita
precise. O SDK **descarta** essa célula e `result` traz só as células dos campos; ela
**não** é exposta no retorno, de propósito.

O reconhecimento é pela chave `_rmd` (objeto com exatamente essa chave), não pela
posição: excedente de outra forma, ou objeto não vazio em posição de campo, continua
lançando. Linha mais **curta** que `fields` segue válida — é a forma medida da inserção
multi-record (M88), em que o servidor devolve só a chave gerada.

---

## Links

- [Tipos: `DatasetEntity`, `DatasetRecord`, `DatasetSaveParams`, `DatasetSaveResult`](./tipos.md#dataset)
- [Conferência (usa `dataset` em todas as escritas)](./conferencia.md)
- [Lotes (entrada 1813 / baixa 1811)](./lotes.md)
- [DbExplorer (leitura por SQL)](./db-explorer.md)
- [SankhyaClient](./cliente-sdk.md)
