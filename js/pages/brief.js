/* Briefing: rules, benchmark, research document and the Portfolio Builder.
   As in the real simulation you start in 100% cash: the builder sets your STRATEGY
   (target weights → contracts at today's prices); you execute it on the floor
   during the portfolio-construction phase. */
Pages.brief = (() => {
  let timer = null, scn, fund, W;
  const SRC = { course: ['course', 'From the AmplifyME course'], guess: ['our guess', 'Not confirmed in the course'], ours: ['our rule', 'Added for practice'], format: ['format', 'Rule of this format'] };

  function defaults() { const w = {}; for (const a of fund.assets) w[a.id] = +(fund.bench[a.id] * 100 * .97).toFixed(2); return w; }
  function render(v) {
    const P = App.pending;
    scn = P.scenario || (P.scenario = getScenario(P.scenarioId)); fund = UNIVERSE[scn.fund];
    W = P.weights || (P.weights = defaults());
    const R = mandateRanges(fund, fund.capital), rs = scn.research;
    const viewTag = vw => `<span class="tag view-${vw}">${{ OW: 'Overweight', N: 'Neutral', UW: 'Underweight' }[vw]}</span>`;
    const byId = Object.fromEntries(fund.assets.map(a => [a.id, a]));
    const groups = fund.classOrder.map(k => [k, fund.assets.filter(a => a.cls === k)]).filter(([, l]) => l.length);
    v.innerHTML = `
    <div class="page brief">
      <header class="brief-head">
        <div>
          <div class="eyebrow">${esc(scn.code)} · ${fund.name} · ${P.mode === 'exam' ? 'Exam mode' : 'Training mode'} · ${fund.quarters}×${fmtMin(P.quarterMin)} quarters, ${fmtMin(P.breakMin)} breaks</div>
          <h1 class="serif">Research &amp; portfolio builder</h1>
          <p class="muted">You'll start with <b>${Fmt.compact(fund.capital)} in cash</b>. Read the research, decide where each region is in the cycle, and set your strategy: start from the benchmark and tilt overweight or underweight. You'll execute it on the trading floor before Q1 starts.</p>
        </div>
        <div class="brief-timer card" id="b-timer" ${P.briefMin ? '' : 'hidden'}><span class="eyebrow">Reading time left</span><b class="mono" id="b-left">--:--</b><div class="progress"><i id="b-prog" style="width:100%"></i></div></div>
      </header>
      <div class="brief-grid">
        <div class="brief-l">
          <div class="card">
            <div class="row"><h3 class="grow">${icon('scale', 17)} Rules (investment constraints)</h3><span class="tag grey">${Fmt.money(fund.capital)}</span></div>
            <p class="muted sm">"Golden rule number one: do not break your investment constraints." Objective: <b>beat the benchmark</b> (relative return) over ${fund.quarters} quarters.</p>
            <div class="rules">${ruleList(fund).map(r => `<div class="rule">${icon('check', 14)}<span class="grow">${esc(r.label)}</span><span class="src src-${r.src}" title="${SRC[r.src][1]}">${SRC[r.src][0]}</span></div>`).join('')}</div>
            <div class="bench-bar">${fund.assets.filter(a => fund.bench[a.id] > 0).map((a, i) => `<i style="flex:${fund.bench[a.id]};background:var(--c${(i % 6) + 1})" title="${a.tk} ${Fmt.pct(fund.bench[a.id], 1)}"></i>`).join('')}</div>
            <div class="bench-legend">${fund.assets.map((a, i) => `<span><i style="background:${fund.bench[a.id] > 0 ? `var(--c${(i % 6) + 1})` : 'var(--locked)'}"></i>${a.tk} ${Fmt.pct(fund.bench[a.id], fund.bench[a.id] % .01 ? 2 : 0)}</span>`).join('')}</div>
            <p class="faint sm">Benchmark: ${scn.fund === 'multi' ? '"balanced" client: 50% equity (7 indices × 7.14%) / 30% bonds (US10 15%, GE10 15%) / 20% commodities (GOLD 10%, OIL 10%). EURUSD is tradable but 0% in the benchmark.' : 'equal-weight, 20% in each stock.'}</p>
          </div>
          <div class="card house"><div class="eyebrow">${icon('lightbulb', 13)} Research · house view (as of day 0)</div><p class="serif">${esc(rs.summary)}</p></div>
          ${rs.regions ? `<div class="region-grid">${rs.regions.map(r => `
            <div class="region"><div class="row"><b class="grow">${r.name}</b>${viewTag(r.view)}</div>
              ${r.phase ? `<div class="phase-chip">${icon('activity', 12)} Cycle: <b>${esc(r.phase)}</b></div>` : ''}
              <table class="kv">${r.rows.map(([k, x]) => `<tr><td>${k}</td><td>${x}</td></tr>`).join('')}</table>
              <p class="sm muted">${esc(r.note)}</p><div class="faint xs">Trades as <b>${r.id && byId[r.id] ? byId[r.id].tk + ' · ' + byId[r.id].name : ''}</b></div></div>`).join('')}</div>
            <div class="card"><h3>${icon('layers', 16)} Bonds, commodities &amp; FX</h3><table class="tbl"><tbody>${Object.entries(rs.assets).filter(([id]) => byId[id]).map(([id, x]) => { const a = byId[id]; return `<tr><td class="l"><b>${a.tk}</b> <span class="faint">${a.name}${a.bond && scn.yld0 && scn.yld0[id] != null ? ` · yield ${scn.yld0[id].toFixed(2)}%` : ''}</span></td><td class="l">${viewTag(x.view)}</td><td class="l wrap-cell muted">${esc(x.note)}</td></tr>`; }).join('')}</tbody></table></div>`
          : `<div class="region-grid">${Object.entries(rs.companies).map(([id, r]) => { const a = byId[id]; return `
            <div class="region"><div class="row"><b class="grow">${a.name}</b>${viewTag(r.view)}</div><div class="faint sm">${a.tk} · ${a.long}</div>
              <table class="kv">${r.rows.map(([k, x]) => `<tr><td>${k}</td><td>${x}</td></tr>`).join('')}</table><p class="sm muted">${esc(r.note)}</p></div>`; }).join('')}</div>`}
          ${scn.fund === 'multi' ? `<div class="card"><h3>${icon('route', 16)} Cycle playbook (from the course)</h3>
            <table class="tbl cyc"><thead><tr><th class="l">Phase</th><th class="l">Risk assets (equities)</th><th class="l">Safe havens (bonds, gold)</th><th class="l">Typical tilt vs 50/30/20</th></tr></thead><tbody>
              <tr><td class="l">Slowdown</td><td class="l down">↓ small</td><td class="l up">↑ small</td><td class="l">≈ 45 / 33 / 22</td></tr>
              <tr><td class="l">Recession</td><td class="l down">↓↓ worst</td><td class="l up">↑↑ best</td><td class="l">≈ 40 / 38 / 22</td></tr>
              <tr><td class="l">Recovery</td><td class="l up">↑↑ best</td><td class="l down">↓↓</td><td class="l">≈ 60 / 25 / 15 (course example)</td></tr>
              <tr><td class="l">Expansion</td><td class="l up">↑ small</td><td class="l down">↓ small</td><td class="l">≈ 55 / 27 / 18</td></tr></tbody></table>
            <p class="faint xs">Tilts other than the course's 60/25/15 example are illustrative. Class limits are ±10pp from 50/30/20.</p></div>` : ''}
          <div class="card"><h3>${icon('alert', 16)} Key risks on the radar</h3><ul class="risks">${rs.risks.map(r => `<li>${esc(r)}</li>`).join('')}</ul></div>
        </div>

        <div class="brief-r">
          <div class="card builder">
            <div class="row"><h3 class="grow">${icon('sliders', 17)} Portfolio builder</h3><button class="chip-btn" data-q="bench">Benchmark</button><button class="chip-btn" data-q="views">Apply views</button></div>
            <table class="tbl bt"><thead><tr><th>Instrument</th><th>Bench</th><th>Allowed</th><th>Strategy %</th><th>Contracts</th><th>Active</th></tr></thead><tbody>
              ${groups.map(([k, list]) => `<tr class="grp-row"><td colspan="6">${fund.classes[k]}<span class="faint" data-cls="${k}"></span></td></tr>` + list.map(a => `<tr data-row="${a.id}"><td><b>${a.tk}</b><div class="faint xs">${a.name}</div></td><td>${(fund.bench[a.id] * 100).toFixed(fund.bench[a.id] % .01 ? 2 : 0)}%</td><td class="faint">${(R.asset[a.id][0] * 100).toFixed(1)}–${(R.asset[a.id][1] * 100).toFixed(1)}</td>
                <td><div class="stepper"><button data-s="-1" data-a="${a.id}" aria-label="decrease">−</button><input class="mono" data-w="${a.id}" value="${W[a.id].toFixed(1)}" inputmode="decimal"><button data-s="1" data-a="${a.id}" aria-label="increase">+</button></div></td>
                <td class="mono" data-ct="${a.id}"></td><td><div class="act" data-act="${a.id}"></div></td></tr>`).join('')).join('')}
              <tr class="cash-row"><td><b>Cash</b><div class="faint xs">auto</div></td><td>0%</td><td class="faint">≤${((1 - fund.rules.minInvested) * 100).toFixed(0)} at Q starts</td><td><b class="mono" id="b-cash"></b></td><td></td><td></td></tr>
            </tbody></table>
            <div id="b-checks" class="checks"></div>
            <div class="b-sum" id="b-sum"></div>
            <button class="btn btn-primary lg full" id="launch">${icon('play', 18)} Go to the trading floor</button>
            <p class="faint xs center">You still start in cash: this plan appears in the Strategy tab, ready to execute before Q1.</p>
          </div>
        </div>
      </div>
    </div>`;

    v.querySelectorAll('[data-w]').forEach(inp => {
      inp.oninput = () => { const x = parseFloat(inp.value); if (isFinite(x)) { W[inp.dataset.w] = clamp(x, 0, 100); update(v); } };
      inp.onblur = () => { inp.value = W[inp.dataset.w].toFixed(1); };
      inp.onkeydown = e => { if (e.key === 'ArrowUp' || e.key === 'ArrowDown') { e.preventDefault(); step(v, inp.dataset.w, e.key === 'ArrowUp' ? .5 : -.5); } };
    });
    v.querySelectorAll('[data-s]').forEach(b => (b.onclick = () => step(v, b.dataset.a, +b.dataset.s * .5)));
    v.querySelectorAll('[data-q]').forEach(b => (b.onclick = () => {
      const d = defaults();
      if (b.dataset.q === 'views') {
        const viewOf = id => (rs.assets && rs.assets[id] && rs.assets[id].view) || (rs.companies && rs.companies[id] && rs.companies[id].view) || ((rs.regions || []).find(r => r.id === id) || {}).view || 'N';
        const tilt = scn.fund === 'multi' ? 1.5 : 5;
        for (const a of fund.assets) d[a.id] = clamp(d[a.id] + (a.cls === 'fx' ? 0 : { OW: tilt, UW: -tilt, N: 0 }[viewOf(a.id)]), R.asset[a.id][0] * 100, R.asset[a.id][1] * 100);
        const s = sum(Object.values(d)), k = 97 / s; for (const id in d) d[id] = +(d[id] * k).toFixed(2);
      }
      Object.assign(W, d); v.querySelectorAll('[data-w]').forEach(i => (i.value = W[i.dataset.w].toFixed(1))); update(v);
    }));
    $('#launch').onclick = () => launch();
    update(v);
    startTimer();
  }
  function step(v, id, d) { W[id] = clamp(+(W[id] + d).toFixed(2), 0, 100); v.querySelector(`[data-w="${id}"]`).value = W[id].toFixed(1); update(v); }
  function fmtMin(x) { return x >= 1 ? (+x.toFixed(1)) + ' min' : Math.round(x * 60) + 's'; }

  function state() {
    const w = {}; for (const a of fund.assets) w[a.id] = (W[a.id] || 0) / 100;
    const cash = 1 - sum(Object.values(w));
    return { w, cash, checks: mandateChecks(fund, w, cash, fund.capital) };
  }
  function update(v) {
    const s = state();
    $('#b-cash').textContent = (s.cash * 100).toFixed(1) + '%';
    $('#b-cash').className = 'mono ' + (s.cash < -1e-9 || 1 - s.cash < fund.rules.minInvested ? 'down' : '');
    for (const a of fund.assets) {
      const act = s.w[a.id] - fund.bench[a.id], el = v.querySelector(`[data-act="${a.id}"]`);
      const bad = s.checks.some(c => c.key === a.id && !c.ok);
      const wd = clamp(Math.abs(act) / .1 * 50, 0, 50);
      el.innerHTML = `<span class="act-bar"><i class="${act >= 0 ? 'pos' : 'neg'}" style="width:${wd}%;${act >= 0 ? 'left:50%' : 'right:50%'}"></i></span><span class="mono ${signCls(act)}">${Fmt.pp(act, 1)}</span>`;
      v.querySelector(`[data-row="${a.id}"]`).classList.toggle('bad-row', bad);
      const ct = s.w[a.id] * fund.capital / (a.p0 * a.mult);
      v.querySelector(`[data-ct="${a.id}"]`).textContent = s.w[a.id] > 0 ? Fmt.int(ct) : '—';
    }
    for (const k of Object.keys(fund.classes)) { const el = v.querySelector(`[data-cls="${k}"]`); if (el) el.textContent = ` · ${(sum(fund.assets.filter(a => a.cls === k).map(a => s.w[a.id])) * 100).toFixed(1)}% (bench ${(sum(fund.assets.filter(a => a.cls === k).map(a => fund.bench[a.id])) * 100).toFixed(0)}%)`; }
    const bad = s.checks.filter(c => !c.ok), over = s.cash < -1e-9, under = 1 - s.cash < fund.rules.minInvested - 1e-9;
    $('#b-checks').innerHTML = (over ? `<div class="chk bad">${icon('xCircle', 15)} Weights add up to ${(100 - s.cash * 100).toFixed(1)}%: over 100%, and leverage isn't allowed.</div>` : '') +
      (under ? `<div class="chk bad">${icon('xCircle', 15)} Only ${(100 - s.cash * 100).toFixed(1)}% invested: the rule is at least ${fund.rules.minInvested * 100}% at every quarter start.</div>` : '') +
      bad.map(c => `<div class="chk bad">${icon('xCircle', 15)} ${esc(c.label)} at ${c.usd ? Fmt.compact(c.value) : (c.value * 100).toFixed(1) + '%'}: allowed ${c.usd ? '≤ ' + Fmt.compact(c.max) : (c.min * 100).toFixed(1) + '–' + (c.max * 100).toFixed(1) + '%'}</div>`).join('') +
      (!bad.length && !over && !under ? `<div class="chk ok">${icon('checkCircle', 15)} Strategy satisfies every rule</div>` : '');
    const as = sum(fund.assets.map(a => Math.abs(s.w[a.id] - fund.bench[a.id]))) / 2;
    const ow = fund.assets.filter(a => s.w[a.id] - fund.bench[a.id] > .005), uw = fund.assets.filter(a => s.w[a.id] - fund.bench[a.id] < -.005);
    $('#b-sum').innerHTML = `<div><span class="faint">Active share</span><b class="mono">${Fmt.pct(as, 1)}</b></div><div><span class="faint">Overweights</span><b>${ow.map(a => a.tk).join(', ') || '—'}</b></div><div><span class="faint">Underweights</span><b>${uw.map(a => a.tk).join(', ') || '—'}</b></div>`;
    $('#launch').classList.toggle('btn-warn', !!(bad.length || over || under));
  }

  function startTimer() {
    clearInterval(timer);
    const P = App.pending; if (!P.briefMin) return;
    const tot = P.briefMin * 60000;
    const tick = () => {
      if (!$('#b-left')) return clearInterval(timer);
      const left = tot - (Date.now() - P.briefStart);
      $('#b-left').textContent = Fmt.clock(left); $('#b-prog').style.width = clamp(left / tot * 100, 0, 100) + '%';
      $('#b-timer').classList.toggle('urgent', left < 60000);
      if (left <= 0) {
        clearInterval(timer);
        if (P.mode === 'exam') { toast(`${icon('clock', 16)} Reading time is up. Heading to the trading floor.`, '', 3000); launch(true); }
        else toast(`${icon('clock', 16)} Reading time is up. In exam mode you'd go to the floor now.`, 'warn', 5000);
      }
    };
    tick(); timer = setInterval(tick, 500);
  }

  async function launch(forced) {
    const s = state();
    const bad = s.checks.filter(c => !c.ok).length || s.cash < 0 || 1 - s.cash < fund.rules.minInvested - 1e-9;
    if (bad && !forced && !(await confirmBox('Your strategy breaks a rule', 'You can still go to the floor and fix it there, but if you execute this plan as it is, you will be in breach.', 'Go anyway', 'btn-primary'))) return;
    clearInterval(timer);
    const P = App.pending;
    const sess = new Session({ scenario: P.scenario, scenarioId: P.scenarioId, mode: P.mode, quarterMin: P.quarterMin, breakMin: P.breakMin, buildMin: P.buildMin, variant: P.variant });
    sess.strategy = Object.assign({}, s.w);
    App.session = sess;
    location.hash = '#/floor';
  }
  function destroy() { clearInterval(timer); }
  return { render, destroy };
})();
