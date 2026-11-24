import { promises as fs } from 'node:fs';

/**
 * Ofertas de los listados ya revisadas, encajen o no ({ listado: { id: día ISO en que se vio por última vez } }).
 * Las que no encajan no se guardan en las ofertas del perfil: sin este registro se volvería a abrir su ficha en cada
 * ejecución. Se olvidan a los 90 días para que el archivo no crezca sin fin (para entonces ya no están publicadas).
 */
export type SeenFile = Readonly<Record<string, Readonly<Record<string, string>>>>;

export const FORGET_AFTER_DAYS = 90;
const DAY_MS = 86_400_000;
const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

function isSeenFile(value: unknown): value is SeenFile {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  return Object.values(value).every(
    (ids) =>
      typeof ids === 'object' &&
      ids !== null &&
      !Array.isArray(ids) &&
      Object.values(ids).every((day) => typeof day === 'string' && ISO_DAY.test(day)),
  );
}

/** Si falta o está corrupto se empieza de cero: solo cuesta volver a abrir algunas fichas. */
export async function loadSeen(file: string): Promise<SeenFile> {
  try {
    const data: unknown = JSON.parse(await fs.readFile(file, 'utf8'));
    if (isSeenFile(data)) return data;
    console.warn(`⚠ ${file} no tiene el formato esperado: se empieza de cero.`);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      console.warn(`⚠ No se pudo leer ${file} (${(error as Error).message}): se empieza de cero.`);
    }
  }
  return {};
}

/** Marca como vistas hoy las ofertas de un listado y olvida las que llevan más de 90 días sin aparecer. */
export function markSeen(seen: SeenFile, listing: string, ids: readonly string[], now: Date): SeenFile {
  const today = now.toISOString().slice(0, 10);
  const oldest = new Date(now.getTime() - FORGET_AFTER_DAYS * DAY_MS).toISOString().slice(0, 10);
  const kept = Object.entries(seen[listing] ?? {}).filter(([, day]) => day >= oldest);
  return { ...seen, [listing]: Object.fromEntries([...kept, ...ids.map((id) => [id, today] as const)]) };
}

export async function saveSeen(file: string, seen: SeenFile): Promise<void> {
  const tmpFile = `${file}.tmp`;
  await fs.writeFile(tmpFile, `${JSON.stringify(seen, null, 2)}\n`, 'utf8');
  await fs.rename(tmpFile, file);
}
