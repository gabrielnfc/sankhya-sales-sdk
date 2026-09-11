/**
 * Guard de ambiente para suites de INTEGRACAO QUE ESCREVEM no ERP.
 *
 * Contexto: `npm run test:integration` roda suites que criam pedido, cliente e
 * titulo financeiro de verdade. Elas so podem tocar o SANDBOX. Um `.env` com
 * bloco de producao usando as mesmas chaves do bloco de sandbox ja fez o suite
 * inteiro apontar para producao sem nenhum aviso.
 *
 * Regra: escrita exige host de sandbox. Qualquer outra coisa aborta.
 * Falhar o teste e infinitamente mais barato que criar um pedido em producao.
 *
 * "O que e host permitido" NAO mora aqui: vem de `src/core/environment-guard.ts`,
 * fonte unica do marcador de sandbox (D3). Este arquivo so reexporta a decisao.
 */
import { isAllowedHost } from '../../src/core/environment-guard.js';

const DICA = 'Use SANKHYA_* (sandbox) em escrita; SANKHYA_PROD_* e producao, somente leitura.';

/**
 * Aborta se `baseUrl` nao for sandbox.
 *
 * Chame no topo de toda suite que executa escrita (`criar*`, `atualizar*`,
 * `cancelar*`, `saveRecord`). Suites somente-leitura nao precisam.
 *
 * @param baseUrl - URL base que a suite vai usar (normalmente `SANKHYA_BASE_URL`).
 * @throws {Error} Se a URL nao for reconhecida como sandbox.
 */
export function assertSandbox(baseUrl: string): void {
  // Sem credencial configurada a suite ja se auto-pula via `describe.skipIf`.
  if (!baseUrl) return;

  let host: string;
  try {
    host = new URL(baseUrl).hostname;
  } catch {
    throw new Error(`[write-guard] SANKHYA_BASE_URL invalida: "${baseUrl}". ${DICA}`);
  }

  // Sem `allowedHosts`: em escrita, a allowlist e so o sandbox.
  if (!isAllowedHost(host)) {
    throw new Error(`[write-guard] ABORTADO: host "${host}" nao e sandbox. ${DICA}`);
  }
}
