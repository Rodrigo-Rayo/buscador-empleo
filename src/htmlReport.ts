import { promises as fs } from 'node:fs';
import { PROFILES, SearchProfile } from './profiles';
import { scoreTitle } from './relevance';
import { CLIENT_SCRIPT } from './report/clientScript';
import { STYLES } from './report/styles';
import { SOURCES } from './sources';
import type { JobOffer } from './storage';

const FONTS_URL =
  'https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght,SOFT,WONK@0,9..144,400..800,0..100,0..1;1,9..144,400,0..100,0..1&family=IBM+Plex+Mono:wght@400;500;600&display=swap';
// Clave común de las primeras versiones: la página la usa como respaldo para no perder marcas antiguas
const STORAGE_PREFIX = 'buscador-empleo:estados:v1';

const HTML_ESCAPES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (char) => HTML_ESCAPES[char] ?? char);
}

/**
 * Serializa datos para incrustarlos en <script type="application/json">.
 * Escapar "<" impide que un título con "</script>" cierre la etiqueta e inyecte HTML.
 */
function embedJson(data: unknown): string {
  return JSON.stringify(data).replace(/</g, '\\u003c');
}

/** Ofertas más recientes primero, con su encaje y el nombre del portal (se calculan al generar, no se guardan). */
function prepareOffers(offers: readonly JobOffer[], profile: SearchProfile) {
  return [...offers]
    .sort((a, b) => b.fechaGuardado.localeCompare(a.fechaGuardado))
    .map((offer) => ({ ...offer, portalNombre: SOURCES[offer.portal].nombre, ...scoreTitle(offer.titulo, profile.page.scoring) }));
}

/** Barra con las páginas de todas las personas (son archivos hermanos en la misma carpeta). */
/** Enlaza las páginas activas (y la actual); sin barra si solo hay una, como en la página publicada de Gabi. */
function renderNav(current: SearchProfile): string {
  const visible = PROFILES.filter((profile) => !profile.paused || profile.id === current.id);
  if (visible.length < 2) return '';
  const links = visible.map((profile) => {
    const label = escapeHtml(profile.page.navLabel) + (profile.paused ? ' <small>(pausada)</small>' : '');
    const currentAttr = profile.id === current.id ? ' aria-current="page"' : '';
    return `<a href="${escapeHtml(profile.reportFile)}"${currentAttr}>${label}</a>`;
  });
  return `<nav class="people" aria-label="Búsquedas de cada persona">${links.join('')}</nav>`;
}

/** Genera una página HTML autocontenida con las ofertas (más recientes primero), buscador, filtros y estados. */
export function renderReport(offers: readonly JobOffer[], generatedAt: Date, profile: SearchProfile): string {
  const { page } = profile;
  const kicker = page.kicker.map((part) => `<span>${escapeHtml(part)}</span>`).join('');
  const meta = {
    generatedAt: generatedAt.toISOString(),
    matchLabel: page.matchLabel,
    onlyMatchByDefault: page.onlyMatchByDefault ?? false,
    storageKey: `${STORAGE_PREFIX}:${profile.id}`,
    legacyStorageKey: STORAGE_PREFIX,
  };

  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(page.documentTitle)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="${FONTS_URL}" rel="stylesheet">
<style>${STYLES}</style>
</head>
<body>
<div class="wrap">
  ${renderNav(profile)}
  <header class="masthead">
    <div class="kicker">${kicker}<span id="updated"></span></div>
    <h1>${escapeHtml(page.heading)} <em>${escapeHtml(page.emphasis)}</em></h1>
    <div class="stats" id="stats"></div>
  </header>
  <div class="controls">
    <div class="views" id="views" role="group" aria-label="Estado de las ofertas"></div>
    <div class="search">
      <input id="q" type="search" placeholder="Buscar puesto, empresa o palabra…  ( / )" aria-label="Buscar ofertas" autocomplete="off">
      <select id="company" aria-label="Filtrar por empresa"><option value="">Todas las empresas</option></select>
    </div>
    <div class="chips" id="portals" role="group" aria-label="Filtrar por portal"></div>
    <div class="chips" id="chips" role="group" aria-label="Filtrar por ubicación"></div>
    <label class="only-match"><input type="checkbox" id="only-match"> <span id="only-match-label"></span></label>
    <div class="count" id="count" aria-live="polite"></div>
    <p class="warning" id="storage-warning" hidden>Este navegador no permite guardar el estado de las ofertas: los cambios se perderán al cerrar la página.</p>
  </div>
  <main id="list"></main>
  <footer>Generado por buscador-empleo · <kbd>/</kbd> buscar · <kbd>Esc</kbd> limpiar · Dentro de cada día, primero las que mejor encajan · El estado (aplicada/descartada) se guarda en este navegador · La ubicación es orientativa: confírmala en la oferta.</footer>
</div>
<div class="toast" id="toast" role="status" aria-live="polite"></div>
<script type="application/json" id="offers-data">${embedJson(prepareOffers(offers, profile))}</script>
<script type="application/json" id="meta-data">${embedJson(meta)}</script>
<script>${CLIENT_SCRIPT}</script>
</body>
</html>
`;
}

export async function writeReport(
  file: string,
  offers: readonly JobOffer[],
  profile: SearchProfile,
  generatedAt: Date = new Date(),
): Promise<void> {
  await fs.writeFile(file, renderReport(offers, generatedAt, profile), 'utf8');
}
