import { describe, expect, it } from 'vitest';
import { selectListingJobs } from '../src/listingFilter';
import { PROFILES } from '../src/profiles';
import type { ParsedJob } from '../src/sources';

const marilyn = PROFILES.find((p) => p.id === 'marilyn')!;
const NOW = new Date(2026, 10, 24, 10, 0);

const job = (id: string, overrides: Partial<ParsedJob>): ParsedJob => ({
  id,
  titulo: 'Técnico/a de proyecto',
  empresa: 'Asociación',
  ubicacion: 'Madrid',
  enlace: `https://www.eduso.net/?p=${id}`,
  portal: 'eduso',
  ...overrides,
});

describe('selectListingJobs (Marilyn)', () => {
  it('se queda con lo que encaja aunque solo lo diga la descripción', () => {
    const talleres = job('1', { descripcion: 'Impartir talleres de educación afectivo-sexual en institutos' });
    expect(selectListingJobs([talleres], marilyn, NOW)).toEqual([talleres]);
  });

  it('descarta lo que no encaja con su perfil', () => {
    expect(selectListingJobs([job('2', { titulo: 'Auxiliar técnico educativo', descripcion: 'Centro escolar' })], marilyn, NOW)).toEqual([]);
  });

  it('descarta lo que está fuera de su zona (Madrid u online)', () => {
    const sevilla = job('3', { titulo: 'Educador/a sexual', ubicacion: 'Sevilla · Andalucía' });
    const online = job('4', { titulo: 'Educador/a sexual', ubicacion: 'Estatal', descripcion: 'Formación online' });
    expect(selectListingJobs([sevilla, online], marilyn, NOW).map((j) => j.id)).toEqual(['4']);
  });

  it('descarta las de plazo vencido y conserva las que cierran hoy o no tienen plazo', () => {
    const vencida = job('5', { titulo: 'Educador/a sexual', fechaLimite: '2026-11-23' });
    const hoy = job('6', { titulo: 'Educador/a sexual', fechaLimite: '2026-11-24' });
    const sinPlazo = job('7', { titulo: 'Educador/a sexual' });
    expect(selectListingJobs([vencida, hoy, sinPlazo], marilyn, NOW).map((j) => j.id)).toEqual(['6', '7']);
  });

  it('descarta las que piden colegiación u otra titulación en la descripción', () => {
    const colegiada = job('8', { titulo: 'Psicóloga violencia de género', descripcion: 'Imprescindible colegiación' });
    const educadorSocial = job('9', {
      titulo: 'Técnico/a de igualdad',
      descripcion: 'Estudios mínimos: Diplomatura o grado de Educador/a Social',
    });
    expect(selectListingJobs([colegiada, educadorSocial], marilyn, NOW)).toEqual([]);
  });
});
