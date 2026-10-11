export const STYLES = /* css */ `
:root {
  --paper: #f4efe6; --paper-raised: #fbf8f2; --ink: #1d1a16; --ink-soft: #5d554a; --ink-faint: #8f8574;
  --rule: #d9cfbf; --accent: #c2410c; --accent-soft: #fbe3d3; --focus: #1d4ed8;
  --ok: #15803d; --ok-soft: #dcfce7; --warn: #a16207; --warn-soft: #fef3c7;
  --display: 'Fraunces', Georgia, 'Times New Roman', serif;
  --mono: 'IBM Plex Mono', ui-monospace, 'Cascadia Mono', Consolas, monospace;
  --ease: cubic-bezier(0.16, 1, 0.3, 1);
  color-scheme: light;
}
@media (prefers-color-scheme: dark) {
  :root { --paper: #16140f; --paper-raised: #1f1c16; --ink: #f1ebe0; --ink-soft: #b9af9f; --ink-faint: #82796b;
    --rule: #37322a; --accent: #fb923c; --accent-soft: #3a2415; --focus: #93c5fd; --ok: #4ade80; --ok-soft: #14301f; --warn: #facc15; --warn-soft: #3a3010; color-scheme: dark; }
}
* { box-sizing: border-box; }
body { margin: 0; background: var(--paper); color: var(--ink); font-family: var(--mono); font-size: 14px; line-height: 1.5; }
.wrap { max-width: 980px; margin: 0 auto; padding: 0 16px 96px; }
button { font: inherit; cursor: pointer; }
:focus-visible { outline: 2px solid var(--focus); outline-offset: 2px; }

nav.people { display: flex; gap: 4px; flex-wrap: wrap; padding-top: 20px; }
nav.people a { font-size: 12px; color: var(--ink-soft); text-decoration: none; padding: 6px 12px; border: 1px solid var(--rule);
  border-radius: 999px; transition: background .15s, color .15s, border-color .15s; }
nav.people a:hover { border-color: var(--ink); color: var(--ink); }
nav.people a[aria-current="page"] { background: var(--accent); border-color: var(--accent); color: var(--paper); font-weight: 600; }
nav.people small { opacity: .7; }
#portals[hidden] { display: none; }
header.masthead { padding: 36px 0 28px; border-bottom: 3px double var(--ink); }
.kicker { text-transform: uppercase; letter-spacing: .14em; font-size: 11px; color: var(--ink-soft); display: flex; gap: 16px; flex-wrap: wrap; }
h1 { font-family: var(--display); font-weight: 800; font-size: clamp(2.8rem, 1.6rem + 6vw, 5.5rem); line-height: .92;
  letter-spacing: -.035em; margin: 14px 0 0; font-variation-settings: 'SOFT' 50, 'WONK' 1; }
h1 em { font-style: italic; font-weight: 400; color: var(--accent); }
.stats { display: flex; gap: 16px 32px; margin-top: 24px; flex-wrap: wrap; }
.stat b { display: block; font-family: var(--display); font-size: 2rem; font-weight: 600; line-height: 1; }
.stat span { font-size: 11px; text-transform: uppercase; letter-spacing: .1em; color: var(--ink-soft); }
.stat.hot b { color: var(--accent); }
.stat.ok b { color: var(--ok); }

.controls { position: sticky; top: 0; z-index: 5; background: var(--paper); padding: 16px 0 12px; border-bottom: 1px solid var(--rule); }
.views { display: flex; gap: 0; border-bottom: 1px solid var(--rule); margin-bottom: 14px; overflow-x: auto; }
.view { background: none; border: 0; border-bottom: 2px solid transparent; margin-bottom: -1px; padding: 6px 14px 8px;
  color: var(--ink-soft); font-size: 13px; white-space: nowrap; transition: color .15s, border-color .15s; }
.view:hover { color: var(--ink); }
.view[aria-pressed="true"] { color: var(--ink); border-bottom-color: var(--accent); font-weight: 600; }
.view small { color: var(--ink-faint); font-weight: 400; margin-left: 4px; }
.search { display: flex; gap: 10px; }
.search input, .search select { font: inherit; color: var(--ink); background: var(--paper-raised); border: 1px solid var(--rule);
  border-radius: 2px; padding: 10px 12px; min-width: 0; transition: border-color .15s; }
.search input { flex: 1; }
.search select { max-width: 38%; }
.chips { display: flex; gap: 6px; flex-wrap: wrap; margin-top: 10px; }
.chip { font-size: 12px; border: 1px solid var(--rule); background: transparent; color: var(--ink-soft);
  padding: 4px 10px; border-radius: 999px; transition: background .15s, color .15s, border-color .15s; }
.chip:hover { border-color: var(--ink); color: var(--ink); }
.chip[aria-pressed="true"] { background: var(--ink); border-color: var(--ink); color: var(--paper); }
.chip small { opacity: .65; margin-left: 4px; }
.only-match { display: inline-flex; align-items: center; gap: 8px; margin-top: 10px; font-size: 12px; color: var(--ink-soft); cursor: pointer; user-select: none; }
.only-match input { accent-color: var(--ok); width: 15px; height: 15px; margin: 0; cursor: pointer; }
.only-match:hover { color: var(--ink); }
.count { font-size: 12px; color: var(--ink-faint); margin-top: 10px; }
.warning { font-size: 12px; color: var(--accent); margin-top: 8px; }

section.day { margin-top: 40px; }
.day h2 { font-family: var(--display); font-weight: 400; font-style: italic; font-size: 1.5rem; margin: 0 0 4px;
  display: flex; align-items: baseline; gap: 12px; flex-wrap: wrap; }
.day h2 span { font-family: var(--mono); font-style: normal; font-size: 11px; color: var(--ink-faint); letter-spacing: .08em; text-transform: uppercase; }

ol.jobs { list-style: none; margin: 0; padding: 0; }
.job { display: grid; grid-template-columns: 1fr auto; align-items: center; gap: 8px 20px; padding: 18px 12px 18px 16px;
  margin: 0 -12px 0 -16px; border-top: 1px solid var(--rule); position: relative; transition: background .25s var(--ease), opacity .25s; }
.job::before { content: ''; position: absolute; left: 0; top: 18px; bottom: 18px; width: 3px; background: var(--accent);
  transform: scaleY(0); transform-origin: top; transition: transform .3s var(--ease); }
.job:hover { background: var(--paper-raised); }
.job:hover::before { transform: scaleY(1); }
.job.is-aplicada::before { background: var(--ok); transform: scaleY(1); }
.job.is-descartada { opacity: .5; }
.job.is-descartada .title { text-decoration: line-through; text-decoration-thickness: 1px; }
.job-link { color: inherit; text-decoration: none; display: block; min-width: 0; }
.job-link:hover .title { text-decoration: underline; text-decoration-thickness: 1px; text-underline-offset: 4px; }
.title { font-family: var(--display); font-size: 1.3rem; font-weight: 600; line-height: 1.2; letter-spacing: -.01em; overflow-wrap: anywhere; }
.meta { display: flex; gap: 4px 14px; flex-wrap: wrap; color: var(--ink-soft); font-size: 12.5px; margin-top: 4px; }
.meta .company { color: var(--ink); font-weight: 500; }
.meta .loc::before, .meta .ext::before, .meta .published::before { content: '◦ '; color: var(--ink-faint); }
.meta .published { color: var(--ink); }
.meta .published.old { color: var(--warn); }
.meta .ext { color: var(--ink-faint); }
.tag { font-size: 10px; font-weight: 600; letter-spacing: .12em; text-transform: uppercase; border: 1px solid currentColor;
  padding: 1px 6px; border-radius: 2px; margin-left: 10px; vertical-align: 4px; font-family: var(--mono); white-space: nowrap; }
.tag.new { color: var(--accent); }
.tag.applied { color: var(--ok); background: var(--ok-soft); }
.tag.good { color: var(--ok); border-style: dashed; }
.tag.warn { color: var(--warn); background: var(--warn-soft); }

.actions { display: flex; gap: 6px; }
.act { font-size: 12px; border: 1px solid var(--rule); background: var(--paper); color: var(--ink-soft); padding: 6px 10px;
  border-radius: 2px; white-space: nowrap; transition: background .15s, color .15s, border-color .15s, transform .1s; }
.act:active { transform: translateY(1px); }
.act.apply:hover, .act.apply[aria-pressed="true"] { border-color: var(--ok); color: var(--ok); }
.act.apply[aria-pressed="true"] { background: var(--ok-soft); }
.act.discard:hover, .act.discard[aria-pressed="true"] { border-color: var(--ink); color: var(--ink); }
.act.discard[aria-pressed="true"] { background: var(--rule); }

.empty { padding: 64px 0; text-align: center; color: var(--ink-soft); font-family: var(--display); font-style: italic; font-size: 1.3rem; }
.toast { position: fixed; left: 50%; bottom: 24px; transform: translate(-50%, 16px); opacity: 0; pointer-events: none;
  background: var(--ink); color: var(--paper); padding: 10px 10px 10px 16px; border-radius: 3px; display: flex; gap: 16px;
  align-items: center; font-size: 13px; box-shadow: 0 8px 24px rgba(0,0,0,.25); transition: opacity .2s, transform .3s var(--ease); z-index: 10; max-width: calc(100% - 32px); }
.toast.show { opacity: 1; transform: translate(-50%, 0); pointer-events: auto; }
.toast button { background: none; border: 1px solid currentColor; color: inherit; padding: 4px 10px; border-radius: 2px; }
footer { margin-top: 64px; font-size: 11px; color: var(--ink-faint); border-top: 1px solid var(--rule); padding-top: 16px; }
kbd { font: inherit; border: 1px solid var(--rule); border-radius: 3px; padding: 0 4px; }

@media (max-width: 640px) {
  header.masthead { padding: 20px 0 18px; }
  .kicker { gap: 2px 12px; font-size: 10px; }
  h1 { font-size: clamp(2.2rem, 1.4rem + 5vw, 3rem); }
  .stats { gap: 12px 24px; margin-top: 16px; }
  .stat b { font-size: 1.6rem; }
  /* Fija arriba ocupaba casi toda la pantalla y tapaba las ofertas: en el móvil se va con el scroll */
  .controls { position: static; padding-top: 12px; }
  .search { gap: 8px; }
  .search input, .search select { padding: 8px 10px; }
  .search select { max-width: 40%; }
  /* Cada grupo de filtros en una sola línea que se desliza en horizontal */
  .chips { flex-wrap: nowrap; overflow-x: auto; scrollbar-width: none; margin-top: 8px; padding: 0 32px 2px 0;
    -webkit-mask-image: linear-gradient(to right, #000 85%, transparent); mask-image: linear-gradient(to right, #000 85%, transparent); }
  .chips::-webkit-scrollbar { display: none; }
  .chip { flex: none; white-space: nowrap; }
  section.day { margin-top: 28px; }
  .job { grid-template-columns: 1fr; }
}
@media (prefers-reduced-motion: reduce) { * { transition: none !important; } }
`;
