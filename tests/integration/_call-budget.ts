/**
 * Contrato da lane de integracao: teto de chamadas, opt-in duplo e interceptacao
 * do `fetch`. Modulo PURO e sem efeito de import — por isso
 * `tests/security/ci-lanes.test.ts` pode exercita-lo diretamente no CI de PR.
 *
 * Por que nao mora em `wms-sandbox.test.ts`: importar um arquivo de teste
 * registra os `describe` dele na suite que importou, e `npm test` (que roda
 * `tests/security/**`) passaria a colecionar a lane de integracao — exatamente
 * o que a exclusao `--exclude 'tests/integration/**'` existe para impedir.
 *
 * ## Teto de chamadas
 *
 * Contexto medido: a Task 0 do Plano C gastou **319 chamadas** ao gateway do
 * sandbox (ledger `2026-09-05-v3-f1-spikes-task0.md`, §FECHO). Suite que nao
 * conta chamada vira varredura: um laco mal fechado, um retry em cascata, e a
 * lane passa a martelar o ERP de alguem.
 *
 * O teto e fail-closed: estourou, **lanca** e a suite morre no ato — nunca
 * segue em frente "so mais uma". A mensagem cita o rotulo da chamada que
 * estourou e a contagem, porque o valor do teto sozinho nao diz onde vazou.
 *
 * Nao faz rede, nao importa nada do SDK: `tests/security/ci-lanes.test.ts`
 * exercita este arquivo no CI de PR, onde a lane de integracao nunca roda.
 */

/** Contador de chamadas com teto. Criado por {@link callBudget}. */
export interface CallBudget {
  /**
   * Registra uma chamada.
   *
   * @param label - Rotulo da chamada (servico, rota — **nunca** credencial).
   * @throws {Error} Quando a chamada excede o teto. Nada e contado nesse caso:
   * `spent()` continua no valor do teto.
   */
  spend(label: string): void;
  /** Quantas chamadas foram registradas com sucesso ate agora. */
  spent(): number;
}

/**
 * Cria um teto de `max` chamadas.
 *
 * @param max - Teto, inteiro positivo. Teto zero ou nao-inteiro e recusado na
 * criacao: um teto que nao limita nada e pior que teto nenhum, porque parece
 * uma guarda.
 * @returns O contador.
 * @throws {Error} Se `max` nao for inteiro positivo.
 * @example
 * ```ts
 * const orcamento = callBudget(40);
 * orcamento.spend('DbExplorerSP.executeQuery');
 * orcamento.spent(); // 1
 * ```
 */
export function callBudget(max: number): CallBudget {
  if (!Number.isInteger(max) || max <= 0) {
    throw new Error(
      `[call-budget] teto invalido: ${String(max)}. Informe um inteiro positivo — teto que nao limita nada e pior que teto nenhum.`,
    );
  }

  let gasto = 0;

  return {
    spend(label: string): void {
      if (gasto >= max) {
        throw new Error(
          `[call-budget] teto de ${max} chamadas estourado na chamada ${gasto + 1} ("${label}"). Suite abortada antes de chamar.`,
        );
      }
      gasto += 1;
    },
    spent(): number {
      return gasto;
    },
  };
}

/** `true` se o erro veio do teto — nunca deve ser confundido com recusa do ERP. */
export function ehErroDeTeto(erro: unknown): boolean {
  return erro instanceof Error && erro.message.startsWith('[call-budget]');
}

/**
 * Teto da lane WMS. Unico lugar onde o numero existe: a suite usa
 * `callBudget(TETO_CHAMADAS)` e `ci-lanes.test.ts` assere que vale 40. Subir o
 * teto sem mudar o teste reprova.
 */
export const TETO_CHAMADAS = 40;

/**
 * Opt-in DUPLO da lane WMS. Nomes das variaveis num lugar so, para que a trava
 * de CI teste a decisao — nao a prosa que fala dela.
 */
export const LANE_OPT_IN = {
  /** Todas obrigatorias; qualquer uma vazia derruba o opt-in. */
  credenciais: [
    'SANKHYA_BASE_URL',
    'SANKHYA_CLIENT_ID',
    'SANKHYA_CLIENT_SECRET',
    'SANKHYA_X_TOKEN',
  ],
  /** Flag explicita, alem das credenciais. Precisa valer exatamente `'1'`. */
  flag: 'SDK_INTEGRATION_WMS',
  valorDaFlag: '1',
} as const;

/** Ambiente lido pelo opt-in — `process.env` ou um objeto de teste. */
export type AmbienteDaLane = Readonly<Record<string, string | undefined>>;

/** `true` quando TODAS as credenciais estao presentes e nao vazias. */
export function temCredenciais(env: AmbienteDaLane): boolean {
  return LANE_OPT_IN.credenciais.every((nome) => Boolean(env[nome]));
}

/** `true` quando a flag explicita vale exatamente o valor esperado. */
export function temFlagDeOptIn(env: AmbienteDaLane): boolean {
  return env[LANE_OPT_IN.flag] === LANE_OPT_IN.valorDaFlag;
}

/**
 * Decisao unica de "a lane pode rodar": credenciais **e** flag. Credencial
 * sozinha (um `.env` esquecido no ambiente) NAO autoriza escrever no ERP.
 *
 * @param env - Ambiente a inspecionar.
 * @returns `true` so quando os dois lados do opt-in estao satisfeitos.
 */
export function optInSatisfeito(env: AmbienteDaLane): boolean {
  return temCredenciais(env) && temFlagDeOptIn(env);
}

/**
 * Motivo legivel do SKIP, sem ecoar nenhum valor de ambiente.
 *
 * @returns String vazia quando o opt-in esta satisfeito.
 */
export function motivoDoSkip(env: AmbienteDaLane): string {
  const faltando: string[] = [];
  if (!temCredenciais(env)) faltando.push(`credenciais (${LANE_OPT_IN.credenciais.join(', ')})`);
  if (!temFlagDeOptIn(env)) {
    faltando.push(`${LANE_OPT_IN.flag}=${LANE_OPT_IN.valorDaFlag} (opt-in explicito de escrita)`);
  }
  return faltando.join(' + ');
}

/** Interceptacao instalada por {@link interceptarFetch}. */
export interface FetchInterceptado {
  /** Devolve o `fetch` original ao global. Idempotente. */
  restaurar(): void;
}

/**
 * Troca o `fetch` global por um que paga o teto ANTES de sair para a rede.
 *
 * Conta toda requisicao HTTP do SDK (auth, REST e gateway) — superconjunto de
 * "todo `gatewayCall` conta" — porque `src/core/http.ts` resolve o `fetch`
 * global em tempo de chamada. O rotulo e so o `pathname`: querystring e header
 * podem carregar credencial.
 *
 * @param orcamento - Teto que paga cada chamada.
 * @returns Handle com `restaurar()`, para o `finally` do `afterAll`.
 */
export function interceptarFetch(orcamento: CallBudget): FetchInterceptado {
  const original = globalThis.fetch;
  const contado: typeof globalThis.fetch = (entrada, init) => {
    const alvo = entrada instanceof Request ? entrada.url : String(entrada);
    orcamento.spend(new URL(alvo).pathname);
    return original(entrada, init);
  };
  globalThis.fetch = contado;

  return {
    restaurar(): void {
      globalThis.fetch = original;
    },
  };
}
