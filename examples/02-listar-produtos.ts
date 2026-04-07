/**
 * Exemplo: Listar Produtos
 * Demonstra paginacao manual e iteracao automatica com listarTodos.
 * Run: npx tsx examples/02-listar-produtos.ts
 */
import { SankhyaClient } from 'sankhya-sales-sdk';

const sankhya = new SankhyaClient({
  baseUrl: process.env.SANKHYA_BASE_URL!,
  clientId: process.env.SANKHYA_CLIENT_ID!,
  clientSecret: process.env.SANKHYA_CLIENT_SECRET!,
  xToken: process.env.SANKHYA_X_TOKEN!,
});

async function main() {
  // Paginacao manual
  console.log('=== Pagina 1 ===');
  const page1 = await sankhya.produtos.listar({ page: 0 });
  console.log(`${page1.data.length} produtos, total: ${page1.pagination.total}`);

  // Iteracao automatica com listarTodos (AsyncGenerator)
  console.log('\n=== Todos os produtos (primeiros 10) ===');
  let count = 0;
  for await (const produto of sankhya.produtos.listarTodos()) {
    console.log(`${produto.codigoProduto} - ${produto.nome}`);
    if (++count >= 10) break;
  }
}

main().catch(console.error);
