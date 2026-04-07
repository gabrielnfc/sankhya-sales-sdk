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

  // 2. Criar pedido via REST
  const { codigoPedido } = await sankhya.pedidos.criar({
    notaModelo: 1,
    data: new Date().toLocaleDateString('pt-BR'),
    hora: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
    codigoCliente: 1, // Ajuste para um cliente valido
    codigoVendedor: 1, // Ajuste para um vendedor valido
    valorTotal: 100.0,
    itens: [
      {
        codigoProduto: produto.codigoProduto,
        quantidade: 1,
        valorUnitario: 100.0,
        unidade: 'UN',
      },
    ],
    financeiros: [
      {
        codigoTipoPagamento: 1,
        valor: 100.0,
        dataVencimento: '01/05/2026',
        numeroParcela: 1,
      },
    ],
  });
  console.log(`Pedido criado: ${codigoPedido}`);

  // 3. Confirmar pedido via Gateway
  await sankhya.pedidos.confirmar({ codigoPedido });
  console.log('Pedido confirmado!');
}

main().catch(console.error);
