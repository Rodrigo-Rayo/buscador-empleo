import type { SearchResultItem } from '../serperSearch';
import { normalizeKey } from '../text';
import { REMOTE, UNKNOWN_COMPANY, humanizeSlug, mentionsRemote, stripTruncation } from './common';
import type { JobSource, ParsedJob } from './types';

// https://www.infojobs.net/{ciudad}/{slug}/of-i{hex}  (las páginas de categoría y de empresa no llevan "of-i")
const OFFER_URL = /^https?:\/\/(?:www\.)?infojobs\.net\/([^/?#]+)\/([^/?#]+)\/of-i([0-9a-f]+)/i;
const TITLE_PREFIX = /^Oferta de empleo:\s*/i;
const BOLSA_SUFFIX = /\s+-\s+Bolsa\b.*$/i;
// "...en la empresa Origen - Ofertas Clínica. Envía tu curriculum..."
const COMPANY_IN_EMPRESA = /en la empresa (.+?)\.\s/;
// "Net MVC (100% Teletrabajo). Second Window - Ofertas de trabajo."
const COMPANY_BEFORE_OFERTAS = /\.\s([^.]{2,80}?) - Ofertas de trabajo/;
const TRAILING_DOTS = /[\s.…]+$/;

/** Quita el " en {ciudad}" final que InfoJobs añade al título ("Psicólogo/a en Madrid - Rivas" → "Psicólogo/a"). */
function stripCitySuffix(title: string, city: string): string {
  const index = title.lastIndexOf(' en ');
  if (index <= 0) return title;
  return normalizeKey(title.slice(index + 4)).startsWith(normalizeKey(city)) ? title.slice(0, index).trim() : title;
}

function companyFromSnippet(snippet: string): string | undefined {
  const match = COMPANY_IN_EMPRESA.exec(snippet) ?? COMPANY_BEFORE_OFERTAS.exec(snippet);
  // Google corta el snippet con "..." y a veces el nombre queda como "Accom .." o solo ".."
  const company = match?.[1]?.replace(TRAILING_DOTS, '').trim();
  return company && /[a-z0-9]/i.test(company) ? company : undefined;
}

export function parseInfoJobs(item: SearchResultItem): ParsedJob | null {
  const match = OFFER_URL.exec(item.link);
  if (!match?.[1] || !match[2] || !match[3]) return null;
  const [, citySlug, slug, hex] = match;

  const city = humanizeSlug(citySlug);
  const cleaned = stripTruncation(stripTruncation(item.title).replace(TITLE_PREFIX, '').replace(BOLSA_SUFFIX, ''));
  const titulo = stripCitySuffix(cleaned, city) || humanizeSlug(slug);

  return {
    id: `infojobs:${hex}`,
    titulo,
    empresa: companyFromSnippet(item.snippet) ?? UNKNOWN_COMPANY,
    // El snippet mezcla otras ofertas: solo el título es fiable para saber si es remota
    ubicacion: mentionsRemote(titulo) ? REMOTE : city,
    enlace: `https://www.infojobs.net/${citySlug}/${slug}/of-i${hex}`,
    portal: 'infojobs',
  };
}

export const INFOJOBS: JobSource = {
  id: 'infojobs',
  nombre: 'InfoJobs',
  site: 'site:infojobs.net',
  supportsLevelTerms: false,
  supportsLocationGroup: true,
  parse: parseInfoJobs,
};
