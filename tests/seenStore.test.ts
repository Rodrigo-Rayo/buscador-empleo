import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadSeen, markSeen, saveSeen } from '../src/seenStore';

const tempFile = async () => join(await mkdtemp(join(tmpdir(), 'vistos-')), 'vistos.json');

describe('markSeen', () => {
  const NOW = new Date('2026-11-24T10:00:00Z');

  it('marca como vistas hoy las ofertas de un listado sin tocar los demás', () => {
    const seen = markSeen({ eduso: { 'eduso:1': '2026-11-01' } }, 'hacesfalta_madrid', ['hacesfalta:9'], NOW);
    expect(seen).toEqual({ eduso: { 'eduso:1': '2026-11-01' }, hacesfalta_madrid: { 'hacesfalta:9': '2026-11-24' } });
  });

  it('actualiza la fecha de las que vuelven a aparecer y olvida las de hace más de 90 días', () => {
    const before = { eduso: { 'eduso:1': '2026-11-01', 'eduso:2': '2026-08-01', 'eduso:3': '2026-09-01' } };
    expect(markSeen(before, 'eduso', ['eduso:1'], NOW)).toEqual({ eduso: { 'eduso:1': '2026-11-24', 'eduso:3': '2026-09-01' } });
  });

  it('no muta el registro original', () => {
    const before = { eduso: { 'eduso:1': '2026-11-01' } };
    markSeen(before, 'eduso', ['eduso:2'], NOW);
    expect(before).toEqual({ eduso: { 'eduso:1': '2026-11-01' } });
  });
});

describe('loadSeen / saveSeen', () => {
  it('guarda y lee el registro; sin archivo empieza de cero', async () => {
    const file = await tempFile();
    expect(await loadSeen(file)).toEqual({});
    await saveSeen(file, { eduso: { 'eduso:1': '2026-11-24' } });
    expect(await loadSeen(file)).toEqual({ eduso: { 'eduso:1': '2026-11-24' } });
  });

  it('con un archivo corrupto o con otro formato empieza de cero', async () => {
    const file = await tempFile();
    await writeFile(file, '{roto');
    expect(await loadSeen(file)).toEqual({});
    await writeFile(file, JSON.stringify({ eduso: { 'eduso:1': 'ayer' } }));
    expect(await loadSeen(file)).toEqual({});
  });
});
