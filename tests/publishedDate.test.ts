import { describe, expect, it } from 'vitest';
import { parsePublishedDate } from '../src/publishedDate';

const NOW = new Date('2026-09-25T12:00:00.000Z');

// Formatos reales devueltos por Serper (hl=es)
describe('parsePublishedDate', () => {
  it.each([
    ['hace 21 horas', '2026-09-24'],
    ['hace 5 horas', '2026-09-25'],
    ['hace 1 día', '2026-09-24'],
    ['hace 4 días', '2026-09-21'],
    ['hace 1 semana', '2026-09-18'],
    ['hace 2 semanas', '2026-09-11'],
    ['hace un mes', '2026-08-26'],
    ['hace 30 minutos', '2026-09-25'],
    ['ayer', '2026-09-24'],
    ['16 sept 2026', '2026-09-16'],
    ['9 sept. 2026', '2026-09-09'],
    ['27 ago 2026', '2026-08-27'],
    ['7 de sept de 2026', '2026-09-07'],
    ['  Hace   3   DÍAS ', '2026-09-22'],
  ])('%s → %s', (raw, expected) => expect(parsePublishedDate(raw, NOW)).toBe(expected));

  it.each([undefined, '', 'recientemente', 'hace 3 lustros', '31 foo 2026', '40 sept 2026'])('no reconoce "%s"', (raw) => {
    expect(parsePublishedDate(raw, NOW)).toBeNull();
  });

  it('descarta fechas futuras (error de lectura)', () => {
    expect(parsePublishedDate('3 oct 2026', NOW)).toBeNull();
  });
});
