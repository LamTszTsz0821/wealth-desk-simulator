/* Debrief / scorecard: AmplifyME's five metrics (formulas are our estimates) */
Pages.results = (() => {
  let revFilter = 'major';
  function ring(v, size = 168) {
    const r = size / 2 - 12, c = 2 * Math.PI * r;
    return `<svg class="ring" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><defs><linearGradient id="rg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#7034f5"/><stop offset=".5" stop-color="#5c4ef5"/><stop offset="1" stop-color="#53a7ea"/></linearGradient></defs>
      <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="rgba(60,50,110,.1)" stroke-width="12"/>
      <circle class="ring-arc" cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="url(#rg)" stroke-width="12" stroke-linecap="round" stroke-dasharray="${c}" stroke-dashoffset="${c}" style="--to:${c * (1 - v / 100)}" transform="rotate(-90 ${size / 2} ${size / 2})"/></svg>`;
  }
  function grade(v) { return v >= 85 ? ['Outstanding', 'ok'] : v >= 75 ? ['Strong', 'ok'] : v >= 62 ? ['Solid', 'warn'] : v >= 50 ? ['Developing', 'warn'] : ['Needs work', 'bad']; }
  const fmtMin = x => (x >= 1 ? +(+x).toFixed(1) + 'm' : Math.round(x * 60) + 's');

  function render(v, params) {
    const th = document.getElementById('toasts'); if (th) th.innerHTML = '';
    const all = App.results();
    const r = all.find(x => x.id === params[0]) || all[0];
    if (!r) { v.innerHTML = `<div class="page"><div class="empty big-empty">${icon('award', 30)}<h2>No results yet</h2><p class="muted">Finish a simulation to see your scorecard.</p><a class="btn btn-primary" href="#/">Go to the lobby</a></div></div>`; return; }
    const fund = UNIVERSE[r.scenario.fund], sc = r.scores, p = r.parts, [gl, gc] = grade(sc.overall), pa = r.peers.avg || {};
    const metric = (k, label, val, desc, detail, ic) => `<div class="metric"><div class="m-head"><span class="m-ic">${icon(ic, 17)}</span><span class="muted">${label}</span></div><div class="row" style="align-items:baseline"><div class="m-v mono grow" data-count="${val}">0%</div>${pa[k] != null ? `<span class="faint xs" title="Average of the simulated peers">peer avg ${pa[k].toFixed(0)}%</span>` : ''}</div><div class="progress"><i style="width:${clamp(val, 0, 100)}%"></i></div><div class="faint sm">${desc}</div>${detail ? `<div class="m-d sm">${detail}</div>` : ''}</div>`;
    const info = (label, val, desc, ic, cls = '') => `<div class="metric info"><div class="row"><span class="m-ic">${icon(ic, 17)}</span><span class="grow muted">${label}</span><span class="tag grey">info</span></div><div class="m-v mono ${cls}">${val}</div><div class="faint sm">${desc}</div></div>`;
    v.innerHTML = `
    <div class="page results">
      <header class="res-head">
        <div>
          <div class="eyebrow">Debrief · ${esc(r.scenario.code)} · ${fund.name} · ${r.cfg.mode === 'exam' ? 'Exam' : 'Training'} · ${fund.quarters}×${fmtMin(r.cfg.quarterMin)} + ${fmtMin(r.cfg.breakMin)} breaks · ${Fmt.date(r.at)}</div>
          <h1 class="serif">${esc(r.scenario.title || r.scenario.code)}</h1>
          <p class="muted">${esc(r.scenario.basis || '')}${r.early ? ` · <span class="tag warn">ended early at ${Math.round(r.progress * 100)}% of the year</span>` : ''}</p>
        </div>
        <div class="row wrap"><button class="btn btn-outline" id="retry">${icon('rotate', 16)} Retry this scenario</button><a class="btn btn-primary" href="#/">${icon('play', 16)} New simulation</a></div>
      </header>

      <section class="res-hero card">
        <div class="ring-wrap">${ring(sc.overall)}<div class="ring-c"><b class="mono" id="ov">0.0%</b><span>Overall</span></div></div>
        <div class="res-hero-m">
          <div class="row wrap" style="gap:8px"><span class="tag ${gc}">${gl}</span><span class="tag">${icon('trophy', 13)} #${r.rank} of ${r.field}</span><span class="tag grey">Top ${Math.max(1, Math.round(100 - r.pctile + 100 / r.field))}%</span></div>
          <div class="kpis">
            <div><span>Fund return</span><b class="mono ${signCls(r.ret)}">${Fmt.pctS(r.ret)}</b></div>
            <div><span>Benchmark 50/30/20</span><b class="mono">${Fmt.pctS(r.benchRet)}</b></div>
            <div><span>Relative (alpha)</span><b class="mono ${signCls(r.excess)}">${Fmt.pp(r.excess, 2)}</b></div>
            <div><span>Final NAV</span><b class="mono">${Fmt.compact(r.nav)}</b></div>
            <div><span>Sharpe</span><b class="mono">${r.sr.toFixed(2)} <small class="faint">bench ${r.srb.toFixed(2)}</small></b></div>
            <div><span>Max drawdown</span><b class="mono">${Fmt.pct(r.mdd, 1)} <small class="faint">bench ${Fmt.pct(r.bmdd, 1)}</small></b></div>
          </div>
          <p class="faint sm">The five metric <b>names</b> come from the AmplifyME course. Their formulas and the equal-weight overall are <b>our estimate</b>. <a href="#/guide">How scoring works</a></p>
        </div>
      </section>

      <section class="metric-grid five">
        ${metric('roi', '1 · ROI', sc.roi, 'Return vs the benchmark, ranked against 400 simulated peers.', `${Fmt.pctS(r.ret)} · ${Fmt.pp(r.excess, 2)} vs bench`, 'trending')}
        ${metric('cycle', '2 · Cycle judgement & allocation', sc.cycle, 'Were your over/underweights on the right side of the cycle?', `allocation effect ${Fmt.pp(p.alloc, 2)} · class calls right ${Fmt.pct(p.classHit, 0)}`, 'activity')}
        ${metric('rebal', '3 · Rebalancing', sc.rebal, 'Trading back to your strategy in each quarter break.', r.breaks.length ? r.breaks.map(b => `Q${b.after}→${b.after + 1}: ${b.score != null ? b.score.toFixed(0) : '—'}`).join(' · ') : 'no breaks reached', 'rotate')}
        ${metric('risk', '4 · Risk management', sc.risk, 'Stop-loss discipline ($500k), rule breaches and Sharpe ratio.', `stop ${p.stopScore.toFixed(0)} · rules ${p.consScore.toFixed(0)} · Sharpe ${p.sharpeScore.toFixed(0)}`, 'shield')}
        ${metric('appetite', '5 · Risk appetite', sc.appetite, '≥90% invested at the start of every quarter.', r.qStarts.map(q => `Q${q.q} ${Fmt.pct(q.invested, 0)}`).join(' · ') || '—', 'percent')}
      </section>
      <section class="metric-grid info-grid">
        ${info('Order errors', r.fat.length, 'Rejected orders, limit-breaking trades, quick reversals.', 'alert', r.fat.length ? 'down' : '')}
        ${info('Market impact paid', Fmt.compact(r.exec.impactUsd), `${r.exec.trades} trades · ${Fmt.compact(r.exec.notional)} traded · ${r.exec.avgBps.toFixed(1)}bp avg${r.exec.commissions ? ` · ${Fmt.money(r.exec.commissions)} commission` : ' · no commission'}`, 'zap')}
        ${info('Stop-loss breaches', r.stop.episodes.length, r.stop.episodes.length ? r.stop.episodes.map(e => `${e.tk} ${Fmt.compact(e.maxLoss)}`).join(' · ') : 'No position ever lost more than $500k.', 'shield', r.stop.episodes.length ? 'down' : 'up')}
        ${info('Volatility', Fmt.pct(r.vol, 1), `benchmark ${Fmt.pct(r.bvol, 1)}`, 'lineChart')}
      </section>

      <section class="res-2">
        <div class="card"><div class="row"><h3 class="grow">Fund vs benchmark</h3><span class="faint xs">cumulative return · quarter lines</span></div><div class="res-chart"><canvas id="r-chart"></canvas></div>
          <table class="tbl q-tbl"><thead><tr><th>Quarter</th><th>Invested at start</th><th>Fund</th><th>Benchmark</th><th>Relative</th></tr></thead><tbody>${r.quarters.map(q => { const qs = r.qStarts.find(x => x.q === q.q); return `<tr><td>Q${q.q}</td><td class="${qs && !qs.ok ? 'down' : ''}">${qs ? Fmt.pct(qs.invested, 1) + (qs.ok ? '' : ' ✗') : '—'}</td><td class="${signCls(q.ret)}">${Fmt.pctS(q.ret)}</td><td>${Fmt.pctS(q.bench)}</td><td class="${signCls(q.ret - q.bench)}">${Fmt.pp(q.ret - q.bench, 2)}</td></tr>`; }).join('')}</tbody></table></div>
        <div class="card"><div class="row"><h3 class="grow">Where you finished</h3><span class="faint xs">overall score · ${r.field - 1} simulated peers</span></div><div class="res-hist"><canvas id="r-hist"></canvas></div>
          <div class="lb top5">${r.peers.top.map((x, i) => `<div class="lb-row"><span class="lb-n">${i + 1}</span><span class="grow">${esc(x.name)}</span><span class="mono faint">${Fmt.pctS(x.ret, 1)}</span><b class="mono">${x.overall.toFixed(1)}%</b></div>`).join('')}<div class="lb-row me"><span class="lb-n">${r.rank}</span><span class="grow"><b>You</b></span><span class="mono faint">${Fmt.pctS(r.ret, 1)}</span><b class="mono">${sc.overall.toFixed(1)}%</b></div></div></div>
      </section>

      <section class="res-2">
        <div class="card"><h3>${icon('target', 16)} What to work on</h3><div class="tips">${r.tips.map(t => `<div class="tip ${t.k}">${icon(t.k === 'good' ? 'checkCircle' : t.k === 'bad' ? 'xCircle' : 'alert', 16)}<span>${t.t}</span></div>`).join('') || '<p class="muted">Nothing major. Excellent run.</p>'}</div></div>
        <div class="card"><h3>${icon('lightbulb', 16)} What happened this year</h3><ul class="lessons">${r.scenario.lessons.map(l => `<li>${esc(l)}</li>`).join('')}</ul></div>
      </section>

      <section class="card">
        <h3>${icon('rotate', 16)} Rebalancing breaks</h3>
        ${r.breaks.length ? `<table class="tbl"><thead><tr><th class="l">Break</th><th>Drift from your strategy</th><th>Traded back (one-way)</th><th>Trades</th><th>All rules OK after</th><th>Invested after</th><th>Score</th></tr></thead><tbody>${r.breaks.map(b => `<tr><td class="l">Q${b.after} → Q${b.after + 1}</td><td>${Fmt.pct(b.drift, 1)}</td><td>${b.turnover != null ? Fmt.pct(b.turnover, 1) : '—'}</td><td>${b.trades ?? '—'}</td><td class="${b.inLimits ? 'up' : 'down'}">${b.inLimits == null ? '—' : b.inLimits ? 'yes' : 'no'}</td><td>${(r.qStarts.find(q => q.q === b.after + 1) || {}).invested != null ? Fmt.pct(r.qStarts.find(q => q.q === b.after + 1).invested, 1) : '—'}</td><td><b>${b.score != null ? b.score.toFixed(0) : '—'}</b></td></tr>`).join('')}</tbody></table>
        <p class="faint xs">Score per break (our estimate): 70% for trading back at least the drift (or drift under 1.5%) + 30% for ending the break inside every rule.</p>` : '<p class="muted">The session ended before the first break.</p>'}
        ${r.stop.episodes.length || r.risk.episodes.length ? `<h4 style="margin-top:14px">Breaches</h4>${r.stop.episodes.map(e => `<div class="tip bad">${icon('shield', 15)}<span>Stop-loss: ${e.tk} position down ${Fmt.compact(e.maxLoss)} (limit $500k), ${simDate(e.startDay).label}${e.endDay > e.startDay ? '–' + simDate(e.endDay).label : ''}</span></div>`).join('')}${r.risk.episodes.map(e => `<div class="tip warn">${icon('alert', 15)}<span>${esc(e.label)} ${e.dir} limit from ${simDate(e.startDay).label} to ${simDate(e.endDay).label} (${e.endDay - e.startDay + 1} day${e.endDay > e.startDay ? 's' : ''})</span></div>`).join('')}` : ''}
      </section>

      ${r.review ? `<section class="card">
        <div class="row"><h3 class="grow">${icon('newspaper', 16)} News review <span class="tag grey">learning aid · not scored</span></h3>${seg('rv-f', [['major', 'Market-moving'], ['missed', 'Missed / wrong way'], ['good', 'Good calls'], ['all', 'All']], revFilter)}</div>
        <div class="review" id="review"></div>
      </section>` : ''}
      ${r.trades ? `<section class="card">
        <div class="row"><h3 class="grow">${icon('list', 16)} Trades (${r.trades.length})</h3><span class="faint xs">cost = execution vs mid (spread + market impact)</span></div>
        ${r.trades.length ? `<div class="scroll-x"><table class="tbl"><thead><tr><th>#</th><th class="l">When</th><th class="l">Instrument</th><th class="l">Side</th><th>Contracts</th><th>Price</th><th>Notional</th><th>Cost</th></tr></thead><tbody>${r.trades.map(t => { const a = fund.assets.find(x => x.id === t.asset); return `<tr><td>${t.n}</td><td class="l">${t.phase === 'quarter' ? simDate(t.day).label + ' · Q' + t.q : t.phase === 'build' ? 'Construction' : 'Break → Q' + t.q}</td><td class="l"><b>${a.tk}</b></td><td class="l ${t.side > 0 ? 'up' : 'down'}">${t.side > 0 ? 'BUY' : 'SELL'}</td><td>${Fmt.int(t.qty)}</td><td>${Fmt.num(t.px, a.dp)}</td><td>${Fmt.compact(t.notional)}</td><td class="${t.costBps > 8 ? 'down' : ''}">${t.costBps.toFixed(1)}bp</td></tr>`; }).join('')}</tbody></table></div>` : '<p class="muted">No trades.</p>'}
        ${r.fat.length ? `<h4 style="margin-top:14px">Order errors</h4>${r.fat.map(f => `<div class="tip bad">${icon('alert', 15)}<span>${esc(f.text)}</span></div>`).join('')}` : ''}
      </section>` : ''}
    </div>`;

    $('#retry').onclick = () => {
      const lob = Store.get('lobby', {});
      const id = r.scenario.random ? `rnd-${r.scenario.fund}-${r.scenario.seed}` : r.scenario.id;
      App.pending = { scenarioId: id, mode: r.cfg.mode, quarterMin: r.cfg.quarterMin, breakMin: r.cfg.breakMin, buildMin: r.cfg.buildMin, briefMin: lob.brief ?? 10, briefStart: Date.now(), variant: 0 };
      location.hash = '#/brief';
    };
    countUp($('#ov'), sc.overall, x => x.toFixed(1) + '%', 1200);
    v.querySelectorAll('[data-count]').forEach(el => countUp(el, +el.dataset.count, x => x.toFixed(1) + '%', 1000));
    requestAnimationFrame(() => v.querySelector('.ring-arc').classList.add('go'));
    if (sc.overall >= 75) confetti();
    if (r.series) {
      const draw = () => {
        const cv = $('#r-chart'); if (!cv) return;
        const nav = r.series.nav.map(x => (x - 1) * 100), bm = r.series.bench.map(x => (x - 1) * 100);
        Charts.line(cv, { series: [{ data: nav, color: Charts.css('--accent'), width: 2, fill: 'rgba(92,78,245,.12)', tag: x => x.toFixed(1) + '%' }, { data: bm, color: Charts.css('--bench'), width: 1.5, dash: [4, 3], tag: x => x.toFixed(1) + '%' }], xMax: fund.months * 21, yFmt: x => x.toFixed(0) + '%', yInclude: [0],
          xLabels: Array.from({ length: fund.months }, (_, i) => ({ x: i * 21, label: MONTHS[i], tick: i % 3 === 0 && i > 0 })), markers: (r.trades || []).filter(t => t.phase === 'quarter').map(t => ({ x: t.day, kind: 'news', sev: 1 })) });
        Charts.histogram($('#r-hist'), r.peers.overall, sc.overall, { fmt: x => x.toFixed(0) + '%' });
      };
      requestAnimationFrame(draw); new ResizeObserver(draw).observe($('.res-chart'));
    }
    if (r.review) { segWire($('#rv-f'), x => { revFilter = x; review(r); }); review(r); }
  }

  function review(r) {
    const el = $('#review'); if (!el) return;
    const fund = UNIVERSE[r.scenario.fund];
    let rows = r.review;
    if (revFilter === 'major') rows = rows.filter(x => x.sev >= 2);
    if (revFilter === 'missed') rows = rows.filter(x => x.sev >= 2 && x.score != null && x.score < .5);
    if (revFilter === 'good') rows = rows.filter(x => x.score != null && x.score >= .6);
    el.innerHTML = rows.length ? rows.map(x => `
      <div class="rv ${x.score == null ? '' : x.score >= .6 ? 'good' : x.score > 0 ? 'mid' : 'miss'}">
        <div class="rv-d mono">${simDate(x.day).label}</div>
        <div class="grow"><div class="rv-h">${esc(x.h)} <span class="tag grey">${esc(x.tag)}</span>${x.sev >= 3 ? '<span class="tag bad">Major</span>' : ''}</div>
          <div class="rv-w muted sm">${esc(x.why)}</div>
          ${x.rows.length ? `<div class="rv-rows">${x.rows.map(z => { const a = fund.assets.find(q => q.id === z.id); return `<span class="rv-chip ${z.v >= .6 ? 'ok' : z.verdict === 'traded against' ? 'bad' : 'grey'}"><b>${a.tk}</b> ${z.dir > 0 ? '▲' : '▼'} expected · moved <span class="mono">${Fmt.pctS(z.move, 1)}</span> in 5d · you: <b>${z.verdict}</b></span>`; }).join('')}</div>` : ''}
        </div>
      </div>`).join('') : '<p class="muted">Nothing in this filter.</p>';
  }
  function confetti() {
    if (document.documentElement.classList.contains('reduce-motion') || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const host = document.createElement('div'); host.className = 'confetti'; document.body.appendChild(host);
    const cols = ['#7034f5', '#5c4ef5', '#53a7ea', '#ff8fd0', '#f2b52b', '#12a46b'];
    for (let i = 0; i < 70; i++) { const p = document.createElement('i'); p.style.cssText = `left:${Math.random() * 100}%;background:${cols[i % cols.length]};animation-delay:${Math.random() * .5}s;animation-duration:${1.8 + Math.random() * 1.4}s;transform:rotate(${Math.random() * 360}deg)`; host.appendChild(p); }
    setTimeout(() => host.remove(), 3800);
  }
  return { render };
})();
