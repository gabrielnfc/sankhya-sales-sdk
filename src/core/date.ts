export function toSankhyaDate(input: Date | string): string {
  const date = typeof input === 'string' ? new Date(input) : input;
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Data invalida: "${String(input)}"`);
  }
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

export function toSankhyaDateTime(input: Date | string): string {
  const date = typeof input === 'string' ? new Date(input) : input;
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Data invalida: "${String(input)}"`);
  }
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  return `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;
}

const SANKHYA_DATE_RE = /^\d{2}\/\d{2}\/\d{4}$/;
const ISO_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * Normaliza uma data para o formato Sankhya `dd/MM/yyyy`, aceitando entrada ISO.
 *
 * - `yyyy-MM-dd` (ISO date-only) e convertida sem passar por `Date` (evita
 *   deslocamento de fuso horario).
 * - `dd/MM/yyyy` (ja no formato Sankhya) e repassada inalterada.
 * - Demais strings reconheciveis por `Date` caem em {@link toSankhyaDate}.
 */
export function toSankhyaDateMaybe(input: string): string {
  if (SANKHYA_DATE_RE.test(input)) return input;
  const iso = ISO_DATE_RE.exec(input);
  if (iso) {
    const [, year, month, day] = iso;
    const y = Number(year);
    const m = Number(month);
    const d = Number(day);
    // Valida o calendario (rejeita 2024-13-45 etc.) sem deslocar fuso: usa UTC
    // e confere se os componentes sobreviveram a normalizacao do Date.
    const utc = new Date(Date.UTC(y, m - 1, d));
    if (utc.getUTCFullYear() !== y || utc.getUTCMonth() !== m - 1 || utc.getUTCDate() !== d) {
      throw new Error(`Data invalida: "${input}"`);
    }
    return `${day}/${month}/${year}`;
  }
  return toSankhyaDate(input);
}

export function toISODate(sankhyaDate: string): string {
  const parts = sankhyaDate.split('/');
  if (parts.length !== 3) {
    throw new Error(`Formato de data inválido: "${sankhyaDate}". Esperado: dd/mm/aaaa`);
  }
  const [day, month, year] = parts;
  return `${year}-${month}-${day}`;
}
