/* Lobby: choose fund type, scenario, mode and duration → briefing */
Pages.home = (() => {
  let st = Store.get('lobby', { fund: 'multi', scn: 'y2011', mode: 'exam', len: 'practice', brief: 10 });
  // Real AmplifyME timing: 4 × 15-min quarters with 15-min rebalancing breaks. Shorter options keep the proportions.
  const LENS = { real: { q: 15, b: 15, label: 'Real · 4×15 min + 15-min breaks', short: 'Real (≈2 h)' }, half: { q: 7.5, b: 5, label: '4×7½ min + 5-min breaks', short: '≈55 min' }, practice: { q: 5, b: 3, label: '4×5 min + 3-min breaks', short: '≈32 min' }, quick: { q: 3, b: 1.5, label: '4×3 min + 1½-min breaks', short: '≈18 min' }, sprint: { q: 1.5, b: 1, label: '4×1½ min + 1-min breaks', short: '≈10 min' } };
  if (!LENS[st.len]) st.len = 'practice';
  if (!st.players) st.players = 'solo';
  function save() { Store.set('lobby', st); }

  function render(v) {
    const res = App.results();
    const best = res.length ? Math.max(...res.map(r => r.scores.overall)) : null;
    const scns = allScenarios().filter(s => s.fund === st.fund);
    if (st.scn !== 'random' && !scns.find(s => s.id === st.scn)) st.scn = scns[0].id;
    const played = id => res.filter(r => r.scenario.id === id);
    v.innerHTML = `
    <div class="page">
      <section class="hero">
        <div class="hero-l">
          <div class="eyebrow grad-text">AmplifyME Asset Management Simulation · Wealthathon practice</div>
          <h1 class="serif">Practise the AM round<br>before the real thing.</h1>
          <p class="lead muted">Run a <b>$20M balanced multi-asset fund</b> against the <b>50/30/20 benchmark</b>: start in cash, build the portfolio, then manage it through <b>four quarters</b> of breaking news with <b>rebalancing breaks</b>. Scored on the course's five metrics: <b>ROI, cycle judgement &amp; allocation, rebalancing, risk management and risk appetite</b>.</p>
          <div class="row wrap" style="gap:8px;margin-top:6px">
            <span class="tag grey">${icon('clock', 13)} 4 quarters + breaks</span><span class="tag grey">${icon('dollar', 13)} $20M, start in cash</span><span class="tag grey">${icon('target', 13)} 50/30/20 benchmark</span><span class="tag grey">${icon('lock', 13)} ≥90% invested · ≤$5M · $500k stop</span>
          </div>
        </div>
        <div class="hero-r card">
          <div class="eyebrow">How the real round runs</div>
          <ol class="steps">
            <li><b>Research &amp; Portfolio Builder</b><span>Judge each region's cycle phase; tilt from 50/30/20 (±10% limits).</span></li>
            <li><b>Build from 100% cash</b><span>Execute in contracts before Q1. No commission, but big orders move the price.</span></li>
            <li><b>Four 15-min quarters</b><span>Live news. Cut any position before it loses $500k; stay ≤$5M per product.</span></li>
            <li><b>Rebalance in the breaks</b><span>Prices freeze for 15 min: trade back to strategy, be ≥90% invested.</span></li>
          </ol>
          ${best != null ? `<div class="best-strip"><span class="muted">Your best overall</span><b class="mono">${best.toFixed(1)}%</b><a href="#/history">Progress →</a></div>` : ''}
        </div>
      </section>

      <section class="lobby">
        <div class="step-h"><span class="num-badge">1</span><h2>Choose the fund</h2></div>
        <div class="fund-grid">
          ${['multi', 'equity'].map(f => { const F = UNIVERSE[f]; return `
            <button class="card lift fund-card ${st.fund === f ? 'sel' : ''}" data-fund="${f}">
              <div class="row"><div class="fund-ic">${icon(f === 'multi' ? 'globe' : 'barChart', 22)}</div><div class="grow"><b>${F.name}</b> <span class="tag ${f === 'multi' ? '' : 'grey'}">${F.tagline}</span><div class="faint">${F.quarters} quarters · ${F.assets.length} instruments · $20M</div></div>${st.fund === f ? icon('checkCircle', 20, 'acc') : ''}</div>
              <p class="muted">${F.desc}</p>
              <div class="chips">${F.assets.map(a => `<span class="mini-chip">${a.tk}</span>`).join('')}</div>
            </button>`; }).join('')}
        </div>

        <div class="step-h"><span class="num-badge">2</span><h2>Choose a scenario</h2><span class="faint">${st.fund === 'multi' ? '"Course year" starts at the exact prices in the course videos (Jan 2011).' : 'Scenario names stay hidden until the debrief.'}</span></div>
        <div class="scn-grid">
          ${scns.map(s => { const p = played(s.id); const b = p.length ? Math.max(...p.map(r => r.scores.overall)) : null; return `
            <button class="scn-card ${st.scn === s.id ? 'sel' : ''}" data-scn="${s.id}">
              <div class="row"><b>${s.code}</b><span class="tag ${s.id === 'y2011' ? '' : s.difficulty === 'Hard' ? 'bad' : 'warn'}">${s.id === 'y2011' ? 'Most likely year' : s.difficulty}</span></div>
              <p class="muted">${s.teaser}</p>
              <div class="row faint sm">${p.length ? `${icon('rotate', 13)} played ${p.length}× · best <b class="mono">${b.toFixed(1)}%</b> · <i>${esc(p[0].scenario.title || '')}</i>` : `${icon('sparkles', 13)} not played yet`}</div>
            </button>`; }).join('')}
          <button class="scn-card rnd ${st.scn === 'random' ? 'sel' : ''}" data-scn="random">
            <div class="row"><b>${icon('shuffle', 16)} Random year</b><span class="tag">Endless</span></div>
            <p class="muted">A newly generated year each time: new regime, new headlines, new price paths, and research that isn't always right.</p>
            <div class="row faint sm">${icon('zap', 13)} best for repeated practice</div>
          </button>
        </div>

        <div class="step-h"><span class="num-badge">3</span><h2>Session settings</h2></div>
        <div class="card settings-card">
          <div class="set-grid">
            <div><div class="lbl">Players</div>${seg('s-players', [['solo', 'Solo'], ['team', 'Host a team room'], ['join', 'Join a team room']], st.players)}
              <p class="faint sm" id="players-help"></p></div>
            <div><div class="lbl">Mode</div>${seg('s-mode', [['exam', 'Exam: like the real thing'], ['training', 'Training']], st.mode)}
              <p class="faint sm" id="mode-help"></p></div>
            <div><div class="lbl">Session length</div>${seg('s-len', Object.entries(LENS).map(([k, x]) => [k, x.short]), st.len)}
              <p class="faint sm" id="len-help"></p></div>
            <div><div class="lbl">Briefing timer</div>${seg('s-brief', [[10, '10 min'], [5, '5 min'], [0, 'Off']], st.brief)}
              <p class="faint sm">Reading time for the research before you go to the floor (then a construction phase as long as a break).</p></div>
          </div>
          <div class="start-row">
            <div class="faint sm">${icon('keyboard', 14)} Terminal shortcuts: <span class="kbd">B</span> buy <span class="kbd">S</span> sell <span class="kbd">Q</span> quantity <span class="kbd">Enter</span> send <span class="kbd">W</span> Fund Weighting <span class="kbd">1</span>–<span class="kbd">0</span> select instrument</div>
            <button class="btn btn-primary lg" id="go">Go to briefing ${icon('arrowRight', 18)}</button>
          </div>
        </div>

        ${res.length ? `<div class="step-h"><h2>Recent attempts</h2><a href="#/history" class="sm">See all →</a></div>
        <div class="recent">${res.slice(0, 4).map(r => `<a class="card lift recent-card" href="#/results/${r.id}">
          <div class="row"><b>${esc(r.scenario.code)}</b><span class="tag grey">${r.cfg.mode}</span></div>
          <div class="big mono">${r.scores.overall.toFixed(1)}%</div>
          <div class="row faint sm"><span class="${signCls(r.excess)}">${Fmt.pp(r.excess, 2)} vs bench</span><span>·</span><span>#${r.rank}/${r.field}</span></div>
        </a>`).join('')}</div>` : ''}
      </section>
    </div>`;

    v.querySelectorAll('[data-fund]').forEach(b => (b.onclick = () => { st.fund = b.dataset.fund; st.scn = allScenarios().find(s => s.fund === st.fund).id; save(); render(v); }));
    v.querySelectorAll('[data-scn]').forEach(b => (b.onclick = () => { st.scn = b.dataset.scn; save(); v.querySelectorAll('[data-scn]').forEach(x => x.classList.toggle('sel', x === b)); }));
    const help = () => ($('#mode-help').innerHTML = st.mode === 'exam' ? 'No pause, real speed, no hints. Mistakes go straight through, just like the live event.' : 'Pause, speed control, skip breaks, "Execute plan" in one click, warnings before you break a rule or the stop-loss, and a "Why it matters" note on each headline.');
    const ph = () => {
      $('#players-help').innerHTML = st.players === 'team' ? 'You host one shared fund for the team. After the briefing, your trading floor opens a room and shows a 6-digit code to send your teammates. Keep your tab open: it runs the clock.'
        : st.players === 'join' ? 'Your teammate hosts and picks the scenario, mode and length. Click Join and enter their 6-digit code.' : 'Practise on your own.';
      $('#go').innerHTML = st.players === 'join' ? `Join a team room ${icon('arrowRight', 18)}` : `Go to briefing ${icon('arrowRight', 18)}`;
    };
    segWire($('#s-players'), x => { st.players = x; save(); ph(); }); ph();
    segWire($('#s-mode'), x => { st.mode = x; save(); help(); }); help();
    const lh = () => ($('#len-help').textContent = LENS[st.len].label + (st.len === 'real' ? ' (the real competition timing)' : ', same year, compressed'));
    segWire($('#s-len'), x => { st.len = x; save(); lh(); }); lh();
    segWire($('#s-brief'), x => { st.brief = +x; save(); });
    $('#go').onclick = () => {
      if (st.players === 'join') { location.hash = '#/join'; return; }
      let scenarioId = st.scn;
      if (st.scn === 'random') scenarioId = `rnd-${st.fund}-${Math.floor(Math.random() * 1e9)}`;
      const L = LENS[st.len];
      App.pending = { scenarioId, mode: st.mode, quarterMin: L.q, breakMin: L.b, buildMin: L.b, briefMin: st.brief, briefStart: Date.now(), variant: 0, team: st.players === 'team' };
      if (App.session && !App.session.finished) App.session = null;
      location.hash = '#/brief';
    };
  }
  return { render };
})();
