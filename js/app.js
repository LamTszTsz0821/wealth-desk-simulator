/* ==========================================================================
   AM Sim Trainer: app shell, router, settings, shared state
   Routes:  #/            Lobby (pick fund, scenario, exam/training, duration)
            #/brief       Pre-trade briefing: mandate, research, portfolio builder
            #/floor       Live trading terminal
            #/results/:id Debrief / scorecard
            #/history     Progress across attempts
            #/guide       How the real sim works, scoring, playbook, cheat sheet
   ========================================================================== */
const Pages = {};
const App = {
  pending: null,       // config chosen in the lobby, carried into the briefing
  session: null,       // live Session
  current: null,       // current page module
  results() { return Store.get('results', []); },
  saveResult(r) {
    const all = this.results(); all.unshift(r);
    // keep full detail for the 12 most recent, summaries for the rest
    all.forEach((x, i) => { if (i >= 12) { delete x.review; delete x.trades; delete x.series; if (x.peers) x.peers.overall = []; x.slim = true; } });
    Store.set('results', all.slice(0, 60));
  },
  result(id) { return this.results().find(r => r.id === id); },
};

const NAV = [
  { r: '/', ic: 'grid', t: 'Lobby' },
  { r: '/brief', ic: 'fileText', t: 'Briefing', need: () => App.pending || App.session },
  { r: '/floor', ic: 'activity', t: 'Trading floor', need: () => App.session, live: () => App.session && App.session.started && !App.session.finished },
  { r: '/results', ic: 'award', t: 'Debrief', need: () => App.results().length },
  { r: '/history', ic: 'lineChart', t: 'Progress' },
  { r: '/guide', ic: 'bookOpen', t: 'Guide & playbook' },
];

function shell() {
  $('#app').innerHTML = `
  <div class="shell" id="shell">
    <aside class="sidebar" aria-label="Navigation">
      <div class="sb-top"><div class="brand">${logo(26)}<div class="hide-r">AM Sim Trainer<small>AmplifyME AM practice · v3</small></div></div></div>
      <nav class="sb-nav" id="sb-nav"></nav>
      <div class="sb-spacer"></div>
      <div class="sb-note hide-r">Practice tool modelled on the AmplifyME Asset Management Simulation course. Not affiliated with AmplifyME. Prices are reconstructions.</div>
      <div class="sb-foot">
        <button class="sb-item" id="sb-sound" title="Sound">${icon(Sound.on() ? 'volume' : 'volumeOff', 19)}<span class="hide-r">Sound ${Sound.on() ? 'on' : 'off'}</span></button>
        <button class="sb-item" id="sb-settings" title="Settings">${icon('settings', 19)}<span class="hide-r">Settings</span></button>
      </div>
    </aside>
    <main class="main" id="main"><div class="view" id="view"></div></main>
  </div>
  <div class="scrim" id="scrim"></div>
  <div class="modal" id="modal" role="dialog" aria-modal="true"></div>
  <div class="overlay" id="overlay"><div class="ov-card" id="ov-card"></div></div>`;
  $('#sb-settings').onclick = openSettings;
  $('#sb-sound').onclick = () => { Sound.set(!Sound.on()); Sound.unlock(); refreshNav(); if (App.session && !App.session.finished) Sound.ambient(true); };
  $('#scrim').onclick = closeModal;
}

function refreshNav() {
  const r = location.hash.slice(1) || '/';
  $('#sb-nav').innerHTML = NAV.map(n => {
    const on = n.r === '/' ? r === '/' : r.startsWith(n.r);
    const dis = n.need && !n.need();
    const href = n.r === '/results' ? '#/results/' + ((App.results()[0] || {}).id || '') : '#' + n.r;
    return `<a class="sb-item ${on ? 'active' : ''} ${dis ? 'disabled' : ''}" href="${href}" title="${n.t}">${icon(n.ic, 19)}<span class="hide-r">${n.t}</span>${n.live && n.live() ? '<span class="live" aria-label="live"></span>' : ''}</a>`;
  }).join('');
  const sb = $('#sb-sound'); if (sb) sb.innerHTML = `${icon(Sound.on() ? 'volume' : 'volumeOff', 19)}<span class="hide-r">Sound ${Sound.on() ? 'on' : 'off'}</span>`;
}

/* ---------- modal helpers ---------- */
function openModal(html, cls = '') {
  const m = $('#modal'); m.className = 'modal ' + cls; m.innerHTML = html;
  requestAnimationFrame(() => { m.classList.add('show'); $('#scrim').classList.add('show'); const f = m.querySelector('[autofocus]') || m.querySelector('button, input'); if (f) f.focus(); });
  return m;
}
function closeModal() { $('#modal').classList.remove('show'); $('#scrim').classList.remove('show'); }
function confirmBox(title, body, okLabel = 'Confirm', okCls = 'btn-primary') {
  return new Promise(res => {
    const m = openModal(`<h2>${title}</h2><div class="muted">${body}</div><div class="actions"><button class="btn btn-outline" data-a="0">Cancel</button><button class="btn ${okCls}" data-a="1" autofocus>${okLabel}</button></div>`);
    m.querySelectorAll('[data-a]').forEach(b => (b.onclick = () => { closeModal(); res(b.dataset.a === '1'); }));
    m.onkeydown = e => { if (e.key === 'Escape') { closeModal(); res(false); } };
  });
}

function openSettings() {
  const th = IrisTheme.get(), wall = IrisTheme.wallpaper();
  const m = openModal(`
    <h2>Settings</h2>
    <div class="set-sec"><div class="eyebrow">Appearance</div>
      <div class="row" style="gap:14px;margin-top:10px">
        <button class="mode-card ${th === 'amplify' ? 'on' : ''}" data-theme="amplify"><div class="pv amplify"><div class="s"></div><div class="m"></div></div>AmplifyME</button>
        <button class="mode-card ${th === 'glass' ? 'on' : ''}" data-theme="glass"><div class="pv glass"><div class="s"></div><div class="m"></div></div>Liquid Glass</button>
        <button class="mode-card ${th === 'light' ? 'on' : ''}" data-theme="light"><div class="pv light"><div class="s"></div><div class="m"></div></div>Light</button>
      </div>
      <div class="row" style="margin-top:14px"><span class="muted grow">Wallpaper</span><div class="wall-pick">${Object.keys(IrisTheme.WALLPAPERS).map(k => `<button data-wall="${k}" class="${k === wall ? 'on' : ''}" title="${IrisTheme.WALLPAPERS[k].name}" style="background:${IrisTheme.preview(k)}"></button>`).join('')}</div></div>
    </div>
    <div class="set-sec"><div class="eyebrow">Sound</div>
      <label class="set-row"><span class="grow">Alerts (breaking news, fills, rejects)</span><button class="toggle ${Sound.on() ? 'on' : ''}" data-tg="sound"></button></label>
      <label class="set-row"><span class="grow">Trading-floor ambience during the sim</span><button class="toggle ${Store.get('ambient', false) ? 'on' : ''}" data-tg="ambient"></button></label>
    </div>
    <div class="set-sec"><div class="eyebrow">Accessibility</div>
      <label class="set-row"><span class="grow">Reduce motion</span><button class="toggle ${Store.get('reduceMotion', false) ? 'on' : ''}" data-tg="rm"></button></label>
    </div>
    <div class="set-sec"><div class="eyebrow">Data</div>
      <div class="set-row"><span class="grow muted">${App.results().length} saved attempts (stored in this browser only)</span><button class="btn btn-danger sm" id="clr">Clear history</button></div>
    </div>
    <div class="actions"><button class="btn btn-primary" id="done">Done</button></div>`);
  m.querySelectorAll('[data-theme]').forEach(b => (b.onclick = () => { IrisTheme.set(b.dataset.theme); openSettings(); }));
  m.querySelectorAll('[data-wall]').forEach(b => (b.onclick = () => { IrisTheme.setWallpaper(b.dataset.wall); m.querySelectorAll('[data-wall]').forEach(x => x.classList.toggle('on', x === b)); }));
  m.querySelectorAll('[data-tg]').forEach(b => (b.onclick = () => {
    const on = !b.classList.contains('on'); b.classList.toggle('on', on);
    if (b.dataset.tg === 'sound') { Sound.set(on); Sound.unlock(); refreshNav(); }
    if (b.dataset.tg === 'ambient') Sound.setAmbient(on && App.session && !App.session.finished);
    if (b.dataset.tg === 'ambient') Store.set('ambient', on);
    if (b.dataset.tg === 'rm') { Store.set('reduceMotion', on); document.documentElement.classList.toggle('reduce-motion', on); }
  }));
  $('#clr').onclick = async () => { closeModal(); if (await confirmBox('Clear history?', 'This deletes every saved attempt and score from this browser.', 'Delete all', 'btn-sell')) { Store.del('results'); refreshNav(); route(); } };
  $('#done').onclick = closeModal;
}

/* ---------- router ---------- */
function route() {
  const h = (location.hash.slice(1) || '/').split('?')[0];
  const parts = h.split('/').filter(Boolean);
  const name = parts[0] || 'home';
  const map = { home: Pages.home, brief: Pages.brief, floor: Pages.floor, results: Pages.results, history: Pages.history, guide: Pages.guide };
  let page = map[name] || Pages.home;
  if (name === 'brief' && !App.pending) page = Pages.home;
  if (name === 'floor' && !App.session) page = App.pending ? Pages.brief : Pages.home;
  if (App.current && App.current.destroy) App.current.destroy();
  App.current = page;
  const shellEl = $('#shell'); shellEl.classList.toggle('rail', page === Pages.floor);
  $('#main').classList.toggle('dense', page === Pages.floor);
  const v = $('#view'); v.className = 'view view-enter'; v.scrollTop = 0;
  page.render(v, parts.slice(1));
  setTimeout(() => v.classList.remove('view-enter'), 450);
  refreshNav();
  if (window.IrisTheme) setTimeout(() => IrisTheme.refresh(), 320);
}

addEventListener('hashchange', route);
addEventListener('beforeunload', e => { if (App.session && App.session.started && !App.session.finished) { e.preventDefault(); e.returnValue = ''; } });
addEventListener('DOMContentLoaded', () => {
  document.documentElement.classList.toggle('reduce-motion', Store.get('reduceMotion', false));
  shell(); route();
  document.addEventListener('pointerdown', () => Sound.unlock(), { once: true });
});

const BLOOM = '<div class="bloom" aria-hidden="true"><span><i></i></span><span style="--r:60deg"><i></i></span><span style="--r:120deg"><i></i></span></div>';

/* shared: sliding-pill segmented control (motion ref B1) */
function seg(id, opts, val, cls = '') {
  return `<div class="seg ${cls}" id="${id}" role="tablist">${opts.map(([v, l]) => `<button role="tab" data-v="${v}" class="${String(v) === String(val) ? 'on' : ''}" aria-selected="${String(v) === String(val)}">${l}</button>`).join('')}<span class="pill"></span></div>`;
}
function segWire(el, onChange) {
  const pill = el.querySelector('.pill');
  const place = () => { const b = el.querySelector('button.on'); if (!b) return; pill.style.width = b.offsetWidth + 'px'; pill.style.transform = `translateX(${b.offsetLeft}px)`; if (el.classList.contains('buysell')) pill.className = 'pill ' + (b.dataset.v === '1' ? 'b' : 's'); };
  el.querySelectorAll('button').forEach(b => (b.onclick = () => { el.querySelectorAll('button').forEach(x => { x.classList.toggle('on', x === b); x.setAttribute('aria-selected', x === b); }); place(); onChange && onChange(b.dataset.v); }));
  requestAnimationFrame(place);
  el.set = v => { const b = el.querySelector(`button[data-v="${v}"]`); if (b && !b.classList.contains('on')) { el.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b)); place(); } };
  el.place = place;
  return el;
}
