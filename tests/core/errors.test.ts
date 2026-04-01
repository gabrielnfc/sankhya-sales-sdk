import { describe, expect, it } from 'vitest';
import {
  ApiError,
  AuthError,
  GatewayError,
  SankhyaError,
  TimeoutError,
} from '../../src/core/errors.js';

describe('SankhyaError', () => {
  it('deve criar erro base com code e statusCode', () => {
    const error = new SankhyaError('mensagem', 'CUSTOM', 500, { foo: 'bar' });
    expect(error.message).toBe('mensagem');
    expect(error.code).toBe('CUSTOM');
    expect(error.statusCode).toBe(500);
    expect(error.details).toEqual({ foo: 'bar' });
    expect(error.name).toBe('SankhyaError');
    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(SankhyaError);
  });
});

describe('AuthError', () => {
  it('deve ter code AUTH_ERROR', () => {
    const error = new AuthError('credenciais inválidas', 401);
    expect(error.code).toBe('AUTH_ERROR');
    expect(error.statusCode).toBe(401);
    expect(error.name).toBe('AuthError');
    expect(error).toBeInstanceOf(SankhyaError);
    expect(error).toBeInstanceOf(AuthError);
  });
});

describe('ApiError', () => {
  it('deve incluir endpoint e method', () => {
    const error = new ApiError('not found', '/clientes', 'GET', 404, 'body');
    expect(error.code).toBe('API_ERROR');
    expect(error.endpoint).toBe('/clientes');
    expect(error.method).toBe('GET');
    expect(error.statusCode).toBe(404);
    expect(error.details).toBe('body');
    expect(error.name).toBe('ApiError');
    expect(error).toBeInstanceOf(SankhyaError);
    expect(error).toBeInstanceOf(ApiError);
  });
});

describe('GatewayError', () => {
  it('deve incluir serviceName e tsError', () => {
    const error = new GatewayError(
      'Registro não encontrado',
      'CRUDServiceProvider.loadRecord',
      'TS001',
      'ERROR',
    );
    expect(error.code).toBe('GATEWAY_ERROR');
    expect(error.serviceName).toBe('CRUDServiceProvider.loadRecord');
    expect(error.tsErrorCode).toBe('TS001');
    expect(error.tsErrorLevel).toBe('ERROR');
    expect(error.name).toBe('GatewayError');
    expect(error).toBeInstanceOf(SankhyaError);
    expect(error).toBeInstanceOf(GatewayError);
  });
});

describe('TimeoutError', () => {
  it('deve ter code TIMEOUT_ERROR', () => {
    const error = new TimeoutError('timeout após 30000ms');
    expect(error.code).toBe('TIMEOUT_ERROR');
    expect(error.statusCode).toBeUndefined();
    expect(error.name).toBe('TimeoutError');
    expect(error).toBeInstanceOf(SankhyaError);
    expect(error).toBeInstanceOf(TimeoutError);
  });
});

describe('instanceof checks entre tipos', () => {
  it('AuthError não é ApiError', () => {
    const error = new AuthError('auth fail');
    expect(error).not.toBeInstanceOf(ApiError);
    expect(error).not.toBeInstanceOf(GatewayError);
    expect(error).not.toBeInstanceOf(TimeoutError);
  });

  it('ApiError não é AuthError', () => {
    const error = new ApiError('api fail', '/path', 'GET');
    expect(error).not.toBeInstanceOf(AuthError);
    expect(error).not.toBeInstanceOf(GatewayError);
  });
});
