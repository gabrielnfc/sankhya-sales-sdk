# sankhya.metadata

Descoberta de metadata de entidades Sankhya. Lista as colunas reais de uma entidade — **incluindo campos personalizados `AD_*`** — sem o consumidor precisar saber a tabela física Oracle nem montar SQL na mão.

**API Layer:** Gateway (DbExplorer)
**Módulo:** MGE
**Serviço:** `DbExplorerSP.executeQuery`

> Requer que o usuário OAuth tenha permissão de **DbExplorer**. Sem ela, a chamada lança `GatewayError`.

---

## Métodos

### `listFields(entityOrTable, options?)`

Lista as colunas de uma entidade lógica (ex: `CabecalhoNota`) ou de uma tabela física (ex: `TGFCAB`) via passthrough.

```typescript
sankhya.metadata.listFields(
  entityOrTable: string,
  options?: ListFieldsOptions,
): Promise<EntityField[]>
```

| Parâmetro | Tipo | Obrigatório | Descrição |
|-----------|------|-------------|-----------|
| `entityOrTable` | `string` | Sim | Nome lógico da entidade (mapa curado) ou nome da tabela física Oracle. |
| `options.customOnly` | `boolean` | Não | Quando `true`, retorna apenas campos personalizados `AD_*`. Default `false`. |

Entidades lógicas mapeadas: `CabecalhoNota`→`TGFCAB`, `ItemNota`→`TGFITE`, `Parceiro`→`TGFPAR`, `Produto`→`TGFPRO`, `Vendedor`→`TGFVEN`, `TipoOperacao`→`TGFTOP`, `Preco`→`TGFPRC`, `Estoque`→`TGFEST`, `Natureza`→`TGFNAT`, `GrupoProduto`→`TGFGRU`, `Financeiro`→`TGFFIN`, `Empresa`→`TSIEMP`. Nomes fora do mapa são tratados como tabela física (validados por `^[A-Z0-9_]+$`).

**Retorno:** `EntityField[]`

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `name` | `string` | Nome da coluna (ex: `NUNOTA`, `AD_CODRASTREIO`). |
| `type` | `string` | Tipo Oracle (`NUMBER`, `VARCHAR2`, `DATE`, `FLOAT`...). |
| `length` | `number` | `DATA_LENGTH` bruto (bytes). |
| `nullable` | `boolean` | `true` se aceita `NULL`. |
| `precision` | `number?` | Precisão numérica, quando aplicável. |
| `scale` | `number?` | Escala numérica, quando aplicável. |
| `custom` | `boolean` | `true` para campos personalizados (`AD_*`). |

```typescript
// Todas as colunas de CabecalhoNota
const campos = await sankhya.metadata.listFields('CabecalhoNota');

// Apenas os campos personalizados AD_
const custom = await sankhya.metadata.listFields('CabecalhoNota', { customOnly: true });
for (const f of custom) {
  console.log(`${f.name} (${f.type})`); // ex: AD_NUMPEDIDO (VARCHAR2)
}
```

---

## Fluxo de campos personalizados (`AD_*`)

`listFields` descobre **quais** campos `AD_*` existem; o envio é feito pelos recursos de domínio:

1. **Descobrir** — `metadata.listFields(entidade, { customOnly: true })`.
2. **Escrever** —
   - Pedido: `pedidos.criar({ ..., camposExtras: { AD_*: ... } })` (flat).
   - Cliente: `clientes.criar({ ..., camposAdicionais: { AD_*: ... } })` (objeto aninhado).
   - Financeiro: `financeiros.registrarReceita({ ..., camposExtras: { AD_*: ... } })` (flat).
   - Qualquer entidade: `gateway.saveRecord({ entity, fields, data: { AD_*: ... } })`.
3. **Ler** — `gateway.loadRecord`/`loadRecords` com os nomes `AD_*` na lista de `fields`.

---

## Observações

- Implementado sobre `DbExplorerSP.executeQuery` — o único provedor de metadata disponível a partir do Sankhya Om (`MetadataProvider`/`DynamicEntityMetadataSP` não existem nas versões testadas).
- Consulta `USER_TAB_COLUMNS` com fallback para `ALL_TAB_COLUMNS` (cobre instalações multi-schema onde a tabela é alcançada via synonym/grant).
- Entidade/tabela inexistente resulta em lista vazia (não lança).
