import type { SearchResultItem } from '../serperSearch';

export const PORTAL_IDS = ['linkedin', 'linkedin_intl', 'infojobs', 'indeed', 'tecnoempleo', 'hacesfalta'] as const;
export type PortalId = (typeof PORTAL_IDS)[number];

export interface ParsedJob {
  readonly id: string;
  readonly titulo: string;
  readonly empresa: string;
  readonly ubicacion: string;
  readonly enlace: string;
  readonly portal: PortalId;
  /** Día (ISO, "2026-09-21") en que Google vio publicada la oferta; no siempre se conoce */
  readonly fechaPublicacion?: string;
}

export interface JobSource {
  readonly id: PortalId;
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
