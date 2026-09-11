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

/**
 * `true` quando o host e sandbox ou consta da allowlist declarada pelo chamador.
 *
 * NAO diz nada sobre producao: host de producao pode satisfazer este predicado
 * (via `allowedHosts`, ou por carregar o marcador num subdominio) e ainda assim
 * ser recusado — quem decide isso e `assertAllowedHost`, que testa
 * `isProductionHost` PRIMEIRO.
 *
 * Comparacao case-insensitive: estes predicados sao publicos, e quem decide
 * antes de construir o cliente nao passa pela normalizacao da WHATWG `URL`.
 */
export function isAllowedHost(host: string, allowedHosts: readonly string[] = []): boolean {
  const alvo = host.toLowerCase();
  return (
    alvo.includes(SANDBOX_MARKER) ||
    allowedHosts.some((permitido) => permitido.toLowerCase() === alvo)
  );
}

/**
 * `true` quando o host e de producao — o proprio host ou um subdominio dele.
 *
 * Sufixo falso nao conta: `<prod>.evil.com` e `evil-<prod>` sao `false` (e, por
 * nao estarem na allowlist, tambem nao sobem).
 */
export function isProductionHost(host: string): boolean {
  const alvo = host.toLowerCase();
  return PRODUCTION_HOSTS.some((h) => alvo === h || alvo.endsWith(`.${h}`));
}

/**
 * Allowlist fail-closed, em duas decisoes e nesta ordem:
 *
 * 1. **Producao primeiro.** Host de producao (ou subdominio) exige
 *    `allowProduction=true` e SEMPRE emite `logger.warn` citando so o host.
 *    Nem `allowedHosts`, nem o marcador de sandbox num subdominio liberam
 *    producao — se liberassem, producao subiria sem flag e sem rastro em log.
 * 2. **Allowlist.** Fora de producao, passa host de sandbox ou host declarado em
 *    `allowedHosts`. Qualquer outro host aborta.
 *
 * Nenhuma mensagem de erro ecoa a `baseUrl` crua: ela pode carregar `user:senha@`.
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
    host = new URL(baseUrl).hostname.toLowerCase();
  } catch {
    // Sem host nao ha o que citar — e a string crua pode conter credencial.
    throw new SankhyaError(
      `baseUrl nao parseia como URL (valor omitido: pode conter credencial). ${DICA}`,
      'VALIDATION_ERROR',
    );
  }

  // Producao decide PRIMEIRO — antes de qualquer forma de allowlist.
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

  if (isAllowedHost(host, opts.allowedHosts)) return;

  throw new SankhyaError(`Host "${host}" nao esta na allowlist. ${DICA}`, 'VALIDATION_ERROR');
}
