import { describe, expect, it } from 'vitest';
import { effectiveDateRestrict, windowInDays } from '../src/dateWindow';

const NOW = new Date('2026-09-24T10:00:00.000Z');
const daysAgo = (days: number) => new Date(NOW.getTime() - days * 86_400_000);

describe('windowInDays', () => {
  it.each([
    ['d3', 3],
    ['w2', 14],
    ['m1', 30],
    ['y1', 365],
  ])('%s → %i días', (value, days) => expect(windowInDays(value)).toBe(days));

  it('sin ventana o con formato desconocido es infinita', () => {
    expect(windowInDays(undefined)).toBe(Number.POSITIVE_INFINITY);
    expect(windowInDays('h3')).toBe(Number.POSITIVE_INFINITY);
  });
});

describe('effectiveDateRestrict', () => {
  it('primera búsqueda (sin ofertas guardadas): usa la ventana máxima', () => {
    expect(effectiveDateRestrict('w2', null, NOW)).toBe('w2');
  });

  it('búsqueda diaria: solo los últimos días más el margen', () => {
    expect(effectiveDateRestrict('w2', daysAgo(1), NOW)).toBe('d3');
    expect(effectiveDateRestrict('w2', daysAgo(0.2), NOW)).toBe('d3');
    expect(effectiveDateRestrict('w2', NOW, NOW)).toBe('d2');
  });

  it('tras mucho tiempo sin buscar: vuelve a la ventana máxima', () => {
    expect(effectiveDateRestrict('w2', daysAgo(12), NOW)).toBe('w2');
    expect(effectiveDateRestrict('m1', daysAgo(40), NOW)).toBe('m1');
  });

  it('sin ventana máxima siempre es incremental', () => {
    expect(effectiveDateRestrict(undefined, daysAgo(100), NOW)).toBe('d102');
  });

  it('un reloj desajustado (oferta "del futuro") no produce ventanas negativas', () => {
    expect(effectiveDateRestrict('w2', daysAgo(-3), NOW)).toBe('d2');
  });
});
