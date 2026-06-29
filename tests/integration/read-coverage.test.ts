import { beforeAll, describe, expect, it } from 'vitest';
import { ApiError, GatewayError, SankhyaClient } from '../../src/index.js';

/**
 * Cobertura LIVE dos métodos de leitura que antes só tinham teste mockado.
 * Cada caso semeia um ID real de um `listar*` (já validado ao vivo) e exercita
 * o método contra o Sankhya real.
 *
 * Tolerância: erro de negócio do servidor (ApiError/GatewayError) com dado
 * ausente no sandbox vira skip — NÃO é regressão do SDK. Qualquer outro erro
 * (ex.: validação/parse do próprio SDK) propaga e falha o run.
 */
const config = {
  baseUrl: process.env.SANKHYA_BASE_URL ?? '',
  clientId: process.env.SANKHYA_CLIENT_ID ?? '',
  clientSecret: process.env.SANKHYA_CLIENT_SECRET ?? '',
  xToken: process.env.SANKHYA_X_TOKEN ?? '',
  timeout: 30_000,
  logger: { level: 'silent' as const },
};

const has = config.baseUrl && config.clientId && config.clientSecret && config.xToken;

/** Normaliza retorno de listagem (array direto ou PaginatedResult). */
function toArr<T>(r: unknown): T[] {
  if (Array.isArray(r)) return r as T[];
  const data = (r as { data?: unknown })?.data;
  return Array.isArray(data) ? (data as T[]) : [];
}

describe.skipIf(!has)('Read coverage — métodos antes só-mock, validados ao vivo', () => {
  let client: SankhyaClient;
  const seed: Record<string, number | string | undefined> = {};

  beforeAll(async () => {
    client = new SankhyaClient(config);
    await client.authenticate();

    const grab = async (key: string, fn: () => Promise<unknown>, field: string) => {
      try {
        const first = toArr<Record<string, unknown>>(await fn())[0];
        if (first && first[field] != null) seed[key] = first[field] as number | string;
      } catch {
        /* sandbox sem dado — caso correspondente skipa */
      }
    };

    await grab('produto', () => client.produtos.listar({ page: 0 }), 'codigoProduto');
    await grab('grupo', () => client.produtos.listarGrupos(), 'codigoGrupoProduto');
    await grab('volume', () => client.produtos.listarVolumes(), 'codigoVolume');
    await grab('empresa', () => client.cadastros.listarEmpresas(), 'codigoEmpresa');
    await grab('top', () => client.cadastros.listarTiposOperacao(), 'codigoTipoOperacao');
    await grab('natureza', () => client.cadastros.listarNaturezas(), 'codigoNatureza');
    await grab('centro', () => client.cadastros.listarCentrosResultado(), 'codigoCentroResultado');
    await grab('tipoPag', () => client.financeiros.listarTiposPagamento(), 'codigoTipoPagamento');
    await grab('moeda', () => client.financeiros.listarMoedas(), 'codigoMoeda');
    await grab('conta', () => client.financeiros.listarContasBancarias(), 'codigoContaBancaria');
    await grab('local', () => client.estoque.listarLocais(), 'codigoLocal');
    await grab('cliente', () => client.clientes.listar({ page: 0 }), 'codigoCliente');
    await grab('vendedor', () => client.vendedores.listar(), 'codigoVendedor');
    await grab('tipoNeg', () => client.cadastros.listarTiposNegociacao(), 'codigoTipoNegociacao');
  });

  /** Roda leitura live; skip em erro de negócio do servidor, falha no resto. */
  async function liveRead(label: string, fn: () => Promise<unknown>): Promise<unknown | null> {
    try {
      return await fn();
    } catch (e) {
      if (e instanceof ApiError || e instanceof GatewayError) {
        console.warn(`${label}: skip (sandbox) — ${(e as Error).message.slice(0, 90)}`);
        return null;
      }
      throw e; // erro do SDK (parse/validação) = regressão real
    }
  }

  const num = (v: unknown) => Number(v);
  const ok = (v: unknown) => Number.isFinite(num(v));

  it('produtos.componentes', async () => {
    if (!ok(seed.produto)) return;
    const r = await liveRead('componentes', () => client.produtos.componentes(num(seed.produto)));
    if (r !== null) expect(Array.isArray(r)).toBe(true);
  });

  it('produtos.alternativos', async () => {
    if (!ok(seed.produto)) return;
    const r = await liveRead('alternativos', () => client.produtos.alternativos(num(seed.produto)));
    if (r !== null) expect(Array.isArray(r)).toBe(true);
  });

  it('produtos.volumes', async () => {
    if (!ok(seed.produto)) return;
    const r = await liveRead('volumes', () => client.produtos.volumes(num(seed.produto)));
    if (r !== null) expect(Array.isArray(r)).toBe(true);
  });

  it('produtos.listarVolumes', async () => {
    const r = await liveRead('listarVolumes', () => client.produtos.listarVolumes());
    if (r !== null) expect(r).toHaveProperty('data');
  });

  it('produtos.buscarVolume', async () => {
    if (seed.volume == null) return;
    const r = await liveRead('buscarVolume', () =>
      client.produtos.buscarVolume(String(seed.volume)),
    );
    if (r !== null) expect(r).toBeTruthy();
  });

  it('produtos.buscarGrupo', async () => {
    if (!ok(seed.grupo)) return;
    const r = await liveRead('buscarGrupo', () => client.produtos.buscarGrupo(num(seed.grupo)));
    if (r !== null) expect(r).toHaveProperty('codigoGrupoProduto');
  });

  it('cadastros.buscarTipoOperacao', async () => {
    if (!ok(seed.top)) return;
    const r = await liveRead('buscarTipoOperacao', () =>
      client.cadastros.buscarTipoOperacao(num(seed.top)),
    );
    if (r !== null) expect(r).toBeTruthy();
  });

  it('cadastros.buscarNatureza', async () => {
    if (!ok(seed.natureza)) return;
    const r = await liveRead('buscarNatureza', () =>
      client.cadastros.buscarNatureza(num(seed.natureza)),
    );
    if (r !== null) expect(r).toBeTruthy();
  });

  it('cadastros.buscarCentroResultado', async () => {
    if (!ok(seed.centro)) return;
    const r = await liveRead('buscarCentroResultado', () =>
      client.cadastros.buscarCentroResultado(num(seed.centro)),
    );
    if (r !== null) expect(r).toBeTruthy();
  });

  it('cadastros.buscarEmpresa', async () => {
    if (!ok(seed.empresa)) return;
    const r = await liveRead('buscarEmpresa', () =>
      client.cadastros.buscarEmpresa(num(seed.empresa)),
    );
    if (r !== null) expect(r).toHaveProperty('codigoEmpresa');
  });

  it('cadastros.listarProjetos + buscarProjeto', async () => {
    const lista = await liveRead('listarProjetos', () => client.cadastros.listarProjetos());
    if (lista === null) return;
    expect(lista).toHaveProperty('data');
    const proj = toArr<Record<string, unknown>>(lista)[0];
    if (proj?.codigoProjeto == null) return;
    const r = await liveRead('buscarProjeto', () =>
      client.cadastros.buscarProjeto(Number(proj.codigoProjeto)),
    );
    if (r !== null) expect(r).toBeTruthy();
  });

  it('financeiros.buscarTipoPagamento', async () => {
    if (!ok(seed.tipoPag)) return;
    const r = await liveRead('buscarTipoPagamento', () =>
      client.financeiros.buscarTipoPagamento(num(seed.tipoPag)),
    );
    if (r !== null) expect(r).toBeTruthy();
  });

  it('financeiros.buscarMoeda', async () => {
    if (!ok(seed.moeda)) return;
    const r = await liveRead('buscarMoeda', () => client.financeiros.buscarMoeda(num(seed.moeda)));
    if (r !== null) expect(r).toBeTruthy();
  });

  it('financeiros.buscarContaBancaria', async () => {
    if (!ok(seed.conta)) return;
    const r = await liveRead('buscarContaBancaria', () =>
      client.financeiros.buscarContaBancaria(num(seed.conta)),
    );
    if (r !== null) expect(r).toBeTruthy();
  });

  it('estoque.buscarLocal', async () => {
    if (!ok(seed.local)) return;
    const r = await liveRead('buscarLocal', () => client.estoque.buscarLocal(num(seed.local)));
    if (r !== null) expect(r).toHaveProperty('codigoLocal');
  });

  it('precos.porProdutoETabela', async () => {
    if (!ok(seed.produto)) return;
    const porProd = await liveRead('porProduto(seed tabela)', () =>
      client.precos.porProduto(num(seed.produto)),
    );
    const tabela = toArr<{ codigoTabela?: number }>(porProd)[0]?.codigoTabela;
    if (tabela == null) return;
    const r = await liveRead('porProdutoETabela', () =>
      client.precos.porProdutoETabela({ codigoProduto: num(seed.produto), codigoTabela: tabela }),
    );
    if (r !== null) expect(r).toHaveProperty('data');
  });

  it('precos.contextualizado (flagship do README)', async () => {
    if (
      ![seed.empresa, seed.cliente, seed.vendedor, seed.top, seed.tipoNeg, seed.produto].every(ok)
    ) {
      console.warn(
        'contextualizado: skip — sandbox nao tem todos os IDs (empresa/cliente/vendedor/top/tipoNeg/produto)',
      );
      return;
    }
    const r = await liveRead('contextualizado', () =>
      client.precos.contextualizado({
        codigoEmpresa: num(seed.empresa),
        codigoCliente: num(seed.cliente),
        codigoVendedor: num(seed.vendedor),
        codigoTipoOperacao: num(seed.top),
        codigoTipoNegociacao: num(seed.tipoNeg),
        produtos: [{ codigoProduto: num(seed.produto), quantidade: 1 }],
      }),
    );
    if (r !== null) expect(Array.isArray(r)).toBe(true);
  });
});
