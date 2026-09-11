import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import {
  LANE_OPT_IN,
  TETO_CHAMADAS,
  callBudget,
  ehErroDeTeto,
  interceptarFetch,
  motivoDoSkip,
  optInSatisfeito,
} from '../integration/_call-budget.js';

/**
 * Travas da lane de integracao (D4). Rodam SEMPRE, no CI de PR, e nao fazem rede.
 *
 * A lane `tests/integration/**` toca o sandbox de verdade: cria pedido, grava
 * item e exclui por id. Tudo que a protege — nunca disparar em PR, ficar fora do
 * `npm test`, opt-in duplo, teto, teardown com guarda — e verificavel sem rede, e
 * por isso mora aqui em vez de morar so na propria suite (que e SKIP por padrao
 * e portanto nunca reprovaria nada no CI).
 *
 * DUAS tecnicas, nesta ordem de preferencia:
 *
 * 1. **Comportamento.** Opt-in, teto e interceptacao do `fetch` sao funcoes
 *    puras em `tests/integration/_call-budget.ts` e sao chamadas aqui de
 *    verdade. Nada de casar prosa.
 * 2. **Presenca no CODIGO** (`linhasDeCodigo`), so para o que e estrutural — que
 *    a suite realmente chame essas funcoes. O texto passa por um strip de
 *    comentarios e de literais de string ANTES do match: uma trava que casasse
 *    o fonte inteiro morreria no dia em que alguem citasse o nome numa frase, e
 *    foi exatamente assim que a trava do opt-in nasceu morta na primeira volta
 *    desta task. O strip so pode tornar o match mais estrito — logo, erro dele
 *    reprova (falso positivo barato), nunca aprova (I9).
 */

const SUITE = 'tests/integration/wms-sandbox.test.ts';

/** Marcador que toda mensagem de log da lane carrega. Texto de log nao e codigo. */
const MARCADOR_DE_LOG = '[wms-sandbox]';

/**
 * Devolve `fonte` sem comentarios (`//` e bloco) e com o conteudo das strings de
 * LOG apagado — o que sobra e codigo executavel mais os literais que o codigo
 * usa de verdade (SQL, `'A'`, nomes de campo).
 *
 * So o texto de log some porque so ele e prosa: e ali, e nos comentarios, que um
 * nome citado numa frase faria uma trava passar sem que a propriedade exista.
 *
 * Limites declarados (G9): nao entende literal de expressao regular (nenhum
 * arquivo travado aqui tem um) e reconhece log pelo marcador acima. Qualquer
 * erro do strip so pode APAGAR codigo, e apagar codigo deixa a trava vermelha —
 * falso positivo custa uma linha, falso negativo nao se aceita (I9).
 */
function linhasDeCodigo(fonte: string): string {
  let saida = '';
  let i = 0;
  while (i < fonte.length) {
    const c = fonte[i];
    const proximo = fonte[i + 1];

    if (c === '/' && proximo === '/') {
      while (i < fonte.length && fonte[i] !== '\n') i += 1;
      continue;
    }
    if (c === '/' && proximo === '*') {
      i += 2;
      while (i < fonte.length && !(fonte[i] === '*' && fonte[i + 1] === '/')) i += 1;
      i += 2;
      continue;
    }
    if (c === "'" || c === '"' || c === '`') {
      const aspas = c;
      const inicio = i;
      i += 1;
      while (i < fonte.length && fonte[i] !== aspas) {
        if (fonte[i] === '\\') i += 1;
        i += 1;
      }
      i += 1;
      const literal = fonte.slice(inicio, i);
      saida += literal.includes(MARCADOR_DE_LOG) ? `${aspas}${aspas}` : literal;
      continue;
    }

    saida += c;
    i += 1;
  }
  return saida;
}

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

describe('linhasDeCodigo — o strip que as travas estruturais usam', () => {
  it('apaga o nome citado em comentario de linha, de bloco e em texto de log', () => {
    const nome = LANE_OPT_IN.flag;
    const fonte = [
      `const a = 1; // ${nome}`,
      `/* ${nome} */`,
      `console.log('[wms-sandbox] falta ${nome}');`,
    ].join('\n');
    expect(fonte).toContain(nome);
    expect(linhasDeCodigo(fonte)).not.toContain(nome);
  });

  it('preserva codigo e literais que o codigo usa (SQL, status)', () => {
    const fonte = [
      'optInSatisfeito(process.env); // nota',
      "query('SELECT NUNOTA, STATUSNOTA FROM TGFCAB');",
      "const emA = status.get(n) === 'A';",
    ].join('\n');
    const codigo = linhasDeCodigo(fonte);
    expect(codigo).toContain('optInSatisfeito(process.env)');
    expect(codigo).toContain('SELECT NUNOTA, STATUSNOTA FROM TGFCAB');
    expect(codigo).toContain("=== 'A'");
    expect(codigo).not.toContain('// nota');
  });
});

describe('opt-in duplo da lane — comportamento', () => {
  const credenciais = Object.fromEntries(LANE_OPT_IN.credenciais.map((nome) => [nome, 'x']));

  it('credenciais sem a flag NAO autorizam (o acidente do .env esquecido)', () => {
    expect(optInSatisfeito(credenciais)).toBe(false);
    expect(motivoDoSkip(credenciais)).toContain(LANE_OPT_IN.flag);
  });

  it('flag sem credenciais NAO autoriza', () => {
    expect(optInSatisfeito({ [LANE_OPT_IN.flag]: LANE_OPT_IN.valorDaFlag })).toBe(false);
  });

  it('credencial faltando derruba o opt-in mesmo com a flag', () => {
    for (const nome of LANE_OPT_IN.credenciais) {
      const parcial: Record<string, string> = {
        ...credenciais,
        [LANE_OPT_IN.flag]: LANE_OPT_IN.valorDaFlag,
      };
      delete parcial[nome];
      expect(optInSatisfeito(parcial)).toBe(false);
    }
  });

  it('flag com valor diferente do esperado NAO autoriza', () => {
    expect(optInSatisfeito({ ...credenciais, [LANE_OPT_IN.flag]: 'true' })).toBe(false);
  });

  it('credenciais completas + flag autorizam', () => {
    const env = { ...credenciais, [LANE_OPT_IN.flag]: LANE_OPT_IN.valorDaFlag };
    expect(optInSatisfeito(env)).toBe(true);
    expect(motivoDoSkip(env)).toBe('');
  });

  it('ambiente vazio: o motivo cita os dois lados e nenhum valor', () => {
    const motivo = motivoDoSkip({});
    expect(motivo).toContain(LANE_OPT_IN.flag);
    for (const nome of LANE_OPT_IN.credenciais) expect(motivo).toContain(nome);
  });
});

describe('teto da lane — comportamento', () => {
  it('vale 40', () => {
    expect(TETO_CHAMADAS).toBe(40);
  });

  it('erro de teto e distinguivel de recusa do ERP', () => {
    const b = callBudget(1);
    b.spend('a');
    let capturado: unknown;
    try {
      b.spend('b');
    } catch (erro) {
      capturado = erro;
    }
    expect(ehErroDeTeto(capturado)).toBe(true);
    expect(ehErroDeTeto(new Error('Nota nao pode ser incluida'))).toBe(false);
  });

  it('interceptarFetch lanca ANTES de sair para a rede quando o teto acabou', () => {
    const original = globalThis.fetch;
    const orcamento = callBudget(1);
    const interceptado = interceptarFetch(orcamento);
    try {
      expect(globalThis.fetch).not.toBe(original);
      orcamento.spend('previa'); // esgota o teto sem tocar na rede
      expect(() => globalThis.fetch('https://exemplo.invalido/a')).toThrow(/teto/i);
      // Nao contou a chamada recusada, e o request nunca saiu.
      expect(orcamento.spent()).toBe(1);
    } finally {
      interceptado.restaurar();
    }
    expect(globalThis.fetch).toBe(original);
  });

  it('interceptarFetch conta o pathname, delega ao original e restaura', async () => {
    const verdadeiro = globalThis.fetch;
    const duble = vi.fn<typeof globalThis.fetch>(async () => new Response('ok'));
    globalThis.fetch = duble;
    try {
      const orcamento = callBudget(2);
      const interceptado = interceptarFetch(orcamento);
      await globalThis.fetch('https://exemplo.invalido/mgecom/service.sbr?x=1');
      expect(duble).toHaveBeenCalledTimes(1);
      expect(orcamento.spent()).toBe(1);
      interceptado.restaurar();
      expect(globalThis.fetch).toBe(duble);
    } finally {
      globalThis.fetch = verdadeiro;
    }
  });
});

describe('lane WMS — travas estruturais (so linhas de codigo)', () => {
  const codigo = linhasDeCodigo(readFileSync(SUITE, 'utf8'));

  it('decide o skip pelo opt-in duplo, nao por conta propria', () => {
    expect(codigo).toMatch(/optInSatisfeito\(process\.env\)/);
    expect(codigo).toMatch(/describe\.skipIf\(!habilitada\)/);
  });

  it('usa o teto exportado', () => {
    expect(codigo).toMatch(/callBudget\(TETO_CHAMADAS\)/);
  });

  it('prova o sandbox antes de construir o client', () => {
    expect(codigo).toMatch(/assertSandbox\(config\.baseUrl\)/);
    expect(codigo.indexOf('assertSandbox(config.baseUrl)')).toBeLessThan(
      codigo.indexOf('new SankhyaClient(config)'),
    );
  });

  it('intercepta e restaura o fetch global', () => {
    expect(codigo).toMatch(/interceptarFetch\(orcamento\)/);
    expect(codigo).toMatch(/restaurar\(\)/);
  });

  it('teardown tem guarda contra lista de ids vazia', () => {
    expect(codigo).toMatch(/if \(ids\.length === 0\)/);
  });

  it('teardown le STATUSNOTA e exclui so o que esta em A', () => {
    expect(codigo).toMatch(/SELECT NUNOTA, STATUSNOTA FROM TGFCAB/);
    expect(codigo).toMatch(/lerStatus\(residuo\.pedidos\)/);
    expect(codigo).toMatch(/status\.get\(nunota\) === 'A'/);
    expect(codigo).toMatch(/notas\.excluir\(emA\)/);
    expect(codigo).not.toMatch(/notas\.excluir\(residuo\.pedidos\)/);
  });

  it('registra id so depois de validar inteiro positivo', () => {
    expect(codigo).toMatch(/Number\.isInteger\(nunota\)/);
    expect(codigo).not.toMatch(/residuo\.pedidos\.push\(codigoPedido\)/);
  });

  it('nunca confirma nem fatura (regra de ouro T0-4: objeto em L e residuo permanente)', () => {
    expect(codigo).not.toMatch(/\.confirmar\s*\(|\.faturar\s*\(/);
  });
});
