import { SankhyaError } from './errors.js';

/**
 * Valida se o valor e um objeto nao-nulo.
 * Retorna o objeto como Record<string, unknown> para uso interno.
 */
function assertObject(input: unknown, name: string): Record<string, unknown> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new SankhyaError(`${name} deve ser um objeto`, 'VALIDATION_ERROR');
  }
  return input as Record<string, unknown>;
}

/** Valida que o campo e uma string nao-vazia. */
function requireString(o: Record<string, unknown>, field: string, name: string): void {
  if (typeof o[field] !== 'string' || (o[field] as string).trim() === '') {
    throw new SankhyaError(`${name}.${field} deve ser uma string nao-vazia`, 'VALIDATION_ERROR');
  }
}

/** Valida que o campo e um numero finito. */
function requireNumber(o: Record<string, unknown>, field: string, name: string): void {
  if (typeof o[field] !== 'number' || !Number.isFinite(o[field] as number)) {
    throw new SankhyaError(`${name}.${field} deve ser um numero finito`, 'VALIDATION_ERROR');
  }
}

/** Valida que o campo, se presente, e um numero finito. */
function optionalNumber(o: Record<string, unknown>, field: string, name: string): void {
  if (o[field] !== undefined && o[field] !== null) {
    if (typeof o[field] !== 'number' || !Number.isFinite(o[field] as number)) {
      throw new SankhyaError(`${name}.${field} deve ser um numero finito`, 'VALIDATION_ERROR');
    }
  }
}

/** Valida que o campo, se presente, e uma string nao-vazia. */
function optionalString(o: Record<string, unknown>, field: string, name: string): void {
  if (o[field] !== undefined && o[field] !== null) {
    if (typeof o[field] !== 'string' || (o[field] as string).trim() === '') {
      throw new SankhyaError(`${name}.${field} deve ser uma string nao-vazia`, 'VALIDATION_ERROR');
    }
  }
}

/** Valida que o campo e um array nao-vazio. */
function requireArray(o: Record<string, unknown>, field: string, name: string): void {
  if (!Array.isArray(o[field]) || (o[field] as unknown[]).length === 0) {
    throw new SankhyaError(`${name}.${field} deve ser um array nao-vazio`, 'VALIDATION_ERROR');
  }
}

/**
 * Valida dados de entrada para criacao/atualizacao de pedido de venda.
 *
 * Campos obrigatorios: notaModelo, data, hora, valorTotal, itens, financeiros.
 */
export function validatePedidoVendaInput(input: unknown, name: string): void {
  const o = assertObject(input, name);
  requireNumber(o, 'notaModelo', name);
  requireString(o, 'data', name);
  requireString(o, 'hora', name);
  requireNumber(o, 'valorTotal', name);
  requireArray(o, 'itens', name);
  requireArray(o, 'financeiros', name);

  optionalNumber(o, 'codigoVendedor', name);
  optionalNumber(o, 'codigoCliente', name);
  optionalNumber(o, 'valorFrete', name);
  optionalNumber(o, 'valorSeguro', name);
  optionalNumber(o, 'valorOutros', name);
  optionalNumber(o, 'valorIcms', name);
  optionalNumber(o, 'valorCofins', name);
  optionalNumber(o, 'valorFcp', name);
  optionalNumber(o, 'valorJuro', name);

  const itens = o.itens as unknown[];
  for (let i = 0; i < itens.length; i++) {
    const item = assertObject(itens[i], `${name}.itens[${i}]`);
    requireNumber(item, 'codigoProduto', `${name}.itens[${i}]`);
    requireNumber(item, 'quantidade', `${name}.itens[${i}]`);
    requireNumber(item, 'valorUnitario', `${name}.itens[${i}]`);
    requireString(item, 'unidade', `${name}.itens[${i}]`);
    optionalNumber(item, 'percentualDesconto', `${name}.itens[${i}]`);
    optionalNumber(item, 'valorDesconto', `${name}.itens[${i}]`);
  }

  const financeiros = o.financeiros as unknown[];
  for (let i = 0; i < financeiros.length; i++) {
    const fin = assertObject(financeiros[i], `${name}.financeiros[${i}]`);
    requireNumber(fin, 'codigoTipoPagamento', `${name}.financeiros[${i}]`);
    requireNumber(fin, 'valor', `${name}.financeiros[${i}]`);
    requireString(fin, 'dataVencimento', `${name}.financeiros[${i}]`);
    requireNumber(fin, 'numeroParcela', `${name}.financeiros[${i}]`);
  }
}

/**
 * Valida dados de entrada para criacao de cliente.
 *
 * Campos obrigatorios: tipo, cnpjCpf, nome, endereco (com sub-campos).
 */
export function validateCriarClienteInput(input: unknown, name: string): void {
  const o = assertObject(input, name);
  requireString(o, 'nome', name);
  requireString(o, 'cnpjCpf', name);

  if (o.tipo !== 'F' && o.tipo !== 'J') {
    throw new SankhyaError(
      `${name}.tipo deve ser 'F' (Fisica) ou 'J' (Juridica)`,
      'VALIDATION_ERROR',
    );
  }

  const endereco = assertObject(o.endereco, `${name}.endereco`);
  requireString(endereco, 'logradouro', `${name}.endereco`);
  requireString(endereco, 'numero', `${name}.endereco`);
  requireString(endereco, 'bairro', `${name}.endereco`);
  requireString(endereco, 'cidade', `${name}.endereco`);
  requireString(endereco, 'codigoIbge', `${name}.endereco`);
  requireString(endereco, 'uf', `${name}.endereco`);
  requireString(endereco, 'cep', `${name}.endereco`);
  optionalString(endereco, 'complemento', `${name}.endereco`);

  optionalString(o, 'email', name);
  optionalString(o, 'telefoneDdd', name);
  optionalString(o, 'telefoneNumero', name);
  optionalNumber(o, 'codigoVendedor', name);
}

/**
 * Valida campos comuns de receita/despesa para registro.
 */
function validateFinanceiroBase(o: Record<string, unknown>, name: string): void {
  requireNumber(o, 'codigoEmpresa', name);
  requireNumber(o, 'codigoTipoOperacao', name);
  requireNumber(o, 'codigoNatureza', name);
  requireNumber(o, 'codigoParceiro', name);
  requireNumber(o, 'codigoTipoPagamento', name);
  requireString(o, 'dataNegociacao', name);
  requireString(o, 'dataVencimento', name);
  requireNumber(o, 'valorParcela', name);

  optionalNumber(o, 'numeroParcela', name);
  optionalNumber(o, 'codigoCentroResultado', name);
  optionalNumber(o, 'codigoContaBancaria', name);
  optionalString(o, 'observacao', name);
}

/**
 * Valida dados de entrada para registro de receita.
 *
 * Campos obrigatorios: codigoEmpresa, codigoTipoOperacao, codigoNatureza,
 * codigoParceiro, codigoTipoPagamento, dataNegociacao, dataVencimento, valorParcela.
 */
export function validateRegistrarReceitaInput(input: unknown, name: string): void {
  const o = assertObject(input, name);
  validateFinanceiroBase(o, name);
}

/**
 * Valida dados de entrada para registro de despesa.
 *
 * Campos obrigatorios: mesmos de receita.
 */
export function validateRegistrarDespesaInput(input: unknown, name: string): void {
  const o = assertObject(input, name);
  validateFinanceiroBase(o, name);
}

/**
 * Valida parametros para loadRecords do Gateway.
 *
 * Campos obrigatorios: entity, fields.
 */
export function validateLoadRecordsParams(input: unknown, name: string): void {
  const o = assertObject(input, name);
  requireString(o, 'entity', name);
  requireString(o, 'fields', name);
  optionalNumber(o, 'page', name);
}

/**
 * Valida parametros para saveRecord do Gateway.
 *
 * Campos obrigatorios: entity, fields, data.
 */
export function validateSaveRecordParams(input: unknown, name: string): void {
  const o = assertObject(input, name);
  requireString(o, 'entity', name);
  requireString(o, 'fields', name);

  const data = o.data;
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new SankhyaError(`${name}.data deve ser um objeto`, 'VALIDATION_ERROR');
  }
  if (Object.keys(data as Record<string, unknown>).length === 0) {
    throw new SankhyaError(`${name}.data nao pode ser vazio`, 'VALIDATION_ERROR');
  }
}

/**
 * Valida dados de entrada para calculo de impostos.
 *
 * Campos obrigatorios: notaModelo, codigoCliente, produtos.
 */
export function validateCalculoImpostoInput(input: unknown, name: string): void {
  const o = assertObject(input, name);
  requireNumber(o, 'notaModelo', name);
  requireNumber(o, 'codigoCliente', name);
  requireArray(o, 'produtos', name);

  optionalNumber(o, 'codigoEmpresa', name);
  optionalNumber(o, 'codigoTipoOperacao', name);
  optionalNumber(o, 'finalidadeOperacao', name);

  const produtos = o.produtos as unknown[];
  for (let i = 0; i < produtos.length; i++) {
    const p = assertObject(produtos[i], `${name}.produtos[${i}]`);
    requireNumber(p, 'codigoProduto', `${name}.produtos[${i}]`);
    requireNumber(p, 'quantidade', `${name}.produtos[${i}]`);
    requireNumber(p, 'valorUnitario', `${name}.produtos[${i}]`);
    optionalString(p, 'unidade', `${name}.produtos[${i}]`);
    optionalNumber(p, 'valorDesconto', `${name}.produtos[${i}]`);
  }
}

/**
 * Valida dados de entrada para confirmacao de pedido.
 *
 * Campos obrigatorios: codigoPedido.
 */
export function validateConfirmarPedidoInput(input: unknown, name: string): void {
  const o = assertObject(input, name);
  requireNumber(o, 'codigoPedido', name);
}

/**
 * Valida dados de entrada para faturamento de pedido.
 *
 * Campos obrigatorios: codigoPedido, codigoTipoOperacao, dataFaturamento.
 */
export function validateFaturarPedidoInput(input: unknown, name: string): void {
  const o = assertObject(input, name);
  requireNumber(o, 'codigoPedido', name);
  requireNumber(o, 'codigoTipoOperacao', name);
  requireString(o, 'dataFaturamento', name);
}

/**
 * Valida dados de entrada para cancelamento de pedido.
 *
 * Campos obrigatorios: codigoPedido.
 */
export function validateCancelarPedidoInput(input: unknown, name: string): void {
  const o = assertObject(input, name);
  requireNumber(o, 'codigoPedido', name);
  optionalString(o, 'motivo', name);
}
