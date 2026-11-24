import { UNKNOWN_COMPANY, UNKNOWN_LOCATION } from '../sources/common';
import type { ParsedJob } from '../sources/types';
import { cleanText, isoDayFromSpanish, wait } from './html';
import type { Listing } from './types';

// Eduso (portal de la educación social) publica en /empleo/ las convocatorias del sector social y educativo, 24 por
// página y de la más nueva a la más antigua. Cada oferta trae su propia ficha: descripción, territorio, plazo,
// estudios mínimos... y un ancla con el ID de la entrada de WordPress, que /?p=ID redirige a su página propia.
const BASE_URL = 'https://www.eduso.net';
const MAX_PAGES = 15;
const PAGE_DELAY_MS = 500;

const OFFER_ANCHOR = /<a id="(\d+)"><\/a>/g;
const TITLE = /<h4[^>]*>([\s\S]*?)<\/h4>/;
// Fila "<strong>Etiqueta:</strong></td><td>valor</td>" (al plazo le falta el </td> y cierra con </tr>)
const FIELD = /<strong>\s*([^<]+?)\s*:?\s*<\/strong>\s*<\/td>\s*<td[^>]*>([\s\S]*?)<\/(?:td|tr)>/g;

function fieldsOf(block: string): ReadonlyMap<string, string> {
  return new Map([...block.matchAll(FIELD)].map((match) => [cleanText(match[1] ?? '').toLowerCase(), cleanText(match[2] ?? '')]));
}

function parseOffer(postId: string, block: string): ParsedJob | null {
  const titulo = cleanText(TITLE.exec(block)?.[1] ?? '');
  if (!titulo) return null;
  const fields = fieldsOf(block);
  const lugar = fields.get('lugar');
  const territorio = fields.get('territorio');
  const fechaLimite = isoDayFromSpanish(fields.get('plazo final'));
  // Lo que sirve para puntuar: qué piden y qué se hace (sin el tipo de contrato ni el horario)
  const descripcion = [
    fields.get('descripción'),
    fields.get('estudios mínimos') && `Estudios mínimos: ${fields.get('estudios mínimos')}`,
    fields.get('experiencia') && `Experiencia: ${fields.get('experiencia')}`,
  ]
    .filter(Boolean)
    .join('. ');
  return {
    id: `eduso:${postId}`,
    titulo,
    empresa: fields.get('convoca') || UNKNOWN_COMPANY,
    ubicacion: [lugar, territorio].filter((part, index, all) => part && all.indexOf(part) === index).join(' · ') || UNKNOWN_LOCATION,
    enlace: `${BASE_URL}/?p=${postId}`,
    portal: 'eduso',
    ...(descripcion ? { descripcion } : {}),
    ...(fechaLimite ? { fechaLimite } : {}),
  };
}

/** Ofertas de una página del listado de Eduso. */
export function parseEdusoPage(html: string): readonly ParsedJob[] {
  const anchors = [...html.matchAll(OFFER_ANCHOR)];
  return anchors.flatMap((anchor, index) => {
    const end = anchors[index + 1]?.index ?? html.length;
    const job = parseOffer(anchor[1] ?? '', html.slice(anchor.index, end));
    return job ? [job] : [];
  });
}

function pageUrl(page: number): string {
  return page === 1 ? `${BASE_URL}/empleo/` : `${BASE_URL}/empleo/page/${page}/`;
}

export const EDUSO: Listing = {
  id: 'eduso',
  nombre: 'Eduso (empleo social)',
  // El listado ya trae la ficha completa: se lee entero (unas 12 páginas) y lo conocido lo descarta la deduplicación
  async fetchJobs(get, { delayMs = PAGE_DELAY_MS } = {}) {
    const jobs: ParsedJob[] = [];
    for (let page = 1; page <= MAX_PAGES; page++) {
      const html = await get(pageUrl(page));
      const pageJobs = html === null ? [] : parseEdusoPage(html);
      // La primera página siempre tiene ofertas: si sale vacía, Eduso ha cambiado su web y hay que revisar el lector
      if (page === 1 && pageJobs.length === 0) throw new Error('Eduso: no se ha encontrado ninguna oferta en la primera página (¿ha cambiado la web?)');
      if (pageJobs.length === 0) break;
      jobs.push(...pageJobs);
      if (delayMs > 0) await wait(delayMs);
    }
    return { jobs, seenIds: jobs.map((job) => job.id) };
  },
};
