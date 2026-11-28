/* ==========================================================================
   Universe: instruments, benchmark and rules for each fund format.

   MULTI = the AmplifyME Asset Management Simulation (as used in the BOCHK x HKU
   Wealthathon). Source of truth: AmplifyME's 12-video pre-learning course
   (see the Guide page). Items marked GUESS are not stated in the course.
   - 12 instruments: 7 equity indices, 2 bond futures, gold, oil (+ EURUSD, 0% benchmark)
   - Benchmark 50 / 30 / 20 ("balanced" client): 7 equities at 50/7 % each,
     US10 15%, GE10 15%, GOLD 10%, OIL 10%, EURUSD 0%
   - $20M, start 100% cash, 4 quarters with rebalancing breaks
   - Long only · ≥90% invested at each quarter start · ≤$5M per product ·
     ≤$500k loss on any trade · weights within ±10% of benchmark · no commission,
     market impact only · orders in contracts

   EQUITY = a different AmplifyME format (5 stocks, 10–30% each). Kept from v1
   for extra practice; not the Wealthathon format.

   Prices are quoted in index points / futures price; a contract is worth
   price × mult in USD. Contract multipliers are GUESSES modelled on the real
   futures (ES $50, TY $1,000, GC 100oz, CL 1,000bbl, 6E €125k).
   impact = market impact in bp per $1M traded (GUESS); spread = bid/ask in bp.
   ========================================================================== */
const EQW = 0.5 / 7;   // 7.142857…%

const UNIVERSE = {
  multi: {
    id: 'multi',
    name: 'AmplifyME AM Simulation',
    short: 'AM Sim',
    tagline: 'Wealthathon format',
    months: 12, quarters: 4,
    capital: 20e6,
    desc: 'The real competition format: a $20M balanced multi-asset fund against a 50/30/20 benchmark. Start in cash, then four quarters with rebalancing breaks. Seven equity indices, US and German 10-year bond futures, gold, oil and EURUSD.',
    classes: { eq: 'Equity', bond: 'Bond', cmd: 'Commodity', fx: 'FX' },
    classOrder: ['eq', 'bond', 'fx', 'cmd'],
    assets: [
      { id: 'HSI', tk: 'HSI', name: 'Hang Seng', long: 'Hong Kong · Hang Seng Index', cls: 'eq', region: 'Hong Kong / China', p0: 23436, vol: .22, spread: 2, impact: 3, mult: 5, unit: 'contracts', dp: 0, L: { eq: .9, asia: .7 }, idio: .45 },
      { id: 'NKY', tk: 'NKY', name: 'Nikkei 225', long: 'Japan · Nikkei 225', cls: 'eq', region: 'Japan', p0: 10398, vol: .21, spread: 2, impact: 3, mult: 10, unit: 'contracts', dp: 0, L: { eq: .85, asia: .3 }, idio: .55 },
      { id: 'SPX', tk: 'SPX', name: 'S&P 500', long: 'United States · S&P 500', cls: 'eq', region: 'United States', p0: 1272, vol: .19, spread: 1, impact: 2, mult: 50, unit: 'contracts', dp: 2, L: { eq: 1, us: .5 }, idio: .3 },
      { id: 'MXAS', tk: 'MXAS', name: 'MSCI Asia', long: 'Asia · MSCI Asia index', cls: 'eq', region: 'Asia', p0: 585, vol: .2, spread: 3, impact: 4, mult: 100, unit: 'contracts', dp: 2, L: { eq: .9, asia: .8 }, idio: .35 },
      { id: 'ESTOXX', tk: 'ESTOXX', name: 'Euro Stoxx 50', long: 'Euro area · Euro Stoxx 50', cls: 'eq', region: 'Euro area', p0: 2839, vol: .25, spread: 2, impact: 3, mult: 20, unit: 'contracts', dp: 1, L: { eq: 1, eu: .7 }, idio: .35 },
      { id: 'MXLA', tk: 'MXLA', name: 'MSCI Latin America', long: 'Latin America · MSCI EM Latin America', cls: 'eq', region: 'Latin America', p0: 4661, vol: .25, spread: 4, impact: 5, mult: 10, unit: 'contracts', dp: 1, L: { eq: 1, cmd: .5 }, idio: .45 },
      { id: 'UKX', tk: 'UKX', name: 'FTSE 100', long: 'United Kingdom · FTSE 100', cls: 'eq', region: 'United Kingdom', p0: 6014, vol: .18, spread: 2, impact: 3, mult: 15, unit: 'contracts', dp: 1, L: { eq: .8, cmd: .3, eu: .3 }, idio: .4 },
      { id: 'US10', tk: 'US10', name: 'US 10Y future', long: 'US Treasury 10-year note future', cls: 'bond', region: 'United States', p0: 120, vol: .065, spread: .8, impact: 1, mult: 1000, unit: 'contracts', dp: 3, dur: 6.5, bond: true, L: { rates: 1 }, idio: .3 },
      { id: 'GE10', tk: 'GE10', name: 'German 10Y Bund', long: 'German Bund 10-year future', cls: 'bond', region: 'Euro area', p0: 126, vol: .06, spread: .8, impact: 1.2, mult: 1000, unit: 'contracts', dp: 3, dur: 8, bond: true, L: { rates: .85 }, idio: .45 },
      { id: 'EURUSD', tk: 'EURUSD', name: 'EUR/USD', long: 'Euro vs US dollar (0% benchmark)', cls: 'fx', region: 'FX', p0: 1.3360, vol: .1, spread: .6, impact: .8, mult: 125000, unit: 'contracts', dp: 4, L: { fx: 1, eu: .2 }, idio: .4 },
      { id: 'GOLD', tk: 'GOLD', name: 'Gold', long: 'Gold, $ per troy ounce', cls: 'cmd', region: 'Global', p0: 1420, vol: .2, spread: 2, impact: 2.5, mult: 100, unit: 'contracts', dp: 1, L: { safe: 1, rates: .3 }, idio: .6 },
      { id: 'OIL', tk: 'OIL', name: 'Crude oil', long: 'Crude oil, $ per barrel', cls: 'cmd', region: 'Global', p0: 91.50, vol: .32, spread: 3, impact: 3, mult: 1000, unit: 'contracts', dp: 2, L: { cmd: 1, eq: .25 }, idio: .55 },
    ],
    bench: { HSI: EQW, NKY: EQW, SPX: EQW, MXAS: EQW, ESTOXX: EQW, MXLA: EQW, UKX: EQW, US10: .15, GE10: .15, EURUSD: 0, GOLD: .10, OIL: .10 },
    rules: {
      longOnly: true,
      minInvested: .90,          // course: at least 90% invested at the start of each quarter
      maxProductUsd: 5e6,        // course: at most $5M in any one product
      maxTradeLossUsd: 5e5,      // course: at most $500k loss on any single trade
      assetBand: .10,            // course: ±10% from each benchmark weight (applied per instrument: GUESS)
      classBand: .10,            // course example 50/30/20 → 60/25/15 (asset-class level)
      cashRange: null,
      commissionBps: 0,          // course: no commission
      rfq: false,
    },
    estimates: {                 // shown in the Guide as "our guess"
      oilStart: 'OIL start price $91.50 (WTI, early Jan 2011): not captured in the course',
      eurStart: 'EURUSD start 1.3360 (early Jan 2011): not captured in the course',
      contracts: 'Contract multipliers modelled on the real futures',
      impact: 'Market-impact strength',
    },
  },

  equity: {
    id: 'equity',
    name: 'Equity Fund · 5 stocks',
    short: 'Equity',
    tagline: 'other AmplifyME format',
    months: 6, quarters: 2,
    capital: 20e6,
    desc: 'A different AmplifyME format (Finance Accelerator / CFA challenge style): $20M in five stocks, each between 10% and 30%, small cash buffer. Not the Wealthathon format; extra practice only.',
    classes: { eq: 'Equity' },
    classOrder: ['eq'],
    assets: [
      { id: 'NVBT', tk: 'NVBT', name: 'Novabyte Semiconductor', long: 'Semiconductors · AI data-centre chips', cls: 'eq', sector: 'Technology', p0: 138.6, vol: .42, spread: 6, impact: 2.5, mult: 1, unit: 'shares', dp: 2, L: { eq: 1.2, tech: 1 }, idio: .8 },
      { id: 'MRDN', tk: 'MRDN', name: 'Meridian Bank', long: 'US commercial & retail bank', cls: 'eq', sector: 'Financials', p0: 52.3, vol: .28, spread: 6, impact: 2.5, mult: 1, unit: 'shares', dp: 2, L: { eq: 1, rates: -.5 }, idio: .7 },
      { id: 'HLX', tk: 'HLX', name: 'Helix Energy', long: 'Integrated oil & gas producer', cls: 'eq', sector: 'Energy', p0: 84.1, vol: .33, spread: 6, impact: 2.5, mult: 1, unit: 'shares', dp: 2, L: { eq: .7, cmd: 1 }, idio: .6 },
      { id: 'VRDT', tk: 'VRDT', name: 'Verdant Foods', long: 'Packaged foods & household brands', cls: 'eq', sector: 'Consumer staples', p0: 61.8, vol: .17, spread: 5, impact: 2, mult: 1, unit: 'shares', dp: 2, L: { eq: .55 }, idio: .8 },
      { id: 'AURX', tk: 'AURX', name: 'Aurora Therapeutics', long: 'Biotech · oncology & metabolic', cls: 'eq', sector: 'Healthcare', p0: 112.4, vol: .38, spread: 7, impact: 3, mult: 1, unit: 'shares', dp: 2, L: { eq: .8 }, idio: 1 },
    ],
    bench: { NVBT: .2, MRDN: .2, HLX: .2, VRDT: .2, AURX: .2 },
    rules: {
      longOnly: true, minInvested: .90, maxProductUsd: null, maxTradeLossUsd: 5e5,
      assetRange: [.10, .30], classBand: null, cashRange: [.01, .10],
      commissionBps: 2, rfq: true,
    },
  },
};

// Bank RFQ venue (equity format only)
const VENUE = {
  minCommission: 25,
  rfqTimeoutMs: 6000,
  banks: [{ id: 'NBS', name: 'Northbridge Securities' }, { id: 'HAL', name: 'Halden & Co' }, { id: 'KES', name: 'Kestrel Bank' }],
};

/* Human-readable list of the rules (briefing, guide, risk tab) */
function ruleList(fund) {
  const R = fund.rules, out = [];
  out.push({ k: 'long', label: 'Long only: no short selling, no leverage', src: 'course' });
  out.push({ k: 'invested', label: `At least ${R.minInvested * 100}% invested at the start of every quarter`, src: 'course' });
  if (R.maxProductUsd) out.push({ k: 'cap', label: `At most ${Fmt.compact(R.maxProductUsd)} in any one product`, src: 'course' });
  out.push({ k: 'stop', label: `At most ${Fmt.compact(R.maxTradeLossUsd)} loss on any trade: cut it before it gets there`, src: fund.id === 'multi' ? 'course' : 'ours' });
  if (R.assetBand) out.push({ k: 'band', label: `Each instrument within ±${R.assetBand * 100}pp of its benchmark weight`, src: 'guess' });
  if (R.classBand) out.push({ k: 'cls', label: `Each asset class within ±${R.classBand * 100}pp (equity 40–60%, bonds 20–40%, commodities 10–30%)`, src: 'course' });
  if (R.assetRange) out.push({ k: 'range', label: `Each stock between ${R.assetRange[0] * 100}% and ${R.assetRange[1] * 100}%`, src: 'format' });
  if (R.cashRange) out.push({ k: 'cash', label: `Cash between ${R.cashRange[0] * 100}% and ${R.cashRange[1] * 100}% at every close`, src: 'format' });
  out.push({ k: 'cost', label: R.commissionBps ? `${R.commissionBps}bp commission on exchange orders; bank RFQs commission-free` : 'No commission. Big orders pay market impact', src: fund.id === 'multi' ? 'course' : 'format' });
  return out;
}

/* Allowed [min,max] weight per instrument and per class (cap depends on NAV). */
function mandateRanges(fund, nav) {
  const R = fund.rules, out = { asset: {}, cls: {}, cash: R.cashRange || null };
  for (const a of fund.assets) {
    const b = fund.bench[a.id];
    let r = R.assetRange ? R.assetRange.slice() : R.assetBand != null ? [Math.max(0, b - R.assetBand), b + R.assetBand] : [0, 1];
    if (R.maxProductUsd && nav) r[1] = Math.min(r[1], R.maxProductUsd / nav);
    out.asset[a.id] = [+r[0].toFixed(5), +r[1].toFixed(5)];
  }
  if (R.classBand) for (const k of Object.keys(fund.classes)) {
    const b = sum(fund.assets.filter(a => a.cls === k).map(a => fund.bench[a.id]));
    if (b > 0) out.cls[k] = [Math.max(0, b - R.classBand), b + R.classBand];
  }
  return out;
}

/* Continuous constraint checks (evaluated live and at every daily close).
   The 90%-invested rule (quarter starts) and the $500k stop-loss (per position)
   are tracked separately in Session. */
function mandateChecks(fund, w, cashW, nav) {
  const R = mandateRanges(fund, nav), res = [], tol = 1e-6, Rl = fund.rules;
  for (const a of fund.assets) {
    const b = fund.bench[a.id], v = w[a.id] || 0;
    const [mn, mxBand] = Rl.assetRange ? Rl.assetRange : Rl.assetBand != null ? [Math.max(0, b - Rl.assetBand), b + Rl.assetBand] : [0, 1];
    res.push({ id: 'a:' + a.id, scope: 'asset', key: a.id, label: a.tk + ' weight', value: v, min: mn, max: mxBand, ok: v >= mn - tol && v <= mxBand + tol, over: v > mxBand + tol ? v - mxBand : v < mn - tol ? v - mn : 0 });
    if (Rl.maxProductUsd && nav) {
      const usd = v * nav;
      res.push({ id: 'p:' + a.id, scope: 'cap', key: a.id, label: a.tk + ' ≤ ' + Fmt.compact(Rl.maxProductUsd), value: usd, min: 0, max: Rl.maxProductUsd, usd: true, ok: usd <= Rl.maxProductUsd + 1, over: usd > Rl.maxProductUsd + 1 ? (usd - Rl.maxProductUsd) / nav : 0 });
    }
  }
  for (const [k, [mn, mx]] of Object.entries(R.cls)) {
    const v = sum(fund.assets.filter(a => a.cls === k).map(a => w[a.id] || 0));
    res.push({ id: 'c:' + k, scope: 'class', key: k, label: fund.classes[k] + ' (class)', value: v, min: mn, max: mx, ok: v >= mn - tol && v <= mx + tol, over: v > mx + tol ? v - mx : v < mn - tol ? v - mn : 0 });
  }
  if (R.cash) {
    const [cm, cx] = R.cash;
    res.push({ id: 'cash', scope: 'cash', key: 'cash', label: 'Cash', value: cashW, min: cm, max: cx, ok: cashW >= cm - tol && cashW <= cx + tol, over: cashW > cx + tol ? cashW - cx : cashW < cm - tol ? cashW - cm : 0 });
  }
  return res;
}
