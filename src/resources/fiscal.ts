import type { HttpClient } from '../core/http.js';
import { validateCalculoImpostoInput } from '../core/validators.js';
import type {
  CalculoImpostoInput,
  ImportNfseResult,
  ResultadoCalculoImposto,
} from '../types/fiscal.js';

/** Operacoes fiscais no Sankhya ERP (impostos, NFS-e). Acesse via `sankhya.fiscal`. */
export class FiscalResource {
  constructor(private readonly http: HttpClient) {}

  /**
   * Calcula impostos para uma lista de produtos.
   *
   * @param input - Dados do calculo (modelo nota, cliente, produtos).
   * @returns Array com impostos calculados por produto.
   * @throws {ApiError} Em erro HTTP.
   * @throws {AuthError} Se autenticacao falhar.
   * @example
   * ```ts
   * const impostos = await sankhya.fiscal.calcularImpostos({
   *   notaModelo: 1,
   *   codigoCliente: 100,
   *   produtos: [
   *     { codigoProduto: 5, quantidade: 10, valorUnitario: 50 },
   *   ],
   * });
   * ```
   */
  async calcularImpostos(input: CalculoImpostoInput): Promise<ResultadoCalculoImposto[]> {
    validateCalculoImpostoInput(input, 'CalculoImpostoInput');
    return this.http.restPost('/fiscal/impostos/calculo', input);
  }

  /**
   * Importa uma NFS-e (Nota Fiscal de Servico Eletronica) tomada.
   *
   * @param dados - Dados da NFS-e a importar.
   * @returns Resposta da API.
   * @throws {ApiError} Em erro HTTP.
   * @throws {AuthError} Se autenticacao falhar.
   */
  async importarNfse(dados: Record<string, unknown>): Promise<ImportNfseResult> {
    return this.http.restPost('/fiscal/servicos-tomados/nfse', dados);
  }
}
