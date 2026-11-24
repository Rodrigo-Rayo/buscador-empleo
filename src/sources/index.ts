import { HACESFALTA } from './hacesfalta';
import { INDEED } from './indeed';
import { INFOJOBS } from './infojobs';
import { LINKEDIN, LINKEDIN_INTL } from './linkedin';
import { TECNOEMPLEO } from './tecnoempleo';
import type { JobSource, PortalId, SearchPortalId } from './types';

export const SOURCES: Readonly<Record<SearchPortalId, JobSource>> = {
  linkedin: LINKEDIN,
  linkedin_intl: LINKEDIN_INTL,
  infojobs: INFOJOBS,
  indeed: INDEED,
  tecnoempleo: TECNOEMPLEO,
  hacesfalta: HACESFALTA,
};

/** Nombre visible de cada portal, tanto los que se buscan por Google como los listados que se leen directamente */
export const PORTAL_NAMES: Readonly<Record<PortalId, string>> = {
  ...(Object.fromEntries(Object.values(SOURCES).map((source) => [source.id, source.nombre])) as Record<SearchPortalId, string>),
  eduso: 'Eduso (empleo social)',
};

export type { JobSource, ListingId, ParsedJob, PortalId, SearchPortalId } from './types';
export { LISTING_IDS, PORTAL_IDS, SEARCH_PORTAL_IDS, isPortalId } from './types';
