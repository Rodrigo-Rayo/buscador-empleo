import type { SearchResultItem } from '../serperSearch';
import { REMOTE, UNKNOWN_COMPANY, UNKNOWN_LOCATION, humanizeSlug, mentionsRemote, stripTruncation } from './common';
import type { JobSource, ParsedJob } from './types';

// https://www.hacesfalta.org/oportunidades/remuneradas/detalle/{slug}/{id}
const OFFER_URL = /^https?:\/\/(?:www\.)?hacesfalta\.org\/oportunidades\/remuneradas\/detalle\/([^/?#]+)\/(\d+)/i;
// "Preparador/a laboral - Trabajo en Madrid"
const TRABAJO_EN = /^(.+?) - Trabajo en (.+)$/i;
// "Trabajo en Rivas-VaciaMadrid - Madrid"
const LOCATION_PREFIX = /^Trabajo en\s+/i;
// El slug pierde "/": "psicologoa" → "Psicologo/a"
const GENDER_SUFFIX = /(o)a\b/gi;

interface TitleParts {
  readonly titulo?: string;
  readonly ubicacion?: string;
}

/**
 * Formatos vistos:
 *  "Madrid | Trabajo social | Trabajador/trabajadora social"  → ubicación | área | puesto
 *  "Trabajo en Rivas-VaciaMadrid - Madrid | Psicología"        → ubicación | área (sin puesto)
 *  "Preparador/a laboral - Trabajo en Madrid"                  → puesto - ubicación
 *  "Trabajador/a social – coordinador/a de hogares de acogida" → solo puesto
 */
function parseTitle(raw: string): TitleParts {
  const title = stripTruncation(raw);
  const parts = title.split(' | ').map((part) => part.trim());
  if (parts.length >= 3) {
    return { ubicacion: parts[0], titulo: parts[parts.length - 1] };
  }
  if (parts.length === 2) {
    // Solo es ubicación si empieza por "Trabajo en"; si no ("Psicólogo/a | ..."), el puesto completo sale del slug
    const first = parts[0] ?? '';
    const ubicacion = LOCATION_PREFIX.test(first) ? first.replace(LOCATION_PREFIX, '').split(' - ')[0]?.trim() : undefined;
    return { ubicacion };
  }
  const trabajoEn = TRABAJO_EN.exec(title);
  if (trabajoEn) return { titulo: trabajoEn[1]?.trim(), ubicacion: trabajoEn[2]?.trim() };
  return { titulo: title || undefined };
}

export function parseHacesfalta(item: SearchResultItem): ParsedJob | null {
  const match = OFFER_URL.exec(item.link);
  if (!match?.[1] || !match[2]) return null;
  const [, slug, id] = match;

  const { titulo, ubicacion } = parseTitle(item.title);
  const finalTitle = titulo || humanizeSlug(slug).replace(GENDER_SUFFIX, '$1/a');

  return {
    id: `hacesfalta:${id}`,
    titulo: finalTitle,
    // Casi nunca aparece la entidad en el resultado de Google
    empresa: UNKNOWN_COMPANY,
    ubicacion: mentionsRemote(finalTitle) ? REMOTE : (ubicacion ?? UNKNOWN_LOCATION),
    enlace: `https://www.hacesfalta.org/oportunidades/remuneradas/detalle/${slug}/${id}`,
    portal: 'hacesfalta',
  };
}

export const HACESFALTA: JobSource = {
  id: 'hacesfalta',
  nombre: 'Hacesfalta (ONG)',
  site: 'site:hacesfalta.org/oportunidades/remuneradas/detalle',
  supportsLevelTerms: false,
  // Con varias ubicaciones en OR, Google no devuelve nada en este portal: se usa solo la principal
  supportsLocationGroup: false,
  parse: parseHacesfalta,
};
