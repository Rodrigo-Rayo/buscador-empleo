import type { SearchProfile } from './profiles';
import type { JobSource } from './sources';

function orGroup(terms: readonly string[]): string | null {
  return terms.length > 0 ? `(${terms.map((term) => `"${term}"`).join(' OR ')})` : null;
}

/**
 * Construye una consulta "dork" para Google, p. ej.:
 * site:es.linkedin.com/jobs/view "Frontend" ("junior" OR "jr" ...) ("Madrid" OR "remoto" ...) -intitle:senior ...
 */
export function buildQuery(profile: SearchProfile, source: JobSource, keyword: string): string {
  // -intitle: y no -término: todas las fichas de LinkedIn tienen "empleos similares" con "Senior", "Lead"... en el cuerpo
  const exclusions = profile.excludedTitleTerms.map((term) => `-intitle:${term}`).join(' ');
  const level = source.supportsLevelTerms ? orGroup(profile.requiredTerms) : null;
  const locations = source.supportsLocationGroup ? profile.locationTerms : profile.locationTerms.slice(0, 1);
  return [source.site, `"${keyword}"`, level, orGroup(locations), exclusions]
    .filter((part): part is string => Boolean(part))
    .join(' ');
}
