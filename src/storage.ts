import { promises as fs } from 'node:fs';
import { UNKNOWN_COMPANY } from './sources/common';
import { ParsedJob, isPortalId } from './sources';
import { normalizeKey } from './text';

export interface JobOffer extends ParsedJob {
  readonly fechaGuardado: string;
}

export interface MergeResult {
  readonly offers: readonly JobOffer[];
  readonly added: readonly JobOffer[];
}

const REQUIRED_FIELDS = ['id', 'titulo', 'empresa', 'ubicacion', 'enlace', 'fechaGuardado'] as const;
const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

type StoredOffer = Omit<JobOffer, 'portal' | 'fechaPublicacion'> & { portal?: unknown; fechaPublicacion?: unknown };

function isStoredOffer(value: unknown): value is StoredOffer {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return REQUIRED_FIELDS.every((key) => typeof v[key] === 'string');
}

/** Lee las ofertas guardadas. Si el archivo no existe devuelve []; si está corrupto lanza error para no sobrescribirlo. */
export async function loadOffers(file: string): Promise<readonly JobOffer[]> {
  let content: string;
  try {
    content = await fs.readFile(file, 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw error;
  }

  let data: unknown;
  try {
    data = JSON.parse(content);
  } catch {
    throw new Error(`${file} no contiene JSON válido. Revísalo o bórralo antes de volver a ejecutar.`);
  }
  if (!Array.isArray(data) || !data.every(isStoredOffer)) {
    throw new Error(`${file} no tiene el formato esperado (array de ofertas).`);
  }
  // Las ofertas guardadas antes de añadir más portales no tienen "portal": todas eran de LinkedIn
  return data.map(({ fechaPublicacion, ...offer }) => ({
    ...offer,
    portal: isPortalId(offer.portal) ? offer.portal : 'linkedin',
    ...(typeof fechaPublicacion === 'string' && ISO_DAY.test(fechaPublicacion) ? { fechaPublicacion } : {}),
  }));
}

/** Completa la fecha de publicación de ofertas guardadas sin ella si una búsqueda nueva la trae. */
function fillMissingDates(existing: readonly JobOffer[], candidates: readonly ParsedJob[]): readonly JobOffer[] {
  const dates = new Map(candidates.filter((job) => job.fechaPublicacion).map((job) => [job.id, job.fechaPublicacion]));
  return existing.map((offer) => {
    const fechaPublicacion = dates.get(offer.id);
    return offer.fechaPublicacion || !fechaPublicacion ? offer : { ...offer, fechaPublicacion };
  });
}

function companyKey(job: ParsedJob): string | null {
  return job.empresa === UNKNOWN_COMPANY ? null : normalizeKey(job.empresa);
}

/**
 * Misma oferta republicada (LinkedIn cambia el ID) o publicada en otro portal: mismo título y la misma empresa,
 * aunque un portal la escriba más larga ("Devoteam" / "Devoteam Spain"). Sin empresa conocida no se arriesga.
 */
function isRepost(a: ParsedJob, b: ParsedJob): boolean {
  const [companyA, companyB] = [companyKey(a), companyKey(b)];
  if (!companyA || !companyB || normalizeKey(a.titulo) !== normalizeKey(b.titulo)) return false;
  return companyA.startsWith(companyB) || companyB.startsWith(companyA);
}

/** Añade solo las ofertas que no existan ya ni sean republicaciones (tampoco repetidas dentro del mismo lote). */
export function mergeOffers(existing: readonly JobOffer[], candidates: readonly ParsedJob[], now: Date): MergeResult {
  const seenKeys = new Set(existing.flatMap((offer) => [`id:${offer.id}`, `url:${offer.enlace}`]));
  const fechaGuardado = now.toISOString();

  const added = candidates.reduce<JobOffer[]>((acc, job) => {
    const keys = [`id:${job.id}`, `url:${job.enlace}`];
    if (keys.some((key) => seenKeys.has(key))) return acc;
    if (existing.some((offer) => isRepost(offer, job)) || acc.some((offer) => isRepost(offer, job))) return acc;
    keys.forEach((key) => seenKeys.add(key));
    return [...acc, { ...job, fechaGuardado }];
  }, []);

  return { offers: [...fillMissingDates(existing, candidates), ...added], added };
}

/** Escritura atómica: primero a un .tmp y luego rename, para no dejar el JSON a medias si el proceso se corta. */
export async function saveOffers(file: string, offers: readonly JobOffer[]): Promise<void> {
  const tmpFile = `${file}.tmp`;
  await fs.writeFile(tmpFile, `${JSON.stringify(offers, null, 2)}\n`, 'utf8');
  await fs.rename(tmpFile, file);
}
