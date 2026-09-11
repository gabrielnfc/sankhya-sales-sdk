# sankhya.estoque

Módulo para consulta de estoque e locais de armazenamento.

**API Layer:** REST v1 + Gateway
**Base path:** `/v1/estoque`, Gateway MGECOM

---

## Métodos

> **`porLote` exige a dependência `dbExplorer` injetada.** O `SankhyaClient` injeta: use
> `sankhya.estoque`. Quem instancia o resource à mão passa
> `new EstoqueResource(http, { dbExplorer })`.

### `porLote(input)`

Lê as linhas de `TGFEST` de um produto — o saldo **por lote**, que a REST v1 não expõe
(`/estoque/produtos/{id}` agrega por local, sem `CONTROLE`). **Novo em 1.6.0.**

```typescript
sankhya.estoque.porLote(input: {
  codProd: number;
  codEmp?: number;
  codLocal?: number;
}): Promise<EstoqueLote[]>
```

| Parâmetro | Tipo | Obrigatório | Descrição |
|-----------|------|-------------|-----------|
| `codProd` | `number` | Sim | `CODPROD` (inteiro positivo) |
| `codEmp` | `number` | Não | `CODEMP`. Omitido: **todas** as empresas |
| `codLocal` | `number` | Não | `CODLOCAL`. Omitido: **todos** os locais |

**Exemplo:**

```typescript
const lotes = await sankhya.estoque.porLote({ codProd: 10077, codEmp: 2 });
```

**SQL emitido:**

```sql
SELECT CODEMP, CODLOCAL, CODPROD, CONTROLE, TIPO, CODPARC,
       ESTOQUE, RESERVADO, DTVAL, DTFABRICACAO, STATUSLOTE
FROM TGFEST WHERE CODPROD = <codProd> [AND CODEMP = …] [AND CODLOCAL = …]
ORDER BY CODEMP, CODLOCAL, CONTROLE
```

Colunas escolhidas a partir de `spike-raw/virada/D1_EST_10015_TODAS.json:2`, com ordem
própria: `CODPROD` foi acrescentado (a leitura pode ser global) e `WMSBLOQUEADO`/`ATIVO`
ficaram de fora (`WMSBLOQUEADO` não é gate, M98). **Não é a fixture reproduzida.**

**Campos do retorno (`EstoqueLote`):**

| Campo | Tipo | Descrição |
|---|---|---|
| `codEmp`, `codLocal`, `codProd` | `number` | Identidade da linha |
| `controle` | `string` | `' '` é a linha **flutuante**, de reserva sem lote (M92) |
| `tipo` | `string` | Medido: `'P'` |
| `codParc` | `number` | Medido: `0` |
| `estoque` | `number` | Saldo |
| `reservado` | `number` | Disponível = `estoque - reservado` (M102) |
| `dtVal`, `dtFab` | `string \| null` | **Forma crua do ERP**, `null` quando vazias |
| `statusLote` | `string` | Domínio fechado `('A','Q','P','N','R')` (M89) |

**Erros:** `VALIDATION_ERROR` se faltar o `dbExplorer` (nomeando a dep) ou se algum código
não for inteiro positivo — nesse caso **nenhuma consulta é feita** · `PARSE_ERROR` em
coluna numérica vazia ou não numérica.

#### O que o ERP exige (e o que a leitura NÃO prova)

**A leitura global é a que a virada de lote exige (M103).** Sem `codEmp`/`codLocal` o
`SELECT` cobre todas as empresas e locais — é assim que
[`produtos.setTipoControle`](./produtos.md#settipocontroleinput) prova saldo zero.

**`[]` não prova saldo zero nem produto sem lote (I4).** A linha zerada **some** de
`TGFEST` (M91). Leitura vazia é leitura vazia.

**Números têm parse estrito.** Coluna vazia ou não numérica **lança** em vez de virar `0`
— um `0` inventado em `estoque`/`reservado` seria lido como "pode baixar" ou "pode virar
o controle".

**As datas vêm cruas.** O SDK não formata data, nem na ida nem na volta: lido nu, o Oracle
devolve `'05092027 00:00:00'` (medido em `spike-raw/lote/T18_RB_EST_FINAL.json`), que
**não** é o `dd/MM/yyyy` que [`lotes.entrada1813`](./lotes.md#entrada1813input) espera.
Converta no chamador.

---

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

### ~~`detalhes(codigoProduto)` — Gateway~~ — nunca existiu

_Removido da documentação em 2026-09-11 (D5.0). Esta página documentava
`sankhya.estoque.detalhes()` sobre `ConsultaProdutosSP.getDetalhesEstoques`, mas
**o método não existe** em `src/resources/estoque.ts` — nem hoje, nem no histórico do
repositório. O caso de uso que ele prometia (estoque por lote / controle) é o de
[`porLote`](#porloteinput), que passou a existir na 1.6.0._

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
- **Estoque zero:** A REST v1 não retorna produtos com estoque zero — e `porLote` também não, porque a linha zerada some de `TGFEST` (M91). Em nenhum dos dois casos a ausência **prova** saldo zero (I4).
- **Por lote:** para saldo por `CONTROLE`, validade e reserva, use `porLote` — a REST v1 agrega por local e não devolve nada disso.

---

## Links

- [Tipos: Estoque, LocalEstoque, EstoqueLote](./tipos.md#estoque)
- [Lotes: entrada 1813 / baixa 1811](./lotes.md)
- [Produtos: `setTipoControle`](./produtos.md#settipocontroleinput)
- [Produtos](./produtos.md)
- [Pedidos](./pedidos.md)
- [SankhyaClient](./cliente-sdk.md)
