import { describe, expect, it, vi } from 'vitest';
import type { HttpClient } from '../../src/core/http.js';
import { FiscalResource } from '../../src/resources/fiscal.js';

function createMockHttp() {
  return {
    restGet: vi.fn(),
    restPost: vi.fn().mockResolvedValue([{ imposto: 'ICMS', valor: 18.0 }]),
    restPut: vi.fn(),
    gatewayCall: vi.fn(),
  } as unknown as HttpClient;
}

describe('FiscalResource', () => {
  it('calcularImpostos() calls restPost with /fiscal/impostos/calculo', async () => {
    const http = createMockHttp();
    const resource = new FiscalResource(http);
    const input = {
      codigoEmpresa: 1,
      codigoParceiro: 100,
      itens: [{ codigoProduto: 5, quantidade: 10, valorUnitario: 25.0 }],
    };
    const result = await resource.calcularImpostos(input);

    expect(http.restPost).toHaveBeenCalledWith('/fiscal/impostos/calculo', input);
    expect(result).toHaveLength(1);
  });

  it('importarNfse() calls restPost with /fiscal/servicos-tomados/nfse', async () => {
    const http = createMockHttp();
    (http.restPost as ReturnType<typeof vi.fn>).mockResolvedValue({ status: 'importado' });
    const resource = new FiscalResource(http);
    const dados = { xml: '<nfse>...</nfse>' };
    const result = await resource.importarNfse(dados);

    expect(http.restPost).toHaveBeenCalledWith('/fiscal/servicos-tomados/nfse', dados);
    expect(result).toEqual({ status: 'importado' });
  });
});
