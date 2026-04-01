# sankhya.financeiros

Módulo para gerenciamento de títulos financeiros: receitas, despesas, tipos de pagamento, moedas, contas bancárias e TEF.

**API Layer:** REST v1
**Base path:** `/v1/financeiros`

---

## Métodos — Tipos de Pagamento

### `listarTiposPagamento(params?)`

Lista tipos de pagamento.

```typescript
sankhya.financeiros.listarTiposPagamento(params?: {
  page?: number;
  subTipoPagamento?: SubTipoPagamento;
}): Promise<PaginatedResult<TipoPagamento>>
```

**SubTipos de Pagamento:**

| Valor | Enum | Descrição |
|-------|------|-----------|
| 1 | `SubTipoPagamento.AVista` | À vista |
| 2 | `SubTipoPagamento.APrazo` | A prazo |
| 3 | `SubTipoPagamento.Parcelada` | Parcelada |
| 4 | `SubTipoPagamento.ChequePredatado` | Cheque pré-datado |
| 5 | `SubTipoPagamento.Crediario` | Crediário |
| 6 | `SubTipoPagamento.Financeira` | Financeira |
| 7 | `SubTipoPagamento.CartaoCredito` | Cartão de crédito |
| 8 | `SubTipoPagamento.CartaoDebito` | Cartão de débito |
| 9 | `SubTipoPagamento.Voucher` | Voucher |
| 10 | `SubTipoPagamento.PIX` | PIX |
| 11 | `SubTipoPagamento.PIXPOS` | PIX POS |

**Exemplo:**

```typescript
// Listar apenas tipos de pagamento à vista
const tipos = await sankhya.financeiros.listarTiposPagamento({
  subTipoPagamento: SubTipoPagamento.AVista,
});
```

**Endpoint REST:** `GET /v1/financeiros/tipos-pagamento?page={page}&subTipoPagamento={tipo}`

### `buscarTipoPagamento(codigoTipoPagamento)`

```typescript
sankhya.financeiros.buscarTipoPagamento(codigoTipoPagamento: number): Promise<TipoPagamento>
```

**Endpoint REST:** `GET /v1/financeiros/tipos-pagamento/{codigoTipoPagamento}`

---

## Métodos — Receitas

### `listarReceitas(filtro?)`

Lista receitas (títulos a receber) com filtros.

```typescript
sankhya.financeiros.listarReceitas(filtro?: ReceitasFiltro): Promise<PaginatedResult<Receita>>
```

| Parâmetro | Tipo | Obrigatório | Descrição |
|-----------|------|-------------|-----------|
| `page` | `number` | Não (default: 1) | Página (50 registros/página) |
| `codigoEmpresa` | `number` | Não | CODEMP |
| `codigoParceiro` | `number` | Não | CODPARC |
| `statusFinanceiro` | `StatusFinanceiro` | Não | 1=Aberto, 2=Baixado, 3=Todos |
| `tipoFinanceiro` | `TipoFinanceiro` | Não | 1=Real, 2=Provisão, 3=Todos |
| `dataNegociacaoInicio` | `string` | Não | `dd/mm/aaaa` |
| `dataNegociacaoFinal` | `string` | Não | `dd/mm/aaaa` |

**Exemplo:**

```typescript
// Títulos abertos de um cliente
const receitas = await sankhya.financeiros.listarReceitas({
  codigoParceiro: 123,
  statusFinanceiro: StatusFinanceiro.Aberto,
  tipoFinanceiro: TipoFinanceiro.Real,
});

for (const receita of receitas.data) {
  console.log(`NUFIN ${receita.codigoFinanceiro}: R$ ${receita.valorParcela} — Vence: ${receita.dataVencimento}`);
}
```

**Endpoint REST:** `GET /v1/financeiros/receitas?page={page}&...`

### `registrarReceita(dados)`

```typescript
sankhya.financeiros.registrarReceita(dados: Record<string, unknown>): Promise<unknown>
```

**Endpoint REST:** `POST /v1/financeiros/receitas`

### `atualizarReceita(codigoFinanceiro, dados)`

```typescript
sankhya.financeiros.atualizarReceita(
  codigoFinanceiro: number,
  dados: Record<string, unknown>
): Promise<unknown>
```

**Endpoint REST:** `PUT /v1/financeiros/receitas/{codigoFinanceiro}`

### `baixarReceita(dados)`

```typescript
sankhya.financeiros.baixarReceita(dados: Record<string, unknown>): Promise<unknown>
```

**Endpoint REST:** `POST /v1/financeiros/receitas/baixa`

---

## Métodos — Despesas

### `listarDespesas(params?)`

```typescript
sankhya.financeiros.listarDespesas(params?: PaginationParams): Promise<PaginatedResult<Receita>>
```

**Endpoint REST:** `GET /v1/financeiros/despesas?page={page}`

### `registrarDespesa(dados)`

```typescript
sankhya.financeiros.registrarDespesa(dados: Record<string, unknown>): Promise<unknown>
```

**Endpoint REST:** `POST /v1/financeiros/despesas`

### `atualizarDespesa(codigoFinanceiro, dados)`

```typescript
sankhya.financeiros.atualizarDespesa(
  codigoFinanceiro: number,
  dados: Record<string, unknown>
): Promise<unknown>
```

**Endpoint REST:** `PUT /v1/financeiros/despesas/{codigoFinanceiro}`

### `baixarDespesa(dados)`

```typescript
sankhya.financeiros.baixarDespesa(dados: Record<string, unknown>): Promise<unknown>
```

**Endpoint REST:** `POST /v1/financeiros/despesas/baixa`

---

## Métodos — Moedas

### `listarMoedas(params?)`

```typescript
sankhya.financeiros.listarMoedas(params?: PaginationParams): Promise<PaginatedResult<Moeda>>
```

**Endpoint REST:** `GET /v1/financeiros/moedas?page={page}`

### `buscarMoeda(codigoMoeda)`

```typescript
sankhya.financeiros.buscarMoeda(codigoMoeda: number): Promise<Moeda>
```

**Endpoint REST:** `GET /v1/financeiros/moedas/{codigoMoeda}`

### `cotacoesMoeda(codigoMoeda)`

```typescript
sankhya.financeiros.cotacoesMoeda(codigoMoeda: number): Promise<unknown>
```

**Endpoint REST:** `GET /v1/financeiros/moedas/{codigoMoeda}/cotacoes`

---

## Métodos — Contas Bancárias

### `listarContasBancarias()`

```typescript
sankhya.financeiros.listarContasBancarias(): Promise<ContaBancaria[]>
```

**Endpoint REST:** `GET /v1/financeiros/contas-bancaria`

### `buscarContaBancaria(codigoContaBancaria)`

```typescript
sankhya.financeiros.buscarContaBancaria(codigoContaBancaria: number): Promise<ContaBancaria>
```

**Endpoint REST:** `GET /v1/financeiros/contas-bancaria/{codigoContaBancaria}`

---

## Métodos — TEF

### `listarBandeirasTef()`

```typescript
sankhya.financeiros.listarBandeirasTef(): Promise<unknown>
```

**Endpoint REST:** `GET /v1/financeiros/bandeiras-tef`

### `listarRedesTef()`

```typescript
sankhya.financeiros.listarRedesTef(): Promise<unknown>
```

**Endpoint REST:** `GET /v1/financeiros/redes-tef`

---

## Links

- [Tipos: Receita, TipoPagamento, SubTipoPagamento, Moeda, ContaBancaria](./tipos.md#financeiros)
- [Pedidos](./pedidos.md)
- [SankhyaClient](./cliente-sdk.md)
