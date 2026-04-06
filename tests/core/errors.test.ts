import { describe, expect, it } from 'vitest';
import {
  ApiError,
  AuthError,
  GatewayError,
  SankhyaError,
  TimeoutError,
  isSankhyaError,
  isAuthError,
  isApiError,
  isGatewayError,
  isTimeoutError,
} from '../../src/core/errors.js';
import type { SankhyaErrorCode } from '../../src/core/errors.js';

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

describe('type guards', () => {
  describe('isSankhyaError', () => {
    it('returns true for SankhyaError', () => {
      expect(isSankhyaError(new SankhyaError('x', 'CODE'))).toBe(true);
    });

    it('returns true for subclasses', () => {
      expect(isSankhyaError(new AuthError('x'))).toBe(true);
      expect(isSankhyaError(new ApiError('x', '/', 'GET'))).toBe(true);
      expect(isSankhyaError(new GatewayError('x', 'svc'))).toBe(true);
      expect(isSankhyaError(new TimeoutError('x'))).toBe(true);
    });

    it('returns false for plain Error', () => {
      expect(isSankhyaError(new Error('x'))).toBe(false);
    });

    it('returns false for null, undefined, string, plain object', () => {
      expect(isSankhyaError(null)).toBe(false);
      expect(isSankhyaError(undefined)).toBe(false);
      expect(isSankhyaError('string')).toBe(false);
      expect(isSankhyaError({ code: 'AUTH_ERROR' })).toBe(false);
    });
  });

  describe('isAuthError', () => {
    it('returns true for AuthError', () => {
      expect(isAuthError(new AuthError('x'))).toBe(true);
    });

    it('returns false for other error types', () => {
      expect(isAuthError(new ApiError('x', '/', 'GET'))).toBe(false);
      expect(isAuthError(new GatewayError('x', 'svc'))).toBe(false);
      expect(isAuthError(new TimeoutError('x'))).toBe(false);
      expect(isAuthError(null)).toBe(false);
      expect(isAuthError('string')).toBe(false);
    });
  });

  describe('isApiError', () => {
    it('returns true for ApiError', () => {
      expect(isApiError(new ApiError('x', '/test', 'GET'))).toBe(true);
    });

    it('returns false for other error types', () => {
      expect(isApiError(new AuthError('x'))).toBe(false);
      expect(isApiError(new GatewayError('x', 'svc'))).toBe(false);
      expect(isApiError(null)).toBe(false);
    });
  });

  describe('isGatewayError', () => {
    it('returns true for GatewayError', () => {
      expect(isGatewayError(new GatewayError('x', 'svc'))).toBe(true);
    });

    it('returns false for other error types', () => {
      expect(isGatewayError(new AuthError('x'))).toBe(false);
      expect(isGatewayError(new ApiError('x', '/', 'GET'))).toBe(false);
      expect(isGatewayError(null)).toBe(false);
    });
  });

  describe('isTimeoutError', () => {
    it('returns true for TimeoutError', () => {
      expect(isTimeoutError(new TimeoutError('x'))).toBe(true);
    });

    it('returns false for other error types', () => {
      expect(isTimeoutError(new AuthError('x'))).toBe(false);
      expect(isTimeoutError(new ApiError('x', '/', 'GET'))).toBe(false);
      expect(isTimeoutError(null)).toBe(false);
      expect(isTimeoutError(undefined)).toBe(false);
      expect(isTimeoutError('string')).toBe(false);
    });
  });

  describe('SankhyaErrorCode', () => {
    it('covers all error codes in exhaustive switch', () => {
      const codes: SankhyaErrorCode[] = [
        'AUTH_ERROR',
        'API_ERROR',
        'GATEWAY_ERROR',
        'TIMEOUT_ERROR',
      ];

      for (const code of codes) {
        switch (code) {
          case 'AUTH_ERROR':
          case 'API_ERROR':
          case 'GATEWAY_ERROR':
          case 'TIMEOUT_ERROR':
            expect(code).toBeTruthy();
            break;
          default: {
            const _exhaustive: never = code;
            throw new Error(`Unhandled code: ${_exhaustive}`);
          }
        }
      }
    });
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
