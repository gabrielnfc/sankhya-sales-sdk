import { describe, expect, it, vi } from 'vitest';
import { createLogger } from '../../src/core/logger.js';

describe('createLogger', () => {
  it('deve retornar logger padrão com level warn', () => {
    const logger = createLogger();
    expect(logger.debug).toBeTypeOf('function');
    expect(logger.info).toBeTypeOf('function');
    expect(logger.warn).toBeTypeOf('function');
    expect(logger.error).toBeTypeOf('function');
  });

  it('deve logar warn e error no nível warn (padrão)', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    const debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});

    const logger = createLogger();
    logger.debug('test');
    logger.info('test');
    logger.warn('test');
    logger.error('test');

    expect(debugSpy).not.toHaveBeenCalled();
    expect(infoSpy).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledOnce();
    expect(errorSpy).toHaveBeenCalledOnce();

    warnSpy.mockRestore();
    errorSpy.mockRestore();
    infoSpy.mockRestore();
    debugSpy.mockRestore();
  });

  it('deve logar tudo no nível debug', () => {
    const debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const logger = createLogger({ level: 'debug' });
    logger.debug('d');
    logger.info('i');
    logger.warn('w');
    logger.error('e');

    expect(debugSpy).toHaveBeenCalledOnce();
    expect(infoSpy).toHaveBeenCalledOnce();
    expect(warnSpy).toHaveBeenCalledOnce();
    expect(errorSpy).toHaveBeenCalledOnce();

    debugSpy.mockRestore();
    infoSpy.mockRestore();
    warnSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it('não deve logar nada no nível silent', () => {
    const debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const logger = createLogger({ level: 'silent' });
    logger.debug('d');
    logger.info('i');
    logger.warn('w');
    logger.error('e');

    expect(debugSpy).not.toHaveBeenCalled();
    expect(infoSpy).not.toHaveBeenCalled();
    expect(warnSpy).not.toHaveBeenCalled();
    expect(errorSpy).not.toHaveBeenCalled();

    debugSpy.mockRestore();
    infoSpy.mockRestore();
    warnSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it('deve usar logger customizado quando fornecido', () => {
    const custom = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };

    const logger = createLogger({ custom });
    logger.info('test', 'arg');

    expect(custom.info).toHaveBeenCalledWith('test', 'arg');
    expect(logger).toBe(custom);
  });

  it('deve incluir prefix [sankhya-sdk] nas mensagens', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const logger = createLogger({ level: 'warn' });
    logger.warn('algo aconteceu');

    expect(warnSpy).toHaveBeenCalledWith('[sankhya-sdk]', 'algo aconteceu');

    warnSpy.mockRestore();
  });
});
