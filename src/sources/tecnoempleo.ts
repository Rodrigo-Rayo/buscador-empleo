import type { SearchResultItem } from '../serperSearch';
import { normalizeKey } from '../text';
import { REMOTE, UNKNOWN_COMPANY, UNKNOWN_LOCATION, capitalize, stripTruncation } from './common';
import type { JobSource, ParsedJob } from './types';

// https://www.tecnoempleo.com/{slug}/{tecnologías}/rf-{hex}  (las páginas de categoría y perfiles no llevan "rf-")
const OFFER_URL = /^https?:\/\/(?:www\.)?tecnoempleo\.com\/([^/?#]+)\/([^/?#]+)\/rf-([0-9a-f]+)/i;
// "Oferta de Empleo analista programador .net back en Madrid, Devoteam - Tecnoempleo.com con conocimientos..."
// Ubicación y empresa acotadas: sin límite, "en remoto ... (flexibility, WFH..." se tomaría como empresa
const OFERTA_PATTERN =
  /Oferta de Empleo (.+?) en ([^,.]{1,40}), ([^.,]{1,60}?)(?:\s+-\s+Tecnoempleo\.com)?(?:\s+con conocimientos|\s*$|\s*\.\.\.)/i;

interface Details {
  readonly titulo?: string;
  readonly ubicacion?: string;
  readonly empresa?: string;
}

function detailsFrom(text: string): Details {
  const match = OFERTA_PATTERN.exec(stripTruncation(text));
  if (!match) return {};
  return { titulo: match[1]?.trim(), ubicacion: match[2]?.trim(), empresa: match[3]?.trim() };
}

/** "Analista Programador .Net Back - Devoteam" → quita " - Devoteam" si coincide con la empresa. */
function stripCompany(title: string, empresa: string | undefined): string {
  const index = title.lastIndexOf(' - ');
  if (index <= 0 || !empresa) return title;
  return normalizeKey(title.slice(index + 3)) === normalizeKey(empresa) ? title.slice(0, index).trim() : title;
}

export function parseTecnoempleo(item: SearchResultItem): ParsedJob | null {
  const match = OFFER_URL.exec(item.link);
  if (!match?.[1] || !match[2] || !match[3]) return null;
  const [, slug, skills, hex] = match;

  // El título a veces viene con el mismo formato que el snippet ("Oferta de Empleo java developer en remoto, UST")
  const fromTitle = detailsFrom(item.title);
  const details = fromTitle.empresa ? fromTitle : detailsFrom(item.snippet);
  const title = fromTitle.titulo ? capitalize(fromTitle.titulo) : stripCompany(stripTruncation(item.title), details.empresa);
  const location = details.ubicacion ?? UNKNOWN_LOCATION;

  return {
    id: `tecnoempleo:${hex}`,
    titulo: title,
    empresa: details.empresa ?? UNKNOWN_COMPANY,
    ubicacion: /^remot/i.test(location) ? REMOTE : capitalize(location),
    enlace: `https://www.tecnoempleo.com/${slug}/${skills}/rf-${hex}`,
    portal: 'tecnoempleo',
  };
}

export const TECNOEMPLEO: JobSource = {
  id: 'tecnoempleo',
  nombre: 'Tecnoempleo',
  site: 'site:tecnoempleo.com',
  supportsLevelTerms: false,
  supportsLocationGroup: true,
  parse: parseTecnoempleo,
};
