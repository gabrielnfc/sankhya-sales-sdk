# sankhya.dbExplorer

Consulta SQL **somente-leitura** contra a base do ERP. Escape hatch tipado para o que
nenhum resource dedicado cobre.

**API Layer:** Gateway
**Módulo:** MGE
**Serviço:** `DbExplorerSP.executeQuery`
**Novo em:** 1.6.0

> **Pré-requisito.** O usuário OAuth precisa ter permissão para executar o DbExplorer;
> sem ela o servidor devolve `GatewayError`.

---

## Métodos

### `query(sql, options?)`

Executa um `SELECT` e devolve as linhas como dicionários chave-valor.

```typescript
sankhya.dbExplorer.query<T extends DbExplorerRow>(
  sql: string,
  options?: RequestOptions,
): Promise<T[]>
```

| Parâmetro | Tipo | Obrigatório | Descrição |
|-----------|------|-------------|-----------|
| `sql` | `string` | Sim | `SELECT` puro, **sem `;`**. A interpolação é responsabilidade do chamador |
| `options` | `RequestOptions` | Não | `timeout`, `signal` |

**Retorno:** `T[]` — uma entrada por linha; `[]` quando a consulta não devolve nada.
Cada célula vira `string`: o DbExplorer **não** garante string (`CODLOCAL` chega como
`number`). Só `null`/`undefined` viram `''`; `0` e `false` viram `'0'` e `'false'`,
porque são valores reais do ERP.

**Exemplo:**

```typescript
const rows = await sankhya.dbExplorer.query<{ NUNOTA: string; STATUSNOTA: string }>(
  'SELECT NUNOTA, STATUSNOTA FROM TGFCAB WHERE NUNOTA = 1889309',
);
```

**Erros:**

| Código | Quando |
|---|---|
| `VALIDATION_ERROR` | o SQL não é `SELECT` puro — verificado **antes** da rede |
| `DB_EXPLORER_ROW_MISMATCH` | alguma linha tem número de colunas diferente de `fieldsMetadata` |
| `GATEWAY_ERROR` | erro de negócio Sankhya (inclui falta de permissão) |
| `AUTH_ERROR` | falha de autenticação |

---

## O que o SDK recusa antes da rede

A guarda é `/^\s*SELECT\b/i` **e** nenhum `;` em lugar algum
(`src/resources/db-explorer.ts:25,75`).

| SQL | Passa? | Por quê |
|---|---|---|
| `SELECT 1 FROM DUAL` | sim | — |
| `  select x from t` (espaços, minúsculas) | sim | a âncora tolera espaço e caixa |
| `INSERT INTO t SELECT 1 FROM DUAL` | **não** | sem a âncora `^`, um `INSERT` com subquery passaria |
| `DELETE FROM t WHERE id IN (SELECT …)` | **não** | idem |
| `SELECT 1 FROM DUAL; DROP TABLE X` | **não** | o DbExplorer aceita mais de um comando por chamada |

**Limites declarados (G9 — é guarda sintática por regex, não parser de SQL):**

- **Recusa** o que começa com outra palavra, inclusive CTE (`WITH x AS (…) SELECT …`) e
  comentário antes do `SELECT`. Falso negativo aceito: custa um erro a mais ao chamador.
- **Não impede** `SELECT … FOR UPDATE` nem `SELECT f_com_efeito_colateral()`, que
  escrevem apesar de serem `SELECT`. E `DbExplorerSP.executeQuery` está na allowlist de
  idempotentes (`src/core/http.ts:8-10`), então é **retentado até 3×**
  (`src/core/retry.ts:61-66`): um SQL com efeito seria reexecutado. Não use `query()`
  para isso — a responsabilidade é do chamador.

## Formato da resposta

O serviço devolve linhas **posicionais**: `rows[i][j]` corresponde a
`fieldsMetadata[j].name`. O SDK casa os dois e devolve objetos.

```jsonc
// resposta crua do Gateway
{
  "fieldsMetadata": [{ "name": "NUNOTA" }, { "name": "STATUSNOTA" }],
  "rows": [[1889309, "A"]]
}
// o que query() devolve
[{ "NUNOTA": "1889309", "STATUSNOTA": "A" }]
```

Linha com número de colunas diferente de `fieldsMetadata` **lança**
`DB_EXPLORER_ROW_MISMATCH` em vez de devolver um objeto parcial — resposta
inconsistente de fronteira externa não vira dado.

**Colunas homônimas colapsam.** `SELECT A.CODPROD, B.CODPROD` devolve uma única chave
`CODPROD` (a última vence), sem erro. Use alias no SQL.

## Injeção é responsabilidade do chamador

Esta rota **não tem bind parameter**. Todo identificador interpolado precisa ser
validado antes — é o que os resources que usam `query()` fazem, sempre com
`Number.isInteger` (`notas.ts:64-71`, `faturamento.ts:71-80`, `conferencia.ts:47-54`,
`estoque.ts:60-67`).

```typescript
if (!Number.isInteger(nunota) || nunota <= 0) throw new Error('NUNOTA inválido');
const rows = await sankhya.dbExplorer.query(`SELECT … WHERE NUNOTA = ${nunota}`);
```

---

## Links

- [Tipos: `DbExplorerRow`, `DbExplorerRawResponse`](./tipos.md#dbexplorer)
- [Dataset (escrita tipada sobre o Gateway)](./dataset.md)
- [SankhyaClient](./cliente-sdk.md)
