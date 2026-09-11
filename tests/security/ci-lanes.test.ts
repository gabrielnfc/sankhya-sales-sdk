import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { callBudget } from '../integration/_call-budget.js';

/**
 * Travas da lane de integracao (D4). Rodam SEMPRE, no CI de PR, e nao fazem rede.
 *
 * A lane `tests/integration/**` toca o sandbox de verdade: cria pedido, grava
 * item e exclui por id. Tudo que a protege — nunca disparar em PR, ficar fora do
 * `npm test`, teto de chamadas, teardown com guarda — e verificavel sem rede, e
 * por isso mora aqui em vez de morar so na propria suite (que e SKIP por padrao
 * e portanto nunca reprovaria nada no CI).
 *
 * As travas 4-6 leem o FONTE da suite: sao grep, nao parser (I9 — falso positivo
 * custa uma linha de justificativa; falso negativo nao se aceita).
 */

const SUITE = 'tests/integration/wms-sandbox.test.ts';

it('workflow de integracao nunca dispara em pull_request', () => {
  const yml = readFileSync('.github/workflows/integration.yml', 'utf8');
  expect(yml).not.toMatch(/^\s*pull_request:/m);
});

it('npm test exclui a pasta de integracao', () => {
  const pkg = JSON.parse(readFileSync('package.json', 'utf8')) as {
    scripts: Record<string, string>;
  };
  expect(pkg.scripts.test).toContain("--exclude 'tests/integration/**'");
});

it('teto de chamadas lanca ao estourar', () => {
  const b = callBudget(2);
  b.spend('a');
  b.spend('b');
  expect(() => b.spend('c')).toThrow(/teto/i);
});

describe('lane WMS — travas de fonte', () => {
  const fonte = readFileSync(SUITE, 'utf8');

  it('trava o teto em 40 chamadas', () => {
    // Subir o teto sem mexer nesta linha reprova (mutacao nomeada no plano, Step 5).
    expect(fonte).toMatch(/callBudget\(40\)/);
  });

  it('teardown tem guarda contra lista de ids vazia', () => {
    expect(fonte).toMatch(/if \(ids\.length === 0\)/);
  });

  it('nunca confirma nem fatura (regra de ouro T0-4: objeto em L e residuo permanente)', () => {
    expect(fonte).not.toMatch(/\.confirmar\s*\(|\.faturar\s*\(/);
  });

  it('exige SDK_INTEGRATION_WMS alem das credenciais (opt-in duplo)', () => {
    expect(fonte).toMatch(/SDK_INTEGRATION_WMS/);
  });
});
