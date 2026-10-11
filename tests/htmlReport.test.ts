import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { renderReport, writeReport } from '../src/htmlReport';
import { PROFILES } from '../src/profiles';
import type { JobOffer } from '../src/storage';

const PROFILE = PROFILES[0]!;

const offer = (id: string, fechaGuardado: string, titulo = 'Dev'): JobOffer => ({
  id,
  titulo,
  empresa: 'Acme',
  ubicacion: 'Madrid',
  enlace: `https://www.linkedin.com/jobs/view/${id}/`,
  portal: 'linkedin',
  fechaGuardado,
});
const NOW = new Date('2026-09-24T10:00:00.000Z');

function embeddedOffers(html: string): JobOffer[] {
  const match = /<script type="application\/json" id="offers-data">(.*?)<\/script>/s.exec(html);
  return JSON.parse(match![1]!) as JobOffer[];
}

describe('renderReport', () => {
  it('incrusta las ofertas ordenadas de más reciente a más antigua', () => {
    const html = renderReport([offer('1', '2026-09-20T10:00:00Z'), offer('2', '2026-09-24T10:00:00Z')], NOW, PROFILE);
    expect(embeddedOffers(html).map((o) => o.id)).toEqual(['2', '1']);
    expect(html).toContain('"generatedAt":"2026-09-24T10:00:00.000Z"');
  });

  it('no permite cerrar el <script> con un título malicioso', () => {
    const html = renderReport([offer('1', '2026-09-24T10:00:00Z', '</script><img src=x onerror=alert(1)>')], NOW, PROFILE);
    expect(html).not.toContain('</script><img');
    expect(embeddedOffers(html)[0]!.titulo).toBe('</script><img src=x onerror=alert(1)>');
  });

  it('no muta el array de entrada', () => {
    const offers = [offer('1', '2026-09-20T10:00:00Z'), offer('2', '2026-09-24T10:00:00Z')];
    renderReport(offers, NOW, PROFILE);
    expect(offers.map((o) => o.id)).toEqual(['1', '2']);
  });

  it('usa los textos del perfil escapando el HTML', () => {
    const page = { ...PROFILE.page, documentTitle: 'A & B', heading: '<b>Ofertas</b>', emphasis: 'x & y', kicker: ['Madrid'] };
    const html = renderReport([], NOW, { ...PROFILE, page });
    expect(html).toContain('<title>A &amp; B</title>');
    expect(html).toContain('<h1>&lt;b&gt;Ofertas&lt;/b&gt; <em>x &amp; y</em></h1>');
    expect(html).toContain('<span>Madrid</span>');
  });

  it('genera una página válida aunque no haya ofertas', () => {
    const html = renderReport([], NOW, PROFILE);
    expect(embeddedOffers(html)).toEqual([]);
    expect(html.startsWith('<!doctype html>')).toBe(true);
  });
});

describe('writeReport', () => {
  it('escribe el HTML en disco', async () => {
    const file = join(await mkdtemp(join(tmpdir(), 'informe-')), 'ofertas.html');
    await writeReport(file, [offer('1', '2026-09-24T10:00:00Z')], PROFILE, NOW);
    expect(await readFile(file, 'utf8')).toBe(renderReport([offer('1', '2026-09-24T10:00:00Z')], NOW, PROFILE));
  });
});
