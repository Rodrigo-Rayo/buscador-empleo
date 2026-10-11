import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { accumulate, comboKey, loadStats, saveStats, summarizeRun, uselessCombos } from '../src/searchStats';

const outcome = (portal: string, keyword: string, jobIds: string[]) => ({ portal, keyword, jobIds });

describe('summarizeRun', () => {
  it('cuenta resultados, exclusivas y nuevas de cada combinación', () => {
    const run = summarizeRun(
      [
        outcome('linkedin', 'psicólogo', ['a', 'b', 'c']),
        outcome('indeed', 'psicólogo', ['b', 'd']),
        outcome('indeed', 'sexología', []),
      ],
      new Set(['a', 'b', 'd']),
    );
    expect(run[comboKey('linkedin', 'psicólogo')]).toEqual({ busquedas: 1, resultados: 3, exclusivas: 2, nuevas: 2 });
    // "b" es nueva pero ya se la atribuyó LinkedIn, que la encontró antes
    expect(run[comboKey('indeed', 'psicólogo')]).toEqual({ busquedas: 1, resultados: 2, exclusivas: 1, nuevas: 1 });
    expect(run[comboKey('indeed', 'sexología')]).toEqual({ busquedas: 1, resultados: 0, exclusivas: 0, nuevas: 0 });
  });

  it('una oferta repetida dentro de la misma búsqueda cuenta una vez', () => {
    const run = summarizeRun([outcome('linkedin', 'x', ['a', 'a'])], new Set());
    expect(run[comboKey('linkedin', 'x')]).toMatchObject({ resultados: 1, exclusivas: 1 });
  });
});

describe('accumulate', () => {
  it('suma ejecuciones y conserva combinaciones que no se lanzaron esta vez', () => {
    const previous = { 'a | x': { busquedas: 2, resultados: 5, exclusivas: 1, nuevas: 3 } };
    const run = { 'a | x': { busquedas: 1, resultados: 2, exclusivas: 0, nuevas: 1 }, 'b | y': { busquedas: 1, resultados: 0, exclusivas: 0, nuevas: 0 } };
    expect(accumulate(previous, run)).toEqual({
      'a | x': { busquedas: 3, resultados: 7, exclusivas: 1, nuevas: 4 },
      'b | y': { busquedas: 1, resultados: 0, exclusivas: 0, nuevas: 0 },
    });
    expect(previous['a | x'].busquedas).toBe(2);
  });
});

describe('uselessCombos', () => {
  const stats = {
    'indeed | sexología': { busquedas: 3, resultados: 0, exclusivas: 0, nuevas: 0 },
    'indeed | psicólogo': { busquedas: 3, resultados: 9, exclusivas: 0, nuevas: 2 },
    'linkedin | psicólogo': { busquedas: 3, resultados: 30, exclusivas: 12, nuevas: 10 },
    'infojobs | sexología': { busquedas: 2, resultados: 0, exclusivas: 0, nuevas: 0 },
  };

  it('solo marca las que, con datos suficientes, nunca aportaron una exclusiva', () => {
    expect(uselessCombos(stats)).toEqual(['indeed | psicólogo', 'indeed | sexología']);
  });

  it('sin datos suficientes no marca nada', () => {
    expect(uselessCombos(stats, 4)).toEqual([]);
  });
});

describe('loadStats / saveStats', () => {
  const tempFile = async () => join(await mkdtemp(join(tmpdir(), 'stats-')), 'estadisticas.json');

  it('guarda y vuelve a leer', async () => {
    const file = await tempFile();
    const stats = { gabi: { 'linkedin | x': { busquedas: 1, resultados: 2, exclusivas: 1, nuevas: 1 } } };
    await saveStats(file, stats);
    expect(await loadStats(file)).toEqual(stats);
    expect(JSON.parse(await readFile(file, 'utf8'))).toEqual(stats);
  });

  it('sin archivo o con datos dañados empieza de cero', async () => {
    const file = await tempFile();
    expect(await loadStats(file)).toEqual({});
    await writeFile(file, '{roto');
    expect(await loadStats(file)).toEqual({});
    await writeFile(file, JSON.stringify({ gabi: { 'x | y': { busquedas: 'mucho' } } }));
    expect(await loadStats(file)).toEqual({});
  });
});
