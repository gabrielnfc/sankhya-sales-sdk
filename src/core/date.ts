export function toSankhyaDate(input: Date | string): string {
  const date = typeof input === 'string' ? new Date(input) : input;
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

export function toSankhyaDateTime(input: Date | string): string {
  const date = typeof input === 'string' ? new Date(input) : input;
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  return `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;
}

export function toISODate(sankhyaDate: string): string {
  const parts = sankhyaDate.split('/');
  if (parts.length !== 3) {
    throw new Error(`Formato de data inválido: "${sankhyaDate}". Esperado: dd/mm/aaaa`);
  }
  const [day, month, year] = parts;
  return `${year}-${month}-${day}`;
}
