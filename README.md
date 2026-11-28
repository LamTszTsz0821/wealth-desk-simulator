# AM Sim Trainer v3: AmplifyME Asset Management Simulation practice

A practice simulator for the **AmplifyME Asset Management Simulation** used in the **BOCHK × HKU Business
School Wealthathon Challenge**. v2 rebuilt the simulator to the rules in AmplifyME's own pre-learning course (12 videos),
using the team's notes in `AM_Sim_Handoff/reference/amplifyme-course-notes.md`. **v3** rearranges the trading screen into the layout the course describes.

> Independent practice tool: not affiliated with AmplifyME, BOCHK or HKU. AmplifyME doesn't publish its
> scoring formulas, contract sizes or price data, so those parts are our estimates (see "What's a guess").

## Open it
Unzip and double-click **`index.html`**. It runs offline in Chrome, Edge, Safari or Firefox, with no install and no
build step. Use a laptop/desktop screen (1280px wide or more). Scores are saved in that browser only.

## What matches the course
| | v2 |
|---|---|
| Role | Fund manager + research analyst + your own execution trader, $20M **balanced** multi-asset fund |
| Instruments | **HSI, NKY, SPX, MXAS, ESTOXX, MXLA, UKX** · **US10, GE10** · **GOLD, OIL** · **EURUSD** |
| Start prices | Course: HSI 23,436 · NKY 10,398 · SPX 1,272 · MXAS 585 · ESTOXX 2,839 · MXLA 4,661 · UKX 6,014 · US10 120 · GE10 126 · GOLD 1,420 |
| Benchmark | **50 / 30 / 20**: 7 equities × 7.14%, US10 15%, GE10 15%, GOLD 10%, OIL 10%, EURUSD 0% |
| Timeline | Start **100% cash** → build the portfolio → **4 quarters × 15 min** with **15-min rebalancing breaks** (prices frozen, trading allowed) |
| Rules | Long only · **≥90% invested at each quarter start** · **≤$5M per product** · **≤$500k loss on any trade** · **±10%** from benchmark weights |
| Costs | **No commission**; **market impact** on big orders; orders in **contracts** |
| Scoring | The course's five metrics: **ROI · Cycle judgement & allocation · Rebalancing · Risk management (stop-loss + Sharpe) · Risk appetite** |
| Platform layout (v3) | Top account bar: NAV, P&L, **Fund Weighting** button · **Markets top-left with Equity / Bond / FX / Commodity tabs** · **News in the middle** · **Positions top-right** · **Exchange order ticket bottom-left** · **Price chart with the benchmark line bottom-right**. Arranged from the course's description; panel sizes and visual style are ours (we haven't seen the real screen) |

## How a session runs
1. **Lobby:** pick a scenario, **Exam** or **Training**, and a length. **Real** = 4×15 min + 15-min breaks (≈2 h); shorter options keep the same proportions.
2. **Research & Portfolio Builder:** rules, benchmark, regional research with a **cycle phase** for each region, asset views, and the course's cycle playbook. Set your strategy weights; the builder checks every rule and converts them to contracts.
3. **Trading floor:**
   - **Construction (prices frozen):** start in cash and execute your plan from the **Strategy** tab. **Load next order** fills the ticket, sells first.
   - **Q1–Q4 live:** news flashes, prices move. Watch the **Invested ≥90%** and **Stop-loss** gauges in the top bar.
   - **Breaks:** prices freeze. Rebalance back to your strategy and be ≥90% invested before the next quarter.
4. **Debrief:** the five metrics with breakdowns and the peer average; invested % at each quarter start; a per-break rebalancing table; stop-loss and rule breaches; an (unscored) headline-by-headline news review; trades; rank against 400 simulated peers.

**Exam mode** = real timing, no pause, no warnings, every order entered by hand.
**Training mode** = pause, ½–4× speed, "Start next quarter now", one-click **Execute plan**, warnings before you break a rule, stop-loss alerts at about −$400k, "Why it matters" on each headline.

### Scenarios
- **Course year (2011)**: starts at the course's exact prices. Month-end levels are our reconstruction of 2011's path (from memory of the year, not a data feed: close in shape, not exact), and 57 headlines follow the 2011 timeline: Egypt and Libya, Japan earthquake, euro crisis, US downgrade, gold record, the October summit. **Most likely the year the event replays**: the course start prices point to early 2011, but that's an inference.
- **Scenarios Alpha / Bravo / Charlie**: years modelled on 2022, 2020 and 2023, mapped onto the same 12 instruments.
- **Random year**: generated each time on the same universe, for endless practice.
- **Equity fund (5 stocks)**: a different AmplifyME format kept from v1 for extra practice (not the Wealthathon format).

## Scoring (names from the course, formulas are our estimate)
| Metric | How v2 scores it |
|---|---|
| ROI | Percentile of your return among 400 simulated peers on the same year |
| Cycle judgement & allocation | 60% allocation effect (your over/underweights × relative returns, daily), scaled against a strong hindsight tilt · 40% asset-class calls at each quarter start |
| Rebalancing | Per break: 70% trading back at least the drift since the quarter start (or drift < 1.5%) + 30% ending the break inside every rule |
| Risk management | 40% stop-loss (−25 per position past $500k, −2 per day over) · 30% rules (−0.6 per limit-day, −3 per episode) · 30% Sharpe vs the benchmark |
| Risk appetite | Per quarter start: 100 at ≥90% invested, 0 at ≤80%, linear between |
| Overall | Equal-weight average |

## What's a guess
Scoring formulas and weights · contract sizes (modelled on the real futures: ES $50, TY $1,000, GC 100oz, CL 1,000bbl, 6E €125k) · market-impact strength · OIL ($91.50) and EURUSD (1.3360) start prices · the year replayed (2011 inferred) · "$500k per trade" measured per position vs average cost · ±10% applied per instrument as well as per class · length of the construction phase · bid/ask spreads · peers are simulated, not real players.
All of these are listed in the app under **Guide → What's a guess**.


## Team rooms (one shared fund)
1. The host picks **Players → Host a team room** on the Lobby, sets up the run and goes through the briefing. The room opens as you leave the Lobby: the code is at the top of the briefing, so teammates can join and wait while you read. The trading floor opens for everyone together. (You can also host mid-run with the **Team room** button.)
2. Share the 6-digit code or the link (`…/#/join/123456`). Teammates open the link, or pick **Players → Join a team room** on the Lobby and type the code.
3. Everyone sees the same prices, news, clock and portfolio. Anyone can trade; every order goes into the one shared fund. Pause, skip and End (training) also apply to everyone.
4. Keep the host's tab open (it runs the clock). If the host drops, the Team room button shows "host offline" and any teammate can **Take over as host** with no loss of state.

Sync uses free public MQTT brokers (`js/sim/live-sync.js`), so there's no server or account. Some school or office Wi-Fi blocks it; a phone hotspot usually works. Room codes are random and the room only carries game data.

## Not done yet (optional, ask first)
- Hosting on GitHub Pages.

## Files
    index.html                  app shell (plain JS, no build step)
    js/sim/universe.js          instruments, benchmark, rules
    js/sim/scenarios-am.js      2011 course year + conversion of the other years to the AmplifyME universe
    js/sim/scenarios-multi.js   v1 multi-asset years (source data for Alpha/Bravo/Charlie)
    js/sim/scenarios-equity.js  equity-format years
    js/sim/generator.js         random years
    js/sim/engine.js            price paths
    js/sim/session.js           phases, orders (contracts, market impact), rules, stop-loss, 90% rule
    js/sim/scoring.js           five metrics + 400 simulated peers
    js/pages/                   lobby, research & builder, terminal, debrief, progress, guide
    tools/shoot.py              screenshot + smoke test (Playwright)
    screenshots/                sample screens
