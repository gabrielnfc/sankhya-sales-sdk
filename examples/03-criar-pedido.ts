/**
 * Exemplo: Criar Pedido
 * Demonstra o fluxo completo: criar pedido, adicionar item, confirmar.
 * Run: npx tsx examples/03-criar-pedido.ts
 */
import { SankhyaClient } from 'sankhya-sales-sdk';

const sankhya = new SankhyaClient({
  baseUrl: process.env.SANKHYA_BASE_URL!,
  clientId: process.env.SANKHYA_CLIENT_ID!,
  clientSecret: process.env.SANKHYA_CLIENT_SECRET!,
  xToken: process.env.SANKHYA_X_TOKEN!,
});

async function main() {
  // 1. Descobrir um produto disponivel
  const produtos = await sankhya.produtos.listar({ page: 0 });
  const produto = produtos.data[0];
  if (!produto) throw new Error('Nenhum produto encontrado');
  console.log(`Produto: ${produto.nome} (${produto.codigoProduto})`);

  // 2. Criar pedido via REST (datas aceitas em ISO; convertidas internamente)
  const hoje = new Date().toISOString().slice(0, 10); // yyyy-MM-dd
  const { codigoPedido } = await sankhya.pedidos.criar({
    notaModelo: 1,
    data: hoje,
    hora: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
    codigoCliente: 1, // Ajuste para um cliente valido
    codigoVendedor: 1, // Ajuste para um vendedor valido
    valorTotal: 100.0,
    // camposExtras: { AD_NUMPEDIDO: 'ECOM-123' }, // campos personalizados AD_ (opcional)
    itens: [
      {
        codigoProduto: produto.codigoProduto,
        quantidade: 1,
        valorUnitario: 100.0,
        // codigoLocalEstoque: 101, // necessario quando ha controle de estoque por local
        // `controle` opcional (SDK envia ' ' quando omitido); `sequencia` auto-preenchida
      },
    ],
    financeiros: [
      // nomes canonicos tipoPagamento/valorParcela (codigoTipoPagamento/valor/numeroParcela
      // seguem aceitos como aliases legados)
      {
        tipoPagamento: 1,
        valorParcela: 100.0,
        dataVencimento: hoje,
      },
    ],
  });
  console.log(`Pedido criado: ${codigoPedido}`);

  // 3. Confirmar pedido via Gateway
  await sankhya.pedidos.confirmar({ codigoPedido });
  console.log('Pedido confirmado!');
}

main().catch(console.error);
