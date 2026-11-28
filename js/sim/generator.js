/* ==========================================================================
   Random scenario generator: endless practice years from a library of
   realistic headline templates. Each generated year:
   1. picks a macro regime (sets the background drift of each asset),
   2. scatters ~28 market-moving headlines plus some pure noise,
   3. builds month-end waypoints = news effect + regime drift + random walk,
   4. writes a research pack whose OW/UW calls are right roughly 2 times in 3.
   Same seed → same year, so a random scenario can be replayed.
   ========================================================================== */
const Generator = (() => {
  const T = (k, sev, tag, hs, imp, why) => ({ k, sev, tag, hs, imp, why });
  const MULTI = [
    T('fed_hawk', 3, 'Central banks', ['Fed hikes {75|50}bp, more than markets expected', 'Fed Chair: "we will keep raising rates until the job is done"'], { US: -.025, EU: -.01, EM: -.02, UST: -.012, GOLD: -.012 }, 'Hawkish Fed: equities and bonds fall; gold hurt by higher real yields.'),
    T('fed_dove', 3, 'Central banks', ['Fed signals pause; futures now price rate cuts', 'Fed cuts {25|50}bp, citing slowing growth'], { US: .02, EU: .01, EM: .02, UST: .012, GOLD: .012 }, 'Dovish Fed: bonds, gold and equities rally; EM benefits from a weaker dollar.'),
    T('cpi_hot', 2, 'Data', ['US CPI hotter than expected at {4.9|6.2|7.4}%', 'Core inflation re-accelerates for a second month'], { US: -.02, EM: -.01, UST: -.01, GOLD: -.005 }, 'Hot inflation → more hikes priced → bonds and equities down.'),
    T('cpi_cool', 2, 'Data', ['US CPI cooler than expected; core inflation slows', 'Inflation falls to {3.1|3.4|4.0}%, lowest in two years'], { US: .02, EM: .01, UST: .01, GOLD: .008 }, 'Cooling inflation → fewer hikes → bonds and equities up.'),
    T('jobs_weak', 2, 'Data', ['US payrolls miss badly; unemployment rises to {4.3|4.6}%', 'Jobless claims jump to highest in two years'], { US: -.015, UST: .012, GOLD: .01, OIL: -.02 }, 'Weak jobs → growth scare: bonds up, cyclicals and oil down.'),
    T('jobs_strong', 1, 'Data', ['US payrolls smash forecasts', 'Wage growth accelerates as hiring stays hot'], { US: .005, UST: -.008, GOLD: -.01 }, 'Strong jobs: good for growth, bad for bonds (rates stay high).'),
    T('ecb_hawk', 2, 'Central banks', ['ECB raises rates and signals more to come', 'ECB announces end of bond purchases'], { EU: -.015, BUND: -.015 }, 'Hawkish ECB: Bunds and European equities fall.'),
    T('ecb_dove', 2, 'Central banks', ['ECB cuts rates and restarts bond buying', 'ECB President: "ready to do whatever it takes"'], { EU: .02, BUND: .015 }, 'Dovish ECB: European assets rally.'),
    T('boe_hawk', 2, 'Central banks', ['Bank of England hikes 50bp as UK inflation stays in double digits'], { UK: -.012, GILT: -.018 }, 'Hawkish BoE: gilts fall.'),
    T('boe_dove', 2, 'Central banks', ['Bank of England surprises with rate cut'], { UK: .012, GILT: .015 }, 'Dovish BoE: gilts rally.'),
    T('uk_fiscal', 2, 'Politics', ['UK borrowing plans spook markets; gilt yields jump', 'UK government unveils unfunded tax cuts'], { GILT: -.035, UK: -.01 }, 'Fiscal credibility worries: gilts sold.'),
    T('boj_shift', 2, 'Central banks', ['Bank of Japan ends negative rates; yen surges', 'BoJ unexpectedly loosens yield-curve control'], { JP: -.03, UST: -.004, BUND: -.004 }, 'Stronger yen hurts Japanese exporters; global yields nudge up.'),
    T('boj_dove', 2, 'Central banks', ['BoJ doubles down on easing; yen slides to multi-decade low'], { JP: .025 }, 'Weaker yen boosts Japanese exporters.'),
    T('jp_reform', 2, 'Markets', ['Tokyo exchange pushes buybacks; foreign inflows surge into Japan'], { JP: .03 }, 'Governance reform story: Japan re-rated.'),
    T('china_stim', 3, 'Geopolitics', ['Beijing unveils sweeping stimulus package', 'China cuts rates and pledges property support'], { EM: .045, OIL: .03, UK: .01, EU: .01 }, 'China stimulus: EM, oil and commodity-heavy markets up.'),
    T('china_slow', 2, 'Data', ['China GDP misses; property sales slump', 'Chinese property developer defaults on bonds'], { EM: -.035, OIL: -.03, UK: -.01 }, 'China slowdown: EM and oil down.'),
    T('opec_cut', 2, 'Commodities', ['OPEC+ surprises with {1|2}m barrels/day output cut', 'Saudi Arabia extends voluntary production cut'], { OIL: .07, UK: .01 }, 'Supply cut: oil up; UK (energy-heavy) helped.'),
    T('opec_war', 3, 'Commodities', ['OPEC+ talks collapse; producers launch price war', 'OPEC+ agrees to sharply raise output'], { OIL: -.1, UK: -.02, EM: -.01 }, 'Supply flood: oil collapses.'),
    T('mideast', 2, 'Geopolitics', ['Conflict escalates in the Middle East; oil jumps', 'Tanker attacked in the Strait of Hormuz'], { OIL: .05, GOLD: .03, US: -.012, EU: -.012 }, 'Geopolitical risk: oil and gold up, equities down.'),
    T('deesc', 1, 'Geopolitics', ['Ceasefire agreed; risk premium fades'], { OIL: -.03, GOLD: -.015, US: .008, EU: .01 }, 'De-escalation unwinds the risk premium.'),
    T('tech_beat', 2, 'Earnings', ['US mega-cap tech earnings blow past estimates', 'AI spending boom: chipmaker raises guidance sharply'], { US: .025, JP: .005, EM: .01 }, 'US index is tech-heavy: big earnings beats lift it most.'),
    T('tech_miss', 2, 'Earnings', ['Big Tech earnings disappoint; growth stocks slide', 'Cloud giant warns on slowing growth'], { US: -.03, EM: -.005 }, 'Tech misses hit the US index hardest.'),
    T('eu_energy', 2, 'Commodities', ['European gas prices spike as pipeline flows halted'], { EU: -.035, OIL: .03, BUND: .005 }, 'Europe\'s energy dependence makes it most exposed.'),
    T('bank_stress', 3, 'Banks', ['BREAKING: US regional bank collapses; contagion fears', 'Major European lender rescued in emergency deal'], { US: -.035, EU: -.025, UK: -.02, UST: .02, BUND: .012, GOLD: .03 }, 'Flight to safety: bonds and gold up, equities down.'),
    T('recession', 2, 'Data', ['Global manufacturing PMIs slump into contraction', 'Recession fears grip markets as yield curve inverts further'], { US: -.02, EU: -.025, UK: -.015, JP: -.015, EM: -.02, OIL: -.05, UST: .015, BUND: .012, GILT: .012 }, 'Growth scare: equities and oil down, bonds up.'),
    T('risk_on', 1, 'Markets', ['Strong earnings season lifts global equities', 'Global stocks hit record highs on soft-landing hopes'], { US: .02, EU: .02, JP: .015, EM: .015 }, 'Broad risk-on.'),
    T('gold_cb', 1, 'Commodities', ['Central banks buy record tonnage of gold'], { GOLD: .03 }, 'Structural gold demand.'),
    T('em_crisis', 2, 'Markets', ['Emerging-market currency crisis spreads; dollar surges'], { EM: -.05, GOLD: -.01 }, 'Strong dollar and capital flight hit EM.'),
    T('tariffs', 3, 'Politics', ['US announces sweeping tariffs on imports', 'Trade talks collapse; new tariffs from next month'], { EM: -.04, US: -.02, EU: -.02, JP: -.02, GOLD: .015 }, 'Trade war: global equities down, EM and exporters most.'),
    T('trade_deal', 2, 'Politics', ['US and China agree trade truce'], { EM: .03, US: .01, JP: .01 }, 'Trade relief: EM up.'),
  ];
  const NOISE = ['Ratings agency affirms {country} sovereign rating', 'Electric-car maker announces stock split', 'Tech billionaire unveils new rocket design', 'Luxury group opens flagship store in Shanghai', 'Football club takeover approved by league', 'Streaming service raises subscription prices', 'Coffee chain names new CEO', 'Social media platform tests new logo', 'Airline orders 40 new aircraft', 'Retailer reports record online sales on holiday weekend'];
  const COUNTRIES = ['Italy', 'Spain', 'Canada', 'Australia', 'France'];

  const EQ_STOCK = [
    T('beat', 2, 'Earnings', ['{name} Q{q} earnings beat; full-year guidance raised', '{name} posts record quarterly revenue'], { _: .06 }, 'Earnings beat + higher guidance: estimates revised up.'),
    T('miss', 2, 'Earnings', ['{name} Q{q} earnings miss; shares slide', '{name} cuts full-year outlook'], { _: -.07 }, 'Earnings miss / guidance cut: estimates revised down.'),
    T('up', 1, 'Analysts', ['Top broker upgrades {name} to Buy'], { _: .02 }, 'Upgrade: small, short-lived.'),
    T('down', 1, 'Analysts', ['Top broker downgrades {name} to Sell'], { _: -.02 }, 'Downgrade: small, short-lived.'),
    T('ceo', 2, 'Corporate', ['{name} CEO resigns unexpectedly'], { _: -.04 }, 'Leadership uncertainty.'),
    T('mna', 3, 'Corporate', ['Report: {name} explores sale as bidders circle'], { _: .09 }, 'Takeover premium.'),
    T('buyback', 1, 'Corporate', ['{name} announces $3bn share buyback'], { _: .025 }, 'Capital return.'),
    T('probe', 2, 'Regulation', ['Regulators open investigation into {name}'], { _: -.05 }, 'Regulatory risk.'),
  ];
  const EQ_SECTOR = [
    T('export', 2, 'Regulation', ['US weighs new chip export curbs to Asia'], { NVBT: -.06 }, 'Export controls hit chipmakers.'),
    T('ai', 3, 'Product', ['Hyperscalers double AI data-centre budgets'], { NVBT: .08 }, 'AI capex boom = chip demand.'),
    T('launch', 2, 'Product', ['Novabyte unveils next-generation accelerator'], { NVBT: .04 }, 'New product cycle.'),
    T('bankrun', 3, 'Banks', ['BREAKING: Regional bank fails after deposit run'], { MRDN: -.12, NVBT: -.02, VRDT: .015, HLX: -.03 }, 'Bank contagion: banks crushed, staples bid.'),
    T('credit', 2, 'Banks', ['Meridian Bank lifts loan-loss provisions on property exposure'], { MRDN: -.05 }, 'Credit losses rising.'),
    T('oilup', 2, 'Commodities', ['Oil jumps 7% on supply disruption'], { HLX: .06 }, 'Higher oil = higher producer profits.'),
    T('oildown', 2, 'Commodities', ['Oil slides 8% as OPEC+ raises output'], { HLX: -.06 }, 'Lower oil hits producers.'),
    T('windfall', 2, 'Politics', ['Government proposes windfall tax on energy profits'], { HLX: -.05 }, 'Policy risk for energy.'),
    T('recall', 3, 'Corporate', ['Verdant Foods recalls products over contamination'], { VRDT: -.08 }, 'Recall: costs and reputation damage.'),
    T('pricing', 1, 'Corporate', ['Verdant Foods raises prices; volumes hold'], { VRDT: .02 }, 'Pricing power.'),
    T('fda_yes', 3, 'Pharma', ['Aurora wins FDA approval for lead drug'], { AURX: .13 }, 'Binary catalyst: approval.'),
    T('fda_no', 3, 'Pharma', ['FDA rejects Aurora\'s lead drug application'], { AURX: -.15 }, 'Binary catalyst: rejection.'),
    T('trial_good', 2, 'Pharma', ['Aurora phase-3 trial meets primary endpoint'], { AURX: .08 }, 'Positive trial data.'),
    T('trial_bad', 2, 'Pharma', ['Aurora trial halted on safety signal'], { AURX: -.09 }, 'Negative trial data.'),
    T('hawk', 3, 'Macro', ['Fed signals more rate hikes; yields jump', 'Hot CPI print: inflation re-accelerates'], { NVBT: -.045, AURX: -.02, MRDN: .015, VRDT: -.005 }, 'Higher yields hit long-duration growth; help bank margins.'),
    T('dove', 3, 'Macro', ['Fed signals rate cuts ahead; yields tumble', 'Cool CPI print: inflation falls faster than expected'], { NVBT: .045, AURX: .02, MRDN: -.01, VRDT: .005 }, 'Lower yields lift growth stocks.'),
    T('riskoff', 2, 'Macro', ['Recession fears hit global markets'], { NVBT: -.035, MRDN: -.035, HLX: -.04, AURX: -.015, VRDT: .01 }, 'Risk-off: cyclicals down, staples hold.'),
    T('riskon', 1, 'Macro', ['Soft-landing hopes lift stocks to record highs'], { NVBT: .025, MRDN: .02, HLX: .015, AURX: .01 }, 'Risk-on.'),
  ];

  const REGIMES_MULTI = {
    'Goldilocks': { eq: .12, bond: .02, GOLD: .03, OIL: .0, favour: ['fed_dove', 'cpi_cool', 'risk_on', 'tech_beat', 'trade_deal', 'jp_reform'] },
    'Reflation': { eq: .08, bond: -.06, GOLD: .02, OIL: .2, favour: ['cpi_hot', 'fed_hawk', 'opec_cut', 'china_stim', 'jobs_strong', 'ecb_hawk'] },
    'Stagflation': { eq: -.12, bond: -.07, GOLD: .08, OIL: .15, favour: ['cpi_hot', 'fed_hawk', 'mideast', 'eu_energy', 'uk_fiscal', 'opec_cut'] },
    'Recession': { eq: -.15, bond: .07, GOLD: .1, OIL: -.25, favour: ['recession', 'jobs_weak', 'fed_dove', 'bank_stress', 'china_slow', 'opec_war'] },
  };
  const REGIMES_EQ = { 'Growth rally': { drift: { NVBT: .3, MRDN: .05, HLX: -.05, VRDT: 0, AURX: .1 }, favour: ['dove', 'ai', 'riskon'] }, 'Rate shock': { drift: { NVBT: -.25, MRDN: .08, HLX: .2, VRDT: .02, AURX: -.05 }, favour: ['hawk', 'oilup', 'riskoff'] }, 'Choppy': { drift: { NVBT: .05, MRDN: -.05, HLX: .05, VRDT: .03, AURX: 0 }, favour: [] } };

  function fill(h, rng, extra = {}) {
    return h.replace(/\{([^}]+)\}/g, (m, k) => extra[k] ?? (k.includes('|') ? rng.pick(k.split('|')) : k === 'country' ? rng.pick(COUNTRIES) : m));
  }

  function generate(fundId, seed) {
    // Multi-asset years are generated on the v1 universe (templates use its keys), then
    // converted to the AmplifyME universe with toAM() (js/sim/scenarios-am.js).
    const rng = RNG(seed), fund = fundId === 'multi' ? LEGACY_FUND : UNIVERSE[fundId], days = fund.months * 21, M = fund.months;
    const isM = fundId === 'multi';
    const rnames = isM ? Object.keys(REGIMES_MULTI) : Object.keys(REGIMES_EQ);
    const regimeName = rng.pick(rnames), R = isM ? REGIMES_MULTI[regimeName] : REGIMES_EQ[regimeName];
    // event days
    const nEv = isM ? 28 : 24, ev = [];
    let ds = []; for (let i = 0; i < nEv; i++) ds.push(rng.int(2, days - 3)); ds.sort((a, b) => a - b);
    for (let i = 1; i < ds.length; i++) if (ds[i] - ds[i - 1] < 2) ds[i] = Math.min(days - 3, ds[i - 1] + 2);
    const lib = isM ? MULTI : EQ_SECTOR;
    for (const d of ds) {
      let t, imp, h;
      if (!isM && rng() < .45) {   // company-specific generic template
        t = rng.pick(EQ_STOCK); const a = rng.pick(fund.assets);
        imp = { [a.id]: t.imp._ * rng.range(.7, 1.4) }; h = fill(rng.pick(t.hs), rng, { name: a.name, q: String(((Math.floor(d / 63) + 3) % 4) + 1) });
      } else {
        const fav = R.favour.length && rng() < .45 ? lib.filter(x => R.favour.includes(x.k)) : lib;
        t = rng.pick(fav.length ? fav : lib); const k = rng.range(.7, 1.4);
        imp = Object.fromEntries(Object.entries(t.imp).map(([a, v]) => [a, v * k])); h = fill(rng.pick(t.hs), rng);
      }
      ev.push(E(d, t.sev, t.tag, h, imp, t.why));
    }
    for (let i = 0; i < (isM ? 6 : 4); i++) ev.push(E(rng.int(2, days - 3), 0, 'Corporate', fill(rng.pick(NOISE), rng), {}, 'Noise. No impact on your assets.'));
    ev.sort((a, b) => a.d - b.d);

    // waypoints: cumulative news + regime drift + monthly random walk
    const wp = {}, endRet = {};
    for (const a of fund.assets) {
      const drift = isM ? (R[a.id] ?? R[a.cls] ?? 0) : R.drift[a.id];
      const arr = [0]; let rw = 0;
      for (let m = 1; m <= M; m++) {
        const cut = m * 21;
        let news = 0; for (const e of ev) if (e.d < cut && e.imp[a.id]) news += Math.log(1 + e.imp[a.id]);
        rw += rng.normal() * a.vol * .45 / Math.sqrt(12);
        const lg = news * .8 + drift * (m / 12) + rw;
        arr.push(+((Math.exp(lg) - 1) * 100).toFixed(2));
      }
      wp[a.id] = arr; endRet[a.id] = arr[M] / 100;
    }

    // research pack: views right ~2/3 of the time
    const benchRet = sum(fund.assets.map(a => fund.bench[a.id] * endRet[a.id]));
    const view = a => { const rel = endRet[a.id] - benchRet + rng.normal() * .07; return rel > .04 ? 'OW' : rel < -.04 ? 'UW' : 'N'; };
    let research;
    if (isM) {
      const infl = regimeName === 'Reflation' || regimeName === 'Stagflation';
      const growth = regimeName === 'Goldilocks' || regimeName === 'Reflation';
      const g = (b) => (b + rng.normal() * .4).toFixed(1) + '%';
      const regions = [
        ['United States', 'US', 2.2, 'Fed'], ['Euro area', 'EU', 1.2, 'ECB'], ['United Kingdom', 'UK', 1.1, 'BoE'], ['Japan', 'JP', 0.9, 'BoJ'], ['Emerging markets', 'EM', 4.2, 'EM central banks'],
      ].map(([name, id, gb, cb]) => ({ name, phase: { Goldilocks: 'Expansion', Reflation: 'Recovery → expansion', Stagflation: 'Slowdown', Recession: 'Slowdown → recession' }[regimeName], view: view(fund.assets.find(a => a.id === id)), rows: [['GDP growth f\'cast', g(gb + (growth ? .6 : -.8))], ['CPI inflation', g(infl ? 5 : 2.4) + (infl ? ' ↑' : '')], ['Policy stance', `${cb}: ${infl ? 'hawkish' : growth ? 'neutral' : 'easing'}`], ['Equity P/E', (rng.range(11, 21)).toFixed(1) + '×']], note: '' }));
      const assets = {}; for (const id of ['UST', 'BUND', 'GILT', 'GOLD', 'OIL']) assets[id] = { view: view(fund.assets.find(a => a.id === id)), note: '' };
      const vtxt = { OW: 'We expect outperformance.', N: 'Balanced risks.', UW: 'We expect underperformance.' };
      regions.forEach(r => (r.note = vtxt[r.view]));
      for (const k in assets) assets[k].note = vtxt[assets[k].view];
      research = { summary: `Our economists' base case: ${infl ? 'inflation pressures building, so central banks are likely to stay hawkish' : 'inflation contained, so policy should stay supportive'}; growth ${growth ? 'solid' : 'slowing'}. Treat the views below as a starting point. They will not all be right.`, regions, assets, risks: ['Central-bank policy error', 'Geopolitical shock to energy supply', 'China growth', 'Credit event'] };
    } else {
      const companies = {};
      for (const a of fund.assets) companies[a.id] = { view: view(a), rows: [['P/E (fwd)', rng.range(8, 50).toFixed(0) + '×'], ['EPS growth', (rng.range(-8, 35)).toFixed(0) + '%'], ['Dividend yield', a.id === 'AURX' || a.id === 'NVBT' ? '—' : rng.range(1.5, 5).toFixed(1) + '%'], ['Sector', a.sector]], note: '' };
      for (const k in companies) companies[k].note = { OW: 'Analysts expect outperformance.', N: 'Fairly valued.', UW: 'Analysts see downside.' }[companies[k].view];
      research = { summary: 'Our equity analysts\' current views on the five holdings. Expect earnings, macro and company-specific headlines; the calls below will not all be right.', companies, risks: ['Interest-rate surprises', 'Single-stock binary events', 'Commodity swings'] };
    }
    const best = fund.assets.reduce((b, a) => (endRet[a.id] > endRet[b.id] ? a : b)), worst = fund.assets.reduce((b, a) => (endRet[a.id] < endRet[b.id] ? a : b));
    const out = {
      id: 'rnd-' + fundId + '-' + seed, fund: fundId, code: 'Random #' + String(seed).slice(-5), difficulty: 'Random', seed, random: true,
      teaser: 'A freshly generated year: new news flow and new price paths every time.',
      yld0: isM ? { UST: +(rng.range(1, 4.5)).toFixed(2), BUND: +(rng.range(-.3, 2.8)).toFixed(2) } : undefined,
      volMult: Array.from({ length: M }, () => +(rng.range(.85, 1.35)).toFixed(2)),
      wp, ev, research,
      reveal: { title: `${regimeName} year (generated)`, basis: 'Randomly generated scenario', lessons: [
        `Best performer: ${best.name} (${Fmt.pctS(endRet[best.id], 1)}). Worst: ${worst.name} (${Fmt.pctS(endRet[worst.id], 1)}).`,
        `Regime: ${regimeName}. More of the headlines leaned that way, so spotting the regime early and tilting towards it paid off.`,
        'About one research call in three was deliberately wrong. Update your views when the news disagrees with them.',
      ] },
    };
    if (!isM) return out;
    const am = toAM(out, null, RNG(seed + 77));
    const fa = UNIVERSE.multi.assets, er = id => am.wp[id][M] / 100;
    const b2 = fa.reduce((b, a) => (er(a.id) > er(b.id) ? a : b)), w2 = fa.reduce((b, a) => (er(a.id) < er(b.id) ? a : b));
    am.reveal.lessons[0] = `Best performer: ${b2.name} (${Fmt.pctS(er(b2.id), 1)}). Worst: ${w2.name} (${Fmt.pctS(er(w2.id), 1)}).`;
    return am;
  }
  // v1 multi-asset universe, used only to generate random years before conversion
  const LEGACY_FUND = { months: 12,
    assets: [['US', 'US Equities', 'eq', .18], ['EU', 'European Equities', 'eq', .2], ['UK', 'UK Equities', 'eq', .16], ['JP', 'Japanese Equities', 'eq', .19], ['EM', 'Emerging Mkts Equities', 'eq', .21],
      ['UST', 'US 10Y Treasury', 'bond', .075], ['BUND', 'German 10Y Bund', 'bond', .065], ['GILT', 'UK 10Y Gilt', 'bond', .075], ['GOLD', 'Gold', 'cmd', .15], ['OIL', 'Brent Crude Oil', 'cmd', .34]]
      .map(([id, name, cls, vol]) => ({ id, name, cls, vol })),
    bench: { US: .30, EU: .10, UK: .05, JP: .05, EM: .10, UST: .15, BUND: .08, GILT: .07, GOLD: .05, OIL: .05 } };
  return { generate };
})();

function allScenarios() { return [...SCENARIOS_MULTI, ...SCENARIOS_EQUITY]; }
function getScenario(id) {
  if (id && id.startsWith('rnd-')) { const [, fund, seed] = id.split('-'); return Generator.generate(fund, +seed); }
  return allScenarios().find(s => s.id === id);
}
