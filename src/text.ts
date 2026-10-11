/** Minúsculas y sin acentos ("Diseñador Móvil" → "disenador movil"). */
export function normalizeText(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

/** Clave de comparación: solo alfanuméricos ("PrimeIT España" → "primeitespana"). */
export function normalizeKey(text: string): string {
  return normalizeText(text).replace(/[^a-z0-9]/g, '');
}
