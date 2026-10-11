import { describe, expect, it } from 'vitest';
import { mapWithConcurrency } from '../src/concurrency';

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe('mapWithConcurrency', () => {
  it('devuelve los resultados en el orden de entrada aunque terminen desordenados', async () => {
    const results = await mapWithConcurrency([30, 5, 15], 3, async (ms) => {
      await delay(ms);
      return ms * 2;
    });
    expect(results).toEqual([
      { ok: true, value: 60 },
      { ok: true, value: 10 },
      { ok: true, value: 30 },
    ]);
  });

  it('nunca supera el límite de tareas simultáneas', async () => {
    let running = 0;
    let peak = 0;
    await mapWithConcurrency(Array.from({ length: 10 }, (_, i) => i), 3, async () => {
      running++;
      peak = Math.max(peak, running);
      await delay(5);
      running--;
    });
    expect(peak).toBe(3);
  });

  it('recoge los errores sin abortar el resto', async () => {
    const results = await mapWithConcurrency([1, 2, 3], 2, async (n) => {
      if (n === 2) throw new Error('boom');
      return n;
    });
    expect(results.map((r) => r?.ok)).toEqual([true, false, true]);
  });

  it('deja de lanzar tareas tras un error fatal', async () => {
    const started: number[] = [];
    const results = await mapWithConcurrency(
      [1, 2, 3, 4, 5],
      1,
      async (n) => {
        started.push(n);
        if (n === 2) throw new Error('fatal');
        return n;
      },
      () => true,
    );
    expect(started).toEqual([1, 2]);
    expect(results.slice(2)).toEqual([undefined, undefined, undefined]);
  });

  it('funciona con listas vacías y límites fuera de rango', async () => {
    expect(await mapWithConcurrency([], 4, async (n: number) => n)).toEqual([]);
    expect(await mapWithConcurrency([1, 2], 0, async (n) => n)).toHaveLength(2);
  });
});
