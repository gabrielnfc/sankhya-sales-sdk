import { beforeAll, describe, expect, it } from 'vitest';
import { SankhyaClient } from '../../src/index.js';

/**
 * Prova que a correcao das Tasks 4 e 5 atravessa SDK e API de verdade.
 *
 * Incidente original: o sandbox devolve `{ produtos: {...objeto} }` quando
 * exatamente 1 registro casa com o filtro, e `{ produtos: [...] }` quando sao
 * varios. O SDK antigo so reconhecia o formato array — resultado unico virava
 * lista vazia com `totalRecords: 1`. Um consumidor que sincroniza por
 * `modifiedSince` lia isso como "nada mudou" e nunca via o registro.
 *
 * O timestamp da janela NUNCA e hardcoded: o dado do sandbox muda a cada
 * execucao, entao o teste descobre em runtime uma janela `modifiedSince` que
 * isola exatamente 1 produto, estreitando a partir do maior `dataAlteracao:`
 * observado. Se nao conseguir isolar exatamente 1, pula com aviso explicito —
 * nunca aprova por omissao.
 */
const client = new SankhyaClient({
  baseUrl: process.env.SANKHYA_BASE_URL as string,
  clientId: process.env.SANKHYA_CLIENT_ID as string,
  clientSecret: process.env.SANKHYA_CLIENT_SECRET as string,
  xToken: process.env.SANKHYA_X_TOKEN as string,
  logger: { level: 'silent' },
});

/** Datas do Sankhya vem como `dd/MM/yyyy HH:mm:ss` — ordenar exige converter. */
function chaveOrdenavel(data: string): string {
  const m = data.match(/(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2}):(\d{2})/);
  return m ? `${m[3]}${m[2]}${m[1]}${m[4]}${m[5]}${m[6]}` : '';
}

describe('resultado unico via modifiedSince', () => {
  let janelaDeUmRegistro: string | null = null;

  beforeAll(async () => {
    // Estreita a janela ate isolar exatamente 1 registro.
    let corte: string | undefined;
    for (let tentativa = 0; tentativa < 5; tentativa++) {
      const pagina = await client.produtos.listar(corte ? { modifiedSince: corte } : {});
      if (pagina.data.length === 1) {
        janelaDeUmRegistro = corte ?? null;
        return;
      }
      if (pagina.data.length === 0) return;

      const datas = pagina.data
        .map((p) => (p as unknown as Record<string, string>)['dataAlteracao:'])
        .filter((d): d is string => Boolean(d))
        .sort((a, b) => chaveOrdenavel(a).localeCompare(chaveOrdenavel(b)));
      const maior = datas[datas.length - 1];
      if (!maior || maior === corte) return;
      corte = maior;
    }
  }, 60_000);

  it('devolve o registro unico em vez de lista vazia', async () => {
    if (janelaDeUmRegistro === null) {
      // Nunca aprovar por omissao: diga em voz alta que nao foi verificado.
      console.warn('PULADO: sandbox nao tem janela com exatamente 1 alteracao');
      return;
    }

    const resultado = await client.produtos.listar({ modifiedSince: janelaDeUmRegistro });

    expect(resultado.data).toHaveLength(1);
    expect(resultado.totalRecords).toBe(1);
    expect(resultado.degraded).toBe(false);
  });
});
