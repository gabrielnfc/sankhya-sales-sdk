import { describe, expect, it } from 'vitest';
import { assertSandbox } from '../integration/_write-guard.js';

/**
 * O guard existe para impedir que uma suite de escrita crie pedido, cliente ou
 * titulo financeiro em PRODUCAO. E um dispositivo de seguranca: precisa de
 * teste proprio, senao ninguem percebe quando ele para de funcionar.
 */
describe('assertSandbox — guard de escrita em integracao', () => {
  it('aceita host de sandbox', () => {
    expect(() => assertSandbox('https://api.sandbox.sankhya.com.br')).not.toThrow();
  });

  it('ABORTA em host de producao', () => {
    expect(() => assertSandbox('https://api.sankhya.com.br')).toThrow(/nao e sandbox/);
  });

  it('ABORTA no host Om do tenant (producao)', () => {
    expect(() => assertSandbox('https://truebrands.sankhyacloud.com.br')).toThrow(/nao e sandbox/);
  });

  it('ABORTA em URL invalida — nao adivinha o ambiente', () => {
    expect(() => assertSandbox('nao-e-url')).toThrow(/invalida/);
  });

  it('nao aborta com string vazia — a suite ja se auto-pula sem credencial', () => {
    expect(() => assertSandbox('')).not.toThrow();
  });

  it('nao se deixa enganar por "sandbox" fora do host', () => {
    expect(() => assertSandbox('https://api.sankhya.com.br/sandbox/v1')).toThrow(/nao e sandbox/);
  });
});
