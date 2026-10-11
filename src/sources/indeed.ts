import type { SearchResultItem } from '../serperSearch';
import { REMOTE, UNKNOWN_COMPANY, UNKNOWN_LOCATION, stripTruncation } from './common';
import type { JobSource, ParsedJob } from './types';

// https://es.indeed.com/viewjob?jk={hex}
const OFFER_URL = /^https?:\/\/es\.indeed\.com\/viewjob\?(?:[^#]*&)?jk=([0-9a-f]+)/i;
// Lo que va tras el último " - " del título es la ubicación: "28037 Madrid, Madrid provincia"
const LOCATION_HINT = /provincia|^\d{5}\b|españa|teletrabajo|remoto/i;
const POSTAL_CODE = /^\d{5}\s+/;
// La cabecera del snippet ("Título. Empresa. · 3.5. Madrid. • Teletrabajo. Detalles del empleo") es de la propia oferta
const HEADER_END = 'Detalles del empleo';
const MAX_COMPANY_LENGTH = 80;

interface TitleParts {
  readonly titulo: string;
  readonly ubicacion?: string;
}

function splitTitle(raw: string): TitleParts {
  const title = stripTruncation(raw);
  const index = title.lastIndexOf(' - ');
  const tail = index > 0 ? title.slice(index + 3).trim() : '';
  if (!tail || !LOCATION_HINT.test(tail)) return { titulo: title };
  // "28037 Madrid, Madrid provincia" → "Madrid"; "Cercedilla, Madrid provincia" → "Cercedilla"
  const ubicacion = tail.replace(POSTAL_CODE, '').split(',')[0]?.trim();
  return { titulo: title.slice(0, index).trim(), ubicacion: ubicacion || undefined };
}

/** "Psicólogo/a, indefinido, CAEF. Grupo 5. (parte de Clariane). ·" → "Grupo 5" */
function companyFromSnippet(snippet: string, titulo: string): string | undefined {
  const index = snippet.indexOf(`${titulo}. `);
  if (index < 0) return undefined;
  const company = snippet.slice(index + titulo.length + 2).split(/\.\s/)[0]?.trim();
  if (!company || company.length > MAX_COMPANY_LENGTH || /^[\d·•]/.test(company)) return undefined;
  return company;
}

export function parseIndeed(item: SearchResultItem): ParsedJob | null {
  const jk = OFFER_URL.exec(item.link)?.[1];
  if (!jk) return null;

  const { titulo, ubicacion } = splitTitle(item.title);
  // Sin el marcador, el snippet es texto de la descripción (o de otras ofertas) y no dice nada de esta
  const header = item.snippet.includes(HEADER_END) ? (item.snippet.split(HEADER_END)[0] ?? '') : '';

  return {
    id: `indeed:${jk}`,
    titulo,
    empresa: companyFromSnippet(item.snippet, titulo) ?? UNKNOWN_COMPANY,
    ubicacion: /teletrabajo/i.test(header) ? REMOTE : (ubicacion ?? UNKNOWN_LOCATION),
    enlace: `https://es.indeed.com/viewjob?jk=${jk}`,
    portal: 'indeed',
  };
}

export const INDEED: JobSource = {
  id: 'indeed',
  nombre: 'Indeed',
  site: 'site:es.indeed.com/viewjob',
  supportsLevelTerms: false,
  supportsLocationGroup: true,
  parse: parseIndeed,
};
