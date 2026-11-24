import axios from 'axios';
import type { ListingId } from '../sources/types';
import { EDUSO } from './eduso';
import { HACESFALTA_MADRID } from './hacesfalta';
import type { Listing, PageGetter } from './types';

export const LISTINGS: Readonly<Record<ListingId, Listing>> = {
  eduso: EDUSO,
  hacesfalta_madrid: HACESFALTA_MADRID,
};

const TIMEOUT_MS = 20_000;
// Se identifica como lo que es: un buscador personal que lee pocas páginas unas veces por semana
const USER_AGENT = 'BuscadorEmpleo/1.0 (uso personal; github.com/Rodrigo-Rayo/buscador-empleo)';

/** Descarga una página de un listado; null en un 404 (fin de la paginación), error en cualquier otro fallo. */
export const httpPageGetter: PageGetter = async (url) => {
  const response = await axios.get<string>(url, {
    timeout: TIMEOUT_MS,
    responseType: 'text',
    headers: { 'User-Agent': USER_AGENT },
    validateStatus: (status) => (status >= 200 && status < 300) || status === 404,
  });
  return response.status === 404 ? null : response.data;
};

export type { FetchOptions, Listing, ListingResult, PageGetter } from './types';
