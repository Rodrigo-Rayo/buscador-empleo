import type { AxiosInstance } from 'axios';
import dotenv from 'dotenv';
import { mapWithConcurrency } from './concurrency';
import { AppConfig, loadConfig } from './config';
import { effectiveDateRestrict } from './dateWindow';
import { writeReport } from './htmlReport';
import { SearchProfile, searchesFor, selectProfiles } from './profiles';
import { parsePublishedDate } from './publishedDate';
import { buildQuery } from './queryBuilder';
import { StatsFile, TaskOutcome, accumulate, loadStats, saveStats, summarizeRun } from './searchStats';
import { FatalSearchError, createHttpClient, searchPage } from './serperSearch';
import { JobSource, ParsedJob, SOURCES } from './sources';
import { JobOffer, loadOffers, mergeOffers, saveOffers } from './storage';

const STATS_FILE = 'estadisticas.json';

interface CollectResult {
  readonly jobs: readonly ParsedJob[];
  readonly outcomes: readonly TaskOutcome[];
  readonly aborted: boolean;
}

interface SearchContext {
  readonly client: AxiosInstance;
  readonly config: AppConfig;
  readonly profile: SearchProfile;
  readonly dateRestrict: string | undefined;
}

interface RunOptions {
  /** Ignora la ventana incremental y busca con la máxima del perfil (útil para recuperar ofertas y fechas) */
  readonly full: boolean;
}

const FULL_FLAG = '--completa';

interface SearchTask {
  readonly source: JobSource;
  readonly keyword: string;
}

async function runTask({ client, config, profile, dateRestrict }: SearchContext, { source, keyword }: SearchTask): Promise<ParsedJob[]> {
  const query = buildQuery(profile, source, keyword);
  const jobs: ParsedJob[] = [];

  for (let page = 0; page < config.maxPagesPerKeyword; page++) {
    const items = await searchPage(client, query, page, { dateRestrict });
    const now = new Date();
    items.forEach((item) => {
      const job = source.parse(item);
      const fechaPublicacion = parsePublishedDate(item.date, now);
      if (job) jobs.push(fechaPublicacion ? { ...job, fechaPublicacion } : job);
    });
    if (items.length === 0) break;
  }
  return jobs;
}

function tasksFor(profile: SearchProfile): readonly SearchTask[] {
  return searchesFor(profile).map(({ portal, keyword }) => ({ source: SOURCES[portal], keyword }));
}

/** Lanza las búsquedas en paralelo; si una falla de forma irrecuperable no se lanzan más. */
async function collectJobs(context: SearchContext): Promise<CollectResult> {
  const tasks = tasksFor(context.profile);
  const results = await mapWithConcurrency(
    tasks,
    context.config.concurrency,
    (task) => runTask(context, task),
    (error) => error instanceof FatalSearchError,
  );

  const jobs: ParsedJob[] = [];
  const outcomes: TaskOutcome[] = [];
  const perPortal = new Map<string, number>();
  let aborted = false;
  results.forEach((result, index) => {
    const task = tasks[index] as SearchTask;
    if (!result) return; // no llegó a lanzarse
    if (result.ok) {
      jobs.push(...result.value);
      outcomes.push({ portal: task.source.id, keyword: task.keyword, jobIds: result.value.map((job) => job.id) });
      perPortal.set(task.source.nombre, (perPortal.get(task.source.nombre) ?? 0) + result.value.length);
    } else if (result.error instanceof FatalSearchError) {
      aborted = true;
      console.warn(`⚠ ${result.error.message}. Se detiene la búsqueda y se guarda lo obtenido hasta ahora.`);
    } else {
      console.error(`✗ Error buscando "${task.keyword}" en ${task.source.nombre}: ${(result.error as Error).message}`);
    }
  });
  perPortal.forEach((count, portal) => console.log(`  · ${portal}: ${count} ofertas encontradas`));
  return { jobs, outcomes, aborted };
}

function newestSaved(offers: readonly JobOffer[]): Date | null {
  const newest = offers.reduce<string>((max, offer) => (offer.fechaGuardado > max ? offer.fechaGuardado : max), '');
  return newest ? new Date(newest) : null;
}

/** Anota qué ha aportado cada combinación portal + palabra clave (ver `npm run estadisticas`). */
async function recordStats(profile: SearchProfile, outcomes: readonly TaskOutcome[], added: readonly JobOffer[]): Promise<void> {
  const stats: StatsFile = await loadStats(STATS_FILE);
  const run = summarizeRun(outcomes, new Set(added.map((offer) => offer.id)));
  await saveStats(STATS_FILE, { ...stats, [profile.id]: accumulate(stats[profile.id] ?? {}, run) });
}

/** Busca, guarda y regenera la página de un perfil. Devuelve true si hubo que abortar. */
async function runProfile(client: AxiosInstance, config: AppConfig, profile: SearchProfile, { full }: RunOptions): Promise<boolean> {
  const existing = await loadOffers(profile.outputFile);
  const maxWindow = profile.dateRestrict ?? config.dateRestrict;
  const dateRestrict = full ? maxWindow : effectiveDateRestrict(maxWindow, newestSaved(existing), new Date());
  const window = dateRestrict ? `últimos ${dateRestrict.slice(1)}${dateRestrict.charAt(0)}` : 'sin límite de fecha';
  const searches = searchesFor(profile).length;
  console.log(`\n🔎 [${profile.id}] ${searches} búsquedas en ${profile.portals.length} portales (${window}), ${existing.length} guardadas...`);

  const { jobs, outcomes, aborted } = await collectJobs({ client, config, profile, dateRestrict });
  const { offers, added } = mergeOffers(existing, jobs, new Date());
  await saveOffers(profile.outputFile, offers);
  await writeReport(profile.reportFile, offers, profile);
  await recordStats(profile, outcomes, added);

  console.log(`✔ [${profile.id}] ${added.length} ofertas nuevas (${jobs.length - added.length} ya vistas). Total: ${offers.length}.`);
  added.forEach((offer) => console.log(`  + [${SOURCES[offer.portal].nombre}] ${offer.titulo} — ${offer.empresa} (${offer.ubicacion})`));
  return aborted;
}

async function main(): Promise<void> {
  dotenv.config({ quiet: true });
  const config = loadConfig();
  const args = process.argv.slice(2);
  const options: RunOptions = { full: args.includes(FULL_FLAG) };
  // Sin perfiles indicados solo los activos; si se indican, se lanzan aunque estén pausados
  const profiles = selectProfiles(args.filter((arg) => !arg.startsWith('--')), { activeOnly: true });
  const client = createHttpClient(config.apiKey);
  const startedAt = Date.now();

  for (const profile of profiles) {
    if (await runProfile(client, config, profile, options)) {
      process.exitCode = 2;
      return;
    }
  }
  const seconds = ((Date.now() - startedAt) / 1000).toFixed(1);
  console.log(`\n⏱ ${seconds} s · 📄 Ábrelas con: npm run ver  (${profiles.map((p) => p.reportFile).join(', ')})`);
}

main().catch((error: unknown) => {
  console.error(`✗ ${(error as Error).message}`);
  process.exitCode = 1;
});
