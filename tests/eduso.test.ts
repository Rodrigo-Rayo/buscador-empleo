import { describe, expect, it, vi } from 'vitest';
import { EDUSO, parseEdusoPage } from '../src/listings/eduso';

// Misma estructura que el listado real de eduso.net/empleo/ (noviembre de 2026), con ofertas inventadas
function offerBlock(id: string, fields: { titulo: string; filas: [string, string][]; plazoSinCierre?: string }): string {
  const rows = fields.filas
    .map(
      ([label, value]) => `
      <tr class="py-1">
        <td class="p-0 pr-2 naranja t14"><strong>${label}</strong></td>
        <td class=" p-0">${value}</td>
      </tr>`,
    )
    .join('');
  const plazo = fields.plazoSinCierre
    ? `<tr class="py-1"><td class="p-0 pr-2 naranja t14"><strong>Plazo final: </strong></td>
       <td class=" p-0">
       ${fields.plazoSinCierre} </tr>`
    : '';
  return `
  <a id="${id}"></a>
  <div class="bg-blanco mb-1 shadow-sm"><div class="d-flex">
    <div class=""><h4 class="t20 bold mb-2 pt-2">${fields.titulo}</h4></div>
  </div></div>
  <div class="bg-blanco w-100 p-3 mb-3 "><table class="table convocatoria">
    ${rows}${plazo}
  </table></div>`;
}

const PAGE = `<html><body><form>...</form>
${offerBlock('70001', {
  titulo: 'T&eacute;cnico/a de proyecto de educaci&oacute;n afectivo-sexual',
  filas: [
    ['Descripción:', '<p><span>Talleres de educaci&oacute;n afectivo-sexual en institutos.</span></p>'],
    ['Tipo: ', 'Oferta entidad privada'],
    ['Convoca:', '<a href=" https://example.org/" target="_blank"> Asociaci&oacute;n Ejemplo </a>'],
    ['Territorio: ', 'Comunidad de Madrid'],
    ['Lugar:', 'Madrid.'],
    ['Estudios mínimos:', 'Grado en Psicología, Pedagogía o similar'],
    ['Experiencia:', 'Un año en talleres con jóvenes'],
  ],
  plazoSinCierre: '5/12/2026',
})}
${offerBlock('70002', {
  titulo: 'Educador/a Social',
  filas: [
    ['Descripción:', 'Centro de menores.'],
    ['Territorio: ', 'Comunidad de Madrid'],
    ['Lugar:', 'Comunidad de Madrid'],
  ],
})}
${offerBlock('70003', { titulo: '   ', filas: [] })}
</body></html>`;

describe('parseEdusoPage', () => {
  const [tecnico, educador] = parseEdusoPage(PAGE);

  it('lee cada oferta con su ID, enlace propio y campos de la ficha', () => {
    expect(tecnico).toEqual({
      id: 'eduso:70001',
      titulo: 'Técnico/a de proyecto de educación afectivo-sexual',
      empresa: 'Asociación Ejemplo',
      ubicacion: 'Madrid · Comunidad de Madrid',
      enlace: 'https://www.eduso.net/?p=70001',
      portal: 'eduso',
      descripcion:
        'Talleres de educación afectivo-sexual en institutos. Estudios mínimos: Grado en Psicología, Pedagogía o similar. ' +
        'Experiencia: Un año en talleres con jóvenes',
      fechaLimite: '2026-12-05',
    });
  });

  it('sin convocante ni plazo: empresa desconocida, sin fecha límite y sin repetir lugar y territorio', () => {
    expect(educador).toMatchObject({ empresa: 'Desconocida', ubicacion: 'Comunidad de Madrid', descripcion: 'Centro de menores' });
    expect(educador).not.toHaveProperty('fechaLimite');
  });

  it('ignora bloques sin título y páginas sin ofertas', () => {
    expect(parseEdusoPage(PAGE)).toHaveLength(2);
    expect(parseEdusoPage('<html>Nada</html>')).toEqual([]);
  });
});

describe('EDUSO.fetchJobs', () => {
  it('recorre las páginas hasta una sin ofertas o que no existe', async () => {
    const get = vi.fn(async (url: string) => {
      if (url.endsWith('/empleo/')) return PAGE;
      if (url.endsWith('/page/2/')) return offerBlock('70010', { titulo: 'Coordinador/a', filas: [] });
      return null;
    });
    const { jobs, seenIds } = await EDUSO.fetchJobs(get, { delayMs: 0 });
    expect(seenIds).toEqual(jobs.map((job) => job.id));
    expect(jobs.map((job) => job.id)).toEqual(['eduso:70001', 'eduso:70002', 'eduso:70010']);
    expect(get.mock.calls.map(([url]) => url)).toEqual([
      'https://www.eduso.net/empleo/',
      'https://www.eduso.net/empleo/page/2/',
      'https://www.eduso.net/empleo/page/3/',
    ]);
  });

  it('avisa si la primera página no tiene ofertas (la web ha cambiado)', async () => {
    await expect(EDUSO.fetchJobs(async () => '<html></html>', { delayMs: 0 })).rejects.toThrow(/ha cambiado la web/);
  });
});
