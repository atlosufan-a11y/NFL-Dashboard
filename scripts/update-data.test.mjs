import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { run } from "./update-data.mjs";
import { writeJson } from "./json-io.mjs";

// Minimal responses in the shape ESPN's site API and The Odds API return.
const competitor = (homeAway, abbreviation, score, winner) => ({ homeAway, team: { abbreviation }, score: String(score), winner });
const event = ({ id, week, date, away, home, awayPts = 0, homePts = 0, state }) => ({
  id, date, week: { number: week },
  competitions: [{
    competitors: [competitor("home", home, homePts, homePts > awayPts), competitor("away", away, awayPts, awayPts > homePts)],
    status: { type: { state, completed: state === "post" } },
  }],
});

const scoreboards = {
  current: { season: { year: 2026, type: 2 }, week: { number: 4 }, events: [] },
  3: [
    // Already on file: must not be re-fetched.
    event({ id: "401", week: 3, date: "2026-09-27T17:00Z", away: "KC", home: "MIA", awayPts: 24, homePts: 10, state: "post" }),
    // New final, ESPN abbreviations that need mapping.
    event({ id: "402", week: 3, date: "2026-09-29T00:15Z", away: "PHI", home: "CHI", awayPts: 20, homePts: 23, state: "post" }),
  ],
  4: [
    event({ id: "410", week: 4, date: "2026-10-02T00:15Z", away: "PIT", home: "CLE", state: "pre" }),
    event({ id: "411", week: 4, date: "2026-10-04T17:00Z", away: "JAX", home: "WSH", state: "pre" }),
  ],
  5: [event({ id: "420", week: 5, date: "2026-10-11T17:00Z", away: "LAR", home: "SF", state: "pre" })],
};

const summaries = {
  402: {
    boxscore: { teams: [
      { team: { abbreviation: "PHI" }, statistics: [{ name: "totalYards", displayValue: "351" }, { name: "turnovers", displayValue: "2" }] },
      { team: { abbreviation: "CHI" }, statistics: [{ name: "totalYards", displayValue: "1,002" }, { name: "turnovers", displayValue: "0" }] },
    ] },
  },
  410: { predictor: { awayTeam: { gameProjection: "57.63" }, homeTeam: { gameProjection: "42.37" } } },
  411: {},
};

const book = (key, title, spreadHome, total, mlHome, mlAway) => ({
  key, title, last_update: "2026-09-30T12:00:00Z",
  markets: [
    { key: "h2h", outcomes: [{ name: "Cleveland Browns", price: mlHome }, { name: "Pittsburgh Steelers", price: mlAway }] },
    { key: "spreads", outcomes: [
      { name: "Cleveland Browns", price: -110, point: spreadHome },
      { name: "Pittsburgh Steelers", price: -110, point: -spreadHome },
    ] },
    { key: "totals", outcomes: [{ name: "Over", price: -110, point: total }, { name: "Under", price: -110, point: total }] },
  ],
});

let oddsSpread = 2.5;
const oddsFeed = () => [{
  id: "abc", commence_time: "2026-10-02T00:15:00Z", home_team: "Cleveland Browns", away_team: "Pittsburgh Steelers",
  bookmakers: [book("dk", "DraftKings", oddsSpread, 41.5, 120, -140), book("fd", "FanDuel", 3, 41, 125, -145)],
}];

const calls = [];
const json = (body, headers = {}) => ({ ok: true, status: 200, json: async () => body, headers: new Map(Object.entries(headers)) });
async function mockFetch(url) {
  calls.push(url);
  const u = new URL(url);
  if (u.hostname === "api.the-odds-api.com") return json(oddsFeed(), { "x-requests-remaining": "497" });
  if (u.pathname.endsWith("/summary")) return json(summaries[u.searchParams.get("event")] ?? {});
  const wk = u.searchParams.get("week");
  if (!wk) return json(scoreboards.current);
  return json({ events: scoreboards[wk] || [] });
}

function tempData() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "nfl-data-"));
  writeJson(path.join(dir, "meta.json"), { season: 2026, gamesSource: "manual", updatedAt: "2026-09-28T00:00:00.000Z" });
  writeJson(path.join(dir, "games.json"), [{
    id: "2026-3-KC-MIA", season: 2026, wk: 3, date: "2026-09-27", away: "KC", home: "MIA",
    awayPts: 24, homePts: 10, awayYds: 334, homeYds: 329, awayTO: 1, homeTO: 2,
  }]);
  return dir;
}
const read = (dir, f) => JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));

test("adds new finals with box scores and builds the upcoming slate", async () => {
  const dir = tempData();
  calls.length = 0;
  await run({ dataDir: dir, fetchImpl: mockFetch, now: new Date("2026-09-30T12:00:00Z") });

  const games = read(dir, "games.json");
  assert.equal(games.length, 2);
  assert.deepEqual(games[0].awayYds, 334, "existing game kept as-is");
  assert.deepEqual(games[1], {
    id: "2026-3-PHI-CHI", season: 2026, wk: 3, date: "2026-09-28", away: "PHI", home: "CHI",
    awayPts: 20, homePts: 23, awayYds: 351, homeYds: 1002, awayTO: 2, homeTO: 0,
  });
  assert.ok(!calls.some((c) => c.includes("event=401")), "known game not re-fetched");

  const upcoming = read(dir, "upcoming.json");
  assert.deepEqual(upcoming.map((u) => u.id), ["2026-4-PIT-CLE", "2026-4-JAC-WAS", "2026-5-LA-SF"]);
  assert.equal(upcoming[0].awayWinProb, 57.6);
  assert.equal(upcoming[1].awayWinProb, null);

  const meta = read(dir, "meta.json");
  assert.equal(meta.updatedAt, "2026-09-30T12:00:00.000Z");
});

test("unchanged data does not bump updatedAt", async () => {
  const dir = tempData();
  await run({ dataDir: dir, fetchImpl: mockFetch, now: new Date("2026-09-30T12:00:00Z") });
  const r = await run({ dataDir: dir, fetchImpl: mockFetch, now: new Date("2026-09-30T15:00:00Z") });
  assert.equal(r.changed, false);
  assert.equal(read(dir, "meta.json").updatedAt, "2026-09-30T12:00:00.000Z");
});

test("odds: snapshots, line history, and closing lines", async () => {
  const dir = tempData();
  oddsSpread = 2.5;
  await run({ dataDir: dir, fetchImpl: mockFetch, withOdds: true, apiKey: "k", now: new Date("2026-09-30T12:00:00Z") });
  let odds = read(dir, "odds.json");
  assert.equal(odds.games.length, 1);
  const g = odds.games[0];
  assert.equal(g.key, "PIT@CLE:2026-10-01");
  assert.equal(g.wk, 4);
  assert.equal(g.books.length, 2);
  assert.deepEqual(g.books[0].ml, { home: 120, away: -140 });
  assert.deepEqual(g.history.map((h) => h.spreadHome), [3]); // median of 2.5 and 3 rounds to the half point
  assert.equal(read(dir, "meta.json").oddsRequestsRemaining, 497);

  // Same lines: no new snapshot. Moved line: new snapshot.
  await run({ dataDir: dir, fetchImpl: mockFetch, withOdds: true, apiKey: "k", now: new Date("2026-09-30T18:00:00Z") });
  assert.equal(read(dir, "odds.json").games[0].history.length, 1);
  oddsSpread = 4.5;
  await run({ dataDir: dir, fetchImpl: mockFetch, withOdds: true, apiKey: "k", now: new Date("2026-10-01T12:00:00Z") });
  odds = read(dir, "odds.json");
  assert.deepEqual(odds.games[0].history.map((h) => h.spreadHome), [3, 4]);

  // After kickoff the pre-game lines are frozen, then filed as the closing line.
  await run({ dataDir: dir, fetchImpl: mockFetch, withOdds: true, apiKey: "k", now: new Date("2026-10-02T01:00:00Z") });
  assert.equal(read(dir, "odds.json").games[0].history.length, 2);
  assert.deepEqual(read(dir, "closing-lines.json"), []);

  const noFeed = async (url) => (url.includes("the-odds-api") ? json([]) : mockFetch(url));
  await run({ dataDir: dir, fetchImpl: noFeed, withOdds: true, apiKey: "k", now: new Date("2026-10-06T00:00:00Z") });
  assert.equal(read(dir, "odds.json").games.length, 0);
  const closing = read(dir, "closing-lines.json");
  assert.equal(closing.length, 1);
  assert.equal(closing[0].key, "PIT@CLE:2026-10-01");
  assert.equal(closing[0].spreadHome, 4);
});

test("odds are skipped without an API key", async () => {
  const dir = tempData();
  calls.length = 0;
  await run({ dataDir: dir, fetchImpl: mockFetch, withOdds: true, apiKey: undefined, now: new Date("2026-09-30T12:00:00Z") });
  assert.ok(!calls.some((c) => c.includes("the-odds-api")));
  assert.ok(!fs.existsSync(path.join(dir, "odds.json")));
});
