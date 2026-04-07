/**
 * Exemplo: Quick Start
 * Demonstra configuracao basica e primeira chamada API.
 * Run: npx tsx examples/01-quick-start.ts
 */
import { SankhyaClient } from 'sankhya-sales-sdk';

const sankhya = new SankhyaClient({
  baseUrl: process.env.SANKHYA_BASE_URL!,
  clientId: process.env.SANKHYA_CLIENT_ID!,
  clientSecret: process.env.SANKHYA_CLIENT_SECRET!,
  xToken: process.env.SANKHYA_X_TOKEN!,
});

async function main() {
  // Listar primeiros clientes
  const result = await sankhya.clientes.listar({ page: 0 });

  console.log(`Total de clientes: ${result.pagination.total}`);
  for (const cliente of result.data) {
    console.log(`- ${cliente.nome} (${cliente.codigoCliente})`);
  }
}

main().catch(console.error);
