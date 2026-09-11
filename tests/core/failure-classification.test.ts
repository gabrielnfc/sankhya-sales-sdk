import { describe, expect, it } from 'vitest';
import {
  ApiError,
  AuthError,
  CircuitOpenError,
  GatewayError,
  TimeoutError,
} from '../../src/core/errors.js';
import { classifyFailure } from '../../src/core/failure-classification.js';

describe('classifyFailure', () => {
  it.each([
    [new AuthError('token invalido'), 'AUTH_FAIL'],
    [new CircuitOpenError('breaker aberto', 1000), 'AUTH_FAIL'],
    [new ApiError('x', '/p', 'POST', 401, ''), 'AUTH_FAIL'],
    [new ApiError('x', '/p', 'POST', 403, ''), 'AUTH_FAIL'],
    [new TimeoutError('estourou', 30000), 'TIMEOUT'],
    [new ApiError('x', '/p', 'POST', 502, ''), 'TIMEOUT'],
    [new ApiError('x', '/p', 'POST', 429, ''), 'TIMEOUT'],
    [new GatewayError('Nota/Pedido nao existe: PK[1889304]', 'DatasetSP.save'), 'NEGOCIO'],
    [
      new GatewayError('O pedido 544437 nao esta pendente.', 'SelecaoDocumentoSP.faturar'),
      'NEGOCIO',
    ],
    [new ApiError('x', '/p', 'POST', 400, ''), 'NEGOCIO'],
    [new ApiError('x', '/p', 'POST', undefined, ''), 'TIMEOUT'],
    [new Error('boom'), 'TIMEOUT'],
  ])('classifica %s', (err, esperado) => {
    expect(classifyFailure(err)).toBe(esperado);
  });
});
