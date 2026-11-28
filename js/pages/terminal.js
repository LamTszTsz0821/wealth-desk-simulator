/* ==========================================================================
   Trading floor: the live terminal (AmplifyME AM Simulation structure)
   Phases: portfolio construction (start in cash, prices frozen) → Q1 live →
   rebalancing break (prices frozen) → Q2 → … → Q4.
   Layout (as described in the AmplifyME course, v3):
            top account bar (NAV · P&L · Fund Weighting · phase/timer · rules)
            markets (Equity/Bond/FX/Commodity tabs) | news feed | positions (+ strategy/risk tabs)
            order ticket                            | price chart with benchmark line
   The clock runs in a module-level loop, so it keeps going if you open the
   Guide mid-round (as in the real event). The page only renders.
   ========================================================================== */
Pages.floor = (() => {
  let s = null, v = null, mounted = false, raf = 0, last = 0, speed = 1, lastUi = 0;
  let sel = null, side = 1, chartMode = 'asset', bookTab = 'pos', newsFilter = 'all', hoverX = null, mktTab = null;
  let peers = null, unread = 0, flashT = 0, lastPx = {}, wired = null;
  const exam = () => s.cfg.mode === 'exam';
  const frozen = () => s.phase.kind !== 'quarter';

  /* ---------------- loop (module-level) ---------------- */
  function loop(now) {
    raf = requestAnimationFrame(loop);
    if (!s) return;
    const dt = last ? Math.min(now - last, 5000) : 0; last = now;
    s.advance(dt * (exam() ? 1 : speed));
    if (mounted && now - lastUi > 120) { lastUi = now; ui(); }
  }
  function ensureLoop() { if (!raf) { last = 0; raf = requestAnimationFrame(loop); } }

  function wire(sess) {
    if (wired === sess) return; wired = sess; sess.listeners = {};
    sess.on('news', e => { unread++; if (mounted) { addNews(e, true); flash(e); } Sound.news(exam() ? 2 : Math.max(1, e.sev)); });
    sess.on('fill', t => {
      Sound.fill();
      const a = sess.m.byId[t.asset];
      toast(`${icon('checkCircle', 16)} <span><b>${t.side > 0 ? 'Bought' : 'Sold'} ${Fmt.int(t.qty)} ${a.tk}</b> @ ${Fmt.num(t.px, a.dp)} · ${Fmt.compact(t.notional)}${t.venue === 'RFQ' ? ' · ' + esc(t.bank) : ''} · impact ${t.costBps.toFixed(1)}bp</span>`, 'ok', 3000);
      if (mounted) { renderBook(); ticketInfo(); }
    });
    sess.on('reject', r => { Sound.reject(); toast(`${icon('xCircle', 16)} <span><b>Order rejected.</b> ${esc(r.reason)}</span>`, 'bad', 5000); if (mounted) { const t = $('#tk-card'); t && (t.classList.remove('shake'), void t.offsetWidth, t.classList.add('shake')); } });
    sess.on('fat', f => { if (mounted) { const el = $('#t-ff'); el && (el.classList.remove('bump'), void el.offsetWidth, el.classList.add('bump')); } if (f.kind !== 'reject') toast(`${icon('alert', 16)} <span><b>Order error.</b> ${esc(f.text)}</span>`, 'warn', 5000); });
    sess.on('breach', b => { Sound.breach(); toast(`${icon('alert', 16)} <span><b>Rule breach:</b> ${esc(b.label)} is ${b.dir} its limit. Fix it before the next close.</span>`, 'bad', 5000); });
    sess.on('stop', e => { Sound.breach(); toast(`${icon('shield', 16)} <span><b>Stop-loss breach:</b> your ${e.tk} position is down ${Fmt.compact(e.maxLoss)}, more than the ${Fmt.compact(sess.R.maxTradeLossUsd)} limit. Cut it.</span>`, 'bad', 6000); });
    sess.on('stopWarn', e => { if (!exam()) toast(`${icon('shield', 16)} <span><b>${e.tk} is down ${Fmt.compact(e.loss)}</b>, close to the ${Fmt.compact(sess.R.maxTradeLossUsd)} stop-loss limit.</span>`, 'warn', 5000); });
    sess.on('breakEnding', W => {
      if (exam()) return;
      const bad = sess.checks().filter(c => !c.ok);
      if (W.invested < sess.R.minInvested) toast(`${icon('clock', 16)} <span><b>Quarter starts soon and you're only ${Fmt.pct(W.invested, 1)} invested.</b> The rule is at least ${Fmt.pct(sess.R.minInvested, 0)}.</span>`, 'warn', 6000);
      if (bad.length) toast(`${icon('clock', 16)} <span><b>Quarter starts soon</b> with ${bad.length} rule breach${bad.length > 1 ? 'es' : ''}: ${bad.map(b => esc(b.label)).join(', ')}.</span>`, 'warn', 6000);
    });
    sess.on('appetite', r => { Sound.breach(); toast(`${icon('alert', 16)} <span><b>Risk appetite breach:</b> Q${r.q} started with only ${Fmt.pct(r.invested, 1)} invested (minimum ${Fmt.pct(sess.R.minInvested, 0)}).</span>`, 'bad', 7000); });
    sess.on('quarter', q => toast(`${icon('flag', 16)} <span><b>Q${q.q} closed.</b> Fund ${Fmt.pctS(q.ret)} vs benchmark ${Fmt.pctS(q.bench)} · year to date ${Fmt.pp(q.ytd - q.benchYtd, 2)} relative</span>`, q.ret >= q.bench ? 'ok' : '', 6000));
    sess.on('phase', ph => {
      if (!mounted) return;
      Sound.news(2);
      if (ph.kind === 'break') { banner('BREAK', `Q${ph.after} closed: rebalancing break. Prices are frozen for ${Fmt.clock(ph.dur / (exam() ? 1 : speed))}. Bring your weights back to your strategy.`, 'phase'); if (!exam()) { bookTab = 'strat'; $('#bk-tab').set('strat'); renderBook(); } }
      if (ph.kind === 'quarter') banner('LIVE', `Q${ph.q} is live. ${ph.q === 1 ? 'The market is open.' : 'Prices are moving again.'}`, 'live');
      ui(true);
    });
    sess.on('rfq', () => mounted && renderRfq());
    sess.on('end', onEnd);
  }

  /* ---------------- render ---------------- */
  function render(view) {
    v = view; s = App.session; mounted = true; wire(s);
    sel = sel && s.m.byId[sel] ? sel : s.m.assets[0].id;
    mktTab = s.m.byId[sel].cls;
    const m = s.m, F = s.fund;
    const groups = F.classOrder.map(k => [k, m.assets.filter(a => a.cls === k)]).filter(([, l]) => l.length);
    let ki = 0;
    v.innerHTML = `
    <div class="term ${exam() ? 'exam' : 'training'}">
      <header class="term-top">
        <div class="tt-phase" id="t-phase"><span class="ph-tag" id="t-phtag">BUILD</span><div><b id="t-phlabel">Portfolio construction</b><div class="faint xs" id="t-phsub">—</div></div><b class="mono ph-left" id="t-left">--:--</b></div>
        <div class="tt-clock">
          <div class="row" style="gap:8px"><b class="tt-date" id="t-date">—</b><span class="tag grey" id="t-q">Q1</span></div>
          <div class="tt-prog"><i id="t-prog"></i>${Array.from({ length: s.nQ - 1 }, (_, i) => `<span style="left:${((i + 1) / s.nQ) * 100}%"></span>`).join('')}</div>
        </div>
        <div class="tt-stats">
          <div class="st"><span>Fund NAV</span><b class="mono" id="t-nav">—</b></div>
          <div class="st"><span>P&amp;L</span><b class="mono" id="t-pnl">—</b></div>
          <div class="st"><span>vs Benchmark</span><b class="mono" id="t-ex">—</b></div>
          <div class="st gauge" id="t-inv" title="At least ${F.rules.minInvested * 100}% invested at every quarter start"><span>Invested ≥${F.rules.minInvested * 100}%</span><b class="mono" id="t-invv">—</b></div>
          <button class="st lim" id="t-lim" title="Rule status"><span>Rules</span><b id="t-limv">OK</b></button>
          <button class="st lim" id="t-stop" title="Largest loss on any position vs the ${Fmt.compact(F.rules.maxTradeLossUsd)} stop-loss"><span>Stop-loss</span><b class="mono" id="t-stopv">OK</b></button>
          <div class="st" id="t-ff" title="Rejected orders, limit-breaking trades, quick reversals"><span>Order errors</span><b class="mono" id="t-ffv">0</b></div>
        </div>
        <div class="tt-ctl">
          <button class="btn btn-outline sm" id="t-room" title="Trade this fund together with your team">${icon('users', 15)} Team room</button>
          <button class="btn btn-outline sm" id="t-fw" title="Fund Weighting (W)">${icon('sliders', 15)} Fund Weighting</button>
          ${exam() ? '' : `<button class="btn btn-primary sm" id="t-next" title="End this phase now (training only)" hidden>${icon('play', 14)} <span id="t-next-l">Start Q1</span></button><button class="icon-btn boxed" id="t-pause" title="Pause (Space)">${icon('pause', 17)}</button>${seg('t-speed', [[0.5, '½×'], [1, '1×'], [2, '2×'], [4, '4×']], speed)}`}
          <button class="icon-btn boxed" id="t-sound" title="Sound">${icon(Sound.on() ? 'volume' : 'volumeOff', 17)}</button>
          <button class="btn btn-outline sm" id="t-end">${icon('flag', 15)} End</button>
        </div>
      </header>
      <div class="term-grid">
        <section class="panel p-watch">
          <div class="p-h" title="Markets"><b class="mk-title ${groups.length > 1 ? 'tabbed' : ''}">Markets</b>${groups.length > 1 ? seg('w-tab', groups.map(([k]) => [k, F.classes[k]]), mktTab) : '<span class="faint xs">chg since start · weight vs range</span>'}</div>
          <div class="watch" id="watch">${groups.map(([k, list]) => `<div class="w-group" data-grp="${k}" ${groups.length > 1 && k !== mktTab ? 'hidden' : ''}>` + list.map(a => { ki++; return `
            <button class="w-row ${a.id === sel ? 'sel' : ''}" data-asset="${a.id}">
              <div class="w-l"><span class="w-k">${ki <= 10 ? ki % 10 : ''}</span><div><b>${a.tk}</b><div class="faint xs">${a.name}</div></div></div>
              <canvas class="w-spark" data-spark="${a.id}"></canvas>
              <div class="w-r"><b class="mono" data-px="${a.id}">—</b><span class="mono xs" data-chg="${a.id}">—</span></div>
              <div class="w-wt"><span class="wbar"><i class="band" data-band="${a.id}"></i><i class="bm" data-bm="${a.id}"></i><i class="me" data-me="${a.id}"></i></span><span class="mono xs" data-wt="${a.id}"></span></div>
            </button>`; }).join('') + '</div>').join('')}
            ${s.scn.research && s.scn.research.companies ? `<div class="w-views"><div class="eyebrow">Research views (day 0)</div>${m.assets.map(a => { const r = s.scn.research.companies[a.id]; return `<div class="row"><b class="grow">${a.tk}</b><span class="faint xs">${a.sector}</span><span class="tag view-${r.view}">${r.view}</span></div>`; }).join('')}</div>` : ''}</div>
        </section>
        <section class="panel p-news">
          <div class="p-h"><b>News</b><span class="tag bad" id="n-unread" hidden></span><span class="grow"></span>${seg('n-filter', [['all', 'All'], ['mine', 'My holdings']], newsFilter)}</div>
          <div class="news" id="news"></div>
        </section>
        <section class="panel p-book">
          <div class="p-h">${seg('bk-tab', [['pos', 'Positions'], ['strat', 'Strategy'], ['alloc', 'Allocation'], ['risk', 'Risk & rules'], ['blot', 'Blotter'], ['floor', 'Leaderboard']], bookTab)}<span class="faint xs" id="bk-meta"></span></div>
          <div class="book" id="book"></div>
        </section>
        <section class="panel p-ticket" id="tk-card">
          <div class="p-h"><b>Order ticket</b><span class="faint xs" id="tk-hint"></span></div>
          <div class="tk">
            <div class="tk-row"><select class="select-in" id="tk-asset">${m.assets.map(a => `<option value="${a.id}">${a.tk} · ${a.name}</option>`).join('')}</select>${seg('tk-side', [[1, 'Buy'], [-1, 'Sell']], side, 'buysell')}</div>
            <div class="tk-row">
              <div class="qty"><input class="input mono" id="tk-qty" inputmode="numeric" placeholder="Quantity" autocomplete="off"><span class="faint xs" id="tk-unit">contracts</span></div></div>
            <div class="tk-chips" id="tk-chips"></div>
            <div class="tk-info" id="tk-info"></div>
            <div class="tk-btns ${s.R.rfq ? '' : 'one'}">
              <button class="btn btn-buy" id="tk-exch" title="Send to the exchange (Enter)">${icon('zap', 16)} <span id="tk-exch-l">Buy</span></button>
              ${s.R.rfq ? `<button class="btn btn-outline" id="tk-rfq" title="Request quotes from 3 banks (R or Shift+Enter)">${icon('users', 16)} RFQ · banks</button>` : ''}
            </div>
            <div id="rfq"></div>
          </div>
        </section>
        <section class="panel p-chart">
          <div class="p-h"><div class="ch-title" id="ch-title"></div>${seg('ch-mode', [['asset', 'Instrument'], ['fund', 'Fund vs benchmark']], chartMode)}</div>
          <div class="ch-wrap"><canvas id="chart"></canvas><div class="ch-tip" id="ch-tip"></div><div class="ch-frozen" id="ch-frozen" hidden>${icon('pause', 14)} Prices frozen</div></div>
        </section>
      </div>
      <div class="flash" id="flash" role="status" aria-live="assertive"></div>
    </div>`;

    v.querySelectorAll('[data-asset]').forEach(b => (b.onclick = () => select(b.dataset.asset)));
    if ($('#w-tab')) segWire($('#w-tab'), x => showTab(x));
    segWire($('#ch-mode'), x => { chartMode = x; drawChart(); chartTitle(); });
    segWire($('#bk-tab'), x => { bookTab = x; renderBook(); });
    segWire($('#n-filter'), x => { newsFilter = x; renderNews(); });
    segWire($('#tk-side'), x => { side = +x; ticketInfo(); });
    if (!exam()) { segWire($('#t-speed'), x => (speed = +x)); $('#t-pause').onclick = togglePause; $('#t-next').onclick = skipPhase; }
    $('#t-fw').onclick = fundWeighting; $('#t-room').onclick = () => Room.panel(); Room.label();
    if (s.teamHost) { s.teamHost = false; Room.host(s).then(() => Room.panel()).catch(e => toast(`${icon('xCircle', 16)} Couldn't open the team room: ${esc(e.message || 'no connection')}. Try the Team room button, or a phone hotspot.`, 'bad', 7000)); }
    $('#t-sound').onclick = () => { Sound.set(!Sound.on()); $('#t-sound').innerHTML = icon(Sound.on() ? 'volume' : 'volumeOff', 17); refreshNav(); Sound.ambient(true); };
    $('#t-end').onclick = endEarly;
    $('#t-lim').onclick = $('#t-stop').onclick = () => { $('#bk-tab').set('risk'); bookTab = 'risk'; renderBook(); };
    $('#tk-asset').value = sel; $('#tk-asset').onchange = e => select(e.target.value);
    const q = $('#tk-qty');
    q.oninput = () => { const raw = q.value.replace(/[^\d]/g, ''); q.value = raw ? (+raw).toLocaleString('en-US') : ''; ticketInfo(); };
    q.onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); e.shiftKey && s.R.rfq ? rfq() : sendExchange(); } };
    $('#tk-exch').onclick = sendExchange; if ($('#tk-rfq')) $('#tk-rfq').onclick = rfq;
    const cv = $('#chart');
    cv.onmousemove = e => { hoverX = e.offsetX; drawChart(); };
    cv.onmouseleave = () => { hoverX = null; $('#ch-tip').classList.remove('show'); drawChart(); };
    document.addEventListener('keydown', onKey);
    new ResizeObserver(() => mounted && (drawChart(), drawSparks())).observe($('.ch-wrap'));
    const book = $('#book');
    book.addEventListener('mouseleave', () => { if (!book.contains(document.activeElement)) renderBook(); });
    book.addEventListener('click', bookClick);
    book.addEventListener('change', bookChange);

    renderNews(); renderBook(); chips(); ticketInfo(); renderRfq(); chartTitle();
    requestAnimationFrame(() => { ui(true); drawSparks(); });
    if (!peers) setTimeout(() => { if (s) { peers = Scoring.peers(s.m, 60); if (mounted && bookTab === 'floor') renderBook(); } }, 50);
    ensureLoop();
    if (!s.started) countdown(); else Sound.ambient(true);
  }

  function countdown() {
    const ov = $('#overlay'), card = $('#ov-card');
    let n = 3;
    const show = () => { card.innerHTML = `<div class="eyebrow">Simulation starts in</div><div class="count-big grad-text">${n}</div><p class="muted">You start with ${Fmt.compact(s.capital)} in cash. First, <b>build your portfolio</b>: prices are frozen until Q1 starts.<br>${exam() ? 'Exam mode: real timings, no pausing.' : 'Training mode: pause, speed up, or skip ahead with "Start Q1".'}</p>`; };
    show(); ov.classList.add('show');
    const it = setInterval(() => {
      n--; if (n > 0) { show(); Sound.tick(); return; }
      clearInterval(it); ov.classList.remove('show'); s.start(); Sound.news(2); Sound.ambient(true);
      banner('BUILD', `Portfolio construction: ${Fmt.clock(s.phase.dur / (exam() ? 1 : speed))} to invest at least ${Fmt.pct(s.R.minInvested, 0)} before Q1. Your plan from the briefing is in the Strategy tab.`, 'phase');
      bookTab = 'strat'; $('#bk-tab').set('strat'); renderBook();
    }, 800);
    Sound.tick();
  }

  /* ---------------- per-tick UI ---------------- */
  function ui(force) {
    if (!mounted || !$('#t-date')) return;
    const m = s.m, t = s.step, d = s.day(), date = simDate(Math.max(0, d)), ph = s.phase, fz = frozen();
    // phase
    const tag = $('#t-phtag');
    tag.textContent = ph.kind === 'quarter' ? 'LIVE' : ph.kind === 'break' ? 'BREAK' : 'BUILD';
    tag.className = 'ph-tag ' + ph.kind;
    $('#t-phlabel').textContent = ph.kind === 'quarter' ? `Q${ph.q} · market live` : ph.kind === 'break' ? `Rebalancing break · Q${ph.after}→Q${ph.after + 1}` : 'Portfolio construction';
    $('#t-phsub').textContent = s.finished ? 'Year complete' : ph.kind === 'quarter' ? `then ${ph.q < s.nQ ? 'rebalancing break' : 'end of year'}` : 'prices frozen · trading allowed';
    const sc = exam() ? 1 : speed, left = s.phaseLeft() / sc;
    $('#t-left').textContent = Fmt.clock(left);
    $('#t-phase').classList.toggle('urgent', left < 30000 && s.started && !s.finished);
    if (!exam()) { const nb = $('#t-next'); nb.hidden = ph.kind === 'quarter' || !s.started || s.finished; $('#t-next-l').textContent = `Start Q${s.currentQ()} now`; }
    $('#t-date').textContent = date.label; $('#t-q').textContent = 'Q' + s.currentQ();
    $('#t-prog').style.width = (t / (m.N - 1)) * 100 + '%';
    const W = s.weights(), nav = W.nav, ret = nav / s.capital - 1, bret = m.bench[t] - 1;
    setNum('#t-nav', Fmt.compact(nav)); setNum('#t-pnl', Fmt.compactS(nav - s.capital), nav - s.capital);
    setNum('#t-ex', Fmt.pp(ret - bret, 2), ret - bret);
    setNum('#t-invv', Fmt.pct(W.invested, 1)); $('#t-inv').classList.toggle('bad', W.invested < s.R.minInvested); $('#t-inv').classList.toggle('good', W.invested >= s.R.minInvested);
    const bad = s.checks(t, W).filter(c => !c.ok);
    $('#t-lim').classList.toggle('bad', bad.length > 0); $('#t-limv').textContent = bad.length ? `${bad.length} breach${bad.length > 1 ? 'es' : ''}` : 'OK';
    const worst = Math.max(0, ...m.assets.map(a => -s.unrealized(a.id))), lim = s.R.maxTradeLossUsd;
    $('#t-stopv').textContent = worst > 1000 ? '−' + Fmt.compact(worst).replace('$', '$') : 'OK';
    $('#t-stop').classList.toggle('bad', worst > lim); $('#t-stop').classList.toggle('warn', worst > .7 * lim && worst <= lim);
    $('#t-ffv').textContent = s.fat.length; $('#t-ff').classList.toggle('bad', s.fat.length > 0);
    const R = s.ranges(), maxR = Math.max(...m.assets.map(a => R.asset[a.id][1])) * 1.1;
    for (const a of m.assets) {
      const px = s.mid(a.id), el = v.querySelector(`[data-px="${a.id}"]`), prev = lastPx[a.id];
      el.textContent = Fmt.num(px, a.dp);
      if (prev && Math.abs(px / prev - 1) > .0006) { const row = el.closest('.w-row'); row.classList.remove('flash-up', 'flash-down'); void row.offsetWidth; row.classList.add(px > prev ? 'flash-up' : 'flash-down'); lastPx[a.id] = px; }
      else if (!prev) lastPx[a.id] = px;
      const chg = m.ret(a.id, 0, t), ce = v.querySelector(`[data-chg="${a.id}"]`);
      ce.textContent = Fmt.pctS(chg); ce.className = 'mono xs ' + signCls(chg);
      const w = W.w[a.id], [lo, hi] = R.asset[a.id], ok = w >= lo - 1e-6 && w <= hi + 1e-6;
      v.querySelector(`[data-band="${a.id}"]`).style.cssText = `left:${lo / maxR * 100}%;width:${(hi - lo) / maxR * 100}%`;
      v.querySelector(`[data-bm="${a.id}"]`).style.left = (s.fund.bench[a.id] / maxR * 100) + '%';
      const me = v.querySelector(`[data-me="${a.id}"]`); me.style.width = clamp(w / maxR * 100, 0, 100) + '%'; me.classList.toggle('bad', !ok);
      const wt = v.querySelector(`[data-wt="${a.id}"]`); wt.textContent = Fmt.pct(w, 1); wt.classList.toggle('down', !ok);
    }
    $('#ch-frozen').hidden = !fz || !s.started;
    if (t % m.S === 0 || force) drawSparks();
    drawChart(); chartTitle(); ticketInfo(true);
    if (bookTab !== 'blot' && (bookTab !== 'floor' || t % m.S === 0 || force)) renderBook(true);
    if (s.rfq && s.rfq.status === 'live') tickRfq();
    if (!exam()) { const pb = $('#t-pause'), want = s.paused ? 'play' : 'pause'; if (pb.dataset.ic !== want) { pb.dataset.ic = want; pb.innerHTML = icon(want, 17); } }
  }
  function setNum(sel2, txt, sign) { const e = $(sel2); if (!e) return; e.textContent = txt; if (sign !== undefined) e.className = 'mono ' + signCls(sign); }
  function drawSparks() {
    const t = s.step;
    for (const a of s.m.assets) { const cv = v.querySelector(`[data-spark="${a.id}"]`); if (!cv) continue; const from = Math.max(0, t - 30 * s.m.S); Charts.spark(cv, s.m.price[a.id], from, Math.max(t, from + 2), s.m.ret(a.id, from, t) >= 0 ? Charts.css('--up') : Charts.css('--down')); }
  }

  /* ---------------- chart ---------------- */
  function monthLabels(scale) { const out = []; for (let mth = 0; mth < s.fund.months; mth++) out.push({ x: mth * 21 * scale, label: MONTHS[mth], tick: mth > 0 && mth % 3 === 0 }); return out; }
  function chartTitle() {
    const el = $('#ch-title'); if (!el) return;
    const t = s.step;
    if (chartMode === 'asset') {
      const a = s.m.byId[sel], px = s.mid(sel), chg = s.m.ret(sel, 0, t), dchg = s.m.ret(sel, Math.max(0, s.day() * s.m.S), t), y = s.m.yld(sel, t);
      el.innerHTML = `<div class="ch-name"><b>${a.name}</b> <span class="faint">${a.tk} · ${a.long}</span></div><div class="row" style="gap:12px"><span class="big mono">${Fmt.num(px, a.dp)}</span><span class="mono ${signCls(chg)}">${Fmt.pctS(chg)} since start</span><span class="mono xs ${signCls(dchg)}">${Fmt.pctS(dchg)} today</span>${y != null ? `<span class="tag grey mono">yield ${y.toFixed(2)}%</span>` : ''}<span class="tag grey mono">1 contract ≈ ${Fmt.compact(s.cval(sel))}</span><span class="faint xs">- - benchmark (rebased) ${Fmt.pctS(s.m.bench[t] - 1)}</span></div>`;
    } else {
      const nav = s.nav(), r = nav / s.capital - 1, b = s.m.bench[t] - 1;
      el.innerHTML = `<div class="ch-name"><b>Fund vs benchmark</b> <span class="faint">cumulative return · 50/30/20 benchmark dashed</span></div><div class="row" style="gap:12px"><span class="big mono ${signCls(r)}">${Fmt.pctS(r)}</span><span class="mono faint">bench ${Fmt.pctS(b)}</span><span class="mono ${signCls(r - b)}">${Fmt.pp(r - b, 2)} relative</span></div>`;
    }
  }
  // 50/30/20 benchmark rebased to the instrument's starting price (dashed line on the price chart)
  let blCache = null;
  function benchLine(m, p0) {
    if (blCache && blCache.id === sel && blCache.m === m) return blCache.arr;
    const arr = new Float64Array(m.N); for (let i = 0; i < m.N; i++) arr[i] = p0 * m.bench[i];
    blCache = { id: sel, m, arr }; return arr;
  }
  function drawChart() {
    const cv = $('#chart'); if (!cv) return;
    const m = s.m, t = s.step, exM = exam();
    const news = s.news.map(e => ({ x: chartMode === 'asset' ? e.step : e.step / m.S, kind: 'news', sev: exM ? 1 : e.sev, e }));
    let info;
    if (chartMode === 'asset') {
      const a = m.byId[sel];
      const trades = s.trades.filter(x => x.asset === sel).map(x => ({ x: x.step, kind: x.side > 0 ? 'buy' : 'sell' }));
      const p0 = m.price[sel][0], bl = benchLine(m, p0);
      info = Charts.line(cv, { series: [{ data: m.price[sel], upto: t, color: Charts.css('--price-line'), width: 1.8, fill: Charts.css('--price-fill'), tag: v2 => Fmt.num(v2, a.dp) }, { data: bl, upto: t, color: Charts.css('--bench'), width: 1.3, dash: [4, 3] }], xMax: m.N - 1, now: t, yFmt: v2 => Fmt.num(v2, a.dp > 2 ? 2 : a.dp), xLabels: monthLabels(m.S), markers: [...news, ...trades], hover: hoverX != null ? { x: hoverX } : null });
    } else {
      const nav = s.daily.nav.map(x => (x / s.capital - 1) * 100), bm = s.daily.bench.map(x => (x / s.capital - 1) * 100);
      nav.push((s.nav() / s.capital - 1) * 100); bm.push((m.bench[t] - 1) * 100);
      info = Charts.line(cv, { series: [{ data: nav, color: Charts.css('--price-line'), width: 2, fill: Charts.css('--price-fill'), tag: v2 => v2.toFixed(2) + '%' }, { data: bm, color: Charts.css('--bench'), width: 1.5, dash: [4, 3], tag: v2 => v2.toFixed(2) + '%' }], xMax: m.days, now: t / m.S, yFmt: v2 => v2.toFixed(1) + '%', yInclude: [0], xLabels: monthLabels(1), markers: news, hover: hoverX != null ? { x: hoverX } : null });
    }
    const tip = $('#ch-tip');
    if (hoverX != null && info && info.i != null) {
      const step = chartMode === 'asset' ? info.i : info.i * m.S, d = m.dayOf(step);
      const val = chartMode === 'asset' ? Fmt.num(m.price[sel][info.i], m.byId[sel].dp) : `${Fmt.pctS((s.daily.nav[info.i] || s.nav()) / s.capital - 1)} · bench ${Fmt.pctS(m.bench[Math.min(step, m.N - 1)] - 1)}`;
      const near = s.news.filter(e => Math.abs(e.step - step) <= m.S * 1.5).slice(-2);
      tip.innerHTML = `<b>${simDate(d).label}</b> · <span class="mono">${val}</span>${near.map(e => `<div class="tip-news">${esc(e.h)}</div>`).join('')}`;
      tip.style.left = clamp(info.x + 12, 0, cv.clientWidth - 260) + 'px'; tip.classList.add('show');
    }
  }

  /* ---------------- selection & ticket ---------------- */
  function showTab(k) {
    mktTab = k; v.querySelectorAll('.w-group').forEach(g => (g.hidden = g.dataset.grp !== k));
    const t = $('#w-tab'); if (t) t.set(k);
    drawSparks();
  }
  function select(id) {
    if (s.m.byId[id].cls !== mktTab) showTab(s.m.byId[id].cls);
    sel = id; v.querySelectorAll('.w-row').forEach(r => r.classList.toggle('sel', r.dataset.asset === id));
    $('#tk-asset').value = id; if (chartMode !== 'asset') { chartMode = 'asset'; $('#ch-mode').set('asset'); }
    chips(); ticketInfo(); drawChart(); chartTitle(); renderBook(true);
  }
  const qtyVal = () => +($('#tk-qty').value || '').replace(/[^\d]/g, '') || 0;
  function setQty(q, sd) { if (sd) { side = sd; $('#tk-side').set(side); } $('#tk-qty').value = q > 0 ? Math.round(q).toLocaleString('en-US') : ''; ticketInfo(); $('#tk-qty').focus(); }
  function chips() {
    const el = $('#tk-chips'); if (!el) return;
    el.innerHTML = `<button class="chip-btn" data-pct=".01" title="1% of the fund">1%</button><button class="chip-btn" data-pct=".025" title="2.5% of the fund">2.5%</button><button class="chip-btn" data-pct=".05" title="5% of the fund">5%</button><span class="grow"></span>${s.strategy ? '<button class="chip-btn" data-to="strat" title="Contracts that bring this instrument back to your strategy weight">→ Strategy</button>' : ''}<button class="chip-btn" data-to="bench" title="Contracts that bring this instrument to its benchmark weight">→ Bench</button>${exam() ? '' : '<button class="chip-btn" data-to="limit" title="Smallest trade back inside every limit">→ In limit</button>'}<button class="chip-btn" data-to="all" title="Sell the whole position">All</button>`;
    el.querySelectorAll('[data-pct]').forEach(b => (b.onclick = () => setQty((s.nav() * +b.dataset.pct) / s.cval(sel))));
    el.querySelectorAll('[data-to]').forEach(b => (b.onclick = () => {
      const W = s.weights(), nav = W.nav, cur = W.w[sel], R = s.ranges().asset[sel];
      const target = b.dataset.to === 'bench' ? s.fund.bench[sel] : b.dataset.to === 'strat' ? (s.strategy[sel] || 0) : b.dataset.to === 'all' ? 0 : cur > R[1] ? R[1] - .002 : cur < R[0] ? R[0] + .002 : cur;
      const dq = ((target - cur) * nav) / s.cval(sel);
      if (Math.abs(dq) < .5) return toast(`${icon('info', 16)} ${s.m.byId[sel].tk} is already there.`, '', 2000);
      setQty(Math.abs(dq), dq > 0 ? 1 : -1);
    }));
  }
  function ticketInfo(live) {
    const el = $('#tk-info'); if (!el) return;
    const a = s.m.byId[sel], q = qtyVal(), mid = s.mid(sel), sp = s.m.spreadBps(sel, s.step);
    const bid = mid * (1 - sp / 2e4), ask = mid * (1 + sp / 2e4);
    $('#tk-unit').textContent = a.unit;
    $('#tk-exch').className = 'btn ' + (side > 0 ? 'btn-buy' : 'btn-sell');
    $('#tk-exch-l').textContent = `${side > 0 ? 'Buy' : 'Sell'}${q ? ' ' + Fmt.int(q) : ''}${s.R.rfq ? ' · exchange' : ''}`;
    const W = s.weights(), R = s.ranges().asset[sel], cur = W.w[sel], cap = s.R.maxProductUsd;
    let html = `<div class="wide"><span>Bid / Ask · 1 ${a.unit === 'shares' ? 'share' : 'contract'}</span><b class="mono">${Fmt.num(bid, a.dp)} / ${Fmt.num(ask, a.dp)} <span class="faint">· ${a.unit === 'shares' ? '' : '× ' + Fmt.int(a.mult) + ' = '}${Fmt.compact(s.cval(sel))}</span></b></div>`;
    html += `<div><span>Holding</span><b class="mono">${Fmt.int(s.pos[sel].qty)} · ${Fmt.pct(cur, 1)}</b></div><div><span>Allowed · bench</span><b class="mono">${(R[0] * 100).toFixed(1)}–${(R[1] * 100).toFixed(1)}% · ${(s.fund.bench[sel] * 100).toFixed(1)}%</b></div>`;
    if (q > 0) {
      const pv = s.preview(sel, side, q), c = pv.cost;
      if (!pv.ok) {
        html += `<div class="hl"><span>Notional</span><b class="mono">${Fmt.compact(c.notional)}</b></div><div class="hl"><span>% of fund</span><b class="mono down">${Fmt.pct(c.notional / W.nav, 1)}</b></div><div class="wide err">${icon('xCircle', 14)} ${esc(pv.errors[0])}</div>`;
        if (!live || !el.matches(':hover')) el.innerHTML = html;
        $('#tk-hint').textContent = ''; return;
      }
      const after = pv.post.w[sel], ok = after >= R[0] - 1e-6 && after <= R[1] + 1e-6, valAfter = pv.post.value;
      html += `<div class="hl"><span>Notional</span><b class="mono">${Fmt.money(c.notional)}</b></div><div class="hl"><span>% of fund</span><b class="mono ${c.notional / W.nav > .25 ? 'down' : ''}">${Fmt.pct(c.notional / W.nav, 2)}</b></div>`;
      html += `<div class="hl"><span>Weight after</span><b class="mono ${ok ? '' : 'down'}">${Fmt.pct(cur, 1)} → ${Fmt.pct(after, 1)}${ok ? '' : ' ⚠'}</b></div><div class="hl"><span>${cap ? 'Position vs ' + Fmt.compact(cap) : 'Cash after'}</span><b class="mono ${cap && valAfter > cap ? 'down' : ''}">${cap ? Fmt.compact(valAfter) + (valAfter > cap ? ' ⚠' : '') : Fmt.pct(pv.post.cash, 1)}</b></div>`;
      html += `<div class="hl"><span>Invested after</span><b class="mono ${1 - pv.post.cash < s.R.minInvested ? 'warnc' : ''}">${Fmt.pct(1 - pv.post.cash, 1)}</b></div><div class="hl"><span>Est. execution cost</span><b class="mono">${c.allInBps.toFixed(1)}bp ≈ ${Fmt.compact(c.allInBps * c.notional / 1e4)}</b></div>`;
      html += `<div class="wide"><span class="xs">½ spread ${c.halfSpread.toFixed(1)}bp + market impact ${c.impact.toFixed(1)}bp${c.commission ? ` + commission ${(c.commission / c.notional * 1e4).toFixed(1)}bp` : ' · no commission'}${s.pressure[sel] ? ' · your recent trading in ' + a.tk + ' still moving the price' : ''}</span></div>`;
      if (pv.newBreaches.length) html += `<div class="wide warn">${icon('alert', 14)} Would breach: ${pv.newBreaches.map(b => esc(b.label)).join(', ')}</div>`;
    }
    if (!live || !el.matches(':hover')) el.innerHTML = html;
    $('#tk-hint').textContent = q > 0 ? '' : frozen() && s.started ? 'Prices frozen · trading allowed' : `Quantity in ${a.unit}`;
  }

  async function pretradeOk(q) {
    const pv = s.preview(sel, side, q);
    if (exam()) return true;
    if (!pv.ok) {
      const wasPaused = s.paused; s.pause(true);
      await confirmBox('This order would be rejected', `<p>${esc(pv.errors[0])}</p><p class="faint sm">Training mode stopped it. In exam mode it would be rejected and logged as an order error.</p>`, 'OK, fix it', 'btn-primary');
      if (!wasPaused) s.pause(false);
      return false;
    }
    const issues = [];
    if (pv.newBreaches.length) issues.push(`It would push <b>${pv.newBreaches.map(b => esc(b.label)).join(', ')}</b> outside the rules.`);
    if (pv.notional > .25 * s.nav()) issues.push(`It's <b>${Fmt.pct(pv.notional / s.nav(), 1)}</b> of the fund in one ticket. Market impact: about <b>${pv.cost.impact.toFixed(1)}bp</b>.`);
    if (!issues.length) return true;
    const wasPaused = s.paused; s.pause(true);
    const ok = await confirmBox('Pre-trade check', issues.map(i => `<p>${i}</p>`).join('') + '<p class="faint sm">Training mode only. In exam mode, nothing warns you.</p>', 'Send anyway', side > 0 ? 'btn-buy' : 'btn-sell');
    if (!wasPaused) s.pause(false);
    return ok;
  }
  async function sendExchange() {
    if (!s.started || s.finished) return;
    const q = qtyVal(); if (!q) { $('#tk-qty').focus(); return toast(`${icon('info', 16)} Enter a quantity first.`, '', 2000); }
    if (!(await pretradeOk(q))) return;
    const t = s.marketOrder(sel, side, q);
    if (t) { $('#tk-qty').value = ''; ticketInfo(); }
  }
  async function rfq() {
    if (!s.R.rfq || !s.started || s.finished) return;
    const q = qtyVal(); if (!q) { $('#tk-qty').focus(); return toast(`${icon('info', 16)} Enter a quantity first.`, '', 2000); }
    if (!(await pretradeOk(q))) return;
    s.requestQuotes(sel, side, q); renderRfq();
  }
  function renderRfq() {
    const el = $('#rfq'); if (!el) return;
    const r = s.rfq;
    const off = !r || ['done', 'cancelled'].includes(r.status) || (r.status === 'expired' && s.elapsed - r.requestedAt > 9000);
    $('.tk').classList.toggle('rfq-on', !off);
    if (off) { el.innerHTML = ''; return; }
    const a = s.m.byId[r.asset], live = r.quotes.filter(q => q.status === 'live');
    const best = live.length ? live.reduce((b, q) => (r.side > 0 ? (q.px < b.px ? q : b) : (q.px > b.px ? q : b))) : null;
    el.innerHTML = `<div class="rfq ${r.status}">
      <div class="row"><b class="grow">RFQ · ${r.side > 0 ? 'Buy' : 'Sell'} ${Fmt.int(r.qty)} ${a.tk}</b><span class="faint xs mono" data-mid>mid ${Fmt.num(s.mid(r.asset), a.dp)}</span>${r.status === 'live' ? `<button class="icon-btn" id="rfq-x" title="Cancel (Esc)">${icon('x', 15)}</button>` : ''}</div>
      ${r.quotes.map(q => { const left = q.status === 'live' ? clamp((q.expires - s.elapsed) / VENUE.rfqTimeoutMs, 0, 1) : 0, bps = q.px ? ((q.px - s.mid(r.asset)) / s.mid(r.asset)) * r.side * 1e4 : 0;
        return `<div class="quote ${q === best ? 'best' : ''} ${q.status}"><div class="grow"><b>${q.name}</b><div class="qbar"><i style="width:${left * 100}%"></i></div></div>
          ${q.status === 'pending' ? '<span class="dots"><i></i><i></i><i></i></span>' : q.status === 'pass' ? '<span class="faint xs">No quote</span>' : q.status === 'expired' ? '<span class="faint xs">Expired</span>' : q.status === 'lost' ? '<span class="faint xs">—</span>' : q.status === 'done' ? `<span class="up xs">Done @ ${Fmt.num(q.px, a.dp)}</span>` : `<span class="mono">${Fmt.num(q.px, a.dp)}</span><span class="faint xs mono" data-bps>${bps.toFixed(1)}bp</span><button class="btn sm ${r.side > 0 ? 'btn-buy' : 'btn-sell'}" data-bank="${q.bank}">${r.side > 0 ? 'Lift' : 'Hit'}</button>`}</div>`; }).join('')}
      ${r.status === 'expired' ? '<div class="faint xs">All quotes expired. Request again.</div>' : ''}</div>`;
    if (!el.wired) {
      el.wired = true;
      el.addEventListener('click', e => {
        const b = e.target.closest('[data-bank]'), x = e.target.closest('#rfq-x');
        if (x) { s.cancelRfq(); renderRfq(); return; }
        if (!b) return;
        if (s.acceptQuote(b.dataset.bank)) { $('#tk-qty').value = ''; ticketInfo(); }
        renderRfq();
      });
    }
  }
  function tickRfq() {
    const r = s.rfq, el = $('#rfq'); if (!r || !el || !el.firstElementChild) return;
    const a = s.m.byId[r.asset], mid = s.mid(r.asset);
    const midEl = el.querySelector('[data-mid]'); if (midEl) midEl.textContent = 'mid ' + Fmt.num(mid, a.dp);
    r.quotes.forEach((q, i) => { const row = el.querySelectorAll('.quote')[i]; if (!row) return; const bar = row.querySelector('.qbar i'); if (bar) bar.style.width = (q.status === 'live' ? clamp((q.expires - s.elapsed) / VENUE.rfqTimeoutMs, 0, 1) * 100 : 0) + '%'; const bp = row.querySelector('[data-bps]'); if (bp && q.px) bp.textContent = (((q.px - mid) / mid) * r.side * 1e4).toFixed(1) + 'bp'; });
  }

  /* ---------------- strategy (Portfolio Builder on the floor) ---------------- */
  function planOrders() {
    const W = s.weights(), nav = W.nav, st = s.strategy || {};
    // ignore trades under 0.2% of the fund: otherwise rounding and costs make the plan chase ±1 share forever
    return s.m.assets.map(a => { const tgt = st[a.id] || 0; let dq = Math.round(((tgt - W.w[a.id]) * nav) / s.cval(a.id)); if (Math.abs(dq * s.cval(a.id)) < .002 * nav) dq = 0; return { id: a.id, tgt, cur: W.w[a.id], dq }; });
  }
  async function executePlan() {
    if (!s.started || s.finished) return;
    const orders = planOrders().filter(o => o.dq);
    if (!orders.length) return toast(`${icon('checkCircle', 16)} Already at your strategy weights.`, 'ok', 2500);
    for (const o of orders.filter(o => o.dq < 0)) s.marketOrder(o.id, -1, Math.min(-o.dq, s.pos[o.id].qty));
    for (const o of orders.filter(o => o.dq > 0)) {
      const c = s.costModel(o.id, o.dq, 1), per = c.mid * s.m.byId[o.id].mult * (1 + (c.halfSpread + c.impact) / 1e4);
      const q = Math.min(o.dq, Math.floor((s.cash * .998) / per));
      if (q > 0) s.marketOrder(o.id, 1, q);
    }
    renderBook();
  }
  function bookClick(e) {
    const r = e.target.closest('[data-sel]'); if (r && !e.target.closest('input,button')) select(r.dataset.sel);
    const ld = e.target.closest('[data-load]');
    if (ld) { const o = planOrders().find(x => x.id === ld.dataset.load); select(o.id); setQty(Math.abs(o.dq), o.dq > 0 ? 1 : -1); }
    const act = e.target.closest('[data-st]');
    if (act) {
      const k = act.dataset.st, W = s.weights();
      if (k === 'cur') s.strategy = Object.assign({}, W.w);
      if (k === 'bench') s.strategy = Object.fromEntries(s.m.assets.map(a => [a.id, s.fund.bench[a.id] * .97]));
      if (k === 'exec') executePlan();
      if (k === 'next') {
        const orders = planOrders().filter(o => o.dq).sort((a, b) => (a.dq < 0) === (b.dq < 0) ? Math.abs(b.dq * s.cval(b.id)) - Math.abs(a.dq * s.cval(a.id)) : a.dq < 0 ? -1 : 1);
        const o = orders[0];
        if (!o) { toast(`${icon('checkCircle', 16)} Nothing to trade: you're at your strategy.`, 'ok', 2500); return; }
        let q = Math.abs(o.dq);
        if (o.dq > 0) { const c = s.costModel(o.id, q, 1), per = c.mid * s.m.byId[o.id].mult * (1 + (c.halfSpread + c.impact) / 1e4); q = Math.min(q, Math.floor(s.cash * .998 / per)); }
        if (q <= 0) { toast(`${icon('info', 16)} Not enough cash for the next buy (${s.m.byId[o.id].tk}). Sell something first or lower its strategy weight.`, 'warn', 4000); return; }
        select(o.id); setQty(q, o.dq > 0 ? 1 : -1); return;
      }
      chips(); renderBook();
    }
  }
  function bookChange(e) {
    const inp = e.target.closest('[data-sw]'); if (!inp) return;
    const x = parseFloat(inp.value); if (!isFinite(x)) return;
    s.strategy = s.strategy || {}; s.strategy[inp.dataset.sw] = clamp(x, 0, 100) / 100;
    renderBook();
  }

  /* ---------------- book ---------------- */
  function allocBars(W) {
    const m = s.m, R = s.ranges(), maxR = Math.max(...m.assets.map(a => R.asset[a.id][1])) * 1.08;
    const bar = (label, w, b, lo, hi, scale, st) => { const ok = w >= lo - 1e-6 && w <= hi + 1e-6; return `<div class="al-row ${ok ? '' : 'bad'}"><span class="al-l">${label}</span><span class="al-track"><i class="band" style="left:${lo / scale * 100}%;width:${(hi - lo) / scale * 100}%"></i>${b != null ? `<i class="bm" style="left:${b / scale * 100}%"></i>` : ''}${st != null ? `<i class="stm" style="left:${st / scale * 100}%"></i>` : ''}<i class="me" style="width:${clamp(w / scale * 100, 0, 100)}%"></i></span><span class="mono al-v">${Fmt.pct(w, 1)}</span><span class="mono xs al-a ${b != null ? signCls(w - b) : ''}">${b != null ? Fmt.pp(w - b, 1) : ''}</span></div>`; };
    const st = s.strategy;
    return `<div class="alloc"><div class="al-legend faint xs"><span><i class="lg-band"></i>allowed</span><span><i class="lg-bm"></i>benchmark</span>${st ? '<span><i class="lg-st"></i>strategy</span>' : ''}<span><i class="lg-me"></i>you</span></div>
      ${m.assets.map(a => bar(a.tk, W.w[a.id], s.fund.bench[a.id], R.asset[a.id][0], R.asset[a.id][1], maxR, st ? st[a.id] || 0 : null)).join('')}
      <div class="al-sep">Asset classes</div>
      ${s.fund.classOrder.map(k => { const as = m.assets.filter(a => a.cls === k); if (!as.length) return ''; const w = sum(as.map(a => W.w[a.id])), b = sum(as.map(a => s.fund.bench[a.id])), r = R.cls[k] || [0, 1]; return bar(s.fund.classes[k], w, b, r[0], r[1], 1, st ? sum(as.map(a => st[a.id] || 0)) : null); }).join('')}
      ${bar('Invested', W.invested, null, s.R.minInvested, 1, 1)}</div>`;
  }
  function renderBook(live) {
    const el = $('#book'); if (!el) return;
    if (live && (el.matches(':hover') || el.contains(document.activeElement))) return;
    const m = s.m, W = s.weights(), R = s.ranges(), lim = s.R.maxTradeLossUsd;
    let html = '', meta = '';
    if (bookTab === 'pos') {
      let tu = 0, tr2 = 0;
      html = `<table class="tbl"><thead><tr><th>Instrument</th><th>Contracts</th><th>Avg px</th><th>Value</th><th>Weight</th><th>vs bench</th><th>Unreal. P&amp;L · stop</th><th>Realised</th></tr></thead><tbody>
      ${m.assets.map(a => { const p = s.pos[a.id], w = W.w[a.id], u = s.unrealized(a.id), [lo, hi] = R.asset[a.id], ok = w >= lo - 1e-6 && w <= hi + 1e-6, lossPct = clamp(-u / lim, 0, 1.2); tu += u; tr2 += p.realized;
        return `<tr class="click ${a.id === sel ? 'sel' : ''}" data-sel="${a.id}"><td><b>${a.tk}</b></td><td>${Fmt.int(p.qty)}</td><td title="Last ${Fmt.num(s.mid(a.id), a.dp)}">${p.qty ? Fmt.num(s.avgPx(a.id), a.dp) : '—'}</td><td>${Fmt.compact(s.value(a.id))}</td><td class="${ok ? '' : 'down'}" title="Allowed ${(lo * 100).toFixed(1)}–${(hi * 100).toFixed(1)}% · benchmark ${Fmt.pct(s.fund.bench[a.id], 1)}"><b>${Fmt.pct(w, 1)}</b>${ok ? '' : ' ⚠'}</td><td class="${signCls(w - s.fund.bench[a.id])}">${Fmt.pp(w - s.fund.bench[a.id], 1)}</td>
          <td><span class="pnl-cell"><span class="${signCls(u)}">${Fmt.compactS(u)}</span>${p.qty ? `<span class="slbar ${lossPct >= 1 ? 'bad' : lossPct > .7 ? 'warn' : ''}" title="Loss vs ${Fmt.compact(lim)} stop-loss"><i style="width:${Math.min(lossPct, 1) * 100}%"></i></span>` : ''}</span></td><td class="${signCls(p.realized)}">${Fmt.compactS(p.realized)}</td></tr>`; }).join('')}
      <tr><td><b>Cash</b></td><td></td><td></td><td>${Fmt.compact(s.cash)}</td><td><b>${Fmt.pct(W.cash, 1)}</b></td><td class="faint" colspan="3">invested ${Fmt.pct(W.invested, 1)} (≥${s.R.minInvested * 100}% at quarter starts)</td></tr>
      <tr class="tot"><td><b>Total</b></td><td></td><td></td><td><b>${Fmt.compact(W.nav)}</b></td><td>100%</td><td></td><td class="${signCls(tu)}"><b>${Fmt.compactS(tu)}</b></td><td class="${signCls(tr2)}"><b>${Fmt.compactS(tr2)}</b></td></tr></tbody></table>`;
    } else if (bookTab === 'strat') {
      const plan = planOrders(), st = s.strategy || {}, tot = sum(Object.values(st));
      html = `<div class="strat-head"><p class="faint sm">Your target weights (the Portfolio Builder). <b>Trade</b> = contracts needed now to get back to plan. Sell first to free cash. ${exam() ? '<b>Load</b> puts an order in the ticket; you still send it.' : 'Training: <b>Execute plan</b> sends them all.'}</p>
        <div class="row"><button class="chip-btn" data-st="next" title="Puts the next order in the ticket: sells first (to free cash), then buys sized to the cash you have">${icon('arrowRight', 13)} Load next order</button><button class="chip-btn" data-st="cur">Strategy = current weights</button><button class="chip-btn" data-st="bench">Strategy = benchmark (97% invested)</button>${exam() ? '' : `<button class="btn btn-primary sm" data-st="exec">${icon('zap', 14)} Execute plan</button>`}</div></div>
        <table class="tbl"><thead><tr><th>Instrument</th><th>Bench</th><th>Allowed</th><th>Strategy %</th><th>Now</th><th>Drift</th><th>Trade</th><th></th></tr></thead><tbody>
        ${plan.map(o => { const a = m.byId[o.id], [lo, hi] = R.asset[o.id], okT = o.tgt >= lo - 1e-6 && o.tgt <= hi + 1e-6; return `<tr data-sel="${o.id}" class="${a.id === sel ? 'sel' : ''}"><td><b>${a.tk}</b></td><td class="faint">${Fmt.pct(s.fund.bench[o.id], 1)}</td><td class="faint">${(lo * 100).toFixed(1)}–${(hi * 100).toFixed(1)}</td>
          <td><input class="sw-in mono ${okT ? '' : 'bad'}" data-sw="${o.id}" value="${(o.tgt * 100).toFixed(1)}" inputmode="decimal"></td><td>${Fmt.pct(o.cur, 1)}</td><td class="${Math.abs(o.cur - o.tgt) > .01 ? 'warnc' : 'faint'}">${Fmt.pp(o.cur - o.tgt, 1)}</td>
          <td class="${o.dq > 0 ? 'up' : o.dq < 0 ? 'down' : 'faint'}">${o.dq ? (o.dq > 0 ? 'BUY ' : 'SELL ') + Fmt.int(Math.abs(o.dq)) : '—'}</td><td>${o.dq ? `<button class="chip-btn" data-load="${o.id}">Load</button>` : ''}</td></tr>`; }).join('')}
        <tr class="tot"><td><b>Total invested</b></td><td class="faint">100%</td><td></td><td class="${tot < s.R.minInvested ? 'down' : ''}"><b>${(tot * 100).toFixed(1)}%</b></td><td>${Fmt.pct(W.invested, 1)}</td><td></td><td></td><td></td></tr></tbody></table>`;
      const drift = sum(plan.map(o => Math.abs(o.cur - o.tgt))) / 2;
      meta = `drift from strategy ${Fmt.pct(drift, 1)}`;
    } else if (bookTab === 'alloc') {
      html = allocBars(W);
    } else if (bookTab === 'blot') {
      const tr = s.trades.slice().reverse();
      html = tr.length ? `<table class="tbl"><thead><tr><th>#</th><th class="l">When</th><th class="l">Instrument</th><th class="l">Side</th><th>Qty</th><th>Price</th><th>Notional</th><th>Cost</th></tr></thead><tbody>${tr.map(x => { const a = m.byId[x.asset]; return `<tr><td>${x.n}</td><td class="l">${x.phase === 'quarter' ? simDate(x.day).label + ' · Q' + x.q : x.phase === 'build' ? 'Construction' : 'Break →Q' + x.q}</td><td class="l"><b>${a.tk}</b></td><td class="l ${x.side > 0 ? 'up' : 'down'}">${x.side > 0 ? 'BUY' : 'SELL'}</td><td>${Fmt.int(x.qty)}</td><td>${Fmt.num(x.px, a.dp)}</td><td>${Fmt.compact(x.notional)}</td><td class="${x.costBps > 8 ? 'down' : ''}">${x.costBps.toFixed(1)}bp</td></tr>`; }).join('')}</tbody></table>` : `<div class="empty">${icon('list', 22)}<p>No trades yet. Your executions appear here with their market-impact cost.</p></div>`;
      const n = sum(tr.map(x => x.notional)), c = sum(tr.map(x => x.costUsd));
      meta = tr.length ? `${tr.length} trades · ${Fmt.compact(n)} traded · impact cost ${Fmt.compact(c)} (${n ? (c / n * 1e4).toFixed(1) : 0}bp)` : '';
    } else if (bookTab === 'risk') {
      const ch = s.checks(s.step, W), act = s.breach.active;
      const stopRows = m.assets.filter(a => s.pos[a.id].qty).map(a => { const loss = -s.unrealized(a.id), p = clamp(loss / lim, 0, 1.2); return `<div class="rk ${p >= 1 ? 'bad' : p > .7 ? 'warn' : 'ok'}">${icon('shield', 15)}<span class="sl-l"><b>${a.tk}</b></span><span class="slbar wide ${p >= 1 ? 'bad' : p > .7 ? 'warn' : ''}"><i style="width:${Math.min(p, 1) * 100}%"></i></span><span class="mono xs">${loss > 0 ? '−' + Fmt.compact(loss) : Fmt.compactS(-loss)}</span></div>`; }).join('');
      const badCh = ch.filter(c => !c.ok);
      html = `<div class="risk-grid"><div>
          <div class="eyebrow">Stop-loss · max ${Fmt.compact(lim)} loss per position</div>${stopRows || '<p class="faint sm">No positions yet.</p>'}
          <div class="eyebrow" style="margin-top:12px">Invested at quarter starts (≥${s.R.minInvested * 100}%)</div>
          ${Array.from({ length: s.nQ }, (_, i) => { const q = s.qStarts.find(x => x.q === i + 1); return `<div class="rk ${q ? (q.ok ? 'ok' : 'bad') : ''}">${icon(q ? (q.ok ? 'checkCircle' : 'xCircle') : 'clock', 15)}<span class="grow">Q${i + 1} start</span><span class="mono">${q ? Fmt.pct(q.invested, 1) : i + 1 === s.currentQ() ? 'now ' + Fmt.pct(W.invested, 1) : '—'}</span></div>`; }).join('')}
        </div><div>
          <div class="eyebrow">Rules (live) · ${badCh.length ? badCh.length + ' breached' : 'all OK'}</div>
          ${badCh.map(c => `<div class="rk bad">${icon('xCircle', 15)}<span class="grow">${esc(c.label)}</span><span class="mono">${c.usd ? Fmt.compact(c.value) : Fmt.pct(c.value, 1)}</span>${act[c.id] ? `<span class="tag bad">${s.day() - act[c.id].startDay + 1}d</span>` : ''}</div>`).join('')}
          ${ruleList(s.fund).map(r => `<div class="rk ok">${icon('check', 14)}<span class="grow sm">${esc(r.label)}</span></div>`).join('')}
          <div class="eyebrow" style="margin-top:12px">History</div>
          ${[...s.stop.episodes.map(e => `<div class="rk bad">${icon('shield', 15)}<span class="grow">${e.tk} lost ${Fmt.compact(e.maxLoss)} (stop-loss)</span><span class="faint xs">${simDate(e.startDay).label}</span></div>`), ...s.breach.episodes.slice().reverse().map(e => `<div class="rk bad">${icon('alert', 15)}<span class="grow">${esc(e.label)} ${e.dir} limit</span><span class="faint xs">${simDate(e.startDay).label}${e.endDay > e.startDay ? '–' + simDate(e.endDay).label : ''}</span></div>`), ...s.fat.slice().reverse().map(f => `<div class="rk warn">${icon('alert', 15)}<span class="grow sm">${esc(f.text)}</span></div>`)].join('') || '<p class="faint sm">Nothing yet. Keep it that way.</p>'}
        </div></div>`;
      meta = `${s.breach.limitDays} limit-days · ${s.stop.episodes.length} stop-loss breaches`;
    } else if (bookTab === 'floor') {
      if (!peers) html = `<div class="empty">${BLOOM}<p>Loading the trading floor…</p></div>`;
      else {
        const d = Math.min(s.daily.nav.length - 1, Math.max(0, s.day()));
        const rows = peers.filter(p => p.path).map(p => ({ name: p.name, ret: p.path[Math.min(d, p.path.length - 1)] - 1 }));
        rows.push({ name: 'You', me: true, ret: s.nav() / s.capital - 1 });
        rows.sort((a, b) => b.ret - a.ret);
        const me = rows.findIndex(r => r.me);
        html = `<div class="lb">${rows.map((r, i) => `<div class="lb-row ${r.me ? 'me' : ''}"><span class="lb-n">${i + 1}</span><span class="grow">${r.me ? '<b>You</b>' : esc(r.name)}</span><span class="mono ${signCls(r.ret)}">${Fmt.pctS(r.ret)}</span></div>`).join('')}</div>`;
        meta = `You are #${me + 1} of ${rows.length} by return · simulated floor`;
      }
    }
    el.innerHTML = html; $('#bk-meta').textContent = meta;
  }
  function fundWeighting() {
    const W = s.weights();
    const m = openModal(`<h2>Fund Weighting</h2><p class="muted sm">Weights now vs benchmark${s.strategy ? ', your strategy (line)' : ''} and the allowed range. NAV ${Fmt.compact(W.nav)} · invested ${Fmt.pct(W.invested, 1)}.</p>${allocBars(W)}<div class="actions"><button class="btn btn-primary" id="fw-x">Close</button></div>`, 'wide');
    $('#fw-x').onclick = closeModal; m.onkeydown = e => { if (e.key === 'Escape') closeModal(); };
  }

  /* ---------------- news & banners ---------------- */
  function newsItem(e, fresh) {
    const mine = Object.keys(e.imp).some(k => s.pos[k] && s.pos[k].qty > 0);
    const sevCls = exam() ? 'sevx' : 'sev' + e.sev;
    return `<article class="n-item ${sevCls} ${fresh ? 'fresh' : ''}" data-mine="${mine ? 1 : 0}">
      <div class="n-meta"><span class="mono">${simDate(e.day).label}</span><span class="tag grey">${esc(e.tag)}</span>${!exam() && e.sev >= 3 ? '<span class="tag bad">Major</span>' : ''}</div>
      <div class="n-h">${esc(e.h)}</div>
      ${!exam() && e.why ? `<details><summary>Why it matters</summary><p>${esc(e.why)}</p>${Object.keys(e.imp).length ? `<div class="n-imp">${Object.entries(e.imp).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1])).map(([k, x]) => `<span class="tag ${x > 0 ? 'ok' : 'bad'}">${s.m.byId[k].tk} ${x > 0 ? '▲' : '▼'}</span>`).join('')}</div>` : ''}</details>` : ''}
    </article>`;
  }
  function renderNews() {
    const el = $('#news'); if (!el) return;
    const list = s.news.slice().reverse();
    el.innerHTML = list.length ? list.map(e => newsItem(e)).join('') : `<div class="empty">${icon('globe', 22)}<p>Headlines arrive once Q1 is live. Watch for the flash.</p></div>`;
    if (newsFilter === 'mine') el.querySelectorAll('.n-item[data-mine="0"]').forEach(x => (x.hidden = true));
    unread = 0; updUnread();
  }
  function addNews(e) {
    const el = $('#news'); if (!el) return;
    const emp = el.querySelector('.empty'); if (emp) emp.remove();
    el.insertAdjacentHTML('afterbegin', newsItem(e, true));
    if (newsFilter === 'mine' && el.firstElementChild.dataset.mine === '0') el.firstElementChild.hidden = true;
    if (el.scrollTop < 40) unread = 0;
    updUnread();
  }
  function updUnread() { const u = $('#n-unread'); if (u) { u.hidden = !unread; u.textContent = unread + ' new'; } }
  function banner(tagTxt, text, cls) {
    const f = $('#flash'); if (!f) return;
    placeFlash(f);
    clearTimeout(flashT);
    f.className = 'flash ' + cls;
    f.innerHTML = `<span class="fl-tag">${tagTxt}</span><b>${text}</b><button class="icon-btn" aria-label="Dismiss">${icon('x', 15)}</button>`;
    requestAnimationFrame(() => f.classList.add('show'));
    f.querySelector('button').onclick = () => f.classList.remove('show');
    flashT = setTimeout(() => f.classList.remove('show'), 8000);
  }
  // AmplifyME layout: news sits top-centre, so the flash floats over the chart (bottom-right) rather than the panels' tabs
  function placeFlash(f) {
    const c = $('.p-chart'); if (!c) return;
    f.style.top = (c.offsetTop + 64) + 'px'; f.style.left = (c.offsetLeft + c.offsetWidth / 2) + 'px';
    f.style.maxWidth = Math.max(320, c.offsetWidth - 40) + 'px';
  }
  function flash(e) {
    if (!exam() && e.sev < 2) return;
    const f = $('#flash'); if (!f) return;
    placeFlash(f);
    clearTimeout(flashT);
    f.className = 'flash ' + (exam() ? 'sev2' : 'sev' + e.sev);
    f.innerHTML = `<span class="fl-tag">${!exam() && e.sev >= 3 ? 'BREAKING' : 'NEWS FLASH'}</span><span class="mono faint">${simDate(e.day).label}</span><b>${esc(e.h.replace(/^BREAKING:\s*/, ''))}</b><button class="icon-btn" aria-label="Dismiss">${icon('x', 15)}</button>`;
    requestAnimationFrame(() => f.classList.add('show'));
    f.querySelector('button').onclick = () => f.classList.remove('show');
    flashT = setTimeout(() => f.classList.remove('show'), exam() ? 6000 : 7000);
  }

  /* ---------------- controls ---------------- */
  function togglePause() { if (!s.started || s.finished || exam()) return; s.pause(!s.paused); toast(`${icon(s.paused ? 'pause' : 'play', 16)} ${s.paused ? 'Paused. Training mode only.' : 'Resumed'}`, '', 1500); ui(); }
  function skipPhase() { if (exam() || !s.started) return; if (s.skipPhase()) ui(true); }
  async function endEarly() {
    const wasPaused = s.paused; if (!exam()) s.pause(true);
    const ok = await confirmBox('End the session now?', `You're in ${s.phase.label}. You'll be scored on the year so far. In the real event the simulation runs to the end of Q${s.nQ}.`, 'End & score', 'btn-sell');
    if (ok) s.finish(true); else if (!exam() && !wasPaused) s.pause(false);
  }
  function onKey(e) {
    if (!mounted || $('#modal').classList.contains('show')) return;
    const tag = (e.target.tagName || '').toLowerCase(), typing = tag === 'input' || tag === 'select' || tag === 'textarea';
    if (e.key === 'Escape') { if (s.rfq && s.rfq.status === 'live') { s.cancelRfq(); renderRfq(); } if (typing) e.target.blur(); return; }
    if (typing || e.metaKey || e.ctrlKey || e.altKey) return;
    const k = e.key.toLowerCase();
    if (k === 'b' || k === 's') { side = k === 'b' ? 1 : -1; $('#tk-side').set(side); ticketInfo(); $('#tk-qty').focus(); e.preventDefault(); }
    else if (k === 'q') { $('#tk-qty').focus(); e.preventDefault(); }
    else if (k === 'w') { fundWeighting(); e.preventDefault(); }
    else if (k === 'r' && s.R.rfq) { rfq(); e.preventDefault(); }
    else if (k === ' ') { togglePause(); e.preventDefault(); }
    else if (/^[0-9]$/.test(k)) { const i = k === '0' ? 9 : +k - 1; const a = s.m.assets[i]; if (a) select(a.id); }
  }

  /* ---------------- end ---------------- */
  function onEnd(sess) {
    Sound.ambient(false); Sound.news(3);
    const ov = $('#overlay'), card = $('#ov-card');
    card.innerHTML = `${BLOOM}<h2 class="serif">${sess.early ? 'Session ended' : 'Year complete'}</h2><p class="muted">Scoring ROI, cycle judgement, rebalancing, risk management and risk appetite against 400 simulated peers…</p>`;
    ov.classList.add('show');
    setTimeout(() => {
      const r = Scoring.score(sess);
      App.saveResult(r); App.session = null; App.pending = null; peers = null; wired = null; s = null;
      cancelAnimationFrame(raf); raf = 0;
      setTimeout(() => { ov.classList.remove('show'); location.hash = '#/results/' + r.id; }, 600);
    }, 900);
  }
  function destroy() { mounted = false; document.removeEventListener('keydown', onKey); const f = $('#flash'); if (f) f.classList.remove('show'); }
  return { render, destroy };
})();
