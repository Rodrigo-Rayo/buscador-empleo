import { JSDOM } from 'jsdom';
import { describe, expect, it } from 'vitest';
import { renderReport } from '../src/htmlReport';
import { PROFILES } from '../src/profiles';
import type { JobOffer } from '../src/storage';

// Ejecuta la página generada en un navegador simulado para probar la interacción real.
const LEGACY_KEY = 'buscador-empleo:estados:v1';
const keyFor = (profileId: string) => `${LEGACY_KEY}:${profileId}`;

const offer = (id: string, titulo: string, ubicacion: string, fechaGuardado = '2026-09-24T10:00:00.000Z'): JobOffer => ({
  id,
  titulo,
  empresa: 'Acme',
  ubicacion,
  enlace: `https://www.linkedin.com/jobs/view/${id}/`,
  portal: 'linkedin',
  fechaGuardado,
});

const OFFERS = [
  offer('1', 'Frontend Junior', 'Madrid'),
  offer('2', 'Backend Node', 'Remoto'),
  offer('3', 'Fullstack Mid', 'Remoto', '2026-09-20T10:00:00.000Z'),
];

type PageOptions = {
  storage?: Record<string, unknown>;
  legacyStorage?: Record<string, unknown>;
  brokenStorage?: boolean;
  offers?: JobOffer[];
  profile?: string;
};

function openPage(options: PageOptions = {}) {
  const profile = PROFILES.find((p) => p.id === (options.profile ?? 'desarrollo'))!;
  const dom = new JSDOM(renderReport(options.offers ?? OFFERS, new Date(), profile), {
    runScripts: 'dangerously',
    url: 'http://localhost/ofertas.html',
    beforeParse(window) {
      if (options.storage) window.localStorage.setItem(keyFor(profile.id), JSON.stringify(options.storage));
      if (options.legacyStorage) window.localStorage.setItem(LEGACY_KEY, JSON.stringify(options.legacyStorage));
      if (options.brokenStorage) {
        Object.defineProperty(window, 'localStorage', {
          get() {
            throw new Error('SecurityError');
          },
        });
      }
    },
  });
  const doc = dom.window.document;
  const titles = () => [...doc.querySelectorAll('.job .title')].map((t) => t.firstChild?.textContent);
  const button = (selector: string, text: string) =>
    [...doc.querySelectorAll<HTMLButtonElement>(selector)].find((b) => b.textContent?.includes(text))!;
  const row = (titulo: string) => [...doc.querySelectorAll('.job')].find((li) => li.querySelector('.title')?.firstChild?.textContent === titulo)!;
  const clickAction = (titulo: string, action: 'apply' | 'discard') =>
    row(titulo).querySelector<HTMLButtonElement>(`.act.${action}`)!.click();
  const stored = () => JSON.parse(dom.window.localStorage.getItem(keyFor(profile.id)) ?? '{}') as Record<string, { estado: string }>;
  return { dom, doc, titles, button, row, clickAction, stored };
}

describe('página de ofertas', () => {
  it('muestra las pendientes, más recientes primero, con las nuevas marcadas', () => {
    const { doc, titles } = openPage();
    // Mismo día: "Backend Node" encaja (+1) y "Frontend Junior" no (−2)
    expect(titles()).toEqual(['Backend Node', 'Frontend Junior', 'Fullstack Mid']);
    expect(doc.querySelectorAll('.tag.new')).toHaveLength(2);
    expect(doc.getElementById('count')!.textContent).toBe('Mostrando 3 de 3');
  });

  it('al aplicar, la oferta sale de pendientes, se guarda y aparece en Aplicadas', () => {
    const { titles, clickAction, button, stored, doc } = openPage();
    clickAction('Backend Node', 'apply');

    expect(titles()).toEqual(['Frontend Junior', 'Fullstack Mid']);
    expect(stored()['2']!.estado).toBe('aplicada');
    expect(button('.view', 'Aplicadas').textContent).toBe('Aplicadas1');

    button('.view', 'Aplicadas').click();
    expect(titles()).toEqual(['Backend Node']);
    expect(doc.querySelector('.tag.applied')!.textContent).toMatch(/^Aplicada · /);
  });

  it('descartar y deshacer devuelve la oferta a pendientes', () => {
    const { titles, clickAction, doc, stored } = openPage();
    clickAction('Frontend Junior', 'discard');
    expect(titles()).not.toContain('Frontend Junior');
    expect(doc.getElementById('toast')!.classList.contains('show')).toBe(true);

    doc.querySelector<HTMLButtonElement>('#toast button')!.click();
    expect(titles()).toContain('Frontend Junior');
    expect(stored()['1']).toBeUndefined();
  });

  it('volver a pulsar un estado activo lo quita', () => {
    const { clickAction, button, titles, stored } = openPage({ storage: { '3': { estado: 'descartada', fecha: '2026-09-24T10:00:00.000Z' } } });
    button('.view', 'Descartadas').click();
    expect(titles()).toEqual(['Fullstack Mid']);

    clickAction('Fullstack Mid', 'discard');
    expect(titles()).toEqual([]);
    expect(stored()['3']).toBeUndefined();
  });

  it('recuerda los estados guardados al recargar e ignora datos corruptos', () => {
    const { titles, doc } = openPage({
      storage: { '1': { estado: 'aplicada', fecha: '2026-09-24T10:00:00.000Z' }, '2': { estado: 'hackeada' } },
    });
    expect(titles()).toEqual(['Backend Node', 'Fullstack Mid']);
    const stats = [...doc.querySelectorAll('.stat')].map((s) => [s.querySelector('span')!.textContent, s.querySelector('b')!.textContent]);
    expect(stats).toContainEqual(['aplicadas', '1']);
  });

  it('filtra por ubicación y por texto sin distinguir tildes', () => {
    const { titles, button, doc, dom } = openPage({ offers: [...OFFERS, offer('4', 'Diseñador Web', 'España')] });
    button('.chip', 'Remoto').click();
    expect(titles()).toEqual(['Backend Node', 'Fullstack Mid']);

    button('.chip', 'Todas').click();
    const input = doc.getElementById('q') as HTMLInputElement;
    input.value = 'disenador';
    input.dispatchEvent(new dom.window.Event('input'));
    expect(titles()).toEqual(['Diseñador Web']);
  });

  it('funciona sin localStorage y avisa de que no se guardará', () => {
    const { titles, clickAction, doc } = openPage({ brokenStorage: true });
    expect((doc.getElementById('storage-warning') as HTMLElement).hidden).toBe(false);
    clickAction('Frontend Junior', 'apply');
    expect(titles()).toEqual(['Backend Node', 'Fullstack Mid']);
  });

  it('dentro de cada día ordena por encaje con el stack; los días más recientes van antes', () => {
    const { titles } = openPage({
      offers: [
        offer('10', 'Fullstack Developer', 'Madrid'),
        offer('11', 'Desarrollador Laravel', 'Madrid'),
        offer('12', 'Junior Developer (Angular & .NET)', 'Madrid'),
        offer('13', 'Desarrollador .NET', 'Madrid'),
        offer('14', 'Angular Developer (ayer)', 'Madrid', '2026-09-20T10:00:00.000Z'),
      ],
    });
    // Encaje: 4 (Angular + .NET − Junior), 3 (.NET), 2 (Full Stack), 0 (Laravel); el día anterior va después
    expect(titles()).toEqual([
      'Junior Developer (Angular & .NET)',
      'Desarrollador .NET',
      'Fullstack Developer',
      'Desarrollador Laravel',
      'Angular Developer (ayer)',
    ]);
  });

  it('el filtro "solo con tu stack" oculta las que no encajan y cuenta las que sí', () => {
    const { titles, doc, dom } = openPage({
      offers: [offer('20', 'Desarrollador .NET', 'Madrid'), offer('21', 'Desarrollador Laravel', 'Madrid')],
    });
    expect(doc.getElementById('only-match-label')!.textContent).toBe('Solo con tu stack (1)');
    expect(doc.querySelector('.stat.ok b')!.textContent).toBe('1');

    const checkbox = doc.getElementById('only-match') as HTMLInputElement;
    checkbox.checked = true;
    checkbox.dispatchEvent(new dom.window.Event('change'));
    expect(titles()).toEqual(['Desarrollador .NET']);
  });

  it('perfil de psicología: etiqueta las ofertas según el título', () => {
    const { row } = openPage({
      profile: 'psicologia',
      offers: [offer('6', 'Psicóloga sanitaria terapia de pareja', 'Madrid'), offer('7', 'Psicólogo/a en Neural KIDS', 'Madrid')],
    });
    const tagsOf = (titulo: string) => [...row(titulo).querySelectorAll('.tag:not(.new)')].map((t) => [t.className, t.textContent]);
    expect(tagsOf('Psicóloga sanitaria terapia de pareja')).toEqual([
      ['tag good', 'Sexología / pareja'],
      ['tag warn', 'Pide sanitaria'],
    ]);
    expect(tagsOf('Psicólogo/a en Neural KIDS')).toEqual([]);
  });

  it('recupera las marcas de la clave común antigua y a partir de ahí guarda en la de la persona', () => {
    const { titles, clickAction, stored, dom } = openPage({
      legacyStorage: { '1': { estado: 'aplicada', fecha: '2026-09-24T10:00:00.000Z' } },
    });
    expect(titles()).toEqual(['Backend Node', 'Fullstack Mid']);
    clickAction('Backend Node', 'discard');
    expect(Object.keys(stored()).sort()).toEqual(['1', '2']);
    expect(JSON.parse(dom.window.localStorage.getItem(LEGACY_KEY)!)).toEqual({ '1': { estado: 'aplicada', fecha: '2026-09-24T10:00:00.000Z' } });
  });

  it('las marcas de una persona no afectan a otra', () => {
    const { titles } = openPage({ profile: 'gabi', offers: OFFERS });
    expect(titles()).toHaveLength(3);
  });

  it('barra de navegación: solo los perfiles activos más el actual, que se marca', () => {
    const { doc } = openPage({ profile: 'amy' });
    const links = [...doc.querySelectorAll('nav.people a')].map((a) => [a.getAttribute('href'), a.getAttribute('aria-current')]);
    expect(links).toEqual([
      ['ofertas-gabi.html', null],
      ['ofertas-amy.html', 'page'],
    ]);
    expect(doc.querySelector('nav.people a small')!.textContent).toBe('(pausada)');
  });

  it('sin barra de navegación si su perfil es el único activo (no enlaza búsquedas de otras personas)', () => {
    const { doc } = openPage({ profile: 'gabi' });
    expect(doc.querySelector('nav.people')).toBeNull();
  });

  it('filtro por portal: aparece con varios portales y enlaza con el nombre del portal', () => {
    const infojobs: JobOffer = {
      ...offer('infojobs:abc', 'Trabajador/a social', 'Madrid'),
      portal: 'infojobs',
      enlace: 'https://www.infojobs.net/madrid/trabajador-social/of-iabc',
    };
    const { doc, titles, button, row } = openPage({ profile: 'gabi', offers: [OFFERS[0]!, infojobs] });
    expect((doc.getElementById('portals') as HTMLElement).hidden).toBe(false);
    expect(row('Trabajador/a social').querySelector('.ext')!.textContent).toBe('InfoJobs ↗');
    expect(row('Trabajador/a social').querySelector('a')!.getAttribute('href')).toBe(infojobs.enlace);

    button('#portals .chip', 'InfoJobs').click();
    expect(titles()).toEqual(['Trabajador/a social']);
  });

  it('muestra la fecha de publicación y avisa si tiene más de un mes', () => {
    const isoDaysAgo = (days: number) => {
      const d = new Date();
      d.setDate(d.getDate() - days);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    };
    const { row } = openPage({
      offers: [
        { ...offer('30', 'Hoy mismo', 'Madrid'), fechaPublicacion: isoDaysAgo(0) },
        { ...offer('31', 'Hace unos días', 'Madrid'), fechaPublicacion: isoDaysAgo(4) },
        { ...offer('32', 'Muy antigua', 'Madrid'), fechaPublicacion: isoDaysAgo(45) },
        offer('33', 'Sin fecha', 'Madrid'),
      ],
    });
    const published = (titulo: string) => row(titulo).querySelector('.published');
    expect(published('Hoy mismo')!.textContent).toBe('Publicada hoy');
    expect(published('Hace unos días')!.textContent).toBe('Publicada hace 4 días');
    expect(published('Muy antigua')!.textContent).toMatch(/^Publicada el .+ · puede estar cerrada$/);
    expect(published('Muy antigua')!.classList.contains('old')).toBe(true);
    expect(published('Sin fecha')).toBeNull();
  });

  it('con un solo portal no muestra el filtro por portal', () => {
    const { doc } = openPage();
    expect((doc.getElementById('portals') as HTMLElement).hidden).toBe(true);
  });

  it('muestra títulos maliciosos como texto y no enlaza URLs que no sean de LinkedIn', () => {
    const evil = { ...offer('5', '<img src=x onerror="window.hacked=1">', 'Madrid'), enlace: 'javascript:alert(1)' };
    const { doc, dom } = openPage({ offers: [evil] });
    expect(doc.querySelector('.job img')).toBeNull();
    expect((dom.window as unknown as { hacked?: number }).hacked).toBeUndefined();
    expect(doc.querySelector('.job-link')!.getAttribute('href')).toBe('#');
  });
});
