/* ==========================================================================
   Session: one live run, structured like the AmplifyME AM Simulation.

   Timeline (course): start in 100% cash → build the portfolio → Q1 (live) →
   rebalancing break (prices frozen, trading allowed) → Q2 → break → Q3 →
   break → Q4. Real lengths: 15-min quarters and 15-min breaks. Shorter
   practice lengths scale both. The construction phase before Q1 is our
   guess at how the event starts (the course only says "build the portfolio first").

   Rules enforced and recorded (fund.rules):
   - long only, no leverage (orders that would short or overdraw are rejected)
   - ≥90% invested at each quarter start (risk appetite)
   - ≤$5M per product, each weight within ±10pp of benchmark, class bands
   - ≤$500k loss on any position ("trade"): checked at every daily close.
     We measure it per position against its average cost (our interpretation).

   Execution: exchange orders in contracts. No commission (AM format). Price
   = mid ± (half spread + market impact). Impact grows with order size and with
   your recent same-direction trading in that instrument ("pressure", decays
   with a ~20s half-life at real speed). Strength is a GUESS.
   The equity format keeps v1's 2bp commission and bank RFQs.
   ========================================================================== */
class Session {
  constructor(cfg) {
    this.cfg = Object.assign({ mode: 'exam', quarterMin: 15, breakMin: 15, buildMin: 15, variant: 0 }, cfg);
    this.scn = cfg.scenario || getScenario(cfg.scenarioId);
    this.m = Engine.build(this.scn, { variant: this.cfg.variant });
    this.fund = this.m.fund; this.R = this.fund.rules;
    this.capital = this.fund.capital; this.cash = this.capital;
    this.pos = {}; for (const a of this.m.assets) this.pos[a.id] = { qty: 0, cost: 0, realized: 0 };
    this.nQ = this.fund.quarters; this.qDays = 63;
    const q = this.cfg.quarterMin * 60000, b = this.cfg.breakMin * 60000, bu = this.cfg.buildMin * 60000;
    this.timeScale = this.cfg.quarterMin / 15;
    this.phases = [{ kind: 'build', label: 'Portfolio construction', dur: bu }];
    for (let i = 1; i <= this.nQ; i++) {
      this.phases.push({ kind: 'quarter', q: i, label: `Q${i} live`, dur: q });
      if (i < this.nQ) this.phases.push({ kind: 'break', after: i, label: `Rebalancing break Q${i}→Q${i + 1}`, dur: b });
    }
    this.durationMs = sum(this.phases.map(p => p.dur));
    this.stepMs = q / (this.qDays * this.m.S);
    this.phaseIdx = 0; this.phaseStart = 0;
    this.step = 0; this.elapsed = 0; this.paused = true; this.finished = false; this.started = false;
    this.trades = []; this.rejects = []; this.fat = []; this.news = [];
    this.daily = { nav: [this.capital], bench: [this.capital], w: [], breaches: [] };
    this.breach = { active: {}, episodes: [], limitDays: 0 };
    this.stop = { active: {}, episodes: [], days: 0, warned: {} };
    this.qStarts = []; this.breaks = []; this.quarters = [];
    this.pressure = {}; this.rfq = null; this.nextEv = 0; this.seq = 0; this.listeners = {};
  }
  on(ev, fn) { (this.listeners[ev] = this.listeners[ev] || []).push(fn); return this; }
  emit(ev, ...a) { (this.listeners[ev] || []).forEach(f => { try { f(...a); } catch (e) { console.error(e); } }); }

  /* ---------------- phase info ---------------- */
  get phase() { return this.phases[Math.min(this.phaseIdx, this.phases.length - 1)]; }
  phaseLeft() { return Math.max(0, this.phase.dur - (this.elapsed - this.phaseStart)); }
  totalLeft() { return this.phaseLeft() + sum(this.phases.slice(this.phaseIdx + 1).map(p => p.dur)); }
  isLive() { return this.started && !this.finished && this.phase.kind === 'quarter'; }
  currentQ() { const p = this.phase; return p.kind === 'quarter' ? p.q : p.kind === 'break' ? p.after + 1 : 1; }

  /* ---------------- valuation ---------------- */
  mid(id, t = this.step) { return this.m.mid(id, t); }
  cval(id, t = this.step) { return this.mid(id, t) * this.m.byId[id].mult; }          // $ value of one contract
  value(id, t = this.step) { return this.pos[id].qty * this.cval(id, t); }
  nav(t = this.step) { let v = this.cash; for (const a of this.m.assets) v += this.value(a.id, t); return v; }
  weights(t = this.step) { const n = this.nav(t), w = {}; for (const a of this.m.assets) w[a.id] = this.value(a.id, t) / n; return { w, cash: this.cash / n, nav: n, invested: 1 - this.cash / n }; }
  checks(t = this.step, W) { W = W || this.weights(t); return mandateChecks(this.fund, W.w, W.cash, W.nav); }
  ranges() { return mandateRanges(this.fund, this.nav()); }
  benchNav(t = this.step) { return this.capital * this.m.bench[clamp(t, 0, this.m.N - 1)]; }
  unrealized(id, t = this.step) { const p = this.pos[id]; return this.value(id, t) - p.cost; }
  avgPx(id) { const p = this.pos[id]; return p.qty ? p.cost / p.qty / this.m.byId[id].mult : 0; }
  day() { return this.m.dayOf(this.step); }

  /* ---------------- execution costs ---------------- */
  _decay(dt) {
    const hl = 20000 * Math.max(.15, this.timeScale), k = Math.pow(.5, dt / hl);
    for (const id in this.pressure) { this.pressure[id] *= k; if (Math.abs(this.pressure[id]) < 1e3) delete this.pressure[id]; }
  }
  costModel(id, qty, side = 1) {
    const a = this.m.byId[id], mid = this.mid(id), notional = Math.abs(qty) * mid * a.mult;
    const halfSpread = this.m.spreadBps(id, this.step) / 2;
    const p = (this.pressure[id] || 0) * side;
    const impact = Math.max(0, a.impact * (p + notional / 2) / 1e6);
    const commission = this.R.commissionBps ? Math.max(VENUE.minCommission, notional * this.R.commissionBps / 1e4) : 0;
    return { mid, notional, halfSpread, impact, commission, allInBps: halfSpread + impact + (notional ? commission / notional * 1e4 : 0) };
  }
  preview(id, side, qty, px) {
    qty = Math.floor(qty);
    const out = { ok: true, errors: [], warnings: [], newBreaches: [], qty };
    if (!(qty > 0)) { out.ok = false; out.errors.push('Enter a number of contracts greater than zero.'); return out; }
    const a = this.m.byId[id], c = this.costModel(id, qty, side), comm = px ? 0 : c.commission;
    px = px || c.mid * (1 + side * (c.halfSpread + c.impact) / 1e4);
    const notional = qty * px * a.mult;
    out.notional = notional; out.px = px; out.cost = c;
    if (side > 0 && notional + comm > this.cash + 1e-6) { out.ok = false; out.errors.push(`Not enough cash: this order needs ${Fmt.compact(notional + comm)}, you have ${Fmt.compact(this.cash)}. No leverage allowed.`); }
    if (side < 0 && qty > this.pos[id].qty) { out.ok = false; out.errors.push(`You hold ${Fmt.int(this.pos[id].qty)} ${a.unit}. Long only: you can't sell more than you own.`); }
    const W = this.weights(), nav = W.nav;
    const w2 = Object.assign({}, W.w); w2[id] = (this.value(id) + side * qty * this.cval(id)) / nav;
    const cash2 = (this.cash - side * notional - comm) / nav;
    const before = mandateChecks(this.fund, W.w, W.cash, nav), after = mandateChecks(this.fund, w2, cash2, nav);
    out.newBreaches = after.filter((r, i) => !r.ok && before[i].ok);
    out.post = { w: w2, cash: cash2, value: w2[id] * nav };
    if (notional > .25 * nav) out.warnings.push(`Large order: ${Fmt.pct(notional / nav, 1)} of the fund in one ticket.`);
    return out;
  }
  marketOrder(id, side, qty) {
    qty = Math.floor(qty);
    if (!this.started || this.finished) return null;
    const pv = this.preview(id, side, qty);
    if (!pv.ok) return this._reject(id, side, qty, pv.errors[0]);
    const c = pv.cost, px = c.mid * (1 + side * (c.halfSpread + c.impact) / 1e4);
    this.pressure[id] = (this.pressure[id] || 0) + side * pv.notional;
    return this._fill(id, side, qty, px, { venue: 'EXCH', commission: c.commission, newBreaches: pv.newBreaches, impactBps: c.impact });
  }

  /* ---------------- bank RFQ (equity format only) ---------------- */
  requestQuotes(id, side, qty) {
    if (!this.R.rfq) return null;
    qty = Math.floor(qty);
    const pv = this.preview(id, side, qty);
    if (!pv.ok) { this._reject(id, side, qty, pv.errors[0]); return null; }
    if (this.rfq && this.rfq.status === 'live') this.cancelRfq();
    const rng = RNG(hashStr(id + this.step + qty + this.seq)), c = this.costModel(id, qty, side);
    const quotes = VENUE.banks.map((b, i) => ({ bank: b.id, name: b.name, at: this.elapsed + 350 + i * 250 + rng() * 900, hs: Math.max(.3, c.halfSpread * rng.range(.45, 1.15) + c.impact * rng.range(.2, .45) + rng.range(-.2, .6)), pass: rng() < .12, px: null, status: 'pending' }));
    this.rfq = { id: ++this.seq, asset: id, side, qty, requestedAt: this.elapsed, quotes, status: 'live' };
    this.emit('rfq', this.rfq); return this.rfq;
  }
  _updateRfq() {
    const r = this.rfq; if (!r || r.status !== 'live') return;
    let changed = false;
    for (const q of r.quotes) if (q.status === 'pending' && this.elapsed >= q.at) { q.status = q.pass ? 'pass' : 'live'; q.expires = this.elapsed + VENUE.rfqTimeoutMs; changed = true; }
    for (const q of r.quotes) if (q.status === 'live' && this.elapsed >= q.expires) { q.status = 'expired'; changed = true; }
    for (const q of r.quotes) if (q.status === 'live') q.px = this.mid(r.asset) * (1 + r.side * q.hs / 1e4);
    if (r.quotes.every(q => q.status !== 'pending' && q.status !== 'live')) { r.status = 'expired'; changed = true; }
    if (changed) this.emit('rfq', r);
  }
  acceptQuote(bank) {
    const r = this.rfq; if (!r || r.status !== 'live') return null;
    this._updateRfq();
    const q = r.quotes.find(x => x.bank === bank && x.status === 'live'); if (!q) return null;
    const pv = this.preview(r.asset, r.side, r.qty, q.px);
    if (!pv.ok) { r.status = 'cancelled'; this.emit('rfq', r); return this._reject(r.asset, r.side, r.qty, pv.errors[0]); }
    q.status = 'done'; r.status = 'done'; r.quotes.forEach(x => { if (x !== q && x.status === 'live') x.status = 'lost'; });
    this.emit('rfq', r);
    return this._fill(r.asset, r.side, r.qty, q.px, { venue: 'RFQ', commission: 0, bank: q.name, newBreaches: pv.newBreaches });
  }
  cancelRfq() { if (this.rfq && this.rfq.status === 'live') { this.rfq.status = 'cancelled'; this.emit('rfq', this.rfq); } }

  /* ---------------- fills & order errors ---------------- */
  _fill(id, side, qty, px, o) {
    const a = this.m.byId[id], p = this.pos[id], mid = this.mid(id), notional = qty * px * a.mult;
    if (side > 0) { p.cost += notional; p.qty += qty; this.cash -= notional + o.commission; }
    else { const avg = p.qty ? p.cost / p.qty : 0; p.realized += (px * a.mult - avg) * qty; p.cost -= avg * qty; p.qty -= qty; this.cash += notional - o.commission; if (p.qty === 0) p.cost = 0; }
    const ph = this.phase;
    const t = { n: this.trades.length + 1, step: this.step, day: this.day(), real: this.elapsed, phase: ph.kind, q: this.currentQ(), asset: id, side, qty, px, mid, notional, commission: o.commission, venue: o.venue, bank: o.bank,
      costBps: ((px - mid) / mid) * side * 1e4 + (o.commission / notional) * 1e4 };
    t.costUsd = t.costBps * notional / 1e4;
    this.trades.push(t);
    if (o.newBreaches && o.newBreaches.length) this._fat('breach', `Trade #${t.n} pushed ${o.newBreaches.map(b => b.label).join(', ')} outside the rules`, t);
    const prev = this.trades.slice(0, -1).reverse().find(x => x.asset === id);
    if (prev && prev.side === -side && this.elapsed - prev.real < 4000 && qty >= .5 * prev.qty) this._fat('reversal', `Trade #${t.n} reversed trade #${prev.n} within ${((this.elapsed - prev.real) / 1000).toFixed(1)}s (looks like an error correction)`, t);
    // a position cut back under the stop-loss limit ends its episode at the next close; note it now for the UI
    this.emit('fill', t);
    return t;
  }
  _reject(id, side, qty, reason) {
    const r = { step: this.step, day: this.day(), real: this.elapsed, asset: id, side, qty, reason };
    this.rejects.push(r);
    this._fat('reject', `Order rejected (${side > 0 ? 'buy' : 'sell'} ${Fmt.int(qty || 0)} ${this.m.byId[id].tk}): ${reason}`, r);
    this.emit('reject', r);
    return null;
  }
  _fat(kind, text, ref) { this.fat.push({ kind, text, step: this.step, day: this.day(), real: this.elapsed }); this.emit('fat', this.fat[this.fat.length - 1], ref); }

  /* ---------------- clock ---------------- */
  start() { this.started = true; this.paused = false; this.emit('state'); }
  pause(v = true) { if (this.finished) return; this.paused = v; this.emit('state'); }
  // Training: end the current construction phase / break now
  skipPhase() { const p = this.phase; if (p.kind === 'quarter' || this.finished) return false; p.dur = this.elapsed - this.phaseStart; this.advance(0, true); return true; }
  advance(dtMs, force) {
    if ((this.paused && !force) || this.finished || !this.started) return;
    this.elapsed += dtMs; this._decay(dtMs);
    let moved = false;
    for (let guard = 0; guard < 20; guard++) {
      const ph = this.phase, tIn = this.elapsed - this.phaseStart;
      if (ph.kind === 'quarter') {
        const s0 = (ph.q - 1) * this.qDays * this.m.S, s1 = ph.q * this.qDays * this.m.S;
        const target = Math.min(s1, s0 + Math.floor(tIn / this.stepMs));
        while (this.step < target) { this.step++; this._onStep(); moved = true; }
        if (tIn >= ph.dur || this.step >= s1) { while (this.step < s1) { this.step++; this._onStep(); } this._endQuarter(ph.q); if (!this._next()) break; continue; }
        break;
      } else {
        if (ph.kind === 'break' && !ph.warned && this.phaseLeft() < Math.max(8000, ph.dur * .15)) { ph.warned = true; this.emit('breakEnding', this.weights()); }
        if (ph.kind === 'build' && !ph.warned && this.phaseLeft() < Math.max(8000, ph.dur * .15)) { ph.warned = true; this.emit('breakEnding', this.weights()); }
        if (tIn >= ph.dur) { if (!this._next()) break; continue; }
        break;
      }
    }
    this._updateRfq();
    if (moved) this.emit('tick', this.step);
    this.emit('clock');
  }
  _next() {
    this.phaseStart += this.phase.dur; this.phaseIdx++;
    if (this.phaseIdx >= this.phases.length) { this.phaseIdx = this.phases.length - 1; this.finish(); return false; }
    const ph = this.phase;
    if (ph.kind === 'quarter') this._startQuarter(ph.q);
    this.emit('phase', ph);
    return true;
  }
  _startQuarter(q) {
    const W = this.weights(), ch = this.checks(this.step, W);
    const rec = { q, step: this.step, nav: W.nav, invested: W.invested, cash: W.cash, w: Object.assign({}, W.w), ok: W.invested >= this.R.minInvested - 1e-9, breaches: ch.filter(c => !c.ok).map(c => c.label) };
    this.qStarts.push(rec);
    if (q === 1) { this.daily.w = [Object.assign({ cash: W.cash }, W.w)]; this.daily.nav = [W.nav]; this.daily.bench = [this.capital]; }
    else this.daily.w[this.daily.w.length - 1] = Object.assign({ cash: W.cash }, W.w);   // weights after the break's trades
    const br = this.breaks.find(b => b.after === q - 1);
    if (br) {
      const tr = this.trades.filter(t => t.phase === 'break' && t.q === q);
      br.turnover = sum(tr.map(t => t.notional)) / W.nav / 2;
      br.trades = tr.length; br.wStart = rec.w; br.inLimits = ch.every(c => c.ok); br.invested = W.invested;
    }
    if (!rec.ok) this.emit('appetite', rec);
    this.emit('qstart', rec);
  }
  _endQuarter(q) {
    const dn = this.daily.nav, db = this.daily.bench, i1 = dn.length - 1, i0 = Math.max(0, i1 - this.qDays);
    const rep = { q, nav: dn[i1], ret: dn[i1] / dn[i0] - 1, bench: db[i1] / db[i0] - 1, ytd: dn[i1] / this.capital - 1, benchYtd: db[i1] / this.capital - 1, trades: this.trades.filter(t => t.q === q && t.phase === 'quarter').length };
    this.quarters.push(rep);
    if (q < this.nQ) {
      const W = this.weights(), S = (this.qStarts.find(x => x.q === q) || {}).w || {};
      const drift = sum(this.m.assets.map(a => Math.abs((W.w[a.id] || 0) - (S[a.id] || 0)))) / 2;
      this.breaks.push({ after: q, wEnd: Object.assign({}, W.w), strategy: S, drift, turnover: 0, trades: 0 });
    }
    this.emit('quarter', rep);
  }
  _onStep() {
    const t = this.step;
    while (this.nextEv < this.m.evs.length && this.m.evs[this.nextEv].step <= t) {
      const e = this.m.evs[this.nextEv++];
      const item = Object.assign({}, e, { real: this.elapsed, day: this.m.dayOf(e.step) });
      this.news.push(item); this.emit('news', item);
    }
    if (t % this.m.S === 0) this._recordDay(t / this.m.S - 1);
  }
  _recordDay(d) {
    const W = this.weights();
    this.daily.nav.push(W.nav); this.daily.bench.push(this.benchNav());
    this.daily.w.push(Object.assign({ cash: W.cash }, W.w));
    // continuous constraints
    const bad = mandateChecks(this.fund, W.w, W.cash, W.nav).filter(r => !r.ok);
    this.daily.breaches.push(bad.length); this.breach.limitDays += bad.length;
    const act = this.breach.active;
    for (const r of bad) {
      if (!act[r.id]) { act[r.id] = { id: r.id, label: r.label, startDay: d, endDay: d, maxOver: Math.abs(r.over), dir: r.over > 0 ? 'above' : 'below' }; this.breach.episodes.push(act[r.id]); this.emit('breach', act[r.id]); }
      else { act[r.id].endDay = d; act[r.id].maxOver = Math.max(act[r.id].maxOver, Math.abs(r.over)); }
    }
    for (const k of Object.keys(act)) if (!bad.find(r => r.id === k)) delete act[k];
    // stop-loss: loss on any position vs its average cost
    const lim = this.R.maxTradeLossUsd, sa = this.stop.active;
    for (const a of this.m.assets) {
      const loss = -this.unrealized(a.id);
      if (lim && loss > lim) {
        this.stop.days++;
        if (!sa[a.id]) { sa[a.id] = { id: a.id, tk: a.tk, startDay: d, endDay: d, maxLoss: loss }; this.stop.episodes.push(sa[a.id]); this.emit('stop', sa[a.id]); }
        else { sa[a.id].endDay = d; sa[a.id].maxLoss = Math.max(sa[a.id].maxLoss, loss); }
      } else if (sa[a.id]) delete sa[a.id];
      if (lim && loss > .8 * lim && loss <= lim && !this.stop.warned[a.id]) { this.stop.warned[a.id] = true; this.emit('stopWarn', { id: a.id, tk: a.tk, loss }); }
      if (loss < .5 * lim) delete this.stop.warned[a.id];
    }
    this.emit('day', d);
  }
  finish(early = false) {
    if (this.finished) return;
    this.finished = true; this.paused = true; this.early = early;
    if (this.rfq) this.cancelRfq();
    this.emit('end', this);
  }
}
