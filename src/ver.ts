import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { writeReport } from './htmlReport';
import { PROFILES, selectProfiles } from './profiles';
import { loadOffers } from './storage';

/** Comando del sistema que abre un archivo con el programa por defecto. */
function openCommand(file: string): [string, string[]] {
  // windowsVerbatimArguments: las comillas van a mano para rutas con espacios
  if (process.platform === 'win32') return ['cmd', ['/c', 'start', '""', `"${file}"`]];
  if (process.platform === 'darwin') return ['open', [file]];
  return ['xdg-open', [file]];
}

/** Solo regenera las páginas, sin abrirlas (lo usa GitHub Actions para republicar sin gastar créditos) */
const NO_OPEN_FLAG = '--sin-abrir';

/**
 * Regenera todas las páginas a partir de los JSON guardados (sin gastar créditos), para que la barra de navegación
 * entre personas siempre funcione, y abre en el navegador las pedidas (sin argumentos: las de perfiles activos).
 */
async function main(): Promise<void> {
  for (const profile of PROFILES) {
    await writeReport(profile.reportFile, await loadOffers(profile.outputFile), profile);
  }
  const args = process.argv.slice(2);
  if (args.includes(NO_OPEN_FLAG)) return;
  for (const profile of selectProfiles(args, { activeOnly: true })) {
    const reportFile = resolve(profile.reportFile);
    console.log(`📄 [${profile.id}] → ${reportFile}`);
    const [command, args] = openCommand(reportFile);
    spawn(command, args, { detached: true, stdio: 'ignore', windowsVerbatimArguments: true }).unref();
  }
}

main().catch((error: unknown) => {
  console.error(`✗ ${(error as Error).message}`);
  process.exitCode = 1;
});
