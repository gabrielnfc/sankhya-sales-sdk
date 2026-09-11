import type { IncluirNotaGatewayInput } from '../../src/index.js';

// Codigo de consumidor real (worker do SeparaTrue, D4) escrito contra a RAIZ do pacote.
// `tsconfig.tests.json` inclui apenas `src` e `tests/types` — os `.test.ts` NAO sao
// typecheckados (achado D2.0). Sem estas linhas, os campos novos de D1.2
// (`statusNota`, `numeroPedidoExterno`, `informarPreco`, `camposExtras`) poderiam
// desaparecer do tipo sem nenhum gate reclamar.
export function consumidorMonta4midware(numeroPedidoExterno: string): IncluirNotaGatewayInput {
  return {
    codigoCliente: 312984,
    dataNegociacao: '06/09/2026 12:00:00',
    codigoTipoOperacao: 1001,
    codigoTipoNegociacao: 200,
    codigoVendedor: 50,
    codigoEmpresa: 2,
    tipoMovimento: 'P',
    statusNota: 'A',
    numeroPedidoExterno,
    informarPreco: true,
    camposExtras: { AD_MARKET_PLACE: 'Shopify.EC.V1', CODCENCUS: '0102002', VLRFRETE: 12.5 },
    itens: [{ codigoProduto: 10051, quantidade: 1, valorUnitario: 10, unidade: 'UN' }],
  };
}

// `statusNota` e um union fechado: 'A' | 'L'. Qualquer outro rotulo nao compila.
export function consumidorTrataStatusNota(
  status: NonNullable<IncluirNotaGatewayInput['statusNota']>,
): string {
  switch (status) {
    case 'A':
      return 'aberta';
    case 'L':
      return 'liberada';
    default: {
      const impossivel: never = status;
      return impossivel;
    }
  }
}
