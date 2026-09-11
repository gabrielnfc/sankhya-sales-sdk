# sankhya.produtos

Módulo para consulta de catálogo de produtos, componentes, alternativos, volumes e grupos.

**API Layer:** REST v1 + Gateway
**Base path:** `/v1/produtos`, `/v1/grupos-produto`, Gateway MGE

> **`volumesProduto` e `setTipoControle` exigem dependências injetadas** (`dbExplorer`, e
> `dataset` no segundo). O `SankhyaClient` injeta as duas: use `sankhya.produtos`. Quem
> instancia o resource à mão passa `new ProdutosResource(http, { dataset, dbExplorer })`
> — `new ProdutosResource(http)` continua válido e os demais métodos seguem funcionando.

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

> **Não é o caminho recomendado (M54).** Medido em 2026-09-03 no sandbox,
> `/produtos/{id}/volumes` devolve `[]` mesmo para produto com `TGFVOA` populado. Use
> [`volumesProduto()`](#volumesprodutocodigoproduto), que lê a mesma informação por SQL.
> Sem `@deprecated` de propósito: a medição é de sandbox, e depreciar seria sinal semver
> para todo consumidor.
>
> Este endpoint devolve bloco `pagination` real, que versões anteriores descartavam — o
> método entregava só a primeira página. Agora percorre todas internamente, então pode
> fazer N requisições e falhar no meio de uma varredura longa.

---

### `volumesProduto(codigoProduto)`

Lê os volumes do produto em `TGFVOA` por **SQL** (`dbExplorer.query`). **Novo em 1.6.0.**

```typescript
sankhya.produtos.volumesProduto(codigoProduto: number): Promise<VolumeProduto[]>
```

**Retorno:** `{ codProd, codVol, quantidade, lastro, camadas, ativo }[]`; `[]` quando não
há cadastro. `quantidade` é o fator de conversão un/volume; `lastro × camadas` dá caixas
por palete.

```typescript
const [cx] = await sankhya.produtos.volumesProduto(13609);
// { codProd: 13609, codVol: 'CX', quantidade: 72, lastro: 12, camadas: 4, ativo: true }
```

**SQL emitido** (colunas e `WHERE` na forma medida do censo T0-3,
`spike-raw/censos/censos.ts:81-82,90-91`):

```sql
SELECT CODPROD, CODVOL, QUANTIDADE, LASTRO, CAMADAS, ATIVO
FROM TGFVOA WHERE CODPROD = <codigoProduto> ORDER BY CODVOL
```

O filtro `ATIVO = 'S'` do censo **não** entra: o método devolve `ativo` e quem decide é o
chamador. O `ORDER BY` está lá para a ordem não depender do plano do banco.

**Erros:** `VALIDATION_ERROR` se `codigoProduto` não for inteiro positivo (é
**interpolado** no SQL — guarda de injeção, G3) **ou se a dependência `dbExplorer` não
tiver sido injetada** · `PARSE_ERROR` em `CODPROD` vazio, não numérico ou `<= 0`.

#### Por que SQL e não Gateway (RD-7)

Até a 1.5 este método chamava `CRUDServiceProvider.loadRecords` com
`rootEntity: 'VolumeProduto'` — nome que era **premissa, nunca medida**. A lane de
integração mediu no sandbox em 2026-09-11: **2 de 2** chamadas devolveram
`GatewayError: Erro interno (NPE)` (transactionId `B13E2C8D39AEA4CE10EAE94BCF73F6FC`),
com 0 linhas e 0 colunas. M54 sempre foi medido por SQL; é por SQL que se lê. Medido verde
na mesma lane: `CODPROD 13609` → `{ quantidade: 72, lastro: 12, camadas: 4 }`.

#### Cadastro incompleto é o caso comum (M57)

Só **38,4%** dos PA ativos têm `QUANTIDADE > 1`, e 318 dos 513 PA do censo não têm
`LASTRO`+`CAMADAS`. Por isso `QUANTIDADE`, `LASTRO` e `CAMADAS` vazios viram **0** e
produto sem volume devolve `[]` **sem lançar** — a decisão de tratar a lacuna é do
consumidor (REQ-CNT-5).

> **`quantidade: 0` é indistinguível de "sem cadastro" (D-05).** O SDK não separa os dois
> casos; quem consome precisa tratar `0` como "sem cadastro", não como "fator 0".

`CODPROD` é a identidade da linha: vazio, não numérico ou `<= 0` **lança**, porque `0` ali
seria um produto inventado.

#### Uma chamada, sem paginação — e a afirmação é do CLIENTE

`dbExplorer.query` não expõe teto de linhas nem flag de truncamento, e **nenhum spike
mediu `DbExplorerSP.executeQuery` sem `OFFSET/FETCH`** — os censos sempre paginaram
(`censos.ts:95,188`). O que torna o risco nulo na prática é o tamanho do dado: `TGFVOA`
tem **no máximo 2 linhas por produto** nos 513 PA do censo T0-3. Por isso não há
`INCOMPLETE_READ` aqui; se um dia o servidor truncar, será preciso medir e paginar.

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

### `setTipoControle(input)`

Vira o controle de lote do produto (`TGFPRO.TIPCONTEST`). **Novo em 1.6.0.**

```typescript
sankhya.produtos.setTipoControle(input: SetTipoControleInput): Promise<void>
```

| Campo | Tipo | Descrição |
|---|---|---|
| `codProd` | `number` | `CODPROD` (inteiro positivo) |
| `tipo` | `'L' \| 'N'` | `'L'` liga o controle por lote, `'N'` desliga |
| `usaLoteDtVal` | `boolean` | `USALOTEDTVAL`: `true` grava `'S'`, `false` grava `'N'` |

```typescript
await sankhya.produtos.setTipoControle({ codProd: 10015, tipo: 'L', usaLoteDtVal: true });
```

**Endpoint Gateway:** `DatasetSP.save` sobre a entidade `Produto`
(`fields: CODPROD, TIPCONTEST, USALOTEDTVAL`, fixture `spike-raw/virada/t05e.ts:15`)

**Erros:** `VALIDATION_ERROR` se faltar `dbExplorer`/`dataset` (nomeando a dep), se
`codProd` não for inteiro positivo, se `tipo` não for `'L'`/`'N'`, ou se houver **saldo**
(`/saldo/`) ou **reserva** (`/reserva/`) em qualquer linha — em todos os casos **nada é
gravado** · `PARSE_ERROR` em coluna vazia ou não numérica. Erro do `dbExplorer` propaga
inalterado.

#### O que o ERP exige

**A trava é de saldo, não de permissão (M103).** O gatilho `TRG_INC_UPD_TGFPRO` recusa a
alteração com `SELECT … FROM TGFEST WHERE CODPROD = :NEW.CODPROD AND ESTOQUE <> 0` —
**sem filtro de empresa, local ou controle**. Por isso o `SELECT` desta prova é **global**:

```sql
SELECT CODEMP, CODLOCAL, CONTROLE, ESTOQUE, RESERVADO
FROM TGFEST WHERE CODPROD = <codProd> ORDER BY CODEMP, CODLOCAL
```

Filtrar por `CODEMP` provaria a empresa errada, e a virada seria recusada pelo ERP com
saldo em outra.

**A prova é um `SELECT` independente. O eco do `save` nunca é prova (I3)** — foi
exatamente assim que a gravação de `'L'` ficou (b) parcial no spike (M104): o `save`
respondeu OK e ninguém releu a tabela.

**`RESERVADO` também trava**, embora o gatilho só olhe `ESTOQUE`: com reserva viva, a baixa
que zeraria o saldo é recusada (`DISPONÍVEL = ESTOQUE − RESERVADO`, M102), e virar o
controle sob reserva deixa pedido aberto apontando para um controle que mudou. **A
liberação das reservas é ordem de negócio sobre pedidos e fica FORA do SDK**; aqui o SDK
apenas recusa.

**`SELECT` com 0 linhas PROSSEGUE — (a) medido (RD-6).** A linha de `TGFEST` some quando
zera (M91), e a virada de M104 aconteceu justamente com o read-back devolvendo `rows: []`
(`spike-raw/virada/T05E_RB_EST_ZERO_GLOBAL.json`). Zero linhas **é** saldo zero. Produto
inexistente não é assunto desta guarda: o `save` com `CODPROD` inválido falha no próprio
ERP.

O que a guarda exige é que o `SELECT` tenha **executado**: falha de rede ou do DbExplorer
**propaga** e nunca é lida como "0 linhas".

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

- [Tipos: Produto, GrupoProduto, Volume, VolumeProduto, ComponenteProduto, SetTipoControleInput](./tipos.md#produtos)
- [Estoque por lote (`porLote`)](./estoque.md#porloteinput)
- [Lotes: entrada 1813 / baixa 1811](./lotes.md)
- [DbExplorer (o caminho de `volumesProduto`)](./db-explorer.md)
- [Preços](./precos.md)
- [Estoque](./estoque.md)
- [SankhyaClient](./cliente-sdk.md)
