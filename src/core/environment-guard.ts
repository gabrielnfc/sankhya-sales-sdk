/**
 * Guarda de ambiente do SDK — allowlist de host, fail-closed.
 *
 * Contexto: ate a 1.5.0 o cliente subia calado contra qualquer host, producao
 * inclusive. Um `.env` com bloco de producao usando as mesmas chaves do bloco de
 * sandbox ja fez um suite inteiro apontar para producao sem nenhum aviso.
 *
 * Regra: so sobe host de sandbox, host declarado em `allowedHosts`, ou producao
 * com `allowProduction=true` explicito (que e logado, citando SO o host).
 * Qualquer outro host — e qualquer `baseUrl` que nao parseia — aborta.
 *
 * Esta e a fonte unica do marcador de sandbox: `tests/integration/_write-guard.ts`
 * reexporta daqui em vez de manter uma segunda copia.
 */
import type { Logger } from '../types/config.js';
import { SankhyaError } from './errors.js';

/** Marcador que todo host de homologacao Sankhya carrega; o de producao nunca. */
export const SANDBOX_MARKER = 'sandbox';

/** Hosts de producao conhecidos. So entram com `allowProduction=true` explicito. */
export const PRODUCTION_HOSTS = ['api.sankhya.com.br'] as const;

/**
 * A dica cita a allowlist e o sandbox em toda mensagem de recusa — e escreve a
 * flag como `allowProduction=true` de proposito: a trava de repo
 * (`tests/security/allow-production-flag.test.ts`) reprova a forma literal
 * `allowProduction=true` em qualquer arquivo de `src/`.
 */
const DICA =
  'Allowlist: use o host de sandbox (api.sandbox.sankhya.com.br). Producao exige allowProduction=true explicito (D5).';

/** `true` quando o host e sandbox ou consta da allowlist declarada pelo chamador. */
export function isAllowedHost(host: string, allowedHosts: readonly string[] = []): boolean {
  return host.includes(SANDBOX_MARKER) || allowedHosts.includes(host);
}

/** `true` quando o host e de producao — o proprio host ou um subdominio dele. */
export function isProductionHost(host: string): boolean {
  return PRODUCTION_HOSTS.some((h) => host === h || host.endsWith(`.${h}`));
}

/**
 * Allowlist fail-closed: so passa host de sandbox, host da allowlist explicita,
 * ou producao com `allowProduction=true` (que emite `logger.warn` citando SO o host).
 *
 * @param baseUrl - URL base que o cliente vai usar.
 * @param opts - `allowProduction` libera producao; `allowedHosts` amplia a allowlist.
 * @param logger - Logger do SDK; recebe o aviso quando producao e liberada.
 * @throws {SankhyaError} `VALIDATION_ERROR` para URL invalida ou host fora da allowlist;
 *   `PRODUCTION_BLOCKED` para host de producao sem `allowProduction=true`.
 */
export function assertAllowedHost(
  baseUrl: string,
  opts: { readonly allowProduction?: boolean; readonly allowedHosts?: readonly string[] },
  logger: Logger,
): void {
  let host: string;
  try {
    host = new URL(baseUrl).hostname;
  } catch {
    throw new SankhyaError(`baseUrl invalida: "${baseUrl}". ${DICA}`, 'VALIDATION_ERROR');
  }

  if (isAllowedHost(host, opts.allowedHosts)) return;

  if (isProductionHost(host)) {
    if (opts.allowProduction !== true) {
      throw new SankhyaError(
        `Host de producao detectado (${host}) e o default e recusar. ${DICA}`,
        'PRODUCTION_BLOCKED',
      );
    }
    logger.warn(`[sankhya-sales-sdk] PRODUCAO LIBERADA EXPLICITAMENTE — host=${host}`);
    return;
  }

  throw new SankhyaError(`Host "${host}" nao esta na allowlist. ${DICA}`, 'VALIDATION_ERROR');
}
