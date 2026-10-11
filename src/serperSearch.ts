import axios, { AxiosInstance, isAxiosError } from 'axios';

const ENDPOINT = 'https://google.serper.dev/search';
const RESULTS_PER_PAGE = 10;
const REQUEST_TIMEOUT_MS = 15_000;
const FATAL_STATUSES = new Set([401, 403]);
const RATE_LIMIT_STATUS = 429;
const MAX_RETRIES = 3;
const DEFAULT_RETRY_DELAY_MS = 1000;

export interface SearchResultItem {
  readonly title: string;
  readonly link: string;
  readonly snippet: string;
  /** Fecha que muestra Google ("hace 4 días", "16 sept 2026"), si la hay */
  readonly date?: string;
}

/** Error que invalida el resto de búsquedas (clave inválida, sin créditos, límite de peticiones). */
export class FatalSearchError extends Error {}

/** Demasiadas peticiones seguidas: se reintenta con espera creciente antes de rendirse. */
export class RateLimitError extends FatalSearchError {}

export interface SearchOptions {
  readonly dateRestrict: string | undefined;
  /** Espera base entre reintentos por límite de peticiones (se multiplica por el nº de intento) */
  readonly retryDelayMs?: number;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export function createHttpClient(apiKey: string): AxiosInstance {
  return axios.create({
    baseURL: ENDPOINT,
    timeout: REQUEST_TIMEOUT_MS,
    headers: { 'X-API-KEY': apiKey, 'Content-Type': 'application/json' },
  });
}

function toResultItem(raw: unknown): SearchResultItem | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const item = raw as Record<string, unknown>;
  if (typeof item.link !== 'string' || typeof item.title !== 'string') return null;
  const result = { title: item.title, link: item.link, snippet: typeof item.snippet === 'string' ? item.snippet : '' };
  return typeof item.date === 'string' && item.date ? { ...result, date: item.date } : result;
}

function toSearchError(error: unknown): Error {
  if (!isAxiosError<{ message?: string }>(error)) return error instanceof Error ? error : new Error(String(error));

  const status = error.response?.status;
  // No incluimos error.config en el mensaje: contiene la API key en las cabeceras.
  const detail = error.response?.data?.message ?? error.message;
  const message = `Error de Serper (HTTP ${status ?? 'sin respuesta'}): ${detail}`;

  if (status === RATE_LIMIT_STATUS) return new RateLimitError(message);
  if ((status !== undefined && FATAL_STATUSES.has(status)) || /credit/i.test(detail)) {
    return new FatalSearchError(message);
  }
  return new Error(message);
}

/** `DATE_RESTRICT` (d7, w2, m1, y1) → parámetro `tbs` de Google (qdr:d7, qdr:w2...). */
function toTbs(dateRestrict: string | undefined): string | undefined {
  return dateRestrict ? `qdr:${dateRestrict}` : undefined;
}

async function requestPage(
  client: AxiosInstance,
  query: string,
  page: number,
  dateRestrict: string | undefined,
): Promise<readonly SearchResultItem[]> {
  try {
    const response = await client.post<{ organic?: unknown[] }>('', {
      q: query,
      gl: 'es',
      hl: 'es',
      num: RESULTS_PER_PAGE,
      page: page + 1,
      tbs: toTbs(dateRestrict),
    });
    const items = Array.isArray(response.data.organic) ? response.data.organic : [];
    return items.map(toResultItem).filter((item): item is SearchResultItem => item !== null);
  } catch (error) {
    throw toSearchError(error);
  }
}

/** Pide una página de resultados (`page` empieza en 0), reintentando si Serper limita la frecuencia. */
export async function searchPage(
  client: AxiosInstance,
  query: string,
  page: number,
  { dateRestrict, retryDelayMs = DEFAULT_RETRY_DELAY_MS }: SearchOptions,
): Promise<readonly SearchResultItem[]> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await requestPage(client, query, page, dateRestrict);
    } catch (error) {
      if (!(error instanceof RateLimitError) || attempt >= MAX_RETRIES) throw error;
      await sleep(retryDelayMs * (attempt + 1));
    }
  }
}
