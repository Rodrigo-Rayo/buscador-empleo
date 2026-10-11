// JavaScript que se ejecuta en el navegador. Sin template literals para no chocar con el template de TypeScript.
// El estado (aplicada / descartada) se guarda en localStorage: sobrevive a las regeneraciones de la página.
export const CLIENT_SCRIPT = /* js */ `
(function () {
  var VIEWS = [['pendientes', 'Pendientes'], ['aplicada', 'Aplicadas'], ['descartada', 'Descartadas'], ['todas', 'Todas']];
  // Solo se enlaza a fichas de los portales conocidos (nunca javascript: ni otros dominios)
  var ALLOWED_LINK = /^https:\\/\\/(www\\.linkedin\\.com\\/jobs\\/view\\/|www\\.infojobs\\.net\\/|es\\.indeed\\.com\\/viewjob\\?jk=|www\\.tecnoempleo\\.com\\/|www\\.hacesfalta\\.org\\/oportunidades\\/)/;
  var TOAST_MS = 5000;

  var offers = JSON.parse(document.getElementById('offers-data').textContent);
  var meta = JSON.parse(document.getElementById('meta-data').textContent);
  var STORAGE_KEY = meta.storageKey;
  var latestRun = offers.length ? offers[0].fechaGuardado : '';
  var filters = { q: '', loc: '', company: '', portal: '', view: 'pendientes', onlyMatch: Boolean(meta.onlyMatchByDefault) };
  var storageOk = true;
  var statuses = loadStatuses();
  var toastTimer = null;

  var $ = function (id) { return document.getElementById(id); };
  var norm = function (s) { return s.normalize('NFD').replace(/[\\u0300-\\u036f]/g, '').toLowerCase(); };
  var shortDate = new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short' });
  var longDate = new Intl.DateTimeFormat('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  // ---- Estado persistente ----
  function loadStatuses() {
    try {
      // Cada persona tiene su clave; si aún no existe, se parte de la común de versiones anteriores
      var saved = localStorage.getItem(STORAGE_KEY);
      if (saved === null && meta.legacyStorageKey) saved = localStorage.getItem(meta.legacyStorageKey);
      var parsed = JSON.parse(saved || '{}');
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    } catch (e) {
      storageOk = false;
      return {};
    }
  }
  function statusOf(id) {
    var s = statuses[id];
    return s && (s.estado === 'aplicada' || s.estado === 'descartada') ? s.estado : '';
  }
  function setStatus(id, estado) {
    var next = Object.assign({}, statuses);
    if (estado) next[id] = { estado: estado, fecha: new Date().toISOString() };
    else delete next[id];
    statuses = next;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch (e) { storageOk = false; }
    renderAll();
  }

  // ---- Filtros ----
  function inView(o) {
    var s = statusOf(o.id);
    if (filters.view === 'todas') return true;
    if (filters.view === 'pendientes') return s === '';
    return s === filters.view;
  }
  function matches(o) {
    if (!inView(o)) return false;
    if (filters.loc && o.ubicacion !== filters.loc) return false;
    if (filters.company && o.empresa !== filters.company) return false;
    if (filters.portal && o.portal !== filters.portal) return false;
    if (filters.onlyMatch && !(o.encaje > 0)) return false;
    return !filters.q || norm(o.titulo + ' ' + o.empresa + ' ' + o.ubicacion).indexOf(filters.q) !== -1;
  }
  function countBy(list, key) {
    return list.reduce(function (acc, o) { acc[o[key]] = (acc[o[key]] || 0) + 1; return acc; }, {});
  }
  function countView(view) {
    return offers.filter(function (o) {
      var s = statusOf(o.id);
      return view === 'todas' || (view === 'pendientes' ? s === '' : s === view);
    }).length;
  }

  // ---- Fechas ----
  function dayKey(date) { return date.getFullYear() + '-' + date.getMonth() + '-' + date.getDate(); }
  function dayStart(iso) { var d = new Date(iso); return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime(); }
  // Día más reciente primero; dentro del día, mejor encaje primero; a igualdad, la más reciente
  function byDayThenMatch(a, b) {
    return dayStart(b.fechaGuardado) - dayStart(a.fechaGuardado) || (b.encaje || 0) - (a.encaje || 0) || b.fechaGuardado.localeCompare(a.fechaGuardado);
  }
  function dayLabel(iso) {
    var d = new Date(iso), long = longDate.format(d);
    if (dayKey(d) === dayKey(new Date())) return ['Hoy', long];
    if (dayKey(d) === dayKey(new Date(Date.now() - 864e5))) return ['Ayer', long];
    return [long.charAt(0).toUpperCase() + long.slice(1), ''];
  }

  // "2026-09-21" → "Publicada hace 4 días". Más de un mes: probablemente ya cerrada
  var OLD_DAYS = 30;
  function publishedLabel(isoDay) {
    var match = /^(\\d{4})-(\\d{2})-(\\d{2})$/.exec(isoDay || '');
    if (!match) return null;
    var published = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
    var today = new Date();
    var days = Math.round((new Date(today.getFullYear(), today.getMonth(), today.getDate()) - published) / 864e5);
    var text = days <= 0 ? 'Publicada hoy' : days === 1 ? 'Publicada ayer' :
      days < 14 ? 'Publicada hace ' + days + ' días' : 'Publicada el ' + shortDate.format(published);
    return days > OLD_DAYS ? { text: text + ' · puede estar cerrada', old: true } : { text: text, old: false };
  }

  // ---- Render ----
  function renderStats() {
    var fresh = offers.filter(function (o) { return o.fechaGuardado === latestRun && !statusOf(o.id); }).length;
    var matching = offers.filter(function (o) { return o.encaje > 0 && !statusOf(o.id); }).length;
    var items = [
      [countView('pendientes'), 'pendientes'],
      [fresh, 'nuevas sin revisar', 'hot'],
      [matching, 'pendientes que encajan', 'ok'],
      [countView('aplicada'), 'aplicadas'],
    ];
    $('stats').replaceChildren.apply($('stats'), items.map(function (s) {
      var box = el('div', 'stat' + (s[2] ? ' ' + s[2] : ''));
      box.append(el('b', '', String(s[0])), el('span', '', s[1]));
      return box;
    }));
  }

  function toggleButton(className, label, pressed, onClick) {
    var b = el('button', className, label);
    b.type = 'button';
    b.setAttribute('aria-pressed', String(pressed));
    b.addEventListener('click', onClick);
    return b;
  }

  function renderViews() {
    $('views').replaceChildren.apply($('views'), VIEWS.map(function (v) {
      var b = toggleButton('view', v[1], filters.view === v[0], function () { filters.view = v[0]; filters.loc = ''; renderAll(); });
      b.append(el('small', '', String(countView(v[0]))));
      return b;
    }));
  }

  // Grupo de botones de filtro por un campo (ubicación, portal), con recuento según la pestaña actual
  function renderChipGroup(containerId, field, filterKey, allLabel, labelOf) {
    var counts = countBy(offers.filter(inView), field);
    if (filters[filterKey] && !counts[filters[filterKey]]) filters[filterKey] = '';
    var values = Object.keys(counts).sort(function (a, b) { return counts[b] - counts[a]; });
    var total = values.reduce(function (sum, k) { return sum + counts[k]; }, 0);
    $(containerId).replaceChildren.apply($(containerId), [''].concat(values).map(function (value) {
      var chip = toggleButton('chip', value ? labelOf(value) : allLabel, value === filters[filterKey], function () {
        filters[filterKey] = value;
        renderAll();
      });
      chip.append(el('small', '', String(value ? counts[value] : total)));
      return chip;
    }));
    return values.length;
  }

  function renderChips() {
    renderChipGroup('chips', 'ubicacion', 'loc', 'Todas', function (loc) { return loc; });
    var names = offers.reduce(function (acc, o) { acc[o.portal] = o.portalNombre || o.portal; return acc; }, {});
    var portals = renderChipGroup('portals', 'portal', 'portal', 'Todos los portales', function (p) { return names[p]; });
    $('portals').hidden = portals < 2;
  }

  function renderCompanies() {
    Object.keys(countBy(offers, 'empresa')).sort(function (a, b) { return a.localeCompare(b, 'es'); }).forEach(function (name) {
      var option = el('option', '', name);
      option.value = name;
      $('company').append(option);
    });
  }

  function changeStatus(o, estado) {
    var previous = statusOf(o.id);
    var next = previous === estado ? '' : estado;
    setStatus(o.id, next);
    var message = next === 'aplicada' ? 'Marcada como aplicada' : next === 'descartada' ? 'Oferta descartada' : 'Vuelve a pendientes';
    showToast(message + ': ' + o.titulo, function () { setStatus(o.id, previous); });
  }

  function jobItem(o) {
    var s = statusOf(o.id);
    var li = el('li', 'job' + (s ? ' is-' + s : ''));
    var a = el('a', 'job-link');
    a.href = ALLOWED_LINK.test(o.enlace) ? o.enlace : '#';
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    var title = el('div', 'title', o.titulo);
    if (s === 'aplicada') title.append(el('span', 'tag applied', 'Aplicada · ' + shortDate.format(new Date(statuses[o.id].fecha))));
    else if (!s && o.fechaGuardado === latestRun) title.append(el('span', 'tag new', 'Nueva'));
    (o.etiquetas || []).forEach(function (t) {
      title.append(el('span', 'tag ' + (t.tone === 'warn' ? 'warn' : 'good'), t.label));
    });
    var info = el('div', 'meta');
    info.append(el('span', 'company', o.empresa), el('span', 'loc', o.ubicacion));
    var published = publishedLabel(o.fechaPublicacion);
    if (published) info.append(el('span', 'published' + (published.old ? ' old' : ''), published.text));
    info.append(el('span', 'ext', (o.portalNombre || 'Ver oferta') + ' ↗'));
    a.append(title, info);

    var actions = el('div', 'actions');
    actions.append(
      toggleButton('act apply', s === 'aplicada' ? '✓ Aplicada' : '✓ Aplicar', s === 'aplicada', function () { changeStatus(o, 'aplicada'); }),
      toggleButton('act discard', s === 'descartada' ? '↺ Recuperar' : '✕ Descartar', s === 'descartada', function () { changeStatus(o, 'descartada'); })
    );
    li.append(a, actions);
    return li;
  }

  function renderList() {
    var list = $('list');
    var visible = offers.filter(matches).sort(byDayThenMatch);
    $('count').textContent = 'Mostrando ' + visible.length + ' de ' + countView(filters.view);
    if (!visible.length) {
      list.replaceChildren(el('p', 'empty', filters.view === 'pendientes' && !filters.q ? 'Todo revisado. Vuelve tras la próxima búsqueda.' : 'Ninguna oferta con estos filtros.'));
      return;
    }
    var groups = [];
    visible.forEach(function (o) {
      var key = dayKey(new Date(o.fechaGuardado));
      var last = groups[groups.length - 1];
      if (last && last.key === key) last.items.push(o);
      else groups.push({ key: key, iso: o.fechaGuardado, items: [o] });
    });
    list.replaceChildren.apply(list, groups.map(function (g) {
      var section = el('section', 'day');
      var label = dayLabel(g.iso);
      var h2 = el('h2', '', label[0]);
      h2.append(el('span', '', (label[1] ? label[1] + ' · ' : '') + g.items.length + ' ofertas'));
      var ol = el('ol', 'jobs');
      ol.append.apply(ol, g.items.map(jobItem));
      section.append(h2, ol);
      return section;
    }));
  }

  function renderAll() {
    renderStats();
    renderViews();
    renderChips();
    renderList();
    $('only-match-label').textContent = meta.matchLabel + ' (' + offers.filter(function (o) { return inView(o) && o.encaje > 0; }).length + ')';
    $('storage-warning').hidden = storageOk;
  }

  function showToast(message, onUndo) {
    var toast = $('toast');
    var undo = el('button', '', 'Deshacer');
    undo.type = 'button';
    undo.addEventListener('click', function () { hideToast(); onUndo(); });
    toast.replaceChildren(el('span', '', message), undo);
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(hideToast, TOAST_MS);
  }
  function hideToast() { $('toast').classList.remove('show'); }

  $('updated').textContent = 'Actualizado ' + new Intl.DateTimeFormat('es-ES', { dateStyle: 'long', timeStyle: 'short' }).format(new Date(meta.generatedAt));
  $('q').addEventListener('input', function (e) { filters.q = norm(e.target.value.trim()); renderList(); });
  $('company').addEventListener('change', function (e) { filters.company = e.target.value; renderList(); });
  $('only-match').checked = filters.onlyMatch;
  $('only-match').addEventListener('change', function (e) { filters.onlyMatch = e.target.checked; renderAll(); });
  document.addEventListener('keydown', function (e) {
    if (e.key === '/' && document.activeElement !== $('q')) { e.preventDefault(); $('q').focus(); }
    if (e.key === 'Escape' && document.activeElement === $('q')) { $('q').value = ''; filters.q = ''; renderList(); }
  });

  renderCompanies();
  renderAll();
})();
`;
