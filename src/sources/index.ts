import { HACESFALTA } from './hacesfalta';
import { INDEED } from './indeed';
import { INFOJOBS } from './infojobs';
import { LINKEDIN, LINKEDIN_INTL } from './linkedin';
import { TECNOEMPLEO } from './tecnoempleo';
import type { JobSource, PortalId } from './types';

export const SOURCES: Readonly<Record<PortalId, JobSource>> = {
  linkedin: LINKEDIN,
  linkedin_intl: LINKEDIN_INTL,
  infojobs: INFOJOBS,
  indeed: INDEED,
  tecnoempleo: TECNOEMPLEO,
  hacesfalta: HACESFALTA,
};

export type { JobSource, ParsedJob, PortalId } from './types';
export { PORTAL_IDS, isPortalId } from './types';
