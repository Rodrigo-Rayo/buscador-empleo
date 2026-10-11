import { describe, expect, it } from 'vitest';
import { PROFILES } from '../src/profiles';
import { buildQuery } from '../src/queryBuilder';
import { SOURCES } from '../src/sources';

const profile = (id: string) => PROFILES.find((p) => p.id === id)!;

describe('buildQuery', () => {
  const DEV_EXCLUSIONS =
    '-intitle:lead -intitle:principal -intitle:staff -intitle:manager -intitle:head -intitle:director ' +
    '-intitle:becario -intitle:prácticas -intitle:internship -intitle:trainee';

  it('LinkedIn + desarrollo: sin filtro de nivel (senior también), ubicación y exclusiones por título', () => {
    expect(buildQuery(profile('desarrollo'), SOURCES.linkedin, 'Node.js')).toBe(
      'site:es.linkedin.com/jobs/view "Node.js" ' +
        '("Madrid" OR "remoto" OR "remote" OR "teletrabajo" OR "híbrido" OR "hybrid") ' +
        DEV_EXCLUSIONS,
    );
  });

  it('InfoJobs + desarrollo: misma ubicación y exclusiones', () => {
    expect(buildQuery(profile('desarrollo'), SOURCES.infojobs, '.NET')).toBe(
      'site:infojobs.net ".NET" ("Madrid" OR "remoto" OR "remote" OR "teletrabajo" OR "híbrido" OR "hybrid") ' + DEV_EXCLUSIONS,
    );
  });

  it('internacional: LinkedIn fuera de España, exige "remote" y zona europea', () => {
    expect(buildQuery(profile('internacional'), SOURCES.linkedin_intl, 'Angular')).toBe(
      'site:linkedin.com/jobs/view -site:es.linkedin.com "Angular" ("remote") ' +
        '("Europe" OR "EMEA" OR "European Union" OR "Spain") ' +
        '-intitle:lead -intitle:principal -intitle:staff -intitle:manager -intitle:head -intitle:director -intitle:intern -intitle:trainee',
    );
  });

  it('Hacesfalta: solo la ubicación principal (con varias en OR no devuelve nada)', () => {
    expect(buildQuery(profile('gabi'), SOURCES.hacesfalta, 'trabajo social')).toBe(
      'site:hacesfalta.org/oportunidades/remuneradas/detalle "trabajo social" ("Madrid") ' +
        '-intitle:becario -intitle:becaria -intitle:prácticas',
    );
  });

  it('perfil sin exclusiones ni nivel: sin espacios de sobra', () => {
    expect(buildQuery({ ...profile('gabi'), excludedTitleTerms: [] }, SOURCES.indeed, 'trabajador social')).toBe(
      'site:es.indeed.com/viewjob "trabajador social" ' +
        '("Madrid" OR "Guadalajara" OR "Alcalá de Henares" OR "Azuqueca" OR "Torrejón" OR "remoto" OR "teletrabajo")',
    );
  });
});
