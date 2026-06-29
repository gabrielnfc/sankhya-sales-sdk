import { beforeAll, describe, expect, it } from 'vitest';
import { SankhyaClient } from '../../src/client.js';

/**
 * Round-trip de escrita REAL contra o Sankhya: CRIA um pedido de venda pela API
 * tipada (`pedidos.criar`) e o CONFIRMA (`pedidos.confirmar`), verificando a
 * transicao de status no banco via Gateway. Fecha o ciclo que o issue #4 provou
 * estar quebrado (item sem `controle`/`codigoLocalEstoque`, financeiro com nomes
 * errados, e servico de confirmacao inexistente nesta versao do Om).
 *
 * Valores especificos do tenant sao configuraveis por env (defaults = sandbox do
 * mantenedor). A nota modelo herda empresa/natureza; sobrescrevemos `CODTIPOPER`
 * para uma TOP TIPMOV='P' via `camposExtras` — exatamente o escape hatch novo.
 */
const config = {
  baseUrl: process.env.SANKHYA_BASE_URL ?? '',
  clientId: process.env.SANKHYA_CLIENT_ID ?? '',
  clientSecret: process.env.SANKHYA_CLIENT_SECRET ?? '',
  xToken: process.env.SANKHYA_X_TOKEN ?? '',
  timeout: 60_000,
  logger: { level: 'silent' as const },
};
const has = config.baseUrl && config.clientId && config.clientSecret && config.xToken;

const num = (env: string, fallback: number) => {
  const v = process.env[env];
  const n = v ? Number(v) : fallback;
  return Number.isFinite(n) ? n : fallback;
};

// Recipe (sandbox-proven defaults; override per tenant via env).
const NOTA_MODELO = num('PEDIDO_NOTA_MODELO', 12);
const COD_TIPOPER = num('PEDIDO_TOP', 1000); // TIPMOV='P'
const COD_EMP = num('PEDIDO_EMP', 1);
const COD_CLIENTE = num('PEDIDO_CLIENTE', 1);
const COD_PRODUTO = num('PEDIDO_PRODUTO', 10398);
const COD_LOCAL = num('PEDIDO_LOCAL', 30102);
const COD_TIPTIT = num('PEDIDO_TIPTIT', 2);

const fmtDate = (d: Date) =>
  `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;

describe.skipIf(!has)('Pedido round-trip (criar + confirmar) - LIVE', { timeout: 120_000 }, () => {
  let sankhya: SankhyaClient;
  let estoqueDisponivel = 0;

  beforeAll(async () => {
    sankhya = new SankhyaClient(config);
    await sankhya.authenticate();

    // Estoque geral (CODPARC=0) do produto/local na empresa alvo.
    const rows = await sankhya.gateway.loadRecords({
      entity: 'Estoque',
      fields: 'CODPROD,CODLOCAL,ESTOQUE,RESERVADO',
      criteria: `this.CODPROD = ${COD_PRODUTO} AND this.CODLOCAL = ${COD_LOCAL} AND this.CODEMP = ${COD_EMP} AND this.CODPARC = 0`,
    });
    estoqueDisponivel = rows.reduce(
      (acc, r) => acc + (Number(r.ESTOQUE) - Number(r.RESERVADO || 0)),
      0,
    );
  }, 60_000);

  it('cria um pedido P-type e confirma, verificando a transicao de status', async (ctx) => {
    if (!(estoqueDisponivel > 0)) {
      // Skip explicito (nao um pass vazio): CI distingue "sem dado" de "round-trip ok".
      ctx.skip();
      return;
    }

    const now = new Date();
    const data = fmtDate(now);
    // hora unica (HH:mm:ss) evita o anti-duplicidade empresa+cliente+vendedor+data+hora.
    const hora = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
    const quantidade = Math.min(0.05, estoqueDisponivel);
    const valorUnitario = 100;
    const valorTotal = Number((quantidade * valorUnitario).toFixed(2));

    // 1) CRIA via API tipada — item com controle/local, financeiro canonico, ISO dates.
    const { codigoPedido } = await sankhya.pedidos.criar({
      notaModelo: NOTA_MODELO,
      data: now.toISOString().slice(0, 10), // ISO -> SDK converte p/ dd/MM/yyyy
      hora,
      codigoCliente: COD_CLIENTE,
      valorTotal,
      camposExtras: { CODTIPOPER: COD_TIPOPER, CODEMP: COD_EMP },
      itens: [
        {
          codigoProduto: COD_PRODUTO,
          quantidade,
          valorUnitario,
          codigoLocalEstoque: COD_LOCAL,
          // controle omitido -> SDK envia ' ' (produto sem controle adicional)
        },
      ],
      financeiros: [
        {
          tipoPagamento: COD_TIPTIT,
          valorParcela: valorTotal,
          dataVencimento: now.toISOString().slice(0, 10),
        },
      ],
    });

    expect(codigoPedido).toBeGreaterThan(0);

    // 2) Verifica que nasceu como pedido (TIPMOV='P') pendente.
    const criado = await sankhya.gateway.loadRecord({
      entity: 'CabecalhoNota',
      fields: 'NUNOTA,TIPMOV,PENDENTE,STATUSNOTA',
      primaryKey: { NUNOTA: String(codigoPedido) },
    });
    expect(criado).not.toBeNull();
    expect(criado?.TIPMOV).toBe('P');
    expect(criado?.PENDENTE).toBe('S');

    // 3) CONFIRMA via Gateway (CACSP.confirmarNota).
    await expect(sankhya.pedidos.confirmar({ codigoPedido })).resolves.toBeUndefined();

    // 4) Confirma a transicao: nota deixou de estar "Aberta" (STATUSNOTA='A').
    const confirmado = await sankhya.gateway.loadRecord({
      entity: 'CabecalhoNota',
      fields: 'NUNOTA,STATUSNOTA',
      primaryKey: { NUNOTA: String(codigoPedido) },
    });
    expect(confirmado?.STATUSNOTA).not.toBe('A');

    // Higiene: cancela o pedido de teste para nao acumular lixo no sandbox.
    try {
      await sankhya.pedidos.cancelar({ codigoPedido, motivo: 'teste automatizado SDK' });
    } catch {
      /* best-effort cleanup */
    }
  });
});
