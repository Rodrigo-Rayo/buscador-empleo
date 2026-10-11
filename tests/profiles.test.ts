import { describe, expect, it } from 'vitest';
import { isValidDateRestrict } from '../src/config';
import { PROFILES, searchesFor, selectProfiles } from '../src/profiles';
import { SOURCES } from '../src/sources';

describe('PROFILES', () => {
  it('tienen IDs y archivos únicos (un perfil no pisa los datos de otro)', () => {
    const unique = (values: string[]) => new Set(values).size === values.length;
    expect(unique(PROFILES.map((p) => p.id))).toBe(true);
    expect(unique(PROFILES.flatMap((p) => [p.outputFile, p.reportFile]))).toBe(true);
  });

  it('tienen palabras clave, ventana de fecha válida y reglas de encaje compilables', () => {
    for (const profile of PROFILES) {
      expect(profile.keywords.length).toBeGreaterThan(0);
      if (profile.dateRestrict) expect(isValidDateRestrict(profile.dateRestrict)).toBe(true);
      for (const rule of profile.page.scoring) expect(() => new RegExp(rule.pattern, 'i')).not.toThrow();
    }
  });

  it('cada perfil busca en portales registrados y sin repetir', () => {
    for (const profile of PROFILES) {
      expect(profile.portals.length).toBeGreaterThan(0);
      expect(new Set(profile.portals).size).toBe(profile.portals.length);
      for (const portal of profile.portals) expect(SOURCES[portal]).toBeDefined();
    }
  });

  it('keywordPortals solo restringe palabras clave del perfil a portales del perfil', () => {
    for (const profile of PROFILES) {
      for (const [keyword, portals] of Object.entries(profile.keywordPortals ?? {})) {
        expect(profile.keywords).toContain(keyword);
        expect(portals.length).toBeGreaterThan(0);
        for (const portal of portals) expect(profile.portals).toContain(portal);
      }
    }
  });

  it('Tecnoempleo solo en desarrollo (es un portal exclusivamente de informática)', () => {
    expect(PROFILES.filter((p) => p.portals.includes('tecnoempleo')).map((p) => p.id)).toEqual(['desarrollo']);
  });

  it('internacional: solo LinkedIn fuera de España (lo español ya lo cubre desarrollo)', () => {
    expect(PROFILES.find((p) => p.id === 'internacional')!.portals).toEqual(['linkedin_intl']);
  });

  it('el perfil de desarrollo conserva los archivos originales', () => {
    const desarrollo = PROFILES.find((p) => p.id === 'desarrollo')!;
    expect([desarrollo.outputFile, desarrollo.reportFile]).toEqual(['ofertas.json', 'ofertas.html']);
  });
});

describe('searchesFor', () => {
  const base = PROFILES.find((p) => p.id === 'amy')!;

  it('sin restricciones: cada palabra clave en todos los portales', () => {
    const profile = { ...base, keywords: ['a', 'b'], portals: ['linkedin', 'indeed'] as const, keywordPortals: undefined };
    expect(searchesFor(profile)).toEqual([
      { portal: 'linkedin', keyword: 'a' },
      { portal: 'indeed', keyword: 'a' },
      { portal: 'linkedin', keyword: 'b' },
      { portal: 'indeed', keyword: 'b' },
    ]);
  });

  it('una palabra clave restringida solo se busca en sus portales', () => {
    const profile = { ...base, keywords: ['a', 'b'], portals: ['linkedin', 'indeed'] as const, keywordPortals: { b: ['indeed'] as const } };
    expect(searchesFor(profile).map((s) => `${s.portal}:${s.keyword}`)).toEqual(['linkedin:a', 'indeed:a', 'indeed:b']);
  });
});

describe('selectProfiles', () => {
  it('sin argumentos devuelve todos', () => {
    expect(selectProfiles([])).toBe(PROFILES);
  });

  it('activeOnly: sin argumentos salta los pausados (solo queda gabi)', () => {
    expect(selectProfiles([], { activeOnly: true }).map((p) => p.id)).toEqual(['gabi']);
  });

  it('un perfil pausado se puede lanzar pidiéndolo explícitamente', () => {
    expect(selectProfiles(['psicologia'], { activeOnly: true }).map((p) => p.id)).toEqual(['psicologia']);
  });

  it('filtra por ID', () => {
    expect(selectProfiles(['psicologia']).map((p) => p.id)).toEqual(['psicologia']);
  });

  it('falla con un perfil desconocido y lista los válidos', () => {
    expect(() => selectProfiles(['cocina'])).toThrow(
      'Perfil desconocido: cocina. Perfiles disponibles: desarrollo, internacional, psicologia, gabi, amy.',
    );
  });
});
