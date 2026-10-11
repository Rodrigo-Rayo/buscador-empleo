import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { ParsedJob } from '../src/sources';
import { JobOffer, loadOffers, mergeOffers, saveOffers } from '../src/storage';

const job = (id: string, enlace = `https://www.linkedin.com/jobs/view/${id}/`): ParsedJob => ({
  id,
  titulo: `Dev ${id}`,
  empresa: 'Acme',
  ubicacion: 'Madrid',
  enlace,
  portal: 'linkedin',
});
const NOW = new Date('2026-09-24T10:00:00.000Z');
const tempFile = async () => join(await mkdtemp(join(tmpdir(), 'ofertas-')), 'ofertas.json');

describe('mergeOffers', () => {
  it('añade ofertas nuevas con fecha de guardado', () => {
    const { offers, added } = mergeOffers([], [job('1')], NOW);
    expect(added).toEqual([{ ...job('1'), fechaGuardado: NOW.toISOString() }]);
    expect(offers).toHaveLength(1);
  });

  it('ignora ofertas con ID o enlace ya existentes', () => {
    const existing: JobOffer[] = [{ ...job('1'), fechaGuardado: 'antes' }];
    const { offers, added } = mergeOffers(existing, [job('1'), job('2', existing[0]!.enlace), job('3')], NOW);
    expect(added.map((o) => o.id)).toEqual(['3']);
    expect(offers).toHaveLength(2);
  });

  it('ignora republicaciones: mismo título y empresa con otro ID', () => {
    const existing: JobOffer[] = [{ ...job('1'), titulo: 'Developer Java / React', empresa: 'Grupo TECDATA', fechaGuardado: 'antes' }];
    const repost = { ...job('2'), titulo: 'Developer  java/react', empresa: 'Grupo Tecdata' };
    const other = { ...job('3'), titulo: 'Developer Java / React', empresa: 'Otra Empresa' };
    const { added } = mergeOffers(existing, [repost, other], NOW);
    expect(added.map((o) => o.id)).toEqual(['3']);
  });

  it('detecta la misma oferta en otro portal aunque la empresa venga más larga', () => {
    const existing: JobOffer[] = [
      { ...job('1'), titulo: 'ES- Analista Programador .Net Back', empresa: 'Devoteam', fechaGuardado: 'antes' },
    ];
    const inIndeed: ParsedJob = {
      ...job('indeed:d145ac7e81937017'),
      titulo: 'ES- Analista Programador .Net Back',
      empresa: 'Devoteam Spain',
      portal: 'indeed',
    };
    expect(mergeOffers(existing, [inIndeed], NOW).added).toEqual([]);
  });

  it('no fusiona ofertas con el mismo título si no se conoce la empresa', () => {
    const a: ParsedJob = { ...job('infojobs:a'), titulo: 'Psicólogo/a', empresa: 'Desconocida', portal: 'infojobs' };
    const b: ParsedJob = { ...job('infojobs:b'), titulo: 'Psicólogo/a', empresa: 'Desconocida', portal: 'infojobs' };
    expect(mergeOffers([], [a, b], NOW).added).toHaveLength(2);
  });

  it('completa la fecha de publicación de una oferta guardada sin ella, sin tocar las que ya la tienen', () => {
    const existing: JobOffer[] = [
      { ...job('1'), fechaGuardado: 'antes' },
      { ...job('2'), fechaGuardado: 'antes', fechaPublicacion: '2026-09-01' },
    ];
    const { offers, added } = mergeOffers(
      existing,
      [
        { ...job('1'), fechaPublicacion: '2026-09-20' },
        { ...job('2'), fechaPublicacion: '2026-09-22' },
      ],
      NOW,
    );
    expect(added).toEqual([]);
    expect(offers.map((o) => o.fechaPublicacion)).toEqual(['2026-09-20', '2026-09-01']);
    expect(existing[0]).not.toHaveProperty('fechaPublicacion');
  });

  it('elimina duplicados dentro del mismo lote', () => {
    const { added } = mergeOffers([], [job('1'), job('1')], NOW);
    expect(added).toHaveLength(1);
  });

  it('no muta el array existente', () => {
    const existing: JobOffer[] = [];
    mergeOffers(existing, [job('1')], NOW);
    expect(existing).toEqual([]);
  });
});

describe('loadOffers / saveOffers', () => {
  it('devuelve [] si el archivo no existe y persiste lo guardado', async () => {
    const file = await tempFile();
    expect(await loadOffers(file)).toEqual([]);

    const { offers } = mergeOffers([], [job('1')], NOW);
    await saveOffers(file, offers);
    expect(await loadOffers(file)).toEqual(offers);
    expect(JSON.parse(await readFile(file, 'utf8'))).toEqual(offers);
  });

  it('las ofertas guardadas antes de haber varios portales se leen como LinkedIn', async () => {
    const file = await tempFile();
    const { portal: _portal, ...legacy } = { ...job('1'), fechaGuardado: NOW.toISOString() };
    await writeFile(file, JSON.stringify([legacy, { ...legacy, id: '2', portal: 'monster' }]));
    expect((await loadOffers(file)).map((o) => o.portal)).toEqual(['linkedin', 'linkedin']);
  });

  it('lee la fecha de publicación válida y descarta la que no tiene formato de día', async () => {
    const file = await tempFile();
    const base = { ...job('1'), fechaGuardado: NOW.toISOString() };
    await writeFile(file, JSON.stringify([{ ...base, fechaPublicacion: '2026-09-20' }, { ...base, id: '2', fechaPublicacion: 'ayer' }]));
    const [ok, bad] = await loadOffers(file);
    expect(ok?.fechaPublicacion).toBe('2026-09-20');
    expect(bad).not.toHaveProperty('fechaPublicacion');
  });

  it('lanza error con JSON corrupto en lugar de sobrescribirlo', async () => {
    const file = await tempFile();
    await writeFile(file, '{roto');
    await expect(loadOffers(file)).rejects.toThrow(/JSON válido/);
  });

  it('lanza error si el formato no es un array de ofertas', async () => {
    const file = await tempFile();
    await writeFile(file, JSON.stringify([{ id: 1 }]));
    await expect(loadOffers(file)).rejects.toThrow(/formato esperado/);
  });
});
