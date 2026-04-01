import type { HttpClient } from '../core/http.js';
import type { CalculoImpostoInput, ResultadoCalculoImposto } from '../types/fiscal.js';

export class FiscalResource {
  constructor(private readonly http: HttpClient) {}

  async calcularImpostos(input: CalculoImpostoInput): Promise<ResultadoCalculoImposto[]> {
    return this.http.restPost('/fiscal/impostos/calculo', input);
  }

  async importarNfse(dados: Record<string, unknown>): Promise<unknown> {
    return this.http.restPost('/fiscal/servicos-tomados/nfse', dados);
  }
}
