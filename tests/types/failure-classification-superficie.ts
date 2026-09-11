import { classifyFailure } from '../../src/index.js';
import type { SankhyaFailureKind } from '../../src/index.js';

// Codigo de consumidor real (worker do SeparaTrue, D2.3/D2.4) escrito contra a RAIZ do pacote.
// Se `classifyFailure` ou `SankhyaFailureKind` sairem de `src/index.ts`, estas linhas param de compilar.
// `tests/api-surface.test.ts` cobre a presenca em runtime; o tipo so se trava aqui, porque
// `tsconfig.tests.json` inclui apenas `src` e `tests/types`.
export function consumidorClassificaFalha(err: unknown): SankhyaFailureKind {
  return classifyFailure(err);
}

// O union e exaustivo: os tres rotulos, e nenhum a mais.
export function consumidorTrataTodasAsCamadas(kind: SankhyaFailureKind): string {
  switch (kind) {
    case 'AUTH_FAIL':
      return 'retry seguro';
    case 'NEGOCIO':
      return 'terminal';
    case 'TIMEOUT':
      return 'read-back';
    default: {
      const impossivel: never = kind;
      return impossivel;
    }
  }
}
