/* ==========================================================================
   Team rooms: one shared fund, traded by the whole team in real time.

   The host's browser runs the real Session. Everything that changes the fund
   goes into an ordered log (start, each order with its fill price or reject
   reason, skip-phase, end) and is broadcast with the host's clock about four
   times a second. Teammates build the same Session from the same scenario and
   replay the log at exactly the host's clock times, so prices, news, fills,
   breaches and scores come out identical. A teammate's order, pause, skip or
   end is sent to the host, which executes it and logs it for everyone.

   Transport: window.WDLive (js/sim/live-sync.js), free public MQTT brokers.
   If the host drops, any teammate can take over: they already hold the whole
   state, so they just start hosting from where the fund is.
   ========================================================================== */
const Room = (() => {
  const P = Session.prototype;
  const ME = Math.random().toString(36).slice(2, 10);
  let api = null, code = null, role = null, sess = null, ep = 0;
  let log = [], applied = 0, buf = {}, lastClock = 0, lastRepair = 0, clockT = 0, watchT = 0, peersN = 1;
  const offs = [];

  const newCode = () => String(100000 + Math.floor(Math.random() * 900000));
  const shareLink = () => location.href.split('#')[0] + '#/join/' + code;
  const send = (topic, data) => api && api.emit(topic, data);

  /* ---------------- host side ---------------- */
  function push(e) { log.push(e); send('L', { ep, n: log.length - 1, e }); }
  function wrapHost(s) {
    s.marketOrder = function (id, side, qty) {
      const nRej = this.rejects.length, el = this.elapsed;
      const t = P.marketOrder.call(this, id, side, qty);
      if (t) push({ k: 'o', el, id, side, qty: t.qty, t: { px: t.px, commission: t.commission, venue: t.venue }, pr: Object.assign({}, this.pressure) });
      else if (this.rejects.length > nRej) push({ k: 'o', el, id, side, qty: Math.floor(qty), rej: this.rejects[this.rejects.length - 1].reason });
      return t;
    };
    s.start = function () { if (this.started) return; P.start.call(this); push({ k: 'start', el: this.elapsed }); };
    s.skipPhase = function () { const el = this.elapsed, pi = this.phaseIdx, ok = P.skipPhase.call(this); if (ok) push({ k: 'skip', el, pi }); return ok; };
    s.finish = function (early = false) { const was = this.finished; P.finish.call(this, early); if (!was && early) push({ k: 'fin', el: this.elapsed }); };
  }
  function clockMsg() { return { ep, el: sess.elapsed, p: !!sess.paused, n: log.length, from: ME }; }
  function onRequest(r) {
    if (role !== 'host' || !sess || !r) return;
    if (r.k === 'o' && sess.m.byId[r.id] && (r.side === 1 || r.side === -1)) sess.marketOrder(r.id, r.side, +r.qty);
    else if (r.k === 'pause' && sess.cfg.mode !== 'exam') sess.pause(!!r.v);
    else if (r.k === 'skip' && sess.cfg.mode !== 'exam') sess.skipPhase();
    else if (r.k === 'fin') sess.finish(true);
  }
  function onHello(h) {
    if (role !== 'host' || !h) return;
    if (!sess) { send('W', { to: h.who }); return; }      // room is open, the host is still in the briefing
    const from = Math.max(0, Math.min(log.length, h.from | 0));
    send('H', { ep, to: h.who, from, cfg: cfgOf(sess), durs: sess.phases.map(p => p.dur), strategy: sess.strategy || null, log: log.slice(from), clock: clockMsg() });
  }
  function cfgOf(s) { const c = s.cfg; return { scenarioId: c.scenarioId || s.scn.id, mode: c.mode, quarterMin: c.quarterMin, breakMin: c.breakMin, buildMin: c.buildMin, variant: c.variant || 0 }; }
  function startClock() {
    clearInterval(clockT); let lastT = performance.now();
    clockT = setInterval(() => {
      const now = performance.now(), dt = now - lastT; lastT = now;
      if (role !== 'host' || !sess) return;
      // a hidden tab gets no animation frames, so keep the shared clock running from here (at 1x)
      if (document.hidden) P.advance.call(sess, Math.min(dt, 120000));
      send('C', clockMsg());
    }, 250);
  }

  /* ---------------- teammate side ---------------- */
  function wrapFollower(s) {
    s.advance = function () {};                       // the host's clock drives us
    s.start = function () {};                         // the host starts the year
    s.pause = function (v = true) { send('R', { k: 'pause', v }); };
    s.skipPhase = function () { send('R', { k: 'skip' }); return false; };
    s.finish = function (early = false) { if (early) send('R', { k: 'fin' }); };
    s.marketOrder = function (id, side, qty) { send('R', { k: 'o', id, side, qty: Math.floor(qty) }); return true; };
  }
  function unwrap(s) { ['advance', 'start', 'pause', 'skipPhase', 'finish', 'marketOrder'].forEach(k => delete s[k]); }
  function advTo(el) {
    if (!sess.started || sess.finished || !(el > sess.elapsed)) return;
    P.advance.call(sess, el - sess.elapsed, true);
    if (!sess.finished) sess.elapsed = el;
  }
  function apply(e) {
    const s = sess;
    advTo(e.el);
    if (e.k === 'start') P.start.call(s);
    else if (e.k === 'skip') { if (s.phaseIdx === e.pi) P.skipPhase.call(s); }   // already past it if the host's shortened phase length was preset
    else if (e.k === 'fin') P.finish.call(s, true);
    else if (e.k === 'o') {
      if (e.rej) s._reject(e.id, e.side, e.qty, e.rej);
      else {
        const pv = s.preview(e.id, e.side, e.qty, e.t.px);
        s._fill(e.id, e.side, e.qty, e.t.px, { venue: e.t.venue, commission: e.t.commission, newBreaches: pv.newBreaches || [] });
        s.pressure = Object.assign({}, e.pr || {});
      }
    }
    log.push(e); applied++;
  }
  function drain() { while (buf[applied]) { const e = buf[applied]; delete buf[applied]; apply(e); } }
  function repair() { const now = Date.now(); if (now - lastRepair < 1500) return; lastRepair = now; send('Hq', { who: ME, from: applied }); }
  function onLog(m) {
    if (role !== 'follower' || !sess || m.ep < ep) return;
    if (m.ep > ep) ep = m.ep;
    if (m.n < applied) return;
    buf[m.n] = m.e; drain();
    if (Object.keys(buf).length) repair();
  }
  function onClock(c) {
    if (c.from === ME) return;
    if (role === 'host') { if (c.ep > ep) demote(); return; }
    if (role !== 'follower' || !sess || c.ep < ep) return;
    ep = c.ep; lastClock = Date.now();
    if (c.n > applied) { repair(); return; }        // missing log entries: don't run the clock past them
    advTo(c.el); sess.paused = c.p;
  }
  function onHelloReply(h) {
    if (role !== 'follower' || h.to !== ME) return;
    if (!sess) {
      const s = new Session(h.cfg);
      if (h.strategy) s.strategy = h.strategy;
      if (h.durs) h.durs.forEach((d, i) => { if (s.phases[i]) s.phases[i].dur = d; });   // phases a host skipped in training
      wrapFollower(s); sess = s; ep = h.ep; log = []; applied = 0; buf = {};
      h.log.forEach(apply); onClock(h.clock);
      App.pending = null; App.session = s; lastClock = Date.now();
      if (location.hash.startsWith('#/floor')) route(); else location.hash = '#/floor';
      if (joinWait) { joinWait(true); joinWait = null; }
      return;
    }
    if (h.ep >= ep && h.from <= applied) { ep = h.ep; h.log.slice(applied - h.from).forEach(apply); drain(); onClock(h.clock); }
  }
  function demote() {
    // another browser took over as host while we were away: follow it from our current state
    clearInterval(clockT); unwrap(sess); wrapFollower(sess); role = 'follower'; repair();
    toast(`${icon('users', 16)} Another teammate is now hosting this room.`, '', 4000);
  }

  /* ---------------- connection ---------------- */
  async function connect(c) {
    if (!window.WDLive) throw new Error('The team sync library did not load. Check your connection and reload.');
    api = await WDLive.join('amsim-' + c);
    code = c;
    offs.push(api.on('L', ev => !ev.isMe && onLog(ev.data)));
    offs.push(api.on('C', ev => !ev.isMe && onClock(ev.data)));
    offs.push(api.on('R', ev => onRequest(ev.data)));
    offs.push(api.on('Hq', ev => !ev.isMe && onHello(ev.data)));
    offs.push(api.on('H', ev => !ev.isMe && onHelloReply(ev.data)));
    offs.push(api.on('W', ev => { if (!ev.isMe && ev.data && ev.data.to === ME && joinWait) { waiting = true; status(); } }));
    offs.push(api.onPeers(ch => { peersN = ch.peers.length; label(); status(); }));
    clearInterval(watchT); watchT = setInterval(watch, 1000);
  }
  function watch() {
    if (!api) return;
    if (sess && App.session !== sess) { leave(); return; }      // the year ended (or a new run started)
    if (role === 'host' && !sess && !App.pending) { leave(); return; }   // host went back without starting
    label();
  }
  function hostOffline() { return role === 'follower' && sess && sess.started && !sess.finished && Date.now() - lastClock > 8000; }

  let joinWait = null, waiting = false, statusFn = null;
  function status() { if (statusFn) statusFn(waiting ? `Connected to room ${code} (${peersN} online). Waiting for the host to finish the briefing; the trading floor opens here automatically.` : 'Connecting to the room…'); }
  async function prepare() {
    if (api && role === 'host' && !sess) return code;      // already open from the Lobby
    if (api) leave();
    await connect(newCode()); role = 'host'; sess = null; label(); return code;
  }
  async function host(s) {
    if (api && !(role === 'host' && !sess)) return;
    if (s.R.rfq) { toast(`${icon('info', 16)} Team rooms support the AmplifyME AM format only.`, 'warn', 4000); if (api) leave(); return; }
    if (!api) await connect(newCode());
    role = 'host'; sess = s; ep = Date.now(); log = [];
    if (s.started) log.push({ k: 'start', el: 0 });      // hosting mid-run: teammates catch up from the trade list below
    for (const t of s.trades) log.push({ k: 'o', el: t.real, id: t.asset, side: t.side, qty: t.qty, t: { px: t.px, commission: t.commission, venue: t.venue }, pr: {} });
    wrapHost(s); startClock(); label();
  }
  function join(c) {
    return new Promise(async (res, rej) => {
      try { await connect(c); } catch (e) { rej(e); return; }
      role = 'follower'; sess = null; ep = 0; joinWait = res; waiting = false;
      const ask = () => { if (joinWait) send('Hq', { who: ME, from: 0 }); };
      ask(); const it = setInterval(ask, 2000);
      const to = setInterval(() => { if (!joinWait) { clearInterval(it); clearInterval(to); } }, 1000);
      setTimeout(() => { if (joinWait && waiting) return; clearInterval(it); if (joinWait) { joinWait = null; leave(); rej(new Error(`No host answered in room ${c}. Check the code, and that the host has the trading floor open.`)); } }, 15000);
    });
  }
  function takeover() {
    if (!hostOffline()) return;
    unwrap(sess); role = 'host'; ep = Date.now(); wrapHost(sess); startClock(); label();
    toast(`${icon('users', 16)} You're now hosting room ${code}. The clock runs from your browser.`, 'ok', 5000);
  }
  function leave() {
    clearInterval(clockT); clearInterval(watchT);
    offs.splice(0).forEach(f => { try { f(); } catch (e) {} });
    if (sess && sess === App.session && role === 'follower' && !sess.finished) {
      // keep playing solo from the same state
      unwrap(sess);
    } else if (sess && role === 'host') unwrap(sess);
    if (api) api.leave();
    api = null; code = null; role = null; sess = null; log = []; applied = 0; buf = {}; peersN = 1;
    label();
  }

  /* ---------------- UI ---------------- */
  function label() {
    const bar = document.getElementById('room-bar');
    if (bar) bar.innerHTML = api ? `${icon('users', 16)} <span><b>Team room ${code}</b> · ${peersN} online. Send teammates the code or link now; they'll wait here and join the trading floor with you.</span><input class="input mono" readonly value="${esc(shareLink())}" onclick="this.select()"><b class="mono rb-code">${code}</b>` : '';
    if (bar) bar.hidden = !api;
    const b = document.getElementById('t-room'); if (!b) return;
    const txt = !api ? 'Team room' : hostOffline() ? `Room ${code} · host offline` : `Room ${code} · ${peersN} online`;
    const html = `${icon('users', 15)} ${txt}`;
    if (b.dataset.t !== txt) { b.dataset.t = txt; b.innerHTML = html; }
    b.classList.toggle('room-on', !!api); b.classList.toggle('room-warn', hostOffline());
  }
  function panel() {
    const s = App.session;
    if (!api) {
      const m = openModal(`<h2>Team room</h2>
        <p class="muted">Run this fund together. Your browser hosts the clock; teammates open your link (or enter the code on the Lobby) and see the same prices, news and portfolio. Anyone can trade, and every order goes into the one shared fund.</p>
        <p class="faint sm">Uses free public sync servers, so no account is needed. Room codes are random, and the room carries only game data. Some school or office Wi-Fi blocks it; a phone hotspot usually works.</p>
        <div class="actions"><button class="btn btn-outline" id="rm-x">Cancel</button><button class="btn btn-primary" id="rm-host">${icon('users', 15)} Host this run</button></div>`);
      m.querySelector('#rm-x').onclick = closeModal;
      m.querySelector('#rm-host').onclick = async () => {
        const b = m.querySelector('#rm-host'); b.disabled = true; b.textContent = 'Connecting…';
        try { await host(s); closeModal(); panel(); }
        catch (e) { b.disabled = false; b.textContent = 'Try again'; toast(`${icon('xCircle', 16)} ${esc(e.message || 'Could not reach the sync service.')}`, 'bad', 6000); }
      };
      return;
    }
    const m = openModal(`<h2>Team room ${code}</h2>
      <p class="muted">${role === 'host' ? 'You are hosting. Keep this tab open: the clock runs from your browser.' : 'You are in a teammate\'s room. Your orders go to the shared fund.'} ${peersN} ${peersN === 1 ? 'person' : 'people'} online.</p>
      <div class="set-row"><span class="grow">Room code</span><b class="mono" style="font-size:22px;letter-spacing:.12em">${code}</b></div>
      <div class="set-row"><input class="input grow" id="rm-link" readonly value="${esc(shareLink())}"><button class="btn btn-outline sm" id="rm-copy">Copy link</button></div>
      ${hostOffline() ? '<p class="sm" style="color:var(--warn)">The host has gone quiet. Take over to keep the year running from your browser.</p>' : ''}
      <div class="actions">${hostOffline() ? '<button class="btn btn-primary" id="rm-take">Take over as host</button>' : ''}<button class="btn btn-outline" id="rm-leave">Leave room</button><button class="btn btn-primary" id="rm-x">Close</button></div>`);
    m.querySelector('#rm-x').onclick = closeModal;
    m.querySelector('#rm-copy').onclick = () => { const i = m.querySelector('#rm-link'); i.select(); (navigator.clipboard ? navigator.clipboard.writeText(i.value) : Promise.reject()).then(() => toast(`${icon('check', 16)} Link copied`, 'ok', 1500)).catch(() => document.execCommand('copy')); };
    m.querySelector('#rm-leave').onclick = async () => { closeModal(); if (await confirmBox('Leave the room?', role === 'host' ? 'Teammates will see the host go offline and can take over.' : 'You will keep playing alone from the current state.', 'Leave', 'btn-sell')) leave(); };
    const tk = m.querySelector('#rm-take'); if (tk) tk.onclick = () => { takeover(); closeModal(); };
  }

  /* Lobby / link entry point: #/join or #/join/123456 */
  const page = {
    render(v, parts) {
      const pre = (parts && parts[0] || '').replace(/\D/g, '').slice(0, 6);
      v.innerHTML = `<div class="page narrow"><header class="res-head"><div><div class="eyebrow">Team room</div><h1>Join your team's fund</h1><p class="muted">Enter the 6-digit code from the host's trading floor (Team room button). You'll see the same prices, news and portfolio, and can trade the shared fund.</p></div></header>
        <section class="card" style="padding:20px;max-width:520px"><div class="row" style="gap:10px"><input class="input grow mono" id="jn-code" inputmode="numeric" maxlength="6" placeholder="123456" value="${pre}" style="font-size:20px;letter-spacing:.15em"><button class="btn btn-primary" id="jn-go">${icon('users', 15)} Join</button></div><p class="sm" id="jn-msg" style="margin-top:10px"></p></section></div>`;
      const go = async () => {
        const c = $('#jn-code').value.replace(/\D/g, '');
        if (c.length !== 6) { $('#jn-msg').textContent = 'Room codes are 6 digits.'; return; }
        if (api) leave();
        $('#jn-go').disabled = true; $('#jn-msg').textContent = 'Connecting to the room…';
        try { await join(c); } catch (e) { $('#jn-go').disabled = false; $('#jn-msg').textContent = e.message || 'Could not join.'; }
      };
      statusFn = t => { const el = document.getElementById('jn-msg'); if (el) el.textContent = t; };
      $('#jn-go').onclick = go; $('#jn-code').onkeydown = e => { if (e.key === 'Enter') go(); };
      if (pre.length === 6) go();
    },
    destroy() {},
  };

  return { prepare, host, join, leave, takeover, panel, label, page, get active() { return !!api; }, get role() { return role; }, get code() { return code; } };
})();
