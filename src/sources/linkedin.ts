import type { SearchResultItem } from '../serperSearch';
import { normalizeKey } from '../text';
import { REMOTE, TRUNCATION, UNKNOWN_COMPANY, UNKNOWN_LOCATION, humanizeSlug, mentionsRemote } from './common';
import type { JobSource, ParsedJob } from './types';

// /jobs/view/frontend-developer-at-acme-4012345678  ó  /jobs/view/4012345678  ó  ?currentJobId=4012345678
const JOB_ID_PATTERN = /\/jobs\/view\/(?:[^/?#]*-)?(\d{6,})|[?&]currentJobId=(\d{6,})/;
const SLUG_PATTERN = /\/jobs\/view\/(.+)-at-(.+)-\d{6,}/;

// "Acme hiring Frontend Developer in Madrid, Spain"
const HIRING_PATTERN = /^(.+?) hiring (.+?) in (.+)$/i;
// "Acme busca personal para el cargo de Frontend Developer en Madrid" (la ubicación falta si Google trunca)
const BUSCA_PATTERN = /^(.+?) busca (?:personal para el (?:puesto|cargo) de |a )?(.+?)(?: en (.+))?$/i;
// Separadores entre título y empresa: "Dev en Acme", "Dev - Acme", "Dev at Acme" (fichas en inglés)
const COMPANY_SEPARATORS = [' en ', ' at ', ' - '] as const;
const LOCATION_SEPARATOR = ' — ';
// Sufijos societarios que el slug incluye pero el título no: S.L.U., S.L., S.A.U., S.A., S.L.L.
const LEGAL_SUFFIX = /(slu|sll|sl|sau|sa)$/;

const TRAILING_NOISE = [
  /\s*[|\-–—]\s*(?:Empleos de )?LinkedIn\s*$/i,
  /\s*[|\-–—]\s*(?:Empleos|Jobs)\s*$/i,
  /\s*(?:\.\.\.|…)\s*$/,
] as const;
// "Solicita el puesto de X en Acme en Madrid: Jornada completa..."
const SNIPPET_LOCATION_PATTERN = /Solicita el puesto de .+ en ([^:.]+):/;
// Fichas fuera de es.linkedin.com: "Apply for X at Acme in European Union. Contract..." / "... in European Union ..."
const SNIPPET_LOCATION_PATTERN_EN = /Apply for .+? at .+? in ([^.…]+?)\s*(?:\.\.\.|…|\.)/;

interface TitleParts {
  readonly titulo?: string;
  readonly empresa?: string;
  readonly ubicacion?: string;
}

interface SlugParts {
  readonly titulo: string;
  readonly empresa: string;
}

export function extractJobId(url: string): string | null {
  const match = JOB_ID_PATTERN.exec(url);
  return match?.[1] ?? match?.[2] ?? null;
}

export function canonicalJobUrl(id: string): string {
  return `https://www.linkedin.com/jobs/view/${id}/`;
}

/** Claves con las que la empresa del slug puede aparecer en el título ("ferchau-spain-s-l-u" → también "ferchauspain"). */
function companyKeys(slugCompany: string): readonly string[] {
  const key = normalizeKey(slugCompany);
  const withoutLegalSuffix = key.replace(LEGAL_SUFFIX, '');
  return withoutLegalSuffix && withoutLegalSuffix !== key ? [key, withoutLegalSuffix] : [key];
}

/** Quita sufijos como " - Empleos - LinkedIn" o "..." (pueden venir encadenados). */
function cleanTitle(raw: string): string {
  let current = raw.trim();
  let previous = '';
  while (current !== previous) {
    previous = current;
    current = TRAILING_NOISE.reduce((text, pattern) => text.replace(pattern, ''), current).trim();
  }
  return current;
}

function parseSlug(url: string): SlugParts | null {
  const match = SLUG_PATTERN.exec(url);
  if (!match?.[1] || !match[2]) return null;
  return { titulo: humanizeSlug(match[1]), empresa: humanizeSlug(match[2]) };
}

/** Busca la empresa del slug al final del título: "Dev en Acme — Madrid" → Dev / Acme / Madrid. */
function splitByCompany(title: string, keys: readonly string[]): TitleParts | null {
  const locationIndex = title.lastIndexOf(LOCATION_SEPARATOR);
  const main = locationIndex > 0 ? title.slice(0, locationIndex) : title;
  const ubicacion = locationIndex > 0 ? title.slice(locationIndex + LOCATION_SEPARATOR.length).trim() : undefined;

  for (const separator of COMPANY_SEPARATORS) {
    const index = main.lastIndexOf(separator);
    const empresa = main.slice(index + separator.length).trim();
    if (index > 0 && keys.includes(normalizeKey(empresa))) {
      return { titulo: main.slice(0, index).trim(), empresa, ubicacion };
    }
  }
  return null;
}

function parseTitle(rawTitle: string, slug: SlugParts | null): TitleParts {
  const title = cleanTitle(rawTitle);
  const truncated = TRUNCATION.test(rawTitle);

  const hiring = HIRING_PATTERN.exec(title);
  if (hiring) return { empresa: hiring[1], titulo: hiring[2], ubicacion: hiring[3] };

  const busca = BUSCA_PATTERN.exec(title);
  if (busca) {
    // Si Google truncó el título, lo que falta es el puesto: el slug lo tiene completo
    return truncated ? { empresa: busca[1], titulo: slug?.titulo } : { empresa: busca[1], titulo: busca[2], ubicacion: busca[3] };
  }

  const byCompany = slug ? splitByCompany(title, companyKeys(slug.empresa)) : null;
  if (byCompany) return byCompany;

  return { titulo: truncated ? (slug?.titulo ?? title) : title || undefined };
}

function locationFromSnippet(snippet: string): string | undefined {
  const explicit = (SNIPPET_LOCATION_PATTERN.exec(snippet) ?? SNIPPET_LOCATION_PATTERN_EN.exec(snippet))?.[1]?.trim();
  if (explicit) return explicit;
  if (mentionsRemote(snippet)) return REMOTE;
  if (/\bmadrid\b/i.test(snippet)) return 'Madrid';
  return undefined;
}

/** Convierte un resultado de búsqueda en una oferta. Devuelve null si no es una oferta de LinkedIn. */
export function parseLinkedIn(item: SearchResultItem): ParsedJob | null {
  const id = extractJobId(item.link);
  if (!id) return null;

  const slug = parseSlug(item.link);
  const fromTitle = parseTitle(item.title, slug);

  return {
    id,
    titulo: fromTitle.titulo || slug?.titulo || 'Sin título',
    empresa: fromTitle.empresa || slug?.empresa || UNKNOWN_COMPANY,
    ubicacion: fromTitle.ubicacion || locationFromSnippet(item.snippet) || UNKNOWN_LOCATION,
    enlace: canonicalJobUrl(id),
    portal: 'linkedin',
  };
}

export const LINKEDIN: JobSource = {
  id: 'linkedin',
  nombre: 'LinkedIn',
  // El subdominio es. solo contiene ofertas publicadas en España (co., mx... traen ofertas de otros países)
  site: 'site:es.linkedin.com/jobs/view',
  supportsLevelTerms: true,
  supportsLocationGroup: true,
  parse: parseLinkedIn,
};

/** Ofertas publicadas fuera de España (remoto internacional). Las españolas ya las trae LINKEDIN. */
export const LINKEDIN_INTL: JobSource = {
  id: 'linkedin_intl',
  nombre: 'LinkedIn Internacional',
  site: 'site:linkedin.com/jobs/view -site:es.linkedin.com',
  supportsLevelTerms: true,
  supportsLocationGroup: true,
  parse: (item) => {
    const job = parseLinkedIn(item);
    return job ? { ...job, portal: 'linkedin_intl' } : null;
  },
};
