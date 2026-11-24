import { UNKNOWN_COMPANY } from '../sources/common';
import type { ParsedJob } from '../sources/types';
import { cleanText, isoDayFromSpanish, wait } from './html';
import type { Listing } from './types';

// Hacesfalta.org (empleo en ONG) lista las ofertas remuneradas de una provincia, 6 por página y de la más nueva a la
// más antigua. La tarjeta del listado solo trae título, ONG y lugar (el texto es la presentación de la ONG): los
// requisitos (colegiación, titulación...), la jornada y el plazo están en la ficha, que se abre solo para las nuevas.
// Mismo ID y enlace que la búsqueda de Hacesfalta por Google, así que no se duplican.
const BASE_URL = 'https://www.hacesfalta.org';
const MADRID_PROVINCE_ID = 28;
// ~30 páginas en Madrid; la primera ejecución las lee todas, las siguientes paran al llegar a lo ya visto
const MAX_PAGES = 40;
const REQUEST_DELAY_MS = 500;

const CARD_START = /<div id="[^"]*_marcoItem_\d+" class="card[^"]*card-oportunidad[^"]*">/g;
const CARD_TITLE = /<a href="(\/oportunidades\/remuneradas\/detalle\/([^/"]+)\/(\d+))"[^>]*_lkTitulo_\d+">([\s\S]*?)<\/a>/;
const CARD_ONG_AND_PLACE = /_aOng_\d+">([\s\S]*?)<\/a>\s*\|\s*([^<]*)</;
// "España(Madrid)" → "Madrid"
const COUNTRY_AND_PROVINCE = /^[^(]*\(([^)]+)\)\s*$/;
const DEADLINE = /Fecha l[ií]mite Inscripci[oó]n<\/span>\s*<\/div>\s*<div[^>]*>\s*<span>\s*([^<]+)<\/span>/;
// Desde "Objetivo" hasta el aviso de "Enviar interés": funciones, perfil, contrato, salario y estudios mínimos
const DETAIL = /<div class="detalle-oportunidad[^"]*">([\s\S]*?)<div class="alert/;

function listUrl(page: number): string {
  return `${BASE_URL}/oportunidades/remuneradas/Default.aspx?pageIndex=${page}&volver=&idProvincia=${MADRID_PROVINCE_ID}&fOrden=FechaPubli&fOrdenDir=Desc`;
}

/** Ofertas de una página del listado, solo con lo que trae la tarjeta. */
export function parseHacesfaltaList(html: string): readonly ParsedJob[] {
  const starts = [...html.matchAll(CARD_START)];
  return starts.flatMap((start, index) => {
    const card = html.slice(start.index, starts[index + 1]?.index ?? html.length);
    const title = CARD_TITLE.exec(card);
    if (!title) return [];
    const [, path, , id, rawTitle] = title;
    const titulo = cleanText(rawTitle ?? '');
    if (!titulo) return [];
    const [, ong, place] = CARD_ONG_AND_PLACE.exec(card) ?? [];
    const placeText = cleanText(place ?? '');
    return [
      {
        id: `hacesfalta:${id}`,
        titulo,
        empresa: cleanText(ong ?? '') || UNKNOWN_COMPANY,
        ubicacion: COUNTRY_AND_PROVINCE.exec(placeText)?.[1]?.trim() || placeText || 'Madrid',
        enlace: `${BASE_URL}${path}`,
        portal: 'hacesfalta' as const,
      },
    ];
  });
}

/** Completa una oferta del listado con la descripción y el plazo de su ficha. */
export function withHacesfaltaDetail(job: ParsedJob, html: string): ParsedJob {
  const descripcion = cleanText(DETAIL.exec(html)?.[1] ?? '');
  const fechaLimite = isoDayFromSpanish(DEADLINE.exec(html)?.[1]);
  return { ...job, ...(descripcion ? { descripcion } : {}), ...(fechaLimite ? { fechaLimite } : {}) };
}

export const HACESFALTA_MADRID: Listing = {
  id: 'hacesfalta_madrid',
  nombre: 'Hacesfalta (ONG, Madrid)',
  async fetchJobs(get, { delayMs = REQUEST_DELAY_MS, knownIds = new Set<string>() } = {}) {
    const jobs: ParsedJob[] = [];
    const seenIds: string[] = [];
    for (let page = 1; page <= MAX_PAGES; page++) {
      const html = await get(listUrl(page));
      const cards = html === null ? [] : parseHacesfaltaList(html);
      if (page === 1 && cards.length === 0) {
        throw new Error('Hacesfalta: no se ha encontrado ninguna oferta en la primera página (¿ha cambiado la web?)');
      }
      if (cards.length === 0) break;
      seenIds.push(...cards.map((card) => card.id));
      const fresh = cards.filter((card) => !knownIds.has(card.id));
      for (const card of fresh) {
        if (delayMs > 0) await wait(delayMs);
        const detail = await get(card.enlace);
        jobs.push(detail === null ? card : withHacesfaltaDetail(card, detail));
      }
      // Una página entera ya revisada: lo que sigue es más antiguo y también se conoce
      if (fresh.length === 0) break;
      if (delayMs > 0) await wait(delayMs);
    }
    return { jobs, seenIds };
  },
};
