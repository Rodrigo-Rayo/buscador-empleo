import type { ListingId, ParsedJob } from '../sources/types';

/** Descarga una página; null si no existe (404), para saber dónde acaba la paginación. */
export type PageGetter = (url: string) => Promise<string | null>;

export interface FetchOptions {
  /** Pausa entre peticiones para no cargar la web */
  readonly delayMs?: number;
  /** Ofertas ya revisadas en otras ejecuciones: no se vuelve a abrir su ficha y permiten dejar de paginar antes */
  readonly knownIds?: ReadonlySet<string>;
}

export interface ListingResult {
  /** Ofertas leídas (sin filtrar por perfil) */
  readonly jobs: readonly ParsedJob[];
  /** IDs de todas las ofertas que aparecían en las páginas leídas, para recordarlas como vistas */
  readonly seenIds: readonly string[];
}

/** Web de empleo cuyo listado se lee directamente, sin Google: no gasta créditos. */
export interface Listing {
  readonly id: ListingId;
  readonly nombre: string;
  readonly fetchJobs: (get: PageGetter, options?: FetchOptions) => Promise<ListingResult>;
}
