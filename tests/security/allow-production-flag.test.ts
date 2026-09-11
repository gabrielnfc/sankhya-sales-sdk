import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

/**
 * Trava de repo: a flag que libera producao nunca pode ficar ligada em codigo,
 * teste ou workflow. Roda no CI de PR e nao faz rede.
 */

/** Unico arquivo autorizado a escrever a flag: a suite que prova o comportamento do guard. */
const PERMITIDOS = ['tests/core/environment-guard.test.ts'];

/**
 * Espacos sao `[[:space:]]`, nao `\s`: o `git grep -E` usa ERE POSIX, que **nao**
 * honra `\s` — medido em 2026-09-11 neste repo, a versao com `\s` so casava a
 * forma colada (sem espaco depois dos dois-pontos) e deixava passar a forma
 * espacada, que e justamente a que se escreve em codigo. Falso negativo de
 * guarda nao se aceita (I9).
 *
 * O padrao nao aparece literal neste arquivo de proposito: a trava se aplica a
 * si mesma, e um exemplo em comentario bastaria para reprova-la.
 */
const PADRAO = 'allowProduction[[:space:]]*:[[:space:]]*true';

/** `git grep` sai com status 1 quando nao encontra nada — isso e lista vazia, nao erro. */
function arquivosQueLigamAFlag(): readonly string[] {
  let saida: string;
  try {
    // `--untracked`: arquivo novo, ainda nao adicionado ao indice, tambem conta —
    // sem isso a flag entra no repo por um arquivo que `git grep` nao olha.
    // `-I` ignora binario.
    saida = execFileSync(
      'git',
      ['grep', '-lnE', '-I', '--untracked', PADRAO, '--', 'src', 'tests', '.github'],
      { encoding: 'utf8' },
    );
  } catch (erro) {
    const status = (erro as { status?: number }).status;
    if (status !== 1) throw erro;
    return [];
  }
  const limpa = saida.trim();
  return limpa ? limpa.split('\n') : [];
}

describe('trava de repo: allowProduction', () => {
  it('nenhum arquivo do repo liga allowProduction, exceto a suite do guard', () => {
    const arquivos = arquivosQueLigamAFlag();
    expect(arquivos.filter((f) => !PERMITIDOS.includes(f))).toEqual([]);
  });
});
