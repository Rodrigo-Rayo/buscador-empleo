import { describe, expect, it, vi } from 'vitest';
import { HACESFALTA_MADRID, parseHacesfaltaList, withHacesfaltaDetail } from '../src/listings/hacesfalta';

// Misma estructura que hacesfalta.org (noviembre de 2026), con ofertas inventadas
function card(index: number, id: number, slug: string, titulo: string, ong: string | null, place = 'España(Madrid)'): string {
  const ongLink = ong ? `<a href="/transparencia-ong/x/detalle/1" id="cphContenido_ListaOportunidades_rptOportunidades_aOng_${index}">${ong}</a>` : '';
  return `
  <div id="cphContenido_ListaOportunidades_rptOportunidades_marcoItem_${index}" class="card mb-4 card-oportunidad card-empleo">
    <a href="/oportunidades/remuneradas/detalle/${slug}/${id}" class="cover-link"></a>
    <h2 class="fs-5 fw-semibold card-title">
      <a href="/oportunidades/remuneradas/detalle/${slug}/${id}" id="cphContenido_ListaOportunidades_rptOportunidades_lkTitulo_${index}">${titulo}</a></h2>
    <p class="color-gray-400 pb-0 mb-2 mb-lg-4">
      ${ongLink}
      |
      ${place}
    </p>
    <p class="d-none d-lg-block card-text small descripcion mb-2">Presentaci&oacute;n de la ONG...</p>
  </div>`;
}

const LIST = `<html><body>
${card(0, 300001, 'mediadora-afectivo-sexual', 'Mediador/a afectivo sexual.', 'Asociaci&oacute;n Ejemplo')}
${card(1, 300002, 'psicologa-menores', 'Psic&oacute;loga menores', null)}
</body></html>`;

const DETAIL = `<html><body>
<div class="row fila-resumen mb-2 mb-md-3"><div class="col-6 col-md-auto fila-resumen-nombre fw-500"><span>Fecha límite Inscripción</span></div>
<div class="col fila-resumen-detalle color-gray-400 ps-0"> <span> 11/12/2026</span> </div> </div>
<div class="detalle-oportunidad mt-4"> <h2 class="fs-6 mb-3">Objetivo</h2>
<p>Talleres de educaci&oacute;n afectivo-sexual &bull; prevenci&oacute;n de ITS.</p>
<p class="fs-6 fw-bold mt-4 mb-1">Estudios mínimos:</p> Licenciado
<div class="alert alert-warning mt-4"> Al pulsar en "Enviar interés"... </div>
</body></html>`;

describe('parseHacesfaltaList', () => {
  it('lee título, ONG, provincia y enlace de cada tarjeta, con el mismo ID que la búsqueda por Google', () => {
    expect(parseHacesfaltaList(LIST)).toEqual([
      {
        id: 'hacesfalta:300001',
        titulo: 'Mediador/a afectivo sexual',
        empresa: 'Asociación Ejemplo',
        ubicacion: 'Madrid',
        enlace: 'https://www.hacesfalta.org/oportunidades/remuneradas/detalle/mediadora-afectivo-sexual/300001',
        portal: 'hacesfalta',
      },
      expect.objectContaining({ id: 'hacesfalta:300002', titulo: 'Psicóloga menores', empresa: 'Desconocida' }),
    ]);
  });

  it('una página sin tarjetas no da ofertas', () => {
    expect(parseHacesfaltaList('<html></html>')).toEqual([]);
  });
});

describe('withHacesfaltaDetail', () => {
  it('añade la descripción y el plazo de la ficha', () => {
    const [job] = parseHacesfaltaList(LIST);
    expect(withHacesfaltaDetail(job!, DETAIL)).toMatchObject({
      fechaLimite: '2026-12-11',
      descripcion: 'Objetivo Talleres de educación afectivo-sexual • prevención de ITS. Estudios mínimos: Licenciado',
    });
  });

  it('si la ficha no tiene esos datos deja la oferta como estaba', () => {
    const [job] = parseHacesfaltaList(LIST);
    expect(withHacesfaltaDetail(job!, '<html></html>')).toEqual(job);
  });
});

describe('HACESFALTA_MADRID.fetchJobs', () => {
  const page2 = card(0, 300003, 'tecnica-igualdad', 'Técnica de igualdad', 'ONG');
  const page3 = card(0, 300004, 'antigua', 'Antigua', 'ONG');

  function fakeGet(pages: Record<number, string>) {
    return vi.fn(async (url: string) => {
      const page = /pageIndex=(\d+)/.exec(url)?.[1];
      if (page) return pages[Number(page)] ?? '<html></html>';
      return url.includes('/detalle/') ? DETAIL : null;
    });
  }

  it('abre la ficha solo de las nuevas y deja de paginar en una página ya conocida', async () => {
    const get = fakeGet({ 1: LIST, 2: page2, 3: page3 });
    const { jobs, seenIds } = await HACESFALTA_MADRID.fetchJobs(get, {
      delayMs: 0,
      knownIds: new Set(['hacesfalta:300002', 'hacesfalta:300003']),
    });
    expect(jobs.map((job) => job.id)).toEqual(['hacesfalta:300001']);
    expect(jobs[0]).toHaveProperty('fechaLimite', '2026-12-11');
    expect(seenIds).toEqual(['hacesfalta:300001', 'hacesfalta:300002', 'hacesfalta:300003']);
    const urls = get.mock.calls.map(([url]) => url);
    expect(urls.filter((url) => url.includes('/detalle/'))).toHaveLength(1);
    expect(urls.some((url) => url.includes('pageIndex=3'))).toBe(false);
  });

  it('lee hasta la primera página vacía si todo es nuevo', async () => {
    const { jobs } = await HACESFALTA_MADRID.fetchJobs(fakeGet({ 1: LIST, 2: page2 }), { delayMs: 0 });
    expect(jobs).toHaveLength(3);
  });

  it('avisa si la primera página no tiene ofertas (la web ha cambiado)', async () => {
    await expect(HACESFALTA_MADRID.fetchJobs(fakeGet({}), { delayMs: 0 })).rejects.toThrow(/ha cambiado la web/);
  });
});
