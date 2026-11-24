import type { SearchProfile } from './profiles';
import { scoreOffer } from './relevance';
import type { ParsedJob } from './sources';
import { normalizeText } from './text';

/** "2026-11-24" del día local (las fechas límite son días, sin hora). */
function localIsoDay(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function isOpen(job: ParsedJob, today: string): boolean {
  return !job.fechaLimite || job.fechaLimite >= today;
}

/** Su ubicación, título o descripción nombra alguno de los sitios del perfil (Madrid, online, remoto...). */
function isInProfileArea(job: ParsedJob, profile: SearchProfile): boolean {
  const text = normalizeText(`${job.ubicacion} ${job.titulo} ${job.descripcion ?? ''}`);
  return profile.locationTerms.some((term) => text.includes(normalizeText(term)));
}

/**
 * Un listado trae todas las ofertas de la web (cientos, de toda España y de cualquier puesto). Se quedan las vigentes,
 * de la zona del perfil y que encajan con él (con la descripción incluida); el resto no se guarda.
 */
export function selectListingJobs(jobs: readonly ParsedJob[], profile: SearchProfile, now: Date): readonly ParsedJob[] {
  const today = localIsoDay(now);
  return jobs.filter(
    (job) => isOpen(job, today) && isInProfileArea(job, profile) && scoreOffer(job, profile.page.scoring).encaje > 0,
  );
}
