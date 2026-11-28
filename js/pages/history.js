/* Progress: every attempt, trend of the overall score, averages per metric */
Pages.history = (() => {
  function render(v) {
    const res = App.results();
    if (!res.length) { v.innerHTML = `<div class="page"><div class="empty big-empty">${icon('lineChart', 30)}<h2>No attempts yet</h2><p class="muted">Your scores will build up here, so you can see improvement before the real thing.</p><a class="btn btn-primary" href="#/">Start a simulation</a></div></div>`; return; }
    const chron = res.slice().reverse();
    const avg = k => mean(res.slice(0, 5).map(r => r.scores[k]));
    const best = res.reduce((b, r) => (r.scores.overall > b.scores.overall ? r : b));
    v.innerHTML = `
    <div class="page">
      <header class="res-head"><div><div class="eyebrow">Progress</div><h1 class="serif">Your practice record</h1><p class="muted">${res.length} attempt${res.length > 1 ? 's' : ''} · best ${best.scores.overall.toFixed(1)}% on ${esc(best.scenario.code)}</p></div></header>
      <section class="metric-grid six">
        ${[['overall', 'Overall', 'award'], ['roi', 'ROI', 'trending'], ['cycle', 'Cycle & allocation', 'activity'], ['rebal', 'Rebalancing', 'rotate'], ['risk', 'Risk mgmt', 'shield'], ['appetite', 'Risk appetite', 'percent']].map(([k, l, ic]) => `<div class="metric"><div class="row"><span class="m-ic">${icon(ic, 17)}</span><span class="muted">${l}</span></div><div class="m-v mono">${avg(k).toFixed(1)}%</div><div class="faint sm">average of last ${Math.min(5, res.length)}</div></div>`).join('')}
      </section>
      <section class="card"><div class="row"><h3 class="grow">Overall score by attempt</h3><span class="faint xs">exam and training attempts, oldest → newest</span></div><div class="res-chart"><canvas id="h-chart"></canvas></div></section>
      <section class="card">
        <table class="tbl"><thead><tr><th class="l">When</th><th class="l">Scenario</th><th class="l">Mode</th><th>Return</th><th>vs bench</th><th>ROI</th><th>Cycle</th><th>Rebal</th><th>Risk</th><th>Appetite</th><th>Errors</th><th>Overall</th><th>Rank</th></tr></thead><tbody>
        ${res.map(r => `<tr class="click" data-go="${r.id}"><td class="l faint">${Fmt.date(r.at)}</td><td class="l"><b>${esc(r.scenario.code)}</b> <span class="faint">${esc(r.scenario.title || '')}</span></td><td class="l"><span class="tag grey">${r.cfg.mode} · ${r.cfg.quarterMin}m quarters</span></td><td class="${signCls(r.ret)}">${Fmt.pctS(r.ret)}</td><td class="${signCls(r.excess)}">${Fmt.pp(r.excess, 2)}</td><td>${r.scores.roi.toFixed(0)}</td><td>${r.scores.cycle.toFixed(0)}</td><td>${r.scores.rebal.toFixed(0)}</td><td>${r.scores.risk.toFixed(0)}</td><td>${r.scores.appetite.toFixed(0)}</td><td class="${r.scores.ff ? 'down' : ''}">${r.scores.ff}</td><td><b>${r.scores.overall.toFixed(1)}%</b></td><td class="faint">#${r.rank}/${r.field}</td></tr>`).join('')}
        </tbody></table>
      </section>
    </div>`;
    v.querySelectorAll('[data-go]').forEach(t => (t.onclick = () => (location.hash = '#/results/' + t.dataset.go)));
    const draw = () => {
      const cv = $('#h-chart'); if (!cv) return;
      const data = chron.map(r => r.scores.overall);
      if (data.length === 1) data.unshift(data[0]);
      Charts.line(cv, { series: [{ data, color: Charts.css('--accent'), width: 2.2, fill: 'rgba(92,78,245,.12)', tag: x => x.toFixed(1) + '%' }], xMax: Math.max(1, data.length - 1), yFmt: x => x.toFixed(0) + '%', yInclude: [40, 80], xLabels: chron.map((r, i) => ({ x: chron.length === 1 ? 1 : i, label: '#' + (i + 1) })), pad: { l: 18 } });
    };
    requestAnimationFrame(draw); new ResizeObserver(draw).observe($('.res-chart'));
  }
  return { render };
})();
