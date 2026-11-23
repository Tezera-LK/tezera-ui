// tezera wireframe history: reads versions.json (built by scripts/build-manifest.mjs)
// and renders an overview plus a per-version viewer. Routes live in the hash:
//   #/                         overview
//   #/<role>/<versionId>       a version
//   #/<role>/<versionId>/<n>   page n of a multi-page version
(function () {
  'use strict';

  const $ = (sel) => document.querySelector(sel);
  const main = $('#main');
  const sidebar = $('#sidebar');
  const scrim = $('#scrim');
  const menuBtn = $('#menu-btn');

  let data = null;
  const index = new Map(); // "<role>/<id>" -> { role, v, i }

  // ---------- helpers ----------
  function h(tag, attrs, ...children) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v == null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'html') el.innerHTML = v; // only used for static SVG icons below
      else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
      else el.setAttribute(k, v === true ? '' : v);
    }
    for (const c of children.flat(Infinity)) if (c != null && c !== false) el.append(c.nodeType ? c : String(c));
    return el;
  }
  const ICON = {
    chev: '<svg class="chev" viewBox="0 0 24 24"><path d="m9 6 6 6-6 6"/></svg>',
    left: '<svg viewBox="0 0 24 24"><path d="m15 6-6 6 6 6"/></svg>',
    right: '<svg viewBox="0 0 24 24"><path d="m9 6 6 6-6 6"/></svg>',
    down: '<svg viewBox="0 0 24 24"><path d="m6 9 6 6 6-6"/></svg>',
    ext: '<svg viewBox="0 0 24 24"><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/></svg>',
    dl: '<svg viewBox="0 0 24 24"><path d="M12 4v11m-5-5 5 5 5-5M5 20h14"/></svg>',
    plug: '<svg viewBox="0 0 24 24"><path d="M9 3v5M15 3v5M6 8h12v3a6 6 0 0 1-12 0V8ZM12 17v4"/></svg>',
    file: '<svg viewBox="0 0 24 24"><path d="M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8l-5-5Z M14 3v5h5"/></svg>',
  };
  const icon = (name) => h('span', { html: ICON[name], style: 'display:contents' });

  const fmtDate = (iso, opts) => new Date(iso + 'T00:00:00Z').toLocaleDateString('en-GB', Object.assign({ day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }, opts));
  const fmtSize = (b) => (b == null ? '' : b >= 1e6 ? (b / 1e6).toFixed(1) + ' MB' : Math.max(1, Math.round(b / 1e3)) + ' KB');
  const fidLabel = (v) => (v.fid === 'lo' ? 'Lo-fi' : 'Hi-fi');
  const kindLabel = { flow: 'Flow', site: 'Multi-page prototype', components: 'Component set', plugin: 'Figma plugin', download: 'Download' };
  const viewable = (v) => !!v.entry;
  const href = (role, v, page) => '#/' + role.id + '/' + encodeURIComponent(v.id) + (page ? '/' + page : '');
  const url = (path) => encodeURI(path);
  // Sidebar groups by role already, so drop a leading role word: "Attendee flow v4" -> "Flow v4".
  const shortLabel = (role, v) => {
    const s = v.label.replace(new RegExp('^' + role.label + '\\s+', 'i'), '');
    return s === v.label ? s : s.charAt(0).toUpperCase() + s.slice(1);
  };

  // ---------- theme ----------
  $('#theme-btn').addEventListener('click', () => {
    const root = document.documentElement;
    const dark = root.dataset.theme ? root.dataset.theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
    root.dataset.theme = dark ? 'light' : 'dark';
    try { localStorage.setItem('tz-theme', root.dataset.theme); } catch (e) {}
  });

  // ---------- drawer (narrow screens) ----------
  function setDrawer(open) {
    sidebar.classList.toggle('open', open);
    scrim.hidden = !open;
    menuBtn.setAttribute('aria-expanded', String(open));
    if (open) (sidebar.querySelector('[aria-current="page"]') || sidebar.querySelector('a')).focus();
  }
  menuBtn.addEventListener('click', () => setDrawer(!sidebar.classList.contains('open')));
  scrim.addEventListener('click', () => setDrawer(false));
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && sidebar.classList.contains('open')) { setDrawer(false); menuBtn.focus(); }
  });

  // ---------- sidebar ----------
  function renderNav() {
    const wrap = $('#nav-roles');
    wrap.replaceChildren();
    for (const role of data.roles) {
      const groups = data.fidelities.map((f) => ({ f, vs: role.versions.filter((v) => v.fid === f.id) })).filter((g) => g.vs.length);
      wrap.append(h('details', { class: 'role', open: true, 'data-state': 'open', 'data-role': role.id },
        h('summary', { onclick: (e) => { e.preventDefault(); toggleRole(e.currentTarget.parentElement); } },
          icon('chev'), role.label, h('span', { class: 'count num' }, role.versions.length)),
        h('div', { class: 'role-body' }, groups.map((g) => [
          h('p', { class: 'group-label' }, g.f.label),
          h('ul', { class: 'vlist' }, g.vs.map((v) => h('li', null,
            h('a', { class: 'vlink', href: href(role, v), 'data-key': role.id + '/' + v.id, title: v.label },
              h('span', { class: 'n num' }, String(v.num).padStart(2, '0')),
              h('span', { class: 't' }, v.kind === 'plugin' ? icon('plug') : null, shortLabel(role, v)),
              h('span', { class: 'd num' }, fmtDate(v.date, { year: undefined })))))),
        ]))));
    }
    const links = $('#links');
    links.replaceChildren(...data.links.map((l) =>
      h('a', { class: 'pill', href: l.url, target: '_blank', rel: 'noopener' }, icon('ext'), h('span', null, l.label))));
  }

  // Accordion for a role section: animates the body's height and opacity.
  // Interruptible: a click mid-animation reverses from the current height, not from the end state.
  const roleAnims = new WeakMap();
  const EASE_OUT = 'cubic-bezier(.23, 1, .32, 1)';
  function toggleRole(d) {
    const body = d.querySelector('.role-body');
    const running = roleAnims.get(d);
    const closing = running ? running.opening : d.open;
    d.dataset.state = closing ? 'closed' : 'open'; // chevron turns at once, in step with the body

    if (matchMedia('(prefers-reduced-motion: reduce)').matches) { d.open = !closing; return; }

    const cs = getComputedStyle(body);
    const from = { h: d.open ? body.getBoundingClientRect().height : 0, o: d.open ? Number(cs.opacity) : 0 };
    if (running) running.anim.cancel();
    if (!closing) d.open = true; // must be open to measure and to show the body while it grows
    const to = closing ? 0 : body.scrollHeight;

    const anim = body.animate(
      [
        { height: from.h + 'px', opacity: from.o, transform: 'translateY(' + (closing ? 0 : -4) + 'px)' },
        { height: to + 'px', opacity: closing ? 0 : 1, transform: 'translateY(' + (closing ? -4 : 0) + 'px)' },
      ],
      { duration: closing ? 200 : 260, easing: EASE_OUT });
    body.style.overflow = 'hidden';
    roleAnims.set(d, { anim, opening: !closing });
    anim.finished.then(() => {
      if (closing) d.open = false;
      body.style.overflow = '';
      roleAnims.delete(d);
    }, () => {}); // cancelled: the interrupting toggle takes over
  }

  function markCurrent(key) {
    document.querySelectorAll('.vlink[aria-current]').forEach((a) => a.removeAttribute('aria-current'));
    if (!key) { $('.nav-overview').setAttribute('aria-current', 'page'); return; }
    $('.nav-overview').removeAttribute('aria-current');
    const a = document.querySelector('.vlink[data-key="' + CSS.escape(key) + '"]');
    if (a) {
      a.setAttribute('aria-current', 'page');
      const d = a.closest('details');
      if (!d.open || roleAnims.has(d)) { roleAnims.get(d)?.anim.cancel(); roleAnims.delete(d); d.open = true; d.dataset.state = 'open'; }
      a.scrollIntoView({ block: 'nearest' });
    }
  }

  // ---------- overview ----------
  function renderOverview() {
    document.title = 'tezera wireframe history';
    const all = data.roles.flatMap((role) => role.versions.map((v) => ({ role, v })));
    const latest = all.reduce((m, x) => (x.v.date > m ? x.v.date : m), '');

    const cards = data.roles.map((role) => {
      const lo = role.versions.filter((v) => v.fid === 'lo').length;
      const hi = role.versions.length - lo;
      const last = [...role.versions].reverse().find(viewable) || role.versions[role.versions.length - 1];
      return h('article', { class: 'card' },
        h('h2', null, role.label),
        h('p', { class: 'meta num' }, [role.versions.length + ' versions', lo && lo + ' lo-fi', hi && hi + ' hi-fi'].filter(Boolean).join(' · ')),
        h('div', { class: 'bars', 'aria-hidden': 'true' }, role.versions.map((v) =>
          h('a', { class: v.fid + (v.kind === 'plugin' ? ' plugin' : ''), href: href(role, v), title: v.label + ' · ' + fmtDate(v.date), tabindex: '-1' }))),
        h('a', { class: 'latest', href: href(role, last) },
          h('small', null, 'Latest · ' + fmtDate(last.date)),
          h('span', null, last.label)));
    });

    const byDate = new Map();
    for (const x of all) (byDate.get(x.v.date) || byDate.set(x.v.date, []).get(x.v.date)).push(x);
    const days = [...byDate.keys()].sort().reverse().map((d) =>
      h('div', { class: 'day' },
        h('time', { datetime: d, class: 'num' }, fmtDate(d)),
        h('ul', null, byDate.get(d).map(({ role, v }) => h('li', null,
          h('a', { class: 'tl-item', href: href(role, v) },
            h('span', { class: 'chip ' + v.fid }, fidLabel(v)),
            h('span', { class: 'chip role' }, role.label),
            v.label))))));

    main.replaceChildren(h('div', { class: 'overview' },
      h('section', { class: 'hero' },
        h('h1', null, 'Every version of every ', h('em', null, 'flow'), '.'),
        h('p', null, 'Figma keeps no history of these wireframes, so this site does. Pick an account type on the left, then step through its lo-fi and hi-fi versions in date order.'),
        h('div', { class: 'stats num' },
          h('span', null, h('b', null, all.length), 'versions'),
          h('span', null, h('b', null, data.roles.length), 'account types'),
          h('span', null, h('b', null, fmtDate(latest)), 'last change'))),
      h('section', { 'aria-labelledby': 'roles-h' }, h('h2', { class: 'section-h', id: 'roles-h' }, 'Account types'), h('div', { class: 'cards' }, cards)),
      h('section', { 'aria-labelledby': 'tl-h' }, h('h2', { class: 'section-h', id: 'tl-h' }, 'Timeline'), h('div', { class: 'timeline' }, days))));
  }

  // ---------- viewer ----------
  let currentSrc = null;

  function renderVersion(role, v, i, pageIdx) {
    const prev = role.versions[i - 1];
    const next = role.versions[i + 1];
    const pages = v.pages || [];
    const page = pages[pageIdx] || null;
    const src = page ? page.file : v.entry;
    document.title = v.label + ' · ' + role.label + ' · tezera wireframe history';

    const stepBtn = (target, dir) => h('a', {
      class: 'icon-btn', role: 'button',
      href: target ? href(role, target) : null,
      'aria-disabled': target ? null : 'true',
      'aria-label': (dir === 'left' ? 'Previous' : 'Next') + ' version' + (target ? ': ' + target.label : ''),
      title: target ? target.label + ' (' + (dir === 'left' ? '←' : '→') + ')' : null,
      style: target ? null : 'opacity:.35;pointer-events:none',
    }, icon(dir));

    const controls = h('div', { class: 'controls' },
      h('div', { class: 'stepper' }, stepBtn(prev, 'left'), h('span', { class: 'pos num' }, (i + 1) + ' / ' + role.versions.length), stepBtn(next, 'right')),
      pages.length > 1 ? h('label', { class: 'select' },
        h('span', { class: 'sr-only' }, v.kind === 'components' ? 'Component' : 'Page'),
        h('select', { onchange: (e) => { location.hash = href(role, v, e.target.value); } },
          pages.map((p, n) => h('option', { value: n, selected: n === pageIdx }, p.label))),
        icon('down')) : null,
      src ? h('a', { class: 'pill', href: url(src), target: '_blank', rel: 'noopener' }, icon('ext'), h('span', null, 'Open in tab')) : null,
      v.download && v.kind !== 'plugin' ? h('a', { class: 'pill', href: url(v.download), download: '' }, icon('dl'), h('span', null, 'Download zip')) : null);

    const bar = h('div', { class: 'vbar' },
      h('div', { class: 'vtitle' },
        h('div', { class: 'crumbs' },
          h('span', null, role.label),
          h('span', { class: 'chip ' + v.fid }, fidLabel(v)),
          h('span', { class: 'chip' }, kindLabel[v.kind] || v.kind),
          h('span', { class: 'num' }, fmtDate(v.date)),
          v.size && src ? h('span', { class: 'num' }, fmtSize(v.size)) : null),
        h('h1', null, v.label)),
      controls);

    let body;
    if (src) {
      const loading = h('div', { class: 'loading', role: 'status' }, h('div', { class: 'spinner' }), 'Loading' + (v.size ? ' ' + fmtSize(v.size) : '') + '…');
      const frame = h('iframe', { title: v.label + (page ? ' – ' + page.label : ''), src: url(src) });
      frame.addEventListener('load', () => loading.classList.add('done'));
      body = h('div', { class: 'frame-wrap' }, frame, loading);
      currentSrc = src;
    } else {
      currentSrc = null;
      body = renderPlugin(v);
    }
    main.replaceChildren(h('div', { class: 'viewer' }, bar, body));
  }

  function renderPlugin(v) {
    const files = v.files || [];
    return h('section', { class: 'plugin-panel', 'aria-label': 'Plugin details' },
      h('p', null, 'A Figma development plugin that draws this version of the wireframes into a Figma file. Figma has no version history for it, so each export is kept here.'),
      h('dl', null,
        v.pluginName ? [h('dt', null, 'Plugin name'), h('dd', null, v.pluginName)] : null,
        h('dt', null, 'Exported'), h('dd', { class: 'num' }, fmtDate(v.date)),
        v.download ? [h('dt', null, 'Zip size'), h('dd', { class: 'num' }, fmtSize(v.size))] : null),
      h('div', { class: 'row' },
        v.download ? h('a', { class: 'pill primary', href: url(v.download), download: '' }, icon('dl'), 'Download zip') : null,
        files.map((f) => h('a', { class: 'pill', href: url(f), target: '_blank', rel: 'noopener' }, icon('file'), f.split('/').pop()))),
      h('div', null,
        h('h2', { class: 'section-h' }, 'Run it in Figma'),
        h('ol', null,
          h('li', null, v.download ? 'Download and unzip the plugin.' : 'Download code.js and manifest.json into one folder.'),
          h('li', null, 'In the Figma desktop app, open Plugins → Development → Import plugin from manifest…'),
          h('li', null, 'Pick manifest.json, then run the plugin from Plugins → Development.'))));
  }

  // ---------- routing ----------
  function route() {
    if (!data) return;
    const parts = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent);
    setDrawer(false);
    if (parts.length >= 2 && index.has(parts[0] + '/' + parts[1])) {
      const { role, v, i } = index.get(parts[0] + '/' + parts[1]);
      const pageIdx = Math.max(0, Math.min(Number(parts[2]) || 0, (v.pages || [1]).length - 1));
      const wanted = v.pages ? v.pages[pageIdx].file : v.entry;
      // Same version and page: keep the loaded iframe (big files).
      if (!(wanted && wanted === currentSrc && main.querySelector('iframe'))) renderVersion(role, v, i, pageIdx);
      markCurrent(parts[0] + '/' + parts[1]);
    } else {
      currentSrc = null;
      renderOverview();
      markCurrent(null);
      if (parts.length) history.replaceState(null, '', '#/');
    }
    main.scrollTop = 0;
  }
  window.addEventListener('hashchange', route);

  // ← / → step through versions when focus is not in a form control or the iframe.
  document.addEventListener('keydown', (e) => {
    if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    if (/^(INPUT|SELECT|TEXTAREA)$/.test(document.activeElement.tagName)) return;
    const btn = main.querySelectorAll('.stepper a')[e.key === 'ArrowLeft' ? 0 : 1];
    if (btn && btn.getAttribute('href')) { e.preventDefault(); location.hash = btn.getAttribute('href'); }
  });

  // ---------- boot ----------
  fetch('versions.json', { cache: 'no-cache' })
    .then((r) => { if (!r.ok) throw new Error(r.status + ' ' + r.statusText); return r.json(); })
    .then((json) => {
      data = json;
      for (const role of data.roles) role.versions.forEach((v, i) => index.set(role.id + '/' + v.id, { role, v, i }));
      renderNav();
      route();
    })
    .catch((err) => {
      $('#state').textContent = 'Could not load versions.json (' + err.message + '). Run "node scripts/build-manifest.mjs" first.';
    });
})();
