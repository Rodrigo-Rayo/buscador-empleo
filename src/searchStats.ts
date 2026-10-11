import { promises as fs } from 'node:fs';

/** Lo que aporta una combinación portal + palabra clave, acumulado entre ejecuciones. */
export interface ComboStats {
  /** Veces que se ha lanzado (cada una cuesta 1 crédito) */
  readonly busquedas: number;
  /** Ofertas que ha devuelto */
  readonly resultados: number;
  /** Ofertas que solo encontró esta combinación en esa ejecución: si siempre es 0, quitarla no pierde nada */
  readonly exclusivas: number;
  /** Ofertas nuevas que se guardaron gracias a ella (atribuidas a la primera combinación que las encontró) */
  readonly nuevas: number;
}

export type ProfileStats = Readonly<Record<string, ComboStats>>;
export type StatsFile = Readonly<Record<string, ProfileStats>>;

export interface TaskOutcome {
  readonly portal: string;
  readonly keyword: string;
  readonly jobIds: readonly string[];
}

export const MIN_RUNS_TO_JUDGE = 3;
const EMPTY: ComboStats = { busquedas: 0, resultados: 0, exclusivas: 0, nuevas: 0 };

export function comboKey(portal: string, keyword: string): string {
  return `${portal} | ${keyword}`;
}

/** Estadísticas de una ejecución: una entrada por combinación que llegó a lanzarse. */
export function summarizeRun(outcomes: readonly TaskOutcome[], addedIds: ReadonlySet<string>): ProfileStats {
  const foundBy = new Map<string, number>();
  outcomes.forEach((outcome) => new Set(outcome.jobIds).forEach((id) => foundBy.set(id, (foundBy.get(id) ?? 0) + 1)));

  const credited = new Set<string>();
  return Object.fromEntries(
    outcomes.map((outcome) => {
      const ids = [...new Set(outcome.jobIds)];
      const nuevas = ids.filter((id) => addedIds.has(id) && !credited.has(id));
      nuevas.forEach((id) => credited.add(id));
      const stats: ComboStats = {
        busquedas: 1,
        resultados: ids.length,
        exclusivas: ids.filter((id) => foundBy.get(id) === 1).length,
        nuevas: nuevas.length,
      };
      return [comboKey(outcome.portal, outcome.keyword), stats];
    }),
  );
}

/** Suma una ejecución al histórico (sin modificar ninguno de los dos). */
export function accumulate(previous: ProfileStats, run: ProfileStats): ProfileStats {
  const keys = new Set([...Object.keys(previous), ...Object.keys(run)]);
  return Object.fromEntries(
    [...keys].map((key) => {
      const a = previous[key] ?? EMPTY;
      const b = run[key] ?? EMPTY;
      const sum: ComboStats = {
        busquedas: a.busquedas + b.busquedas,
        resultados: a.resultados + b.resultados,
        exclusivas: a.exclusivas + b.exclusivas,
        nuevas: a.nuevas + b.nuevas,
      };
      return [key, sum];
    }),
  );
}

/** Combinaciones lanzadas al menos `minRuns` veces que nunca han aportado una oferta exclusiva. */
export function uselessCombos(stats: ProfileStats, minRuns: number = MIN_RUNS_TO_JUDGE): readonly string[] {
  return Object.entries(stats)
    .filter(([, s]) => s.busquedas >= minRuns && s.exclusivas === 0)
    .map(([key]) => key)
    .sort();
}

function isComboStats(value: unknown): value is ComboStats {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return ['busquedas', 'resultados', 'exclusivas', 'nuevas'].every((key) => Number.isInteger(v[key]));
}

function isStatsFile(value: unknown): value is StatsFile {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  return Object.values(value).every(
    (profile) => typeof profile === 'object' && profile !== null && Object.values(profile).every(isComboStats),
  );
}

/** Si el archivo no existe o está dañado se empieza de cero: son estadísticas, no datos del usuario. */
export async function loadStats(file: string): Promise<StatsFile> {
  try {
    const data: unknown = JSON.parse(await fs.readFile(file, 'utf8'));
    if (isStatsFile(data)) return data;
    console.warn(`⚠ ${file} no tiene el formato esperado: se reinician las estadísticas.`);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      console.warn(`⚠ No se pudo leer ${file} (${(error as Error).message}): se reinician las estadísticas.`);
    }
  }
  return {};
}

export async function saveStats(file: string, stats: StatsFile): Promise<void> {
  const tmpFile = `${file}.tmp`;
  await fs.writeFile(tmpFile, `${JSON.stringify(stats, null, 2)}\n`, 'utf8');
  await fs.rename(tmpFile, file);
}
