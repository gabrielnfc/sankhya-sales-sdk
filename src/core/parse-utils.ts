import { SankhyaError } from './errors.js';

/**
 * Safely parses a value to a number. Rejects NaN and Infinity.
 * @param value - The value to parse
 * @param fieldName - Field name for error context
 * @returns Parsed number
 * @throws {SankhyaError} If value cannot be safely parsed to a finite number
 */
export function safeParseNumber(value: unknown, fieldName: string): number {
  if (value === null || value === undefined || value === '') {
    return 0;
  }
  const n = Number(value);
  if (!Number.isFinite(n)) {
    throw new SankhyaError(
      `Valor numerico invalido para campo '${fieldName}': ${String(value).slice(0, 50)}`,
      'PARSE_ERROR',
    );
  }
  return n;
}
