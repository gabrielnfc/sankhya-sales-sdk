/**
 * Teto de chamadas para suite de integracao.
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
