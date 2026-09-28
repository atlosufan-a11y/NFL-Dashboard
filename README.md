# Film Room — NFL Season Dashboard

Standings, game results, team analytics, player leaderboards and a betting workspace for the current NFL season.
It's a static React site (Vite) that reads its data from JSON files in `public/data/`. A scheduled GitHub Action refreshes
those files and redeploys, so the site stays current without anyone editing code.

## What's in it

| Tab | What it shows |
| --- | --- |
| Standings | League and division tables, computed from every final score |
| Games | Every completed game (score, yards, turnovers), team splits, and the upcoming slate with ESPN win probabilities |
| Analytics | Relationship explorer, margin-of-victory histogram (key numbers 3 and 7), efficiency, trajectories, game logs |
| Players | Passing, rushing, receiving, pass rush, interceptions and kicking leaders |
| Betting | **Lines:** consensus and best available spread/total/moneyline across books, line movement, no-vig fair odds vs ESPN's model. **My Bets:** a tracker that grades bets from final scores and reports record, profit, ROI and closing line value, with a weekly limit and JSON export/import. **Calculators:** odds converter, no-vig/hold, parlay |

The site doesn't place bets. Bets you log are stored in your browser only; use Export to back them up.

## Data

| File | Source | Updated by |
| --- | --- | --- |
| `games.json` | Final scores + box-score yards/turnovers (ESPN) | script — only new games are added; existing rows are never overwritten |
| `upcoming.json` | Schedule for this week and next + ESPN win probabilities | script |
| `odds.json` | Current lines from each book + line history (The Odds API) | script with `--odds` |
| `closing-lines.json` | Last pre-kickoff consensus for each game, used for CLV | script with `--odds` |
| `players.json` | Player leaderboards | **manual for now** |
| `meta.json` | Season, sources, last-updated timestamps | script |

## One-time setup

1. **Pages:** repo Settings → Pages → Source: **GitHub Actions**.
2. **Odds (optional, free):** get a key at [the-odds-api.com](https://the-odds-api.com/) and add it under
   Settings → Secrets and variables → Actions as `ODDS_API_KEY`. Without it everything else still works.
3. **Default branch:** scheduled workflows only run on the default branch, and pushes to `main` deploy. Merge this work
   into `main` and make `main` the default branch.
4. Run the workflow once by hand (Actions → *Update data & deploy* → Run workflow) to publish the first build.

## Local development

```sh
npm install
npm run dev            # http://localhost:5173
npm test               # data script + odds math tests
npm run update-data    # refresh scores/schedule from ESPN (add :odds and set ODDS_API_KEY for lines)
```

## Project layout

```
src/
  App.jsx               shell, tabs (hash-routed: #/betting etc.)
  DataContext.jsx       loads public/data/*.json
  lib/derive.js         standings, team stats, weekly splits from games.json
  lib/odds.js           odds math: implied/no-vig, consensus, best price, grading, CLV
  lib/teams.js          teams + feed abbreviation mapping
  components/           one file per tab, plus shared ui.jsx
scripts/update-data.mjs data refresh (ESPN + The Odds API)
.github/workflows/site.yml  schedule → refresh → commit → build → deploy
```
