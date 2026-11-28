/* ==========================================================================
   Scenarios on the AmplifyME universe (12 instruments)
   1. "Course year": modelled on 2011. The course's start prices (HSI 23,436,
      NKY 10,398, SPX 1,272, GOLD 1,420 …) match early January 2011, and an
      Egypt-crisis headline appears in the course. Month-end levels below follow
      2011's real path as we remember it (approximate, not a data feed); headlines follow the real 2011 timeline.
      This is OUR reconstruction, not AmplifyME's data.
   2. The three v1 years (modelled on 2022 / 2020 / 2023), converted to this
      universe with toAM(): US→SPX, Europe→ESTOXX, UK→UKX, Japan→NKY,
      EM→HSI/MXAS/MXLA, UST→US10, Bund→GE10, plus hand-set paths for the new
      instruments (HSI, MXAS, MXLA, EURUSD).
   Format as in scenarios-multi.js: wp = 13 month-end cumulative % moves,
   ev = E(day, severity, tag, headline, impacts, why). 21 trading days a month;
   quarters are days 0–62, 63–125, 126–188, 189–251.
   ========================================================================== */
const SCN_2011 = {
  id: 'y2011', fund: 'multi', code: 'Course year', difficulty: 'Hard', seed: 2011,
  teaser: 'Starts at the exact prices shown in the AmplifyME course videos (early January 2011). The most likely year for the real event.',
  yld0: { US10: 3.36, GE10: 2.96 },
  volMult: [1, 1.1, 1.6, 1, .9, 1.1, 1.3, 2.4, 2.1, 1.6, 1.4, 1.1],
  wp: {
    HSI:    [0, 0.0, -0.4, 0.4, 1.2, 1.1, -4.4, -4.2, -12.4, -24.9, -15.2, -23.2, -21.3],
    NKY:    [0, -1.5, 2.2, -6.2, -5.3, -6.8, -5.6, -5.4, -13.9, -16.3, -13.6, -18.9, -18.7],
    SPX:    [0, 1.1, 4.3, 4.2, 7.2, 5.7, 3.9, 1.6, -4.2, -11.1, -1.5, -2.0, -1.1],
    MXAS:   [0, 0.5, -2.0, -1.0, 2.0, 0.0, -1.0, 0.0, -8.0, -18.0, -10.0, -15.0, -17.0],
    ESTOXX: [0, 4.1, 6.1, 2.5, 6.1, 0.8, 0.4, -5.2, -18.9, -23.2, -16.0, -17.9, -18.4],
    MXLA:   [0, -3.0, -2.0, 2.0, 1.0, -2.0, -3.0, -4.0, -9.0, -22.0, -12.0, -14.0, -19.0],
    UKX:    [0, -2.5, -0.3, -1.7, 0.9, -0.4, -1.1, -3.3, -10.3, -14.7, -7.8, -8.5, -7.3],
    US10:   [0, -0.3, -0.8, -0.9, 0.4, 2.2, 1.4, 4.1, 8.6, 10.3, 8.8, 9.1, 10.6],
    GE10:   [0, -1.6, -1.9, -3.0, -1.9, -0.6, -0.5, 3.4, 6.0, 8.6, 7.6, 5.8, 9.4],
    EURUSD: [0, 2.5, 3.4, 6.0, 10.9, 7.6, 8.5, 7.7, 7.6, 0.2, 3.7, 0.7, -3.0],
    GOLD:   [0, -6.1, -0.6, 1.3, 9.6, 8.2, 5.6, 14.6, 28.6, 14.1, 21.3, 23.0, 7.8],
    OIL:    [0, 0.8, 6.0, 16.6, 24.5, 12.2, 4.3, 4.6, -2.9, -13.4, 1.9, 9.7, 8.0],
  },
  ev: [
    // ---------------- Q1 ----------------
    E(2, 2, 'Data', 'US private payrolls jump 297k, biggest gain on record (ADP)', { SPX: .01, US10: -.006, EURUSD: -.004 }, 'Strong US data in a recovery: equities up, bond futures down (yields up), dollar firmer.'),
    E(5, 2, 'Euro crisis', 'Portuguese bond yields hit euro-era high; bailout talk grows', { ESTOXX: -.015, GE10: .005, EURUSD: -.01 }, 'Periphery stress: European equities and the euro fall, Bunds bid as a safe haven.'),
    E(8, 2, 'Central banks', 'China raises bank reserve requirements again as inflation tops 5%', { HSI: -.015, MXAS: -.01 }, 'Tightening in China hurts Hong Kong and Asian equities.'),
    E(10, 0, 'Corporate', 'Apple CEO Steve Jobs takes medical leave', {}, 'Company news: no material index impact.'),
    E(12, 2, 'Euro crisis', 'Portugal and Spain bond auctions go smoothly; euro rallies', { ESTOXX: .025, EURUSD: .015, GE10: -.006 }, 'Relief for the periphery: European equities and the euro up, Bunds lose safe-haven bid.'),
    E(14, 1, 'Geopolitics', 'Tunisia\'s president flees after weeks of protests', { OIL: .015, GOLD: .008 }, 'Start of the Arab Spring: small risk premium in oil.'),
    E(18, 1, 'Data', 'China GDP grows 9.8%; markets fear more tightening', { HSI: -.01, MXAS: -.005 }, 'Strong growth means more tightening ahead.'),
    E(19, 3, 'Geopolitics', 'BREAKING: Egypt protests escalate; fears for Suez Canal send oil higher', { OIL: .04, GOLD: .015, SPX: -.018, ESTOXX: -.015, UKX: -.012, MXLA: -.012, HSI: -.008, US10: .006, GE10: .004 }, 'Middle East supply risk: oil and gold up, risk assets down, bonds bid.'),
    E(23, 2, 'Data', 'US manufacturing index hits 7-year high (ISM 60.8)', { SPX: .015, ESTOXX: .01, US10: -.006 }, 'Recovery confirmed: risk-on, bonds lower.'),
    E(29, 2, 'Geopolitics', 'Mubarak resigns; Egypt hands power to the military', { SPX: .006, OIL: -.015, GOLD: -.006 }, 'Uncertainty resolved: oil risk premium eases slightly.'),
    E(36, 3, 'Geopolitics', 'BREAKING: Libya descends into civil war; oil output halted', { OIL: .08, GOLD: .02, SPX: -.02, ESTOXX: -.025, NKY: -.015, UKX: -.01, MXAS: -.01, HSI: -.01, US10: .006 }, 'Real supply loss from an OPEC producer: oil spikes, global equities fall.'),
    E(40, 1, 'Commodities', 'Saudi Arabia pledges to cover Libya\'s lost output', { OIL: -.03 }, 'Spare capacity caps the spike.'),
    E(45, 2, 'Central banks', 'ECB\'s Trichet signals rate hike possible next month', { EURUSD: .012, GE10: -.008, ESTOXX: -.006 }, 'Hawkish ECB: euro up, Bunds down.'),
    E(48, 1, 'Euro crisis', 'Moody\'s cuts Greece three notches to B1', { ESTOXX: -.01, EURUSD: -.004 }, 'Sovereign stress continues.'),
    E(50, 3, 'Disaster', 'BREAKING: Magnitude 9.0 earthquake and tsunami strike north-east Japan', { NKY: -.07, MXAS: -.02, HSI: -.015, SPX: -.012, ESTOXX: -.012, OIL: -.03, US10: .006, GOLD: .01 }, 'Black swan. Japan hit hardest; Japanese demand drops, so oil falls.'),
    E(52, 3, 'Disaster', 'Fukushima nuclear crisis escalates; Nikkei plunges 10.6% in a day', { NKY: -.08, MXAS: -.03, HSI: -.025, SPX: -.02, ESTOXX: -.025, UKX: -.015, MXLA: -.015, US10: .008, GE10: .006, GOLD: .006 }, 'Panic selling; safe havens bid. The low came within days.'),
    E(54, 2, 'Central banks', 'G7 agrees first joint yen intervention in a decade', { NKY: .05, MXAS: .015, SPX: .012, ESTOXX: .01 }, 'Coordinated support: Japanese stocks rebound sharply.'),
    E(55, 2, 'Geopolitics', 'UN authorises no-fly zone over Libya; air strikes begin', { OIL: .02, GOLD: .006 }, 'Conflict widens: oil premium persists.'),
    E(59, 2, 'Euro crisis', 'Portugal\'s prime minister resigns after austerity vote fails', { ESTOXX: -.01, EURUSD: -.005 }, 'Bailout now likely.'),
    // ---------------- Q2 ----------------
    E(66, 2, 'Euro crisis', 'Portugal requests an EU bailout', { ESTOXX: -.008, GE10: .003 }, 'Third euro-area bailout, largely expected.'),
    E(67, 2, 'Central banks', 'ECB raises rates to 1.25%, first hike since 2008', { EURUSD: .012, GE10: -.008, ESTOXX: -.005 }, 'Hiking while the periphery struggles: euro up, Bunds down.'),
    E(70, 0, 'Corporate', 'Royal wedding preparations boost London tourism', {}, 'Noise.'),
    E(74, 2, 'Politics', 'S&P cuts US credit outlook to negative', { SPX: -.018, US10: -.004, GOLD: .012 }, 'Warning shot on US debt: equities dip, gold up.'),
    E(79, 2, 'Central banks', 'Fed\'s first-ever press conference: QE2 to end in June as planned', { SPX: .01, GOLD: .015, EURUSD: .008 }, 'Policy stays ultra-easy: weaker dollar, gold up.'),
    E(81, 2, 'Commodities', 'Gold tops $1,500 for the first time; silver nears $50', { GOLD: .02, MXLA: .008 }, 'Debasement fears: gold momentum.'),
    E(84, 1, 'Geopolitics', 'Osama bin Laden killed in US operation', { SPX: .003, OIL: -.01 }, 'Symbolic; small market impact.'),
    E(87, 3, 'Commodities', 'Commodities crash: silver down 30% in a week, oil drops 9% in a day', { OIL: -.09, GOLD: -.03, MXLA: -.03, UKX: -.015, HSI: -.008 }, 'Speculative unwind: commodities and commodity-exporter markets (LatAm, UK) fall hard.'),
    E(93, 2, 'Euro crisis', 'IMF chief arrested in New York; Greek rescue talks in disarray', { ESTOXX: -.012, EURUSD: -.01 }, 'Leadership vacuum in the euro rescue.'),
    E(98, 0, 'Corporate', 'LinkedIn shares double on first day of trading', {}, 'Noise for index investors.'),
    E(104, 3, 'Data', 'US adds just 54,000 jobs; manufacturing slumps: "soft patch" fears', { SPX: -.022, ESTOXX: -.012, MXLA: -.015, OIL: -.02, US10: .008, GOLD: .006 }, 'Slowdown signals: risk assets down, bonds up.'),
    E(110, 2, 'Euro crisis', 'Riots in Athens as parliament debates new austerity', { ESTOXX: -.02, EURUSD: -.01, GE10: .006 }, 'Greek default risk rises.'),
    E(113, 2, 'Commodities', 'IEA releases 60 million barrels from emergency reserves', { OIL: -.06 }, 'Policy supply: oil falls sharply.'),
    E(118, 2, 'Euro crisis', 'Greek parliament passes austerity package', { ESTOXX: .025, EURUSD: .01, GE10: -.005 }, 'Default avoided for now: relief rally.'),
    // ---------------- Q3 ----------------
    E(130, 2, 'Data', 'US payrolls rise just 18,000; unemployment 9.2%', { SPX: -.012, US10: .01, GOLD: .01 }, 'Recovery stalling: bonds and gold up.'),
    E(133, 3, 'Euro crisis', 'Contagion hits Italy and Spain: Italian 10-year yield tops 6%', { ESTOXX: -.04, EURUSD: -.015, GE10: .012, GOLD: .02, UKX: -.012 }, 'The crisis reaches the big economies: Bunds and gold are the havens.'),
    E(140, 2, 'Euro crisis', 'EU summit agrees second Greek bailout', { ESTOXX: .025, EURUSD: .01, GE10: -.006 }, 'Temporary relief.'),
    E(145, 3, 'Politics', 'US debt-ceiling standoff goes to the wire; GDP revised sharply lower', { SPX: -.03, US10: .01, GOLD: .02, MXLA: -.01 }, 'Political risk + weak growth: risk-off.'),
    E(151, 3, 'Markets', 'BREAKING: Global sell-off: S&P 500 falls 4.8% in a day', { SPX: -.045, ESTOXX: -.04, UKX: -.035, NKY: -.025, HSI: -.03, MXAS: -.03, MXLA: -.04, OIL: -.06, US10: .012, GE10: .01, GOLD: .01 }, 'Panic: everything risky sold, bonds bid.'),
    E(152, 3, 'Politics', 'BREAKING: S&P strips the United States of its AAA credit rating', { SPX: -.045, ESTOXX: -.035, UKX: -.03, NKY: -.02, HSI: -.035, MXAS: -.03, MXLA: -.04, OIL: -.05, US10: .01, GOLD: .04, EURUSD: .004 }, 'Counter-intuitive: Treasuries RALLIED on their own downgrade (flight to safety). Gold surged.'),
    E(154, 3, 'Central banks', 'Fed pledges near-zero rates until at least mid-2013', { SPX: .04, ESTOXX: .02, US10: .008, GOLD: .01 }, 'Policy put: sharp equity rebound, bonds up as well.'),
    E(161, 2, 'Commodities', 'Gold hits record above $1,900 an ounce', { GOLD: .03 }, 'Peak fear. Gold topped two weeks later.'),
    E(170, 2, 'Central banks', 'Swiss National Bank caps the franc at 1.20 per euro', { EURUSD: -.01, GOLD: -.02 }, 'One safe haven closed: money moves elsewhere.'),
    E(173, 3, 'Euro crisis', 'ECB chief economist resigns; Greek default fears grip markets', { ESTOXX: -.04, EURUSD: -.015, GE10: .01, UKX: -.015 }, 'Europe\'s policy consensus cracks.'),
    E(182, 3, 'Central banks', 'Fed launches "Operation Twist" and warns of "significant downside risks"', { SPX: -.03, ESTOXX: -.02, MXLA: -.03, HSI: -.02, OIL: -.05, US10: .015, GE10: .006, GOLD: -.02 }, 'Gloomy Fed message: equities and commodities fall, long bonds rally.'),
    E(184, 3, 'Commodities', 'Commodities rout: gold drops $100 in a day as margin calls hit', { GOLD: -.06, OIL: -.05, MXLA: -.03, UKX: -.02, MXAS: -.015 }, 'Even gold is sold in a liquidity squeeze.'),
    // ---------------- Q4 ----------------
    E(190, 2, 'Central banks', 'Bernanke hints at more support; stocks reverse from 13-month low', { SPX: .02, ESTOXX: .015 }, 'The 2011 low was in early October.'),
    E(194, 0, 'Corporate', 'Apple co-founder Steve Jobs dies at 56', {}, 'Tribute headlines; no index impact.'),
    E(195, 3, 'Euro crisis', 'Merkel and Sarkozy pledge a plan to recapitalise Europe\'s banks', { ESTOXX: .035, EURUSD: .015, UKX: .015, SPX: .01 }, 'Policy response: European rally.'),
    E(205, 3, 'Euro crisis', 'EU summit deal: 50% Greek debt haircut and bigger rescue fund', { ESTOXX: .05, SPX: .034, UKX: .03, HSI: .04, MXAS: .03, MXLA: .04, NKY: .02, OIL: .03, EURUSD: .02, GOLD: .01, US10: -.01, GE10: -.008 }, 'Big risk-on day: equities and commodities up, bonds down.'),
    E(207, 1, 'Corporate', 'Broker MF Global files for bankruptcy', { SPX: -.004 }, 'Contained.'),
    E(208, 3, 'Euro crisis', 'Greek PM calls surprise referendum on bailout; markets tumble', { ESTOXX: -.05, SPX: -.028, UKX: -.025, HSI: -.02, MXLA: -.025, EURUSD: -.015, US10: .01, GE10: .008, OIL: -.02 }, 'The summit deal unravels within days.'),
    E(210, 2, 'Central banks', 'New ECB president Draghi surprises with a rate cut', { ESTOXX: .02, EURUSD: -.008 }, 'Dovish surprise: stocks up, euro down.'),
    E(215, 3, 'Euro crisis', 'Italian 10-year yields breach 7%; Berlusconi to resign', { ESTOXX: -.03, SPX: -.035, UKX: -.02, EURUSD: -.01, GE10: .008, US10: .006 }, 'Italy is too big to bail out: fear peaks again.'),
    E(226, 3, 'Central banks', 'Six central banks cut cost of dollar funding; China eases bank reserves', { SPX: .04, ESTOXX: .04, UKX: .03, HSI: .04, MXAS: .03, MXLA: .04, NKY: .02, OIL: .02, EURUSD: .01, GOLD: .02 }, 'Coordinated easing: the biggest rally of the quarter.'),
    E(232, 2, 'Central banks', 'ECB cuts again and offers banks 3-year loans; EU fiscal pact agreed without UK', { ESTOXX: .01, EURUSD: -.008, GE10: .004 }, 'The LTRO calmed bank funding fears into year-end.'),
    E(239, 2, 'Geopolitics', 'North Korean leader Kim Jong-il dies', { HSI: -.012, MXAS: -.012, NKY: -.01 }, 'Regional uncertainty for Asian markets.'),
    E(244, 2, 'Commodities', 'Gold falls below $1,600 as the dollar strengthens', { GOLD: -.03, EURUSD: -.006 }, 'Gold ended the year well off its September record.'),
  ],
  research: {
    summary: 'The global recovery is a year old. The US is in early expansion with the Fed still buying bonds (QE2) and rates at zero. Emerging markets are booming but fighting inflation with rate hikes. Europe is split: Germany is strong while the periphery (Greece, Ireland, Portugal) is in a debt crisis. Japan is stuck in deflation. Our house view favours US equities, commodities and gold over bonds, with caution on Europe and China.',
    regions: [
      { name: 'United States', id: 'SPX', phase: 'Recovery → Expansion', view: 'OW', rows: [['GDP growth f\'cast', '3.0%'], ['Unemployment', '9.4%'], ['CPI inflation', '1.5%'], ['Policy', 'Fed 0–0.25% + QE2']], note: 'Earnings recovering fast; very easy policy. Fiscal and debt-ceiling politics are a risk.' },
      { name: 'Euro area', id: 'ESTOXX', phase: 'Slowdown (periphery in recession)', view: 'UW', rows: [['GDP growth f\'cast', '1.5%'], ['CPI inflation', '2.2% ↑'], ['Policy', 'ECB 1.00% · hikes mooted'], ['Risk', 'Sovereign debt crisis']], note: 'Two bailouts already (Greece, Ireland). Portugal next? Contagion to Spain/Italy is the tail risk.' },
      { name: 'United Kingdom', id: 'UKX', phase: 'Recovery', view: 'N', rows: [['GDP growth f\'cast', '1.7%'], ['CPI inflation', '3.3% (above target)'], ['Policy', 'BoE 0.5% · QE'], ['Index mix', 'Energy, miners, banks']], note: 'Austerity and a VAT rise weigh on the economy; the index is global and commodity-heavy.' },
      { name: 'Japan', id: 'NKY', phase: 'Stagnation', view: 'N', rows: [['GDP growth f\'cast', '1.1%'], ['CPI inflation', '−0.4% (deflation)'], ['Policy', 'BoJ ~0% · asset purchases'], ['Currency', 'Strong yen hurts exporters']], note: 'Cheap but structurally weak; the yen is the key swing factor.' },
      { name: 'Hong Kong / China', id: 'HSI', phase: 'Late expansion (tightening)', view: 'UW', rows: [['China GDP f\'cast', '9.5%'], ['China CPI', '5.1% ↑'], ['Policy', 'PBoC hiking + reserve ratios'], ['Property', 'Curbs on lending']], note: 'Growth strong but policy is turning tighter to fight inflation and property speculation.' },
      { name: 'Asia ex-Japan', id: 'MXAS', phase: 'Expansion', view: 'N', rows: [['GDP growth f\'cast', '7%'], ['CPI inflation', '4–6% ↑'], ['Policy', 'Several central banks hiking'], ['Flows', 'Strong foreign inflows in 2010']], note: 'Fundamentals good, but inflation forcing rate hikes; vulnerable to global risk-off.' },
      { name: 'Latin America', id: 'MXLA', phase: 'Expansion', view: 'OW', rows: [['GDP growth f\'cast', '4.3%'], ['CPI inflation', '6% ↑'], ['Policy', 'Brazil hiking (11.25%)'], ['Driver', 'Commodity exports']], note: 'Commodity boom supports earnings and currencies.' },
    ],
    assets: {
      US10: { view: 'UW', note: 'Yield 3.36%. Recovery and QE2-driven inflation expectations point to higher yields (lower futures prices).' },
      GE10: { view: 'UW', note: 'Yield 2.96%. ECB likely to hike; German growth strong.' },
      GOLD: { view: 'OW', note: 'Negative real rates, central-bank buying, sovereign-debt fears.' },
      OIL: { view: 'OW', note: 'Demand recovering; little spare capacity outside Saudi Arabia; Middle East unrest.' },
      EURUSD: { view: 'N', note: 'ECB hawkish (supports the euro) vs the debt crisis (weighs on it). Not in the benchmark.' },
    },
    risks: ['Euro sovereign debt crisis spreading to Spain or Italy', 'Unrest in Tunisia spreading across the Middle East', 'China overheating and tightening', 'US fiscal politics: debt ceiling, credit rating', 'End of QE2 in June'],
  },
  reveal: { title: '2011: Arab Spring, Japan earthquake, euro crisis, US downgrade', basis: 'Modelled on 2011 (our reconstruction of the year the course start prices point to)', lessons: [
    'The 50/30/20 benchmark ended roughly flat (about −1%): equities −1% (US) to −21% (HK), bonds about +10%, gold and oil about +8%. Underweighting equities from Q3 and overweighting bonds and gold was the winning allocation.',
    'The research was half wrong. It called bonds underweight just before a +10% year, and LatAm overweight before −19%. Cycle judgement means updating your views as the data turns.',
    'Q3 (Aug–Sep) decided the year: the US downgrade and euro contagion took equities down 15–25%, and Treasuries rallied even though they were the asset downgraded.',
    'Stop-losses mattered: a $5M position in NKY lost over $500k in the earthquake week, and $5M in HSI/ESTOXX/MXLA lost more than that in August–September.',
    'Gold peaked in early September and then fell 15%. Taking profit near the highs and rebalancing at the Q3 break would have helped.',
  ] },
};

/* ---------- converting the v1 years onto this universe ---------- */
const AM_EXTRA = {
  alpha: {
    yld0: { US10: 1.6, GE10: -0.1 },
    wp: {
      HSI:    [0, 1.7, -4.6, -10.6, -14.3, -13.2, -7.5, -14.5, -15.5, -27, -37.5, -23.5, -15.5],
      MXAS:   [0, -3, -5, -7, -12, -12, -18, -20, -21, -29, -32, -22, -20],
      MXLA:   [0, 7, 14, 27, 11, 16, -4, -1, 1, -4, 4, 2, 5],
      EURUSD: [0, -1.3, -1.3, -2.2, -7.1, -5.6, -8.1, -10.2, -11.6, -13.7, -13.0, -8.4, -5.9],
    },
    regions: { 'Hong Kong / China': ['UW', 'Slowdown', 'Zero-Covid lockdowns and property-developer stress.'], 'Asia ex-Japan': ['UW', 'Slowdown', 'Strong dollar and China weakness weigh.'], 'Latin America': ['OW', 'Expansion', 'Commodity exporters; central banks hiked early.'] },
    phases: { 'United States': 'Late expansion → slowdown', 'Euro area': 'Slowdown', 'United Kingdom': 'Slowdown', 'Japan': 'Expansion' },
  },
  bravo: {
    yld0: { US10: 1.9, GE10: -0.2 },
    wp: {
      HSI:    [0, -6.7, -7.3, -16.3, -12.4, -18.5, -13.2, -11.6, -9.6, -13.5, -14.9, -5.4, -3.4],
      MXAS:   [0, -5, -8, -20, -12, -11, -4, 4, 7, 5, 7, 15, 22],
      MXLA:   [0, -3, -13, -45, -35, -35, -22, -15, -20, -23, -23, -7, -14],
      EURUSD: [0, -1.1, -1.6, -2.0, -2.4, -0.8, 0.2, 5.0, 6.4, 4.5, 4.0, 6.5, 9.0],
    },
    regions: { 'Hong Kong / China': ['OW', 'Slowdown', 'Trade truce should help; HK protests a drag.'], 'Asia ex-Japan': ['OW', 'Expansion', 'Tech-cycle upturn.'], 'Latin America': ['N', 'Recovery', 'Commodity-sensitive; Brazil reforms.'] },
    phases: { 'United States': 'Late expansion', 'Euro area': 'Slowdown', 'United Kingdom': 'Slowdown', 'Japan': 'Slowdown' },
  },
  charlie: {
    yld0: { US10: 3.9, GE10: 2.5 },
    wp: {
      HSI:    [0, 10.4, 0.4, 3.5, 0.9, -7.4, -4.9, 1.3, -7.4, -11.4, -15, -14.8, -13.8],
      MXAS:   [0, 8, 1, 4, 3, 1, 5, 10, 4, 1, -3, 5, 6],
      MXLA:   [0, 10, 4, 6, 9, 16, 24, 29, 21, 17, 12, 25, 30],
      EURUSD: [0, 1.6, -1.1, 1.5, 2.8, -0.2, 2.0, 2.8, 1.4, -1.2, -1.2, 1.9, 3.2],
    },
    regions: { 'Hong Kong / China': ['OW', 'Recovery', 'China reopening after zero-Covid.'], 'Asia ex-Japan': ['OW', 'Recovery', 'Chip cycle bottoming.'], 'Latin America': ['N', 'Slowdown', 'Rates high but peaking.'] },
    phases: { 'United States': 'Slowdown', 'Euro area': 'Slowdown', 'United Kingdom': 'Slowdown / recession', 'Japan': 'Expansion' },
  },
};

const LEG_MAP = { US: ['SPX'], EU: ['ESTOXX'], UK: ['UKX'], JP: ['NKY'], UST: ['US10'], BUND: ['GE10'], GOLD: ['GOLD'], OIL: ['OIL'] };
const REG_NAME = { 'Emerging markets': null };
const REGION_ID = { 'United States': 'SPX', 'Euro area': 'ESTOXX', 'United Kingdom': 'UKX', 'Japan': 'NKY', 'Hong Kong / China': 'HSI', 'Asia ex-Japan': 'MXAS', 'Latin America': 'MXLA' };

function mapImpacts(imp, h) {
  const out = {};
  const china = /china|chinese|beijing|shanghai|hong kong/i.test(h || '');
  const commodity = imp.OIL != null && Math.abs(imp.OIL) >= .03;
  for (const [k, v] of Object.entries(imp)) {
    if (k === 'EM') {
      out.HSI = (out.HSI || 0) + v * (china ? 1.3 : .9);
      out.MXAS = (out.MXAS || 0) + v;
      out.MXLA = (out.MXLA || 0) + v * (china ? .5 : commodity ? 1.2 : .9);
    } else if (LEG_MAP[k]) for (const n of LEG_MAP[k]) out[n] = (out[n] || 0) + v;
    // GILT has no equivalent instrument: dropped
  }
  return out;
}

/* Convert an old-universe multi scenario (US/EU/UK/JP/EM/UST/BUND/GILT/GOLD/OIL) to the AM universe. */
function toAM(s, x, rng) {
  x = x || {};
  const M = (s.wp.US || []).length - 1 || 12;
  const r = rng || RNG((s.seed || 1) * 97 + 3);
  const em = s.wp.EM || new Array(M + 1).fill(0);
  const wobble = k => { let acc = 0; return em.map((v, i) => { if (i) acc += r.normal() * k; return +(v + acc).toFixed(2); }); };
  const wp = {
    SPX: s.wp.US, ESTOXX: s.wp.EU, UKX: s.wp.UK, NKY: s.wp.JP, US10: s.wp.UST, GE10: s.wp.BUND, GOLD: s.wp.GOLD, OIL: s.wp.OIL,
    HSI: (x.wp && x.wp.HSI) || wobble(2.5), MXAS: (x.wp && x.wp.MXAS) || wobble(1.5), MXLA: (x.wp && x.wp.MXLA) || wobble(3),
    EURUSD: (x.wp && x.wp.EURUSD) || (() => { let acc = 0; return em.map((v, i) => { if (i) acc += r.normal() * 1.6; return +acc.toFixed(2); }); })(),
  };
  const ev = s.ev.map(e => Object.assign({}, e, { imp: mapImpacts(e.imp, e.h) }));
  let research = s.research;
  if (research && research.regions) {
    const regs = [];
    for (const g of research.regions) {
      if (g.name === 'Emerging markets') {
        for (const nm of ['Hong Kong / China', 'Asia ex-Japan', 'Latin America']) {
          const o = (x.regions && x.regions[nm]) || [g.view, 'Expansion', g.note];
          regs.push({ name: nm, id: REGION_ID[nm], view: o[0], phase: o[1], rows: g.rows, note: o[2] });
        }
      } else regs.push(Object.assign({}, g, { id: REGION_ID[g.name], phase: (x.phases && x.phases[g.name]) || g.phase || '' }));
    }
    const assets = {};
    const A = research.assets || {};
    if (A.UST) assets.US10 = A.UST; if (A.BUND) assets.GE10 = A.BUND; if (A.GOLD) assets.GOLD = A.GOLD; if (A.OIL) assets.OIL = A.OIL;
    assets.EURUSD = A.EURUSD || { view: 'N', note: 'Not in the benchmark. Trade it only with a clear view on the ECB vs the Fed.' };
    research = Object.assign({}, research, { regions: regs, assets });
  }
  const reveal = s.reveal ? Object.assign({}, s.reveal, { lessons: (s.reveal.lessons || []).map(l => l.replace(/60\/40/g, '50/30/20')) }) : s.reveal;
  return Object.assign({}, s, { wp, ev, research, reveal, yld0: x.yld0 || (s.yld0 ? { US10: s.yld0.UST, GE10: s.yld0.BUND } : undefined), p0: undefined, converted: true });
}

const SCENARIOS_MULTI = [SCN_2011, ...LEGACY_MULTI.map(s => toAM(s, AM_EXTRA[s.id]))];
