/**
 * Exemplo: Tratamento de Erros
 * Demonstra como usar type guards para cada tipo de erro do SDK.
 * Run: npx tsx examples/04-error-handling.ts
 */
import {
  SankhyaClient,
  isAuthError,
  isApiError,
  isGatewayError,
  isTimeoutError,
  isSankhyaError,
} from 'sankhya-sales-sdk';

const sankhya = new SankhyaClient({
  baseUrl: process.env.SANKHYA_BASE_URL!,
  clientId: process.env.SANKHYA_CLIENT_ID!,
  clientSecret: process.env.SANKHYA_CLIENT_SECRET!,
  xToken: process.env.SANKHYA_X_TOKEN!,
});

async function main() {
  try {
    // Tentar listar clientes
    const result = await sankhya.clientes.listar({ page: 0 });
    console.log(`Sucesso: ${result.data.length} clientes`);
  } catch (error) {
    if (isAuthError(error)) {
      console.error('Erro de autenticacao:', error.message);
      console.error('Verifique SANKHYA_CLIENT_ID e SANKHYA_CLIENT_SECRET');
    } else if (isTimeoutError(error)) {
      console.error('Timeout na requisicao:', error.message);
    } else if (isGatewayError(error)) {
      console.error(`Erro Sankhya [${error.tsErrorCode}]: ${error.message}`);
    } else if (isApiError(error)) {
      console.error(`HTTP ${error.statusCode} em ${error.method} ${error.endpoint}`);
    } else if (isSankhyaError(error)) {
      console.error(`Erro SDK [${error.code}]: ${error.message}`);
    } else {
      throw error;
    }
  }
}

main().catch(console.error);
