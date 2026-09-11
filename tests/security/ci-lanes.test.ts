import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import {
  type ConjuntoDeCredenciais,
  LANE_OPT_IN,
  TETO_CHAMADAS,
  callBudget,
  credenciaisDaLane,
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
 * 2. **Presenca estrutural**, so para o que e estrutural — que a suite realmente
 *    chame essas funcoes. Aqui a DIRECAO da trava decide o texto, e trocar as
 *    duas ja produziu defeito real (re-review, N3):
 *
 *    - trava **POSITIVA** ("tem de existir") roda sobre `linhasDeCodigo(fonte)`:
 *      sem o strip, um nome citado num comentario a satisfaria sozinho — foi
 *      assim que a trava do opt-in nasceu morta na 1a volta. Aqui o strip so
 *      aperta: se ele errar e apagar codigo, a trava fica VERMELHA.
 *    - trava **NEGATIVA** ("nao pode existir") roda sobre o **fonte CRU**: o
 *      strip apaga literais de log inteiros, `${…}` incluso, e uma chamada
 *      proibida escondida dentro de um template de log escaparia. No cru, o
 *      preco de citar o nome numa frase e um falso positivo — o lado barato do
 *      I9, porque falso negativo de guarda nao se aceita.
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

/** Preenche um conjunto inteiro com valores marcados, para distinguir a origem. */
function preenche(conjunto: ConjuntoDeCredenciais, marca: string): Record<string, string> {
  return {
    [conjunto.baseUrl]: `https://${marca}.exemplo.invalido`,
    [conjunto.clientId]: `${marca}-id`,
    [conjunto.clientSecret]: `${marca}-secret`,
    [conjunto.xToken]: `${marca}-token`,
  };
}

const SO_FLAG = { [LANE_OPT_IN.flag]: LANE_OPT_IN.valorDaFlag };

describe('opt-in duplo da lane — comportamento', () => {
  const sandbox = preenche(LANE_OPT_IN.sandbox, 'sandbox');
  const generico = preenche(LANE_OPT_IN.generico, 'generico');

  it('credenciais sem a flag NAO autorizam (o acidente do .env esquecido)', () => {
    expect(optInSatisfeito(sandbox)).toBe(false);
    expect(motivoDoSkip(sandbox)).toContain(LANE_OPT_IN.flag);
  });

  it('flag sem credencial nenhuma NAO autoriza', () => {
    expect(optInSatisfeito(SO_FLAG)).toBe(false);
  });

  it('so o conjunto SANDBOX + flag autoriza, e e ele que resolve', () => {
    const env = { ...sandbox, ...SO_FLAG };
    expect(optInSatisfeito(env)).toBe(true);
    expect(motivoDoSkip(env)).toBe('');
    expect(credenciaisDaLane(env).conjunto.nome).toBe('sandbox');
    expect(credenciaisDaLane(env).baseUrl).toBe(sandbox[LANE_OPT_IN.sandbox.baseUrl]);
  });

  it('so o conjunto GENERICO + flag autoriza (caminho do CI)', () => {
    const env = { ...generico, ...SO_FLAG };
    expect(optInSatisfeito(env)).toBe(true);
    expect(credenciaisDaLane(env).conjunto.nome).toBe('generico');
    expect(credenciaisDaLane(env).baseUrl).toBe(generico[LANE_OPT_IN.generico.baseUrl]);
  });

  it('com os DOIS conjuntos, o SANDBOX vence e o generico e ignorado inteiro', () => {
    const env = { ...generico, ...sandbox, ...SO_FLAG };
    const resolvido = credenciaisDaLane(env);
    expect(resolvido.conjunto.nome).toBe('sandbox');
    expect(resolvido.baseUrl).toBe(sandbox[LANE_OPT_IN.sandbox.baseUrl]);
    expect(resolvido.clientId).toBe(sandbox[LANE_OPT_IN.sandbox.clientId]);
    expect(resolvido.clientSecret).toBe(sandbox[LANE_OPT_IN.sandbox.clientSecret]);
    expect(resolvido.xToken).toBe(sandbox[LANE_OPT_IN.sandbox.xToken]);
  });

  it('SANDBOX incompleto NAO completa com generico: nao autoriza e nomeia a chave que falta', () => {
    for (const chave of [
      LANE_OPT_IN.sandbox.clientId,
      LANE_OPT_IN.sandbox.clientSecret,
      LANE_OPT_IN.sandbox.xToken,
    ]) {
      const parcial: Record<string, string> = { ...generico, ...sandbox, ...SO_FLAG };
      delete parcial[chave];
      expect(optInSatisfeito(parcial)).toBe(false);
      expect(motivoDoSkip(parcial)).toContain(chave);
      expect(credenciaisDaLane(parcial).conjunto.nome).toBe('sandbox');
    }
  });

  it('credencial faltando derruba o opt-in em qualquer conjunto', () => {
    for (const conjunto of [LANE_OPT_IN.sandbox, LANE_OPT_IN.generico]) {
      const completo = preenche(conjunto, 'x');
      for (const chave of Object.keys(completo)) {
        const parcial: Record<string, string> = { ...completo, ...SO_FLAG };
        delete parcial[chave];
        expect(optInSatisfeito(parcial)).toBe(false);
      }
    }
  });

  it('flag com valor diferente do esperado NAO autoriza', () => {
    expect(optInSatisfeito({ ...sandbox, [LANE_OPT_IN.flag]: 'true' })).toBe(false);
  });

  it('ambiente vazio: o motivo cita os dois lados e nenhum valor', () => {
    const motivo = motivoDoSkip({});
    expect(motivo).toContain(LANE_OPT_IN.flag);
    expect(motivo).toContain(LANE_OPT_IN.sandbox.baseUrl);
    expect(motivo).not.toContain('exemplo.invalido');
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

describe('lane WMS — travas estruturais', () => {
  /** Fonte cru: usado pelas travas NEGATIVAS (ver o cabecalho deste arquivo). */
  const cru = readFileSync(SUITE, 'utf8');
  /** So linhas de codigo: usado pelas travas POSITIVAS. */
  const codigo = linhasDeCodigo(cru);

  it('decide o skip pelo opt-in duplo, nao por conta propria', () => {
    expect(codigo).toMatch(/optInSatisfeito\(process\.env\)/);
    expect(codigo).toMatch(/describe\.skipIf\(!habilitada\)/);
  });

  it('usa o teto exportado', () => {
    expect(codigo).toMatch(/callBudget\(TETO_CHAMADAS\)/);
  });

  it('resolve as credenciais por um conjunto so, sem ler env por conta propria', () => {
    expect(codigo).toMatch(/credenciaisDaLane\(process\.env\)/);
    // NEGATIVA, fonte cru: nenhum acesso direto a variavel de credencial fora do
    // resolvedor — e assim que os dois conjuntos se misturariam.
    expect(cru).not.toMatch(/process\.env\.SANKHYA/);
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
    // NEGATIVA: fonte cru (ver cabecalho) — `${…}` dentro de log tambem e codigo.
    expect(cru).not.toMatch(/notas\.excluir\(residuo\.pedidos\)/);
  });

  it('teardown nao deixa NUNOTA sem linha passar calado (I4)', () => {
    expect(codigo).toMatch(/!status\.has\(nunota\)/);
    expect(codigo).toMatch(/for \(const nunota of ausentes\)/);
    expect(codigo).toMatch(/\[\.\.\.foraDeA, \.\.\.ausentes\]/);
    // Formato da mensagem: vive dentro do template de log, entao so o cru a ve.
    expect(cru).toContain('STATUSNOTA=AUSENTE');
  });

  it('passo 8: so recusa de NEGOCIO vira skip; teto e transporte fazem throw', () => {
    expect(codigo).toMatch(/classifyFailure\(falha\) !== 'NEGOCIO'/);
    expect(codigo).toMatch(/throw falha/);
    // A assercao do passo 8 fica FORA do `try`: dentro dele, `expect` vermelho
    // viraria SKIP verde. Prova pela posicao — `lastIndexOf` porque o passo 3
    // usa a mesma assercao antes; a ULTIMA ocorrencia e a do passo 8.
    expect(codigo.indexOf('falha = erro;')).toBeLessThan(
      codigo.lastIndexOf('expect(codigoPedido).toBeGreaterThan(0)'),
    );
  });

  it('recupera por AD_NUMPEDIDO antes de dar veredito no passo 8 (I3/I11)', () => {
    expect(codigo).toMatch(/SELECT NUNOTA FROM TGFCAB WHERE AD_NUMPEDIDO/);
    expect(codigo.indexOf('WHERE AD_NUMPEDIDO')).toBeLessThan(codigo.lastIndexOf('ctx.skip('));
  });

  it('registra id so depois de validar inteiro positivo', () => {
    expect(codigo).toMatch(/Number\.isInteger\(nunota\)/);
    // NEGATIVA: fonte cru.
    expect(cru).not.toMatch(/residuo\.pedidos\.push\(codigoPedido\)/);
  });

  it('nunca confirma nem fatura (regra de ouro T0-4: objeto em L e residuo permanente)', () => {
    // NEGATIVA contra o fonte CRU: `faturar` escondido dentro de um template de
    // log continua sendo uma chamada. Prosa que cite o nome custa um falso
    // positivo — o lado barato do I9.
    expect(cru).not.toMatch(/\.confirmar\s*\(|\.faturar\s*\(/);
  });
});
