/* ==========================================================================
   Scoring: AmplifyME's five asset-management metrics
   The metric NAMES come from the AmplifyME course (videos 10–12). The course
   does not publish weights or formulas, so every formula below is OUR ESTIMATE.
   They are also explained on the Guide page.

   1 ROI                         percentile of your return vs the benchmark (relative return),
                                 ranked against 400 simulated peers on the same year
   2 Cycle judgement & allocation  60%: allocation effect = Σ days Σ instruments (your weight − benchmark)
                                 × (instrument return − benchmark return), scaled against a strong
                                 hindsight tilt · 40%: asset-class calls at each quarter start
                                 (over/underweight equity, bonds, commodities in the right direction)
   3 Rebalancing                 each quarter break: did you trade back from the drift (turnover ≥ drift,
                                 or drift < 1.5%) [70%] and end the break inside every limit [30%]
   4 Risk management             40% stop-loss ($500k rule: −25 per episode, −2 per day over) ·
                                 30% constraints (−0.6 per limit-day, −3 per episode) ·
                                 30% Sharpe ratio vs the benchmark's
   5 Risk appetite               ≥90% invested at each quarter start: 100 at ≥90%, 0 at ≤80%, linear between
   Overall                       simple average of the five (equal weights, our estimate)
   ========================================================================== */
const Scoring = (() => {
  const NAMES = ['Aisha B.', 'Ravi P.', 'Lucas M.', 'Sofia R.', 'Kenji T.', 'Hannah W.', 'Omar K.', 'Chloe D.', 'Mateo G.', 'Priya S.', 'Daniel O.', 'Mei L.', 'Tomás V.', 'Grace N.', 'Yusuf A.', 'Elena C.', 'Jonah F.', 'Amara E.', 'Felix H.', 'Zara Q.', 'Leo J.', 'Nadia I.', 'Sam U.', 'Ines Z.'];
  const FIRST = ['Noah', 'Lina', 'Arjun', 'Maya', 'Hugo', 'Sara', 'Ethan', 'Leila', 'Kai', 'Nora', 'Dev', 'Isla', 'Ben', 'Yara', 'Theo', 'Ana', 'Max', 'Rosa', 'Jae', 'Ella', 'Finn', 'Aditi', 'Luca', 'Zoe', 'Ali', 'Mira', 'Oscar', 'Tara', 'Jin', 'Lea', 'Sami', 'Ivy', 'Raf', 'Emi', 'Kofi', 'Nia', 'Wei', 'Ines', 'Tom', 'Hana'];
  const METRICS = [['roi', 'ROI'], ['cycle', 'Cycle judgement & allocation'], ['rebal', 'Rebalancing'], ['risk', 'Risk management'], ['appetite', 'Risk appetite']];

  function primaryAssets(e) {
    const ent = Object.entries(e.imp).filter(([, v]) => v); if (!ent.length) return [];
    const mx = Math.max(...ent.map(([, v]) => Math.abs(v)));
    return ent.filter(([, v]) => Math.abs(v) >= .6 * mx).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1])).slice(0, 3).map(([k, v]) => ({ id: k, dir: Math.sign(v), imp: v }));
  }
  const pctRank = (sorted, v) => { let lo = 0, hi = sorted.length; while (lo < hi) { const mid = (lo + hi) >> 1; if (sorted[mid] < v) lo = mid + 1; else hi = mid; } return clamp((lo / sorted.length) * 100, 0, 100); };
  const sharpe = navs => { const r = navs.slice(1).map((v, i) => v / navs[i] - 1); const s = std(r); return s > 0 ? (mean(r) / s) * Math.sqrt(252) : 0; };

  /* Market facts shared by every scorer on this year (computed once). */
  function context(m) {
    const fund = m.fund, ids = m.assets.map(a => a.id), S = m.S, days = m.days, nQ = fund.quarters;
    const close = d => (d < 0 ? 0 : m.closeStep(d));
    const dr = ids.map(id => { const out = new Float64Array(days); for (let d = 0; d < days; d++) out[d] = m.price[id][close(d)] / m.price[id][close(d - 1)] - 1; return out; });
    const br = new Float64Array(days); for (let d = 0; d < days; d++) br[d] = m.bench[close(d)] / m.bench[close(d - 1)] - 1;
    const qRet = [], qBench = [];
    for (let q = 0; q < nQ; q++) { const s0 = q * 63 * S, s1 = (q + 1) * 63 * S; qRet.push(ids.map(id => m.price[id][s1] / m.price[id][s0] - 1)); qBench.push(m.bench[s1] / m.bench[s0] - 1); }
    // hindsight allocation effect from tilting every instrument to its band edge in the right direction
    const R0 = mandateRanges(fund, fund.capital);
    let perfect = 0;
    for (let q = 0; q < nQ; q++) ids.forEach((id, i) => { const rel = qRet[q][i] - qBench[q], b = fund.bench[id], [lo, hi] = R0.asset[id]; perfect += rel > 0 ? (hi - b) * rel : (b - lo) * -rel; });
    const clsKeys = Object.keys(fund.classes).filter(k => fund.assets.some(a => a.cls === k && fund.bench[a.id] > 0));
    const clsRet = qRet.map(row => Object.fromEntries(clsKeys.map(k => { const as = fund.assets.filter(a => a.cls === k && fund.bench[a.id] > 0), bw = sum(as.map(a => fund.bench[a.id])); return [k, sum(as.map(a => fund.bench[a.id] * row[ids.indexOf(a.id)])) / bw]; })));
    return { fund, ids, days, nQ, dr, br, qRet, qBench, perfect, clsKeys, clsRet };
  }

  /* rec = { dailyNav, dailyBench, dailyW (per close, incl. cash), qStarts [{q, invested, w}],
             breaks [{drift, turnover, inLimits}], stop {episodes, days}, limit {limitDays, episodes} } */
  function metrics(rec, C) {
    const fund = C.fund, ids = C.ids;
    // 2 cycle judgement & allocation
    let alloc = 0;
    const n = Math.min(rec.dailyW.length - 1, C.days);
    for (let d = 0; d < n; d++) { const w = rec.dailyW[d]; for (let i = 0; i < ids.length; i++) alloc += ((w[ids[i]] || 0) - fund.bench[ids[i]]) * (C.dr[i][d] - C.br[d]); }
    const allocScore = clamp(50 + 50 * alloc / (.35 * C.perfect || 1), 0, 100);
    let hitW = 0, hitTot = 0;
    for (const qs of rec.qStarts) {
      const q = qs.q - 1; if (q >= C.nQ) continue;
      for (const k of C.clsKeys) {
        const act = sum(fund.assets.filter(a => a.cls === k).map(a => (qs.w[a.id] || 0) - fund.bench[a.id]));
        const rel = C.clsRet[q][k] - C.qBench[q];
        if (Math.abs(act) < .005) continue;
        hitTot += Math.abs(act); if (Math.sign(act) === Math.sign(rel)) hitW += Math.abs(act);
      }
    }
    const classHit = hitTot > .02 ? hitW / hitTot : .5;
    const cycle = .6 * allocScore + .4 * classHit * 100;
    // 3 rebalancing
    const brs = rec.breaks.filter(b => b.inLimits != null);
    const brScores = brs.map(b => { const A = b.drift < .015 ? 1 : clamp(b.turnover / b.drift, 0, 1); return 70 * A + 30 * (b.inLimits ? 1 : 0); });
    const rebal = brScores.length ? mean(brScores) : 50;
    // 4 risk management
    const stopScore = clamp(100 - 25 * rec.stop.episodes - 2 * rec.stop.days, 0, 100);
    const consScore = clamp(100 - .6 * rec.limit.limitDays - 3 * rec.limit.episodes, 0, 100);
    const sr = sharpe(rec.dailyNav), srb = sharpe(rec.dailyBench.slice(0, rec.dailyNav.length));
    const sharpeScore = clamp(50 + 30 * (sr - srb), 0, 100);
    const risk = .4 * stopScore + .3 * consScore + .3 * sharpeScore;
    // 5 risk appetite
    const appScores = rec.qStarts.map(q => clamp((q.invested - .8) / .1, 0, 1) * 100);
    const appetite = appScores.length ? mean(appScores) : 0;
    return { cycle, rebal, risk, appetite, parts: { alloc, allocScore, classHit, brScores, stopScore, consScore, sharpeScore, sr, srb, appScores } };
  }
  const overallOf = s => mean([s.roi, s.cycle, s.rebal, s.risk, s.appetite]);

  /* ---------------- simulated peers ---------------- */
  function peers(m, n = 400, C) {
    C = C || context(m);
    const fund = m.fund, ids = C.ids, R = fund.rules, rng = RNG((m.scn.seed || 7) * 31 + 17);
    const Rg = mandateRanges(fund, fund.capital), cap = fund.capital;
    const lim = R.maxTradeLossUsd || 1e12;
    const out = [];
    for (let b = 0; b < n; b++) {
      const skill = rng(), disc = rng(), lazy = rng() < .25, lowCash = rng() < .14;
      let w = {}, cash = 1, nav = cap, basis = {};
      const rec = { dailyNav: [cap], dailyBench: [], dailyW: [], qStarts: [], breaks: [], stop: { episodes: 0, days: 0 }, limit: { limitDays: 0, episodes: 0 } };
      let wasBad = false, strat = null, stopOn = {};
      const path = [1];
      for (let q = 0; q < C.nQ; q++) {
        const rebalance = q === 0 || (!lazy && rng() < .35 + .6 * disc);
        if (q > 0) rec.breaks.push({ drift: sum(ids.map(id => Math.abs((w[id] || 0) - (strat[id] || 0)))) / 2, turnover: 0, inLimits: null });
        if (rebalance) {
          const eqRel = C.clsRet[q].eq - C.qBench[q];
          const right = rng() < .42 + .4 * skill;
          const t = (right ? Math.sign(eqRel) : -Math.sign(eqRel)) * rng.range(.01, .09);
          const tgt = {};
          for (const a of fund.assets) {
            let x = fund.bench[a.id] + (a.cls === 'eq' ? t / 7 : a.cls === 'bond' ? -t * .3 : a.cls === 'cmd' ? -t * .2 : 0) + rng.normal() * .012;
            if (a.cls === 'fx') x = rng() < .15 ? rng.range(0, .04) : 0;
            tgt[a.id] = clamp(x, Rg.asset[a.id][0], Rg.asset[a.id][1]);
          }
          const inv = lowCash ? rng.range(.8, .9) : rng.range(.91, .995), s = sum(Object.values(tgt));
          for (const id of ids) tgt[id] = (tgt[id] / s) * inv;
          const turn = sum(ids.map(id => Math.abs(tgt[id] - (w[id] || 0)))) / 2;
          if (q > 0) rec.breaks[q - 1].turnover = turn;
          nav *= 1 - turn * 2 * rng.range(2, 8) / 1e4;
          w = tgt; cash = 1 - sum(Object.values(w)); strat = Object.assign({}, w);
          for (const id of ids) basis[id] = w[id] * nav;
        }
        const ch0 = mandateChecks(fund, w, cash, nav);
        if (q > 0) rec.breaks[q - 1].inLimits = ch0.every(c => c.ok);
        rec.qStarts.push({ q: q + 1, invested: 1 - cash, w: Object.assign({}, w) });
        if (q === 0) rec.dailyW.push(Object.assign({ cash }, w));
        for (let d = q * 63; d < (q + 1) * 63; d++) {
          let g = cash; ids.forEach((id, i) => { w[id] *= 1 + C.dr[i][d]; g += w[id]; });
          nav *= g; for (const id of ids) w[id] /= g; cash /= g;
          // stop-loss behaviour
          for (const id of ids) {
            const val = w[id] * nav, loss = (basis[id] || 0) - val;
            if (loss > .8 * lim && rng() < disc * .35) { const cut = w[id] * .5; w[id] -= cut; cash += cut; basis[id] = w[id] * nav; stopOn[id] = false; continue; }
            if (loss > lim) { rec.stop.days++; if (!stopOn[id]) { rec.stop.episodes++; stopOn[id] = true; } if (rng() < disc * .6) { const cut = w[id] * .6; w[id] -= cut; cash += cut; basis[id] = w[id] * nav; stopOn[id] = false; } }
            else stopOn[id] = false;
          }
          // fixing breaches
          const ch = mandateChecks(fund, w, cash, nav), bad = ch.filter(c => !c.ok);
          if (bad.length && rng() < .25 + .6 * disc) { for (const id of ids) { const c2 = clamp(w[id], Rg.asset[id][0], Rg.asset[id][1]); cash += w[id] - c2; w[id] = c2; } }
          const bad2 = mandateChecks(fund, w, cash, nav).filter(c => !c.ok).length;
          rec.limit.limitDays += bad2; if (bad2 && !wasBad) rec.limit.episodes++; wasBad = bad2 > 0;
          rec.dailyNav.push(nav); rec.dailyW.push(Object.assign({ cash }, w));
          if (b < NAMES.length) path.push(nav / cap);
        }
      }
      rec.dailyBench = Array.from({ length: days1(C) }, (_, d) => cap * m.bench[d ? m.closeStep(d - 1) : 0]);
      const mt = metrics(rec, C);
      out.push(Object.assign({ name: b < NAMES.length ? NAMES[b] : FIRST[b % FIRST.length] + ' ' + 'ABCDEFGHIJKLMNOPRSTUVWZ'[(b * 7) % 23] + '.', ret: nav / cap - 1, path: b < NAMES.length ? path : null }, mt));
    }
    const ex = out.map(o => o.ret).sort((a, b) => a - b);
    for (const o of out) { o.roi = pctRank(ex, o.ret); o.overall = overallOf(o); }
    return out;
  }
  const days1 = C => C.days + 1;

  /* ---------------- your result ---------------- */
  function score(s) {
    const m = s.m, cap = s.capital, end = s.step, C = context(m);
    const navEnd = s.nav(end), ret = navEnd / cap - 1, benchRet = m.bench[end] - 1;
    const dn = s.daily.nav, db = s.daily.bench;
    const rec = { dailyNav: dn, dailyBench: db, dailyW: s.daily.w, qStarts: s.qStarts, breaks: s.breaks, stop: { episodes: s.stop.episodes.length, days: s.stop.days }, limit: { limitDays: s.breach.limitDays, episodes: s.breach.episodes.length } };
    const mt = metrics(rec, C);
    const P = peers(m, 400, C), prets = P.map(p => p.ret).sort((a, b) => a - b);
    const roi = pctRank(prets, ret);
    const scores = { roi, cycle: mt.cycle, rebal: mt.rebal, risk: mt.risk, appetite: mt.appetite };
    scores.overall = overallOf(scores);
    scores.ff = s.fat.length;
    const better = P.filter(p => p.overall > scores.overall).length, rank = better + 1, field = P.length + 1;
    const dr = dn.slice(1).map((v, i) => v / dn[i] - 1), brr = db.slice(1).map((v, i) => v / db[i] - 1);
    let peak = dn[0], mdd = 0; for (const v of dn) { peak = Math.max(peak, v); mdd = Math.min(mdd, v / peak - 1); }
    let bpk = db[0], bmdd = 0; for (const v of db) { bpk = Math.max(bpk, v); bmdd = Math.min(bmdd, v / bpk - 1); }
    const tr = s.trades;
    const notional = sum(tr.map(t => t.notional)), impactUsd = sum(tr.map(t => t.costUsd));

    // news review (learning aid, not scored)
    const review = [];
    for (const e of m.evs) {
      if (e.step > end || e.sev < 1) continue;
      const pa = primaryAssets(e), rows = [];
      let sc = null;
      if (e.sev >= 2 && pa.length) {
        let tot = 0;
        for (const p of pa) {
          const win = tr.filter(t => t.asset === p.id && t.step >= e.step && t.step <= e.step + 5 * m.S && t.phase === 'quarter');
          const net = sum(win.map(t => t.side * t.notional)) * p.dir;
          const w0 = s.daily.w[Math.min(m.dayOf(e.step), s.daily.w.length - 1)] || {};
          const act = ((w0[p.id] || 0) - m.fund.bench[p.id]) * p.dir;
          let v, txt;
          if (net >= .004 * cap) { v = 1; txt = 'reacted'; } else if (net <= -.004 * cap) { v = 0; txt = 'traded against'; } else if (act >= .015) { v = .6; txt = 'already positioned'; } else { v = 0; txt = 'no action'; }
          tot += v; rows.push({ id: p.id, dir: p.dir, net: net * p.dir, verdict: txt, v, move: m.ret(p.id, e.step - 1, Math.min(m.N - 1, e.step + 5 * m.S)) });
        }
        sc = tot / pa.length;
      }
      review.push({ day: m.dayOf(e.step), sev: e.sev, tag: e.tag, h: e.h, why: e.why, score: sc, rows });
    }

    const res = {
      v: 2, id: 'r' + Date.now().toString(36), at: Date.now(),
      scenario: { id: s.scn.id, code: s.scn.code, fund: s.scn.fund, title: s.scn.reveal && s.scn.reveal.title, basis: s.scn.reveal && s.scn.reveal.basis, lessons: (s.scn.reveal && s.scn.reveal.lessons) || [], random: !!s.scn.random, seed: s.scn.seed },
      cfg: { mode: s.cfg.mode, quarterMin: s.cfg.quarterMin, breakMin: s.cfg.breakMin, buildMin: s.cfg.buildMin, variant: s.cfg.variant },
      early: !!s.early, progress: end / (m.N - 1),
      nav: navEnd, ret, benchRet, excess: ret - benchRet,
      vol: std(dr) * Math.sqrt(252), bvol: std(brr) * Math.sqrt(252), mdd, bmdd, sr: mt.parts.sr, srb: mt.parts.srb,
      scores, parts: mt.parts,
      qStarts: s.qStarts.map(q => ({ q: q.q, invested: q.invested, ok: q.ok, breaches: q.breaches })),
      breaks: s.breaks.map((b, i) => ({ after: b.after, drift: b.drift, turnover: b.turnover, trades: b.trades, inLimits: b.inLimits, score: mt.parts.brScores[i] })),
      stop: { episodes: s.stop.episodes.map(e => Object.assign({}, e)), days: s.stop.days },
      risk: { limitDays: s.breach.limitDays, episodes: s.breach.episodes.map(e => Object.assign({}, e)) },
      exec: { trades: tr.length, notional, impactUsd, avgBps: notional ? impactUsd / notional * 1e4 : 0, commissions: sum(tr.map(t => t.commission)), rejects: s.rejects.length },
      rank, field, pctile: 100 * (1 - (rank - 1) / field),
      peers: { overall: P.map(p => p.overall).sort((a, b) => a - b), top: P.slice().sort((a, b) => b.overall - a.overall).slice(0, 5).map(p => ({ name: p.name, overall: p.overall, ret: p.ret })), avg: Object.fromEntries(METRICS.map(([k]) => [k, mean(P.map(p => p[k]))])) },
      fat: s.fat.slice(),
      series: { nav: dn.map(v => +(v / cap).toFixed(5)), bench: db.map(v => +(v / cap).toFixed(5)) },
      trades: tr.map(t => ({ n: t.n, day: t.day, phase: t.phase, q: t.q, asset: t.asset, side: t.side, qty: t.qty, px: t.px, notional: t.notional, costBps: t.costBps, venue: t.venue, bank: t.bank })),
      review, quarters: s.quarters.slice(),
    };
    res.tips = tips(res, s);
    return res;
  }

  function tips(r) {
    const out = [], sc = r.scores, p = r.parts;
    const missed = r.qStarts.filter(q => !q.ok);
    if (missed.length) out.push({ k: 'bad', t: `Risk appetite: you were under 90% invested at the start of ${missed.map(q => 'Q' + q.q).join(', ')} (${missed.map(q => Fmt.pct(q.invested, 1)).join(', ')}). Before each break ends, check the Invested figure and buy enough to clear 90% with some margin.` });
    if (r.stop.episodes.length) out.push({ k: 'bad', t: `Stop-loss: ${r.stop.episodes.length} position${r.stop.episodes.length > 1 ? 's' : ''} lost more than $500k (${r.stop.episodes.map(e => `${e.tk} ${Fmt.compact(-e.maxLoss)}`).join(', ')}). Watch the Risk tab's stop-loss bars and cut at about −$400k. With $5M in one product, a 10% fall hits the limit.` });
    if (p.consScore < 85) out.push({ k: 'bad', t: `Constraints: ${r.risk.limitDays} limit-days outside the rules (bands, class limits or the $5M cap). Price moves push weights through limits on their own, so check the Fund Weighting after big moves.` });
    const weak = r.breaks.filter(b => b.score != null && b.score < 60);
    if (weak.length) out.push({ k: 'warn', t: `Rebalancing: at ${weak.map(b => `the Q${b.after}→Q${b.after + 1} break`).join(', ')} your weights had drifted ${weak.map(b => Fmt.pct(b.drift, 1)).join(', ')} from your strategy and you traded back ${weak.map(b => Fmt.pct(b.turnover || 0, 1)).join(', ')}. Use the Strategy tab: it shows the contracts needed to get back to plan.` });
    if (sc.cycle < 50) out.push({ k: 'warn', t: `Cycle judgement: your over/underweights lost against the benchmark (allocation effect ${Fmt.pp(p.alloc, 2)}). Re-read the research at each break, decide which phase each region is in, and tilt the asset classes (e.g. 60/25/15 in a recovery, 40/35/25 into a slowdown).` });
    if (p.sharpeScore < 45) out.push({ k: 'warn', t: `Sharpe ${r.sr.toFixed(2)} vs benchmark ${r.srb.toFixed(2)}: you took more volatility than the return justified. Concentrated bets in volatile indices (HSI, MXLA, ESTOXX) drive this.` });
    if (r.excess > 0) out.push({ k: 'good', t: `You beat the benchmark by ${Fmt.pp(r.excess, 2)}.` });
    if (!missed.length && r.qStarts.length) out.push({ k: 'good', t: 'Risk appetite: at least 90% invested at every quarter start.' });
    if (!r.stop.episodes.length && r.qStarts.length) out.push({ k: 'good', t: 'No position ever lost more than $500k.' });
    if (r.fat.length) out.push({ k: 'warn', t: `${r.fat.length} order error${r.fat.length > 1 ? 's' : ''} (rejected orders, limit-breaking trades, quick reversals). Not one of the five metrics, but each is a real mistake on the day.` });
    return out;
  }
  return { score, peers, primaryAssets, context, metrics, METRICS };
})();
