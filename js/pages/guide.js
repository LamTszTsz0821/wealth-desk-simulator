/* Guide & playbook: the AmplifyME Asset Management Simulation as described in
   AmplifyME's pre-learning course, plus what this trainer estimates. */
Pages.guide = (() => {
  function render(v) {
    const F = UNIVERSE.multi;
    v.innerHTML = `
    <div class="page guide">
      <header class="res-head"><div><div class="eyebrow">Guide & playbook</div><h1 class="serif">How the AmplifyME AM Simulation works</h1><p class="muted">Based on AmplifyME's 12-video pre-learning course for the simulation used in the BOCHK × HKU Wealthathon. Anything the course doesn't state is marked <span class="src src-guess">our guess</span>.</p></div><a class="btn btn-primary" href="#/">${icon('play', 16)} Practise now</a></header>
      <nav class="toc">${[['role', 'Your role'], ['time', 'Timeline'], ['layout', 'Screen'], ['inst', 'Instruments & benchmark'], ['rules', 'Rules'], ['score', 'Scoring'], ['cycle', 'Cycle & policy'], ['play', 'Playbook'], ['guess', 'What\'s a guess'], ['keys', 'Shortcuts'], ['src', 'Sources']].map(([a, l]) => `<a href="#/guide" data-jump="${a}">${l}</a>`).join('')}</nav>

      <section class="card" id="g-role"><h2>${icon('briefcase', 18)} Your role</h2>
        <ul class="ticks">
          <li>You are the <b>fund manager, research analyst and your own execution trader</b> of a <b>$20M balanced multi-asset fund</b>.</li>
          <li>Style (course): <b>top-down · multi-asset · active and constrained</b>. You're judged on <b>relative return against a benchmark</b> (alpha), not absolute return.</li>
          <li>The client is <b>"balanced"</b> (capital appreciation plus income, medium risk), so the benchmark is <b>50% equity / 30% fixed income / 20% commodities</b>.</li>
          <li>Two halves of the job: build the portfolio ("put the client's money to work"), then <b>manage it through time</b> (monitor, rebalance, watch for black swans). The second half is the hard part.</li>
        </ul>
      </section>

      <section class="card" id="g-time"><h2>${icon('clock', 18)} Timeline</h2>
        <div class="timeline">${[['Join', 'Enter the 6-digit event code', 'course'], ['Construction', 'Start 100% in cash. Use the research and the Portfolio Builder, then buy.', 'course'], ['Q1 · 15 min', 'Live market and news', 'course'], ['Break · 15 min', 'Prices frozen (except your own market impact). Trading allowed: rebalance.', 'course'], ['Q2 · 15 min', 'Live', 'course'], ['Break', 'Rebalance', 'course'], ['Q3 · 15 min', 'Live', 'course'], ['Break', 'Rebalance', 'course'], ['Q4 · 15 min', 'Live → final scores', 'course']].map(([t, d]) => `<div class="tl"><b>${t}</b><span>${d}</span></div>`).join('')}</div>
        <p class="faint sm">The course doesn't say how long the construction phase lasts. Here it's as long as a break <span class="src src-guess">our guess</span>. Shorter practice lengths scale everything in proportion.</p>
      </section>

      <section class="card" id="g-inst"><h2>${icon('table', 18)} Instruments & benchmark</h2>
        <div class="scroll-x"><table class="tbl"><thead><tr><th class="l">Class</th><th class="l">Instrument</th><th>Benchmark</th><th>Start price</th><th>1 contract (our guess)</th><th>≈ $ per contract</th></tr></thead><tbody>
          ${F.assets.map(a => `<tr><td class="l">${F.classes[a.cls]}</td><td class="l"><b>${a.tk}</b> <span class="faint">${a.name}</span></td><td>${Fmt.pct(F.bench[a.id], F.bench[a.id] % .01 ? 2 : 0)}</td><td>${Fmt.num(a.p0, a.dp)}${a.id === 'OIL' || a.id === 'EURUSD' ? ' <span class="src src-guess">guess</span>' : ''}</td><td>${a.cls === 'fx' ? '€' + Fmt.int(a.mult) : a.id === 'GOLD' ? '100 oz' : a.id === 'OIL' ? '1,000 bbl' : '$' + Fmt.int(a.mult) + ' × price'}</td><td>${Fmt.compact(a.p0 * a.mult)}</td></tr>`).join('')}
        </tbody></table></div>
        <p class="faint sm">Benchmark weights and start prices are from the course (OIL and EURUSD start prices weren't captured). The start prices match early January 2011, so this trainer's "Course year" scenario replays a reconstruction of 2011: Arab Spring, Japan earthquake, euro crisis, US downgrade, gold record. That's an inference, not something the course states. Bond futures move opposite to yields (price ↑ when yields ↓).</p>
      </section>

      <section class="card" id="g-rules"><h2>${icon('scale', 18)} Rules ("golden rule #1: don't break your constraints")</h2>
        <div class="rules">${ruleList(F).map(r => `<div class="rule">${icon('check', 14)}<span class="grow">${esc(r.label)}</span><span class="src src-${r.src}">${{ course: 'course', guess: 'our guess', ours: 'our rule', format: 'format' }[r.src]}</span></div>`).join('')}</div>
        <ul class="ticks" style="margin-top:12px">
          <li><b>$500k stop-loss:</b> the course says no more than $500k loss on any trade, so cut it before it gets there. This trainer measures each <b>position against its average cost</b> at every daily close <span class="src src-guess">our interpretation</span>. With $5M in one product, a 10% fall hits the limit.</li>
          <li><b>90% invested</b> is checked at the <b>start</b> of every quarter (including Q1, right after construction). Between quarter starts you can hold more cash, but cash is a drag.</li>
          <li><b>±10%:</b> the course example moves the asset classes from 50/30/20 to 60/25/15. This trainer applies ±10pp to each class and to each instrument (whichever is tighter, along with the $5M cap) <span class="src src-guess">per-instrument is our guess</span>.</li>
          <li><b>No commission, but market impact:</b> big orders move the price against you. Here impact grows with order size and with your recent same-direction trading in that instrument, then fades over ~20 seconds <span class="src src-guess">strength is our guess</span>.</li>
        </ul>
      </section>

      <section class="card" id="g-score"><h2>${icon('award', 18)} Scoring: AmplifyME's five metrics</h2>
        <p class="muted sm">The <b>metric names</b> are from the course. AmplifyME doesn't publish weights or formulas: everything in the right-hand column is <span class="src src-guess">our estimate</span>, built so the behaviour the course asks for scores well.</p>
        <div class="scroll-x"><table class="tbl cheat"><thead><tr><th class="l">Metric (course)</th><th class="l">What the course says it rewards</th><th class="l">How this trainer scores it (estimate)</th></tr></thead><tbody>
          <tr><td class="l"><b>1 ROI</b></td><td class="l wrap-cell">Return relative to the benchmark</td><td class="l wrap-cell">Percentile of your return among 400 simulated peers on the same year</td></tr>
          <tr><td class="l"><b>2 Cycle judgement & allocation</b></td><td class="l wrap-cell">Positioning for the right phase of the cycle; over/underweights vs the benchmark</td><td class="l wrap-cell">60%: allocation effect (Σ (your weight − benchmark weight) × (instrument return − benchmark return), daily), scaled against a strong hindsight tilt · 40%: were your asset-class over/underweights at each quarter start on the right side?</td></tr>
          <tr><td class="l"><b>3 Rebalancing</b></td><td class="l wrap-cell">Bringing weights back to your strategy at the quarter breaks ("periodic small tweaks")</td><td class="l wrap-cell">Per break: 70% for trading back at least the drift since the quarter start (or drift &lt; 1.5%), 30% for ending the break inside every rule; averaged</td></tr>
          <tr><td class="l"><b>4 Risk management</b></td><td class="l wrap-cell">Stop-loss discipline (the $500k rule) and the Sharpe ratio</td><td class="l wrap-cell">40% stop-loss (−25 per position that passes $500k, −2 per day over) · 30% rules (−0.6 per limit-day, −3 per episode) · 30% Sharpe vs the benchmark's</td></tr>
          <tr><td class="l"><b>5 Risk appetite</b></td><td class="l wrap-cell">The 90%-invested rule</td><td class="l wrap-cell">Per quarter start: 100 at ≥90% invested, 0 at ≤80%, linear between; averaged</td></tr>
          <tr><td class="l"><b>Overall</b></td><td class="l wrap-cell">Not stated</td><td class="l wrap-cell">Equal-weight average of the five</td></tr>
        </tbody></table></div>
        <p class="faint sm">Also shown, not scored: order errors (rejected orders, trades that break a rule, quick reversals), market impact paid, and a news review of how you reacted to each headline.</p>
      </section>

      <section class="card" id="g-cycle"><h2>${icon('activity', 18)} The business cycle and monetary policy (course videos 6–7)</h2>
        <div class="two">
          <div><h4>Four phases</h4><table class="tbl cheat"><thead><tr><th class="l">Phase</th><th class="l">Signs</th><th class="l">Risk assets</th><th class="l">Safe havens</th></tr></thead><tbody>
            <tr><td class="l">Slowdown</td><td class="l wrap-cell">Growth decelerating, inflation pressure, hawkish central bank</td><td class="l arrow"><span class="down">↓</span></td><td class="l arrow"><span class="up">↑</span></td></tr>
            <tr><td class="l">Recession</td><td class="l wrap-cell">GDP contracting, profits falling, credit tight, dovish CB (cuts, QE)</td><td class="l arrow"><span class="down">↓↓ worst</span></td><td class="l arrow"><span class="up">↑↑ best</span></td></tr>
            <tr><td class="l">Recovery</td><td class="l wrap-cell">GDP rebounds steeply, credit loosens, rates at their lowest</td><td class="l arrow"><span class="up">↑↑ best</span></td><td class="l arrow"><span class="down">↓↓</span></td></tr>
            <tr><td class="l">Expansion</td><td class="l wrap-cell">Longest phase, growth moderates, policy neutral</td><td class="l arrow"><span class="up">↑</span></td><td class="l arrow"><span class="down">↓</span></td></tr></tbody></table>
            <p class="faint sm">Risk assets = equities (especially cyclicals). Safe havens = bonds, gold, defensive stocks. Judge the phase from GDP, employment, inflation and rates, then position for the <b>next</b> phase.</p></div>
          <div><h4>Central-bank decisions can override the cycle short-term</h4><table class="tbl cheat"><thead><tr><th class="l"></th><th class="l">Equities</th><th class="l">Bonds</th></tr></thead><tbody>
            <tr><td class="l">Hike, bullish mood</td><td class="l arrow"><span class="up">↑</span></td><td class="l arrow"><span class="down">↓↓</span> (havens sold, yields up)</td></tr>
            <tr><td class="l">Hike, bearish mood</td><td class="l arrow"><span class="down">↓↓</span> (hiking into a slowdown)</td><td class="l arrow"><span class="up">↑</span> mild</td></tr>
            <tr><td class="l">Cut, bullish mood</td><td class="l arrow"><span class="up">↑↑</span> ("Goldilocks")</td><td class="l arrow">↑ or ↓</td></tr>
            <tr><td class="l">Cut, bearish mood</td><td class="l arrow"><span class="down">↓</span> (cut seen as too little)</td><td class="l arrow"><span class="up">↑↑</span></td></tr></tbody></table>
            <p class="faint sm">Sector mix explains index behaviour: tech-heavy SPX behaves like growth; UKX is energy, materials and staples; MXLA and MXAS are commodity- and China-sensitive; HSI is tied to China policy.</p></div>
        </div>
      </section>

      <section class="card" id="g-play"><h2>${icon('route', 18)} Playbook for the day</h2>
        <div class="three">
          <div><h4>Before Q1 (construction)</h4><ol>
            <li>For each region, write down the <b>cycle phase</b> and your OW/N/UW.</li>
            <li>Set <b>asset-class tilts</b> first (e.g. 55/27/18), then pick regions within equities.</li>
            <li>Stay <b>inside every band with room to spare</b> and below <b>$5M</b> per product (≈25% of the fund).</li>
            <li>Get to <b>~95% invested</b>: comfortably over 90%, with a little cash for impact and opportunities.</li>
            <li>Split big orders: impact builds up when you hammer one instrument.</li></ol></div>
          <div><h4>During a quarter</h4><ol>
            <li>Triage each headline: <b>which phase does it signal? which instruments? which way?</b></li>
            <li>Central-bank news can override the cycle: use the policy table.</li>
            <li>Watch the <b>stop-loss</b> gauge: cut a position at about <b>−$400k</b>, not after −$500k.</li>
            <li>Big moves push weights through bands and the $5M cap: check <b>Fund Weighting (W)</b>.</li>
            <li>Ignore noise headlines (company gossip, celebrity news).</li></ol></div>
          <div><h4>In each break</h4><ol>
            <li>Prices are frozen, so this is your <b>calm rebalancing window</b>.</li>
            <li>Re-judge the cycle with the quarter's news, and update your strategy if the phase changed.</li>
            <li>Open the <b>Strategy</b> tab: trade back the drift ("periodic small tweaks").</li>
            <li>Before the break ends: <b>≥90% invested</b>, every rule OK.</li>
            <li>Take profit on spikes (gold, oil): shocks often reverse.</li></ol></div>
        </div>
      </section>

      <section class="card" id="g-layout"><h2>${icon('grid', 18)} The trading screen</h2>
        <div class="layout-map"><div class="lm top">Account bar · NAV · P&amp;L · <b>Fund Weighting</b></div><div class="lm">Markets<br><small>Equity · Bond · FX · Commodity</small></div><div class="lm">News</div><div class="lm">Positions</div><div class="lm">Order ticket</div><div class="lm wide2">Price chart + benchmark line</div></div>
        <p class="faint sm">Arranged as the course describes AmplifyME's platform. Panel sizes and styling are ours <span class="src src-guess">not seen</span>. Extra tabs next to Positions (Strategy, Allocation, Risk &amp; rules, Blotter, Leaderboard) are practice aids.</p>
      </section>

      <section class="card" id="g-guess"><h2>${icon('help', 18)} What's a guess in this trainer</h2>
        <div class="scroll-x"><table class="tbl cheat"><thead><tr><th class="l">Item</th><th class="l">What we did</th><th class="l">Why</th></tr></thead><tbody>
          ${[['Scoring formulas & weights', 'Our formulas, equal weights', 'Course gives metric names only'],
             ['Contract sizes', 'Modelled on the real futures (ES $50, TY $1,000, GC 100oz, CL 1,000bbl, 6E €125k…)', 'Not shown in the course'],
             ['Market impact', 'Grows with order size and recent same-direction trading; ~20s half-life', 'Course: "big orders move the price"'],
             ['OIL and EURUSD start prices', 'OIL $91.50 (WTI), EURUSD 1.3360: early Jan 2011', 'Not captured from the course'],
             ['The year replayed', 'A 2011 reconstruction from our knowledge of the year (not a data feed): the shape and the big moves follow 2011, but levels are approximate', 'Start prices point to 2011; AmplifyME may use another year'],
             ['$500k "per trade"', 'Per position vs average cost, at each daily close', 'The course wording is "per trade"'],
             ['±10% band', 'Applied per asset class and per instrument', 'Course example is class-level'],
             ['Construction phase', 'Same length as a break', 'Not stated'],
             ['Bid/ask spreads', '1–4bp', 'Not stated'],
             ['Peers', '400 simulated players with different skill and discipline', 'The real event ranks you against real participants']].map(r => `<tr>${r.map((c, i) => `<td class="l ${i ? 'wrap-cell muted' : ''}">${i ? c : `<b>${c}</b>`}</td>`).join('')}</tr>`).join('')}
        </tbody></table></div>
      </section>

      <section class="card" id="g-keys"><h2>${icon('keyboard', 18)} Terminal shortcuts</h2>
        <div class="keys">${[['B / S', 'Buy / Sell and focus quantity'], ['Q', 'Focus quantity'], ['Enter', 'Send order'], ['W', 'Fund Weighting'], ['1 … 9, 0', 'Select instrument (first ten)'], ['Esc', 'Leave the field / cancel'], ['Space', 'Pause / resume (training)']].map(([k, d]) => `<div><span class="kbd">${k}</span><span>${d}</span></div>`).join('')}</div>
      </section>

      <section class="card" id="g-src"><h2>${icon('link', 18)} Sources</h2>
        <ul class="src-list">
          <li><b>AmplifyME, "Asset Management Simulation Pre-Learning"</b> (12 videos, presenter Piers Curran): rules, instruments, benchmark, timeline and metric names. Course notes supplied by the team (<i>amplifyme-course-notes.md</i>).</li>
          <li><a href="https://wma.hkubs.hku.hk/challenge/" target="_blank" rel="noopener">BOCHK × HKU Business School Wealthathon Challenge</a></li>
          <li><a href="https://www.stir.ac.uk/about/faculties/stirling-management-school/amplifyme-boot-camp/" target="_blank" rel="noopener">University of Stirling: AmplifyME Boot Camp</a> (real historical prices, time sped up)</li>
          <li><a href="https://amplifyme.com/blog/amplifyme-spotlight-on-a-simulation-asset-management" target="_blank" rel="noopener">AmplifyME: Spotlight on a simulation, asset management</a></li>
        </ul>
        <p class="faint sm">Independent practice tool. Not affiliated with or endorsed by AmplifyME, BOCHK or HKU. Prices are reconstructions: close to history, not official data.</p>
      </section>
    </div>`;
    v.querySelectorAll('[data-jump]').forEach(a => (a.onclick = e => { e.preventDefault(); $('#g-' + a.dataset.jump).scrollIntoView({ behavior: 'smooth', block: 'start' }); }));
  }
  return { render };
})();
