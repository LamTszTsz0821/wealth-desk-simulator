/* ==========================================================================
   Market engine: turns a scenario into a full intraday price path.
   log price(t) = news component E(t)              (jumps that settle over a few days)
                + residual drift through waypoints  (so month-ends match the story)
                + correlated noise, Brownian-bridged to zero at each month-end
   8 sub-steps per trading day; one sub-step is one live "tick".
   Everything is precomputed at session start (≈2,000 × 10 numbers), so the live
   loop only reads arrays and the debrief can replay the whole year.
   ========================================================================== */
const Engine = (() => {
  const S = 8;
  const FACTORS = ['eq', 'us', 'eu', 'asia', 'tech', 'rates', 'cmd', 'safe', 'fx'];

  function easeOut(x) { return 1 - Math.pow(1 - x, 2.2); }

  function build(scn, opts = {}) {
    const fund = UNIVERSE[scn.fund];
    const days = fund.months * 21, N = days * S + 1;
    const rng = RNG((scn.seed || 1) * 7919 + (opts.variant || 0) * 104729);
    const assets = fund.assets.map(a => Object.assign({}, a, { p0: (scn.p0 && scn.p0[a.id]) || a.p0, y0: scn.yld0 && scn.yld0[a.id] }));

    // events → steps (a little into the day so they don't all land on the open)
    const evs = scn.ev.map((e, i) => {
      const sev = e.sev;
      return Object.assign({}, e, {
        idx: i,
        step: clamp(Math.round(e.d * S) + 2 + (i % 4), 1, N - 2),
        imm: e.f ?? (sev >= 3 ? .55 : sev === 1 ? .4 : .5),
        lag: e.lag ?? (sev >= 3 ? 4 : 3),
      });
    }).sort((a, b) => a.step - b.step);
    evs.forEach((e, i) => (e.idx = i));

    // correlated noise increments, per sub-step
    const f = {}; for (const k of FACTORS) { f[k] = new Float64Array(N); for (let t = 1; t < N; t++) f[k][t] = rng.normal(); }
    const price = {}, spreadMul = {}, logp = {};
    for (const a of assets) {
      const L = a.L || {}, norm = Math.sqrt(sum(Object.values(L).map(v => v * v)) + a.idio * a.idio);
      const X = new Float64Array(N);
      for (let t = 1; t < N; t++) {
        const day = (t - 1) / S, m = Math.floor(day / 21);
        const vm = (scn.volMult && scn.volMult[m]) || 1;
        let z = a.idio * rng.normal();
        for (const k in L) z += L[k] * f[k][t];
        X[t] = X[t - 1] + (z / norm) * a.vol * vm / Math.sqrt(252 * S);
      }
      // news component
      const En = new Float64Array(N), W = new Float64Array(N);
      for (const e of evs) {
        const imp = e.imp[a.id]; if (!imp) continue;
        const lg = Math.log(1 + imp), span = e.lag * S;
        for (let t = e.step; t < N; t++) { const k = Math.min(1, (t - e.step) / span); En[t] += lg * (e.imm + (1 - e.imm) * easeOut(k)); }
      }
      // waypoints → residual drift, noise bridged per month
      const wp = scn.wp[a.id] || new Array(fund.months + 1).fill(0);
      const lp = new Float64Array(N);
      for (let m = 0; m < fund.months; m++) {
        const s0 = m * 21 * S, s1 = (m + 1) * 21 * S;
        const r0 = Math.log(1 + wp[m] / 100) - En[s0], r1 = Math.log(1 + wp[m + 1] / 100) - En[s1];
        for (let t = s0; t <= s1; t++) {
          const k = (t - s0) / (s1 - s0);
          const bridge = X[t] - X[s0] - k * (X[s1] - X[s0]);
          lp[t] = En[t] + lerp(r0, r1, k) + bridge;
        }
      }
      logp[a.id] = lp;
      const P = new Float64Array(N); for (let t = 0; t < N; t++) P[t] = a.p0 * Math.exp(lp[t]);
      price[a.id] = P;
      // spreads widen after news, then normalise
      const sm = new Float32Array(N).fill(1);
      for (const e of evs) {
        if (!e.imp[a.id] || e.sev < 2) continue;
        for (let t = e.step; t < Math.min(N, e.step + 4 * S); t++) sm[t] += (e.sev - 1) * 1.3 * Math.exp(-(t - e.step) / (1.2 * S));
      }
      spreadMul[a.id] = sm;
    }

    // benchmark: fixed weights, rebalanced continuously
    const bench = new Float64Array(N); bench[0] = 1;
    for (let t = 1; t < N; t++) { let r = 0; for (const a of assets) r += fund.bench[a.id] * (price[a.id][t] / price[a.id][t - 1]); bench[t] = bench[t - 1] * r; }

    const byId = Object.fromEntries(assets.map(a => [a.id, a]));
    return {
      scn, fund, assets, byId, days, S, N, price, bench, evs,
      mid: (id, t) => price[id][clamp(t | 0, 0, N - 1)],
      spreadBps: (id, t) => byId[id].spread * spreadMul[id][clamp(t | 0, 0, N - 1)],
      yld: (id, t) => { const a = byId[id]; if (!a.bond || a.y0 == null) return null; return a.y0 - ((price[id][clamp(t | 0, 0, N - 1)] / a.p0) - 1) / a.dur * 100; },
      dayOf: t => Math.min(days - 1, Math.floor(t / S)),
      closeStep: d => Math.min(N - 1, (d + 1) * S),
      ret: (id, t0, t1) => price[id][clamp(t1, 0, N - 1)] / price[id][clamp(t0, 0, N - 1)] - 1,
    };
  }
  return { build, S };
})();
