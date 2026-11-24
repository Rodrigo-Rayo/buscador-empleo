// Utilidades para leer el HTML de los listados (sin dependencias: son páginas sencillas y bien formadas)

const SPANISH_DATE = /(\d{1,2})\/(\d{1,2})\/(\d{4})/;

// Vocales con tilde o diéresis y eñes, en minúscula y mayúscula ("eacute" → "é", "Ntilde" → "Ñ")
const ACCENTED: Readonly<Record<string, string>> = Object.fromEntries(
  [...'aeiouAEIOU']
    .flatMap((vowel) => [
      [`${vowel}acute`, `${vowel}́`.normalize('NFC')],
      [`${vowel}uml`, `${vowel}̈`.normalize('NFC')],
    ])
    .concat([
      ['ntilde', 'ñ'],
      ['Ntilde', 'Ñ'],
    ]),
);
const ENTITIES: Readonly<Record<string, string>> = {
  ...ACCENTED,
  amp: '&', nbsp: ' ', quot: '"', lt: '<', gt: '>', apos: "'",
  iquest: '¿', iexcl: '¡', ordf: 'ª', ordm: 'º', laquo: '«', raquo: '»', euro: '€',
  ndash: '–', mdash: '—', hellip: '…', bull: '•', middot: '·', lsquo: '‘', rsquo: '’', ldquo: '“', rdquo: '”',
};

export function decodeEntities(text: string): string {
  return text.replace(/&(#x?[0-9a-f]+|\w+);/gi, (entity, code: string) => {
    if (code.startsWith('#x') || code.startsWith('#X')) return String.fromCodePoint(parseInt(code.slice(2), 16));
    if (code.startsWith('#')) return String.fromCodePoint(Number(code.slice(1)));
    return ENTITIES[code] ?? entity;
  });
}

/** Texto plano de un trozo de HTML, en una línea y sin el punto final. */
export function cleanText(html: string): string {
  return decodeEntities(html.replace(/<[^>]+>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[.\s]+$/, '');
}

/** "30/11/2026" → "2026-11-30" */
export function isoDayFromSpanish(text: string | undefined): string | undefined {
  const match = SPANISH_DATE.exec(text ?? '');
  if (!match) return undefined;
  const [, day, month, year] = match;
  return `${year}-${month!.padStart(2, '0')}-${day!.padStart(2, '0')}`;
}

export const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
