# Guia: Fluxo de Venda Completo

Passo a passo completo de uma venda B2B usando o `sankhya-sales-sdk`: buscar produto → preço contextualizado → criar pedido → confirmar → faturar.

## Diagrama do Fluxo

```
┌─────────────┐    ┌─────────────┐    ┌──────────────┐    ┌───────────┐    ┌──────────┐
│ 1. Buscar   │    │ 2. Preço    │    │ 3. Criar     │    │ 4. Confir-│    │ 5. Fatu- │
│ Produto     │───▶│ Contextu-   │───▶│ Pedido       │───▶│ mar       │───▶│ rar      │
│             │    │ alizado     │    │              │    │           │    │          │
│ (REST v1)   │    │ (REST v1)   │    │ (REST v1)    │    │ (Gateway) │    │(Gateway) │
└─────────────┘    └─────────────┘    └──────────────┘    └───────────┘    └──────────┘
      GET                POST               POST             POST             POST
   /v1/produtos     /v1/precos/        /v1/vendas/      CACSP.confirmar   SelecaoDocumento
                    contextualizado     pedidos          Nota              SP.faturar
```

## Setup

```typescript
import {
  SankhyaClient,
  TipoFaturamento,
  GatewayError,
  ApiError,
} from 'sankhya-sales-sdk';

const sankhya = new SankhyaClient({
  baseUrl: process.env.SANKHYA_BASE_URL!,
  clientId: process.env.SANKHYA_CLIENT_ID!,
  clientSecret: process.env.SANKHYA_CLIENT_SECRET!,
  xToken: process.env.SANKHYA_X_TOKEN!,
});
```

## Etapa 1: Buscar Produto e Verificar Estoque

```typescript
// Buscar produto pelo código
const produto = await sankhya.produtos.buscar(1001);
console.log(`Produto: ${produto.nome} — ${produto.volume}`);

// Verificar estoque disponível
const estoques = await sankhya.estoque.porProduto(1001);
const estoqueTotal = estoques.reduce((acc, e) => acc + e.estoque, 0);
console.log(`Estoque disponível: ${estoqueTotal} ${produto.volume}`);

if (estoqueTotal < 10) {
  // Verificar alternativos
  const alternativas = await sankhya.produtos.alternativos(1001);
  console.log('Produtos alternativos:', alternativas.map(a => a.nome));
}
```

**Regra de negócio:** Sempre consulte o estoque em tempo real antes de montar o pedido. O cache de estoque deve ter TTL curto (1–3 min) para evitar over-selling.

## Etapa 2: Obter Preço Contextualizado

```typescript
// O preço contextualizado leva em conta TODAS as regras de negócio do ERP:
// - Descontos por cliente
// - Promoções vigentes
// - Forma de pagamento
// - Região do cliente
// - Vendedor

const precos = await sankhya.precos.contextualizado({
  codigoEmpresa: 1,           // CODEMP
  codigoCliente: 123,         // CODPARC
  codigoVendedor: 10,         // CODVEND
  codigoTipoOperacao: 1100,   // CODTIPOPER (TOP de pedido de venda)
  codigoTipoNegociacao: 1,    // CODTIPVENDA (ex: à vista)
  produtos: [
    { codigoProduto: 1001, quantidade: 10 },
    { codigoProduto: 1002, quantidade: 5, unidade: 'CX' },
  ],
});

for (const preco of precos) {
  console.log(`Produto ${preco.codigoProduto}: R$ ${preco.valor} / ${preco.unidade}`);
}
```

**Regra de negócio:** Este é o endpoint **mais importante** para B2B. Nunca use preços estáticos da tabela de preços para montar pedidos — sempre use o contextualizado para garantir que regras de negócio do ERP sejam aplicadas.

### Pré-requisitos: Obter dados de contexto

Se você não tem os códigos necessários:

```typescript
// Listar empresas
const empresas = await sankhya.cadastros.listarEmpresas();

// Listar tipos de negociação (apenas via Gateway — sem REST v1)
const tiposNegociacao = await sankhya.cadastros.listarTiposNegociacao({ apenasAtivos: true });

// Listar modelos de nota (apenas via Gateway — sem REST v1)
const modelos = await sankhya.cadastros.listarModelosNota();

// Listar tipos de operação
const tops = await sankhya.cadastros.listarTiposOperacao();
```

## Etapa 3: Criar Pedido de Venda

```typescript
const valorUnitarioProd1 = precos.find(p => p.codigoProduto === 1001)!.valor;
const valorUnitarioProd2 = precos.find(p => p.codigoProduto === 1002)!.valor;
const valorTotal = (valorUnitarioProd1 * 10) + (valorUnitarioProd2 * 5);

const { codigoPedido } = await sankhya.pedidos.criar({
  notaModelo: 1,                    // Modelo de nota (pré-configura empresa, TOP, etc.)
  data: '01/04/2026',
  hora: '10:00:00',
  codigoCliente: 123,
  codigoVendedor: 10,
  observacao: 'Pedido via app Força de Vendas',
  valorTotal,
  itens: [
    {
      codigoProduto: 1001,
      quantidade: 10,
      valorUnitario: valorUnitarioProd1,
      unidade: 'UN',
    },
    {
      codigoProduto: 1002,
      quantidade: 5,
      valorUnitario: valorUnitarioProd2,
      unidade: 'CX',
    },
  ],
  financeiros: [
    {
      codigoTipoPagamento: 1,         // Boleto
      valor: valorTotal / 2,
      dataVencimento: '01/05/2026',
      numeroParcela: 1,
    },
    {
      codigoTipoPagamento: 1,
      valor: valorTotal / 2,
      dataVencimento: '01/06/2026',
      numeroParcela: 2,
    },
  ],
});

console.log(`Pedido criado: ${codigoPedido} (status: A CONFIRMAR)`);
```

**Regras de negócio:**
- O pedido é criado **SEMPRE** com status "A CONFIRMAR"
- Os financeiros são registrados como **pendentes** (não baixados)
- Totalizadores do cabeçalho são calculados pelo Sankhya com base nos impostos
- O `notaModelo` define empresa, TOP, natureza — simplifica a criação
- Sempre envie itens E financeiros (ambos obrigatórios)

## Etapa 4: Confirmar Pedido (Gateway)

```typescript
try {
  await sankhya.pedidos.confirmar({
    codigoPedido,                   // NUNOTA retornado na etapa anterior
    compensarAutomaticamente: false,
  });
  console.log('Pedido confirmado com sucesso!');
} catch (error) {
  if (error instanceof GatewayError) {
    console.error(`Erro ao confirmar: ${error.message}`);
    // Possíveis causas: estoque insuficiente, TOP inválida, regra fiscal
  }
}
```

**Regras de negócio:**
- **Não existe endpoint REST v1** para confirmação — apenas Gateway
- A confirmação reserva estoque, gera financeiro e habilita faturamento
- Internamente, o SDK usa `CACSP.confirmarNota` na URL e `ServicosNfeSP.confirmarNota` no body (divergência esperada)
- Sem confirmação, o pedido fica "em aberto" e não será processado pelo ERP

## Etapa 5: Faturar Pedido (Opcional)

```typescript
try {
  await sankhya.pedidos.faturar({
    codigoPedido,
    codigoTipoOperacao: 167,         // TOP de faturamento
    dataFaturamento: '01/04/2026',
    tipoFaturamento: TipoFaturamento.Normal,
    faturarTodosItens: true,
  });
  console.log('Pedido faturado — Nota Fiscal gerada!');
} catch (error) {
  if (error instanceof GatewayError) {
    console.error(`Erro ao faturar: ${error.message}`);
  }
}
```

**Tipos de faturamento:**

| Tipo | Quando usar |
|------|-------------|
| `Normal` | Faturar todos os itens |
| `Estoque` | Apenas itens com estoque |
| `EstoqueDeixandoPendente` | Fatura o que tem estoque, pendencia o resto |
| `Direto` | Sem pedido prévio |

**Regras de negócio:**
- O pedido **deve estar confirmado** (etapa 4)
- Pedidos faturados geram nota fiscal
- Pedidos faturados **não podem ser cancelados** via REST v1

## Fluxo Completo (Código Resumido)

```typescript
// 1. Preço contextualizado
const precos = await sankhya.precos.contextualizado({ ... });

// 2. Criar pedido
const { codigoPedido } = await sankhya.pedidos.criar({ ... });

// 3. Confirmar (Gateway)
await sankhya.pedidos.confirmar({ codigoPedido });

// 4. Faturar (Gateway, opcional)
await sankhya.pedidos.faturar({ codigoPedido, ... });
```

## Simulação de Impostos (Opcional)

Antes de confirmar, você pode simular os impostos para mostrar ao representante:

```typescript
const impostos = await sankhya.fiscal.calcularImpostos({
  notaModelo: 1,
  codigoCliente: 123,
  produtos: [
    { codigoProduto: 1001, quantidade: 10, valorUnitario: 25.50 },
  ],
});

for (const produto of impostos) {
  for (const imposto of produto.impostos) {
    console.log(`${imposto.tipo}: ${imposto.aliquota}% = R$ ${imposto.valorImposto}`);
  }
}
```

## Consultar Status do Pedido

```typescript
const pedidos = await sankhya.pedidos.consultar({
  page: 1,
  codigoEmpresa: 1,
  codigoNota: codigoPedido,
});

const pedido = pedidos.data[0];
console.log(`Status — Confirmado: ${pedido.confirmada}, Pendente: ${pedido.pendente}`);
```

## Links

- [API: Pedidos](../api-reference/pedidos.md)
- [API: Preços](../api-reference/precos.md)
- [API: Estoque](../api-reference/estoque.md)
- [API: Fiscal](../api-reference/fiscal.md)
- [Tratamento de Erros](./tratamento-erros.md)
