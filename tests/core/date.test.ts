import { describe, expect, it } from 'vitest';
import {
  toISODate,
  toSankhyaDate,
  toSankhyaDateMaybe,
  toSankhyaDateTime,
} from '../../src/core/date.js';

describe('toSankhyaDate', () => {
  it('deve converter Date para dd/mm/aaaa', () => {
    const date = new Date(2026, 3, 1); // Abril 1, 2026
    expect(toSankhyaDate(date)).toBe('01/04/2026');
  });

  it('deve converter ISO string para dd/mm/aaaa', () => {
    expect(toSankhyaDate('2026-04-01T10:30:00')).toBe('01/04/2026');
  });

  it('deve preencher zeros à esquerda', () => {
    const date = new Date(2026, 0, 5); // Janeiro 5
    expect(toSankhyaDate(date)).toBe('05/01/2026');
  });
});

describe('toSankhyaDateTime', () => {
  it('deve converter Date para dd/mm/aaaa hh:mm:ss', () => {
    const date = new Date(2026, 3, 1, 14, 30, 45);
    expect(toSankhyaDateTime(date)).toBe('01/04/2026 14:30:45');
  });

  it('deve converter ISO string para dd/mm/aaaa hh:mm:ss', () => {
    const result = toSankhyaDateTime('2026-04-01T08:05:09');
    expect(result).toBe('01/04/2026 08:05:09');
  });

  it('deve preencher zeros em hora/minuto/segundo', () => {
    const date = new Date(2026, 0, 1, 1, 2, 3);
    expect(toSankhyaDateTime(date)).toBe('01/01/2026 01:02:03');
  });
});

describe('toSankhyaDateMaybe', () => {
  it('converte ISO date-only yyyy-MM-dd sem deslocar fuso', () => {
    expect(toSankhyaDateMaybe('2024-02-01')).toBe('01/02/2024');
    expect(toSankhyaDateMaybe('2026-12-31')).toBe('31/12/2026');
  });

  it('repassa dd/MM/yyyy inalterada', () => {
    expect(toSankhyaDateMaybe('15/03/2024')).toBe('15/03/2024');
  });

  it('aceita datetime ISO via fallback', () => {
    expect(toSankhyaDateMaybe('2026-04-01T10:30:00')).toBe('01/04/2026');
  });

  it('lanca para entrada invalida', () => {
    expect(() => toSankhyaDateMaybe('not-a-date')).toThrow('Data invalida');
  });

  it('rejeita ISO com data fora do calendario (nao repassa lixo)', () => {
    expect(() => toSankhyaDateMaybe('2024-13-45')).toThrow('Data invalida');
    expect(() => toSankhyaDateMaybe('2024-00-00')).toThrow('Data invalida');
    expect(() => toSankhyaDateMaybe('2024-02-30')).toThrow('Data invalida');
  });
});

describe('toISODate', () => {
  it('deve converter dd/mm/aaaa para ISO yyyy-mm-dd', () => {
    expect(toISODate('01/04/2026')).toBe('2026-04-01');
  });

  it('deve converter dd/mm/aaaa para ISO yyyy-mm-dd (dezembro)', () => {
    expect(toISODate('25/12/2025')).toBe('2025-12-25');
  });

  it('deve lançar erro para formato inválido', () => {
    expect(() => toISODate('2026-04-01')).toThrow('Formato de data inválido');
    expect(() => toISODate('invalid')).toThrow('Formato de data inválido');
  });
});
