/**
 * Exemplo: Gateway Generico
 * Demonstra CRUD via Gateway para qualquer entidade Sankhya.
 * Run: npx tsx examples/05-gateway-generico.ts
 */
import { SankhyaClient } from 'sankhya-sales-sdk';

const sankhya = new SankhyaClient({
  baseUrl: process.env.SANKHYA_BASE_URL!,
  clientId: process.env.SANKHYA_CLIENT_ID!,
  clientSecret: process.env.SANKHYA_CLIENT_SECRET!,
  xToken: process.env.SANKHYA_X_TOKEN!,
});

async function main() {
  // Carregar registros de uma entidade (ex: Produto)
  const rows = await sankhya.gateway.loadRecords({
    entity: 'Produto',
    fields: 'CODPROD,DESCRPROD,CODGRUPOPROD',
    criteria: "this.ATIVO = 'S'",
    page: 0,
  });

  console.log(`Registros encontrados: ${rows.length}`);
  for (const row of rows.slice(0, 5)) {
    console.log(`${row.CODPROD} - ${row.DESCRPROD}`);
  }
}

main().catch(console.error);
