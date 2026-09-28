#!/usr/bin/env node
// Refreshes public/data/*.json from public feeds.
//
//   node scripts/update-data.mjs          scores, box scores, schedule, win probabilities (ESPN)
//   node scripts/update-data.mjs --odds   ...plus sportsbook lines (needs ODDS_API_KEY)
//
// Existing games are never re-fetched or overwritten, so hand-entered data
// and earlier snapshots stay put. Player stats (players.json) are not touched.

import path from "node:path";
import { fileURLToPath } from "node:url";
import { readJson, writeJson } from "./json-io.mjs";
import { fromEspn, fromName, etDate, matchKey } from "../src/lib/teams.js";
import { consensus } from "../src/lib/odds.js";

const ESPN = "https://site.api.espn.com/apis/site/v2/sports/football/nfl";
const ODDS = "https://api.the-odds-api.com/v4/sports/americanfootball_nfl/odds";
const REGULAR_SEASON = 2;
const LAST_WEEK = 18;
const KEEP_STARTED_ODDS_MS = 3 * 864e5;

const log = (...a) => console.log("[update-data]", ...a);

async function getJson(fetchImpl, url) {
  const res = await fetchImpl(url, { headers: { accept: "application/json" } });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url.replace(/apiKey=[^&]+/, "apiKey=***")}`);
  return { body: await res.json(), headers: res.headers };
}

/* ------------------------------------------------------------------ */
/* ESPN                                                                */
/* ------------------------------------------------------------------ */
const teamStat = (team, name) => {
  const s = team?.statistics?.find((x) => x.name === name);
  const v = s ? parseInt(String(s.displayValue ?? s.value).replace(/,/g, ""), 10) : NaN;
  return Number.isFinite(v) ? v : null;
};

function parseEvent(ev, season) {
  const comp = ev.competitions?.[0];
  if (!comp) return null;
  const side = (ha) => comp.competitors?.find((c) => c.homeAway === ha);
  const home = side("home"), away = side("away");
  const h = fromEspn(home?.team?.abbreviation), a = fromEspn(away?.team?.abbreviation);
  if (!h || !a) return null;
  const wk = ev.week?.number;
  const state = comp.status?.type?.state ?? ev.status?.type?.state;
  const completed = comp.status?.type?.completed ?? ev.status?.type?.completed;
  return {
    espnId: ev.id, id: `${season}-${wk}-${a}-${h}`, wk, kickoff: new Date(ev.date).toISOString(),
    away: a, home: h, awayPts: +away.score, homePts: +home.score, state, completed: !!completed,
  };
}

async function fetchBox(fetchImpl, espnId, away, home) {
  const { body } = await getJson(fetchImpl, `${ESPN}/summary?event=${espnId}`);
  const teams = body.boxscore?.teams || [];
  const byAbbr = Object.fromEntries(teams.map((t) => [fromEspn(t.team?.abbreviation), t]));
  const pred = body.predictor;
  const prob = (t) => {
    const v = parseFloat(t?.gameProjection);
    return Number.isFinite(v) ? +v.toFixed(1) : null;
  };
  return {
    awayYds: teamStat(byAbbr[away], "totalYards"), homeYds: teamStat(byAbbr[home], "totalYards"),
    awayTO: teamStat(byAbbr[away], "turnovers"), homeTO: teamStat(byAbbr[home], "turnovers"),
    awayWinProb: prob(pred?.awayTeam), homeWinProb: prob(pred?.homeTeam),
  };
}

export async function updateScores({ fetchImpl, games, meta }) {
  const { body: current } = await getJson(fetchImpl, `${ESPN}/scoreboard`);
  const season = current.season?.year ?? meta.season;
  const seasonType = current.season?.type ?? REGULAR_SEASON;
  const curWeek = current.week?.number ?? 1;

  if (season !== meta.season) log(`season rolled over: ${meta.season} -> ${season}`);
  // Preseason: only the schedule for week 1. Postseason: regular season is complete.
  const lastWeek = seasonType === REGULAR_SEASON ? Math.min(curWeek + 1, LAST_WEEK) : seasonType === 1 ? 1 : LAST_WEEK;
  const upcomingWeeks = new Set(seasonType === REGULAR_SEASON ? [curWeek, curWeek + 1] : seasonType === 1 ? [1] : []);

  const known = new Map(games.filter((g) => g.season === season).map((g) => [g.id, g]));
  const added = [], upcoming = [];

  for (let wk = 1; wk <= lastWeek; wk++) {
    const { body } = await getJson(fetchImpl, `${ESPN}/scoreboard?dates=${season}&seasontype=${REGULAR_SEASON}&week=${wk}`);
    for (const ev of body.events || []) {
      const e = parseEvent(ev, season);
      if (!e) continue;
      if (e.completed) {
        if (known.has(e.id)) continue;
        const box = await fetchBox(fetchImpl, e.espnId, e.away, e.home).catch((err) => {
          log(`box score unavailable for ${e.id}: ${err.message}`);
          return {};
        });
        const g = {
          id: e.id, season, wk, date: etDate(e.kickoff), away: e.away, home: e.home,
          awayPts: e.awayPts, homePts: e.homePts,
          awayYds: box.awayYds ?? null, homeYds: box.homeYds ?? null, awayTO: box.awayTO ?? null, homeTO: box.homeTO ?? null,
        };
        known.set(g.id, g);
        added.push(g);
      } else if (e.state === "pre" && upcomingWeeks.has(wk)) {
        const box = await fetchBox(fetchImpl, e.espnId, e.away, e.home).catch(() => ({}));
        upcoming.push({
          id: e.id, season, wk, kickoff: e.kickoff, away: e.away, home: e.home,
          awayWinProb: box.awayWinProb ?? null, homeWinProb: box.homeWinProb ?? null,
        });
      }
    }
  }

  // Keep other seasons' games (history) and every game already on file.
  const merged = [...games.filter((g) => g.season !== season), ...known.values()]
    .sort((a, b) => a.season - b.season || a.date.localeCompare(b.date) || a.wk - b.wk || a.id.localeCompare(b.id));
  upcoming.sort((a, b) => a.kickoff.localeCompare(b.kickoff));
  return { games: merged, upcoming, added, season, curWeek };
}

/* ------------------------------------------------------------------ */
/* Odds                                                                */
/* ------------------------------------------------------------------ */
function parseBook(bm, home, away) {
  const m = Object.fromEntries((bm.markets || []).map((x) => [x.key, x.outcomes || []]));
  const byName = (outs, name) => outs.find((o) => o.name === name);
  const pp = (o) => (o ? { point: o.point ?? null, price: o.price ?? null } : null);
  return {
    key: bm.key, title: bm.title, updated: bm.last_update,
    spread: m.spreads ? { home: pp(byName(m.spreads, home)), away: pp(byName(m.spreads, away)) } : null,
    total: m.totals ? { over: pp(byName(m.totals, "Over")), under: pp(byName(m.totals, "Under")) } : null,
    ml: m.h2h ? { home: byName(m.h2h, home)?.price ?? null, away: byName(m.h2h, away)?.price ?? null } : null,
  };
}

const snapshotOf = (t, books) => {
  const c = consensus(books);
  return { t, spreadHome: c.spreadHome, total: c.total, mlHome: c.mlHome, mlAway: c.mlAway };
};
const sameLine = (a, b) => a && b && ["spreadHome", "total", "mlHome", "mlAway"].every((k) => a[k] === b[k]);

export async function updateOdds({ fetchImpl, apiKey, odds, closing, upcoming, now = new Date() }) {
  const url = `${ODDS}?regions=us&markets=h2h,spreads,totals&oddsFormat=american&apiKey=${apiKey}`;
  const { body, headers } = await getJson(fetchImpl, url);
  const t = now.toISOString();
  const prev = Object.fromEntries((odds.games || []).map((g) => [g.key, g]));
  const wkByKey = Object.fromEntries(upcoming.map((u) => [matchKey(u.away, u.home, etDate(u.kickoff)), u.wk]));
  const next = {};

  for (const ev of body) {
    const home = fromName(ev.home_team), away = fromName(ev.away_team);
    if (!home || !away) continue;
    const key = matchKey(away, home, etDate(ev.commence_time));
    const old = prev[key];
    // Once a game kicks off, the feed switches to live odds; freeze the pre-game lines.
    if (new Date(ev.commence_time) <= now) {
      if (old) next[key] = old;
      continue;
    }
    const books = (ev.bookmakers || []).map((b) => parseBook(b, ev.home_team, ev.away_team));
    if (!books.length) continue;
    const history = [...(old?.history || [])];
    const snap = snapshotOf(t, books);
    if (!sameLine(history[history.length - 1], snap)) history.push(snap);
    next[key] = {
      key, oddsId: ev.id, wk: wkByKey[key] ?? old?.wk ?? null, kickoff: new Date(ev.commence_time).toISOString(),
      away, home, books, history,
    };
  }

  // Started games that dropped out of the feed: keep them a few days, then
  // file their last pre-game snapshot as the closing line.
  const closed = [...closing];
  const closedKeys = new Set(closed.map((c) => c.key));
  for (const g of Object.values(prev)) {
    if (next[g.key]) continue;
    const started = new Date(g.kickoff) <= now;
    if (started && now - new Date(g.kickoff) < KEEP_STARTED_ODDS_MS) { next[g.key] = g; continue; }
    if (started && !closedKeys.has(g.key) && g.history?.length) {
      const last = g.history.filter((h) => new Date(h.t) < new Date(g.kickoff)).pop() || g.history[g.history.length - 1];
      closed.push({ key: g.key, wk: g.wk, kickoff: g.kickoff, away: g.away, home: g.home, ...last });
    }
  }

  const games = Object.values(next).sort((a, b) => a.kickoff.localeCompare(b.kickoff));
  return {
    odds: { updatedAt: t, games },
    closing: closed.sort((a, b) => a.kickoff.localeCompare(b.kickoff)),
    remaining: headers?.get?.("x-requests-remaining") ?? null,
  };
}

/* ------------------------------------------------------------------ */
/* Entry point                                                         */
/* ------------------------------------------------------------------ */
export async function run({ dataDir, fetchImpl = fetch, withOdds = false, apiKey, now = new Date() }) {
  const file = (f) => path.join(dataDir, f);
  const meta = readJson(file("meta.json"), { season: now.getFullYear() });
  const games = readJson(file("games.json"), []);
  const oldUpcoming = readJson(file("upcoming.json"), []);

  const scores = await updateScores({ fetchImpl, games, meta });
  log(`season ${scores.season}, week ${scores.curWeek}: ${scores.added.length} new final(s), ${scores.upcoming.length} upcoming`);

  // An empty schedule usually means the feed hiccuped; keep the old one.
  const upcoming = scores.upcoming.length ? scores.upcoming : oldUpcoming.filter((u) => new Date(u.kickoff) > now);
  const nextMeta = {
    ...meta, season: scores.season,
    gamesSource: scores.added.length && !/ESPN/.test(meta.gamesSource || "") ? `${meta.gamesSource}; ESPN (later games)` : meta.gamesSource,
    upcomingSource: "ESPN (schedule and win probabilities)",
  };

  let changed = writeJson(file("games.json"), scores.games);
  changed = writeJson(file("upcoming.json"), upcoming) || changed;

  if (withOdds) {
    if (!apiKey) {
      log("ODDS_API_KEY not set; skipping odds");
    } else {
      try {
        const r = await updateOdds({
          fetchImpl, apiKey, now, upcoming,
          odds: readJson(file("odds.json"), { games: [] }), closing: readJson(file("closing-lines.json"), []),
        });
        // A snapshot with unchanged lines still refreshes "as of"; that's worth a commit.
        changed = writeJson(file("odds.json"), r.odds) || changed;
        changed = writeJson(file("closing-lines.json"), r.closing) || changed;
        nextMeta.oddsUpdatedAt = r.odds.updatedAt;
        if (r.remaining != null) nextMeta.oddsRequestsRemaining = +r.remaining;
        log(`odds: ${r.odds.games.length} game(s), ${r.closing.length} closing line(s), ${r.remaining ?? "?"} API credits left`);
      } catch (err) {
        // Scores still get published when the odds feed fails.
        log(`odds update failed: ${err.message}`);
        process.exitCode = 1;
      }
    }
  }

  if (changed || nextMeta.season !== meta.season) nextMeta.updatedAt = now.toISOString();
  writeJson(file("meta.json"), nextMeta);
  log(changed ? "data changed" : "no changes");
  return { ...scores, changed };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const dataDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../public/data");
  run({ dataDir, withOdds: process.argv.includes("--odds"), apiKey: process.env.ODDS_API_KEY }).catch((err) => {
    console.error("[update-data] failed:", err.message);
    process.exit(1);
  });
}
