import type { SearchResultItem } from '../serperSearch';

/** Portales que se buscan a través de Google (Serper), una consulta por palabra clave */
export const SEARCH_PORTAL_IDS = ['linkedin', 'linkedin_intl', 'infojobs', 'indeed', 'tecnoempleo', 'hacesfalta'] as const;
export type SearchPortalId = (typeof SEARCH_PORTAL_IDS)[number];

/** Portales a los que solo se llega leyendo su listado directamente (no se buscan por Google) */
const DIRECT_PORTAL_IDS = ['eduso'] as const;

export const PORTAL_IDS = [...SEARCH_PORTAL_IDS, ...DIRECT_PORTAL_IDS] as const;
export type PortalId = (typeof PORTAL_IDS)[number];

/**
 * Listados que se leen directamente, sin Google ni créditos. Cada uno pertenece a un portal: el de Hacesfalta (solo
 * Madrid) da las mismas ofertas, con el mismo ID, que su búsqueda por Google, pero todas y con la ficha completa
 */
export const LISTING_IDS = ['eduso', 'hacesfalta_madrid'] as const;
export type ListingId = (typeof LISTING_IDS)[number];

export interface ParsedJob {
  readonly id: string;
  readonly titulo: string;
  readonly empresa: string;
  readonly ubicacion: string;
  readonly enlace: string;
  readonly portal: PortalId;
  /** Día (ISO, "2026-09-21") en que Google vio publicada la oferta; no siempre se conoce */
  readonly fechaPublicacion?: string;
  /**
   * Texto que describe esta oferta y solo esta (requisitos, funciones). Solo lo traen las webs que se leen
   * directamente: el snippet de Google mezcla otras ofertas y no sirve
   */
  readonly descripcion?: string;
  /** Último día (ISO) para inscribirse, si la web lo publica */
  readonly fechaLimite?: string;
}

export interface JobSource {
  readonly id: SearchPortalId;
  readonly nombre: string;
  /** Operador site: que limita la búsqueda a las fichas de oferta del portal */
  readonly site: string;
  /**
   * Si las fichas suelen decir "junior"/"mid" en el texto. En InfoJobs, Indeed y Tecnoempleo casi nunca,
   * y exigirlo en la consulta deja la búsqueda vacía.
   */
  readonly supportsLevelTerms: boolean;
  /** Si admite la lista de ubicaciones en OR; si no, se usa solo la primera (la principal) */
  readonly supportsLocationGroup: boolean;
  /** Devuelve null si el resultado no es una oferta (páginas de categoría, perfiles, empresas...) */
  readonly parse: (item: SearchResultItem) => ParsedJob | null;
}

export function isPortalId(value: unknown): value is PortalId {
  return typeof value === 'string' && (PORTAL_IDS as readonly string[]).includes(value);
}
