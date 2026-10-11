import { PROFILES } from './profiles';
import { ComboStats, MIN_RUNS_TO_JUDGE, loadStats, uselessCombos } from './searchStats';

const STATS_FILE = 'estadisticas.json';

function row(key: string, s: ComboStats, useless: boolean): string {
  const cells = [s.busquedas, s.resultados, s.exclusivas, s.nuevas].map((n) => String(n).padStart(9)).join('');
  return `  ${useless ? '✗' : ' '} ${key.padEnd(42)}${cells}`;
}

/** Muestra qué aporta cada combinación portal + palabra clave y cuáles se pueden quitar sin perder ofertas. */
async function main(): Promise<void> {
  const stats = await loadStats(STATS_FILE);

  for (const profile of PROFILES) {
    const profileStats = stats[profile.id];
    if (!profileStats || Object.keys(profileStats).length === 0) continue;

    const useless = new Set(uselessCombos(profileStats));
    const runs = Math.max(...Object.values(profileStats).map((s) => s.busquedas));
    console.log(`\n■ ${profile.page.navLabel} (${runs} ejecuciones registradas)`);
    console.log(`    ${'portal | palabra clave'.padEnd(42)}${['búsquedas', 'result.', 'exclusiv.', 'nuevas'].map((h) => h.padStart(9)).join('')}`);
    Object.entries(profileStats)
      .sort(([, a], [, b]) => b.exclusivas - a.exclusivas || b.resultados - a.resultados)
      .forEach(([key, s]) => console.log(row(key, s, useless.has(key))));

    if (useless.size > 0) {
      console.log(`  → Candidatas a quitar (${useless.size} créditos menos por búsqueda): nunca han aportado una oferta exclusiva.`);
    } else if (runs < MIN_RUNS_TO_JUDGE) {
      console.log(`  → Faltan datos: se juzga a partir de ${MIN_RUNS_TO_JUDGE} ejecuciones.`);
    }
  }
}

main().catch((error: unknown) => {
  console.error(`✗ ${(error as Error).message}`);
  process.exitCode = 1;
});
