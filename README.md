# Wealth Desk Simulator

A free, browser-based practice simulator for live multi-asset portfolio competitions, built for team practice before an AmplifyME-style wealth-management challenge.

You manage a **$20M client portfolio against a benchmark through 12 months of breaking news**. A year takes 5, 10, 20 or 60 minutes. You start in cash, read the regional research, set your overweights and underweights, then react to headlines, client requests and investment limits.

## Play

Open the GitHub Pages link for this repository. There's nothing to install and no account needed. It works in Chrome, Edge, Safari and Firefox.

- **Solo:** practise alone.
- **Host a team room:** you run the market clock. Share the room code from the header (e.g. `INFL-482193`).
- **Join a team room:** enter the host's code. Everyone sees the same prices, news and one shared portfolio, and anyone can trade or pause.

The same market code always produces the identical market, so you can replay a scenario and compare scores.

## Scoring (out of 1,000)

| Metric | Points | Based on |
|---|---|---|
| Performance | 300 | Alpha versus the benchmark |
| Risk management | 200 | Sharpe ratio versus the benchmark, and max drawdown |
| Discipline | 200 | Limit breaches and missed client requests |
| News response | 150 | Trading the right direction within about 20 seconds of a market-moving headline |
| Resilience | 75 | How much of your worst drawdown you won back |
| Trade management | 75 | Trading costs, and orders over 25% of NAV in one ticket |

These weights are an informed guess based on AmplifyME's published metric names. They are not the official competition formula.

## How team sync works

Team rooms pass messages through free public MQTT brokers (EMQX and HiveMQ) over secure WebSockets, so there's no server or account to set up. Notes:

- Anyone who knows a room code could in principle see or send to that room. Codes are random 6-digit numbers, and the room only carries game data and the nicknames you type. Don't put personal information in names.
- Some school or office networks block these connections. If joining fails, try a phone hotspot.
- If the host closes their tab, the others see a **Take over as host** button and the run continues.

## Files

- `index.html`: the whole simulator (HTML, CSS, JavaScript; no build step)
- `live-sync.js`: the team-room sync layer

Scores and your name are kept only in your own browser.
