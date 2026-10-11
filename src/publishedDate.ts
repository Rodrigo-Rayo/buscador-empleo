import { normalizeText } from './text';

const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;

// Unidades de "hace N ..." en milisegundos (los meses, aproximados a 30 días)
const RELATIVE_UNITS: ReadonlyArray<readonly [RegExp, number]> = [
  [/^minutos?$/, 60_000],
  [/^horas?$/, HOUR_MS],
  [/^dias?$/, DAY_MS],
  [/^semanas?$/, 7 * DAY_MS],
  [/^mes(es)?$/, 30 * DAY_MS],
];

const MONTHS: Readonly<Record<string, number>> = {
  ene: 0, feb: 1, mar: 2, abr: 3, may: 4, jun: 5, jul: 6, ago: 7, sep: 8, sept: 8, oct: 9, nov: 10, dic: 11,
};

const RELATIVE = /^hace (\d+|un|una) (\p{L}+)$/u;
// "16 sept 2026", "9 sept. 2026", "7 de sept de 2026"
const ABSOLUTE = /^(\d{1,2})(?: de)? (\p{L}+)\.?(?: de)? (\d{4})$/u;

function toIsoDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function parseRelative(text: string, now: Date): string | null {
  const match = RELATIVE.exec(text);
  if (!match?.[1] || !match[2]) return null;
  const amount = /^\d+$/.test(match[1]) ? Number(match[1]) : 1;
  const unit = RELATIVE_UNITS.find(([pattern]) => pattern.test(match[2] as string));
  return unit ? toIsoDay(new Date(now.getTime() - amount * unit[1])) : null;
}

function parseAbsolute(text: string): string | null {
  const match = ABSOLUTE.exec(text);
  if (!match?.[1] || !match[2] || !match[3]) return null;
  const month = MONTHS[match[2]];
  const day = Number(match[1]);
  if (month === undefined || day < 1 || day > 31) return null;
  return toIsoDay(new Date(Date.UTC(Number(match[3]), month, day)));
}

/**
 * Convierte la fecha que muestra Google ("hace 4 días", "16 sept 2026") en un día ISO ("2026-09-21").
 * Es la fecha en que Google vio publicada la página, que en las ofertas suele coincidir con la de publicación.
 * Devuelve null si no hay fecha o el formato no se reconoce.
 */
export function parsePublishedDate(raw: string | undefined, now: Date): string | null {
  if (!raw) return null;
  const text = normalizeText(raw).replace(/\s+/g, ' ').trim();
  if (text === 'ayer') return toIsoDay(new Date(now.getTime() - DAY_MS));
  const parsed = parseRelative(text, now) ?? parseAbsolute(text);
  // Una fecha futura indica un error de lectura: mejor no mostrar nada
  return parsed && parsed <= toIsoDay(now) ? parsed : null;
}
