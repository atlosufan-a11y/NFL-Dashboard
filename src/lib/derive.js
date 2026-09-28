import { TEAMS, matchKey } from "./teams.js";

const DAY = new Intl.DateTimeFormat("en-US", { timeZone: "UTC", weekday: "short", month: "short", day: "numeric" });

// Turns the raw JSON files into everything the tabs render. Standings, team
// season stats and weekly splits are all computed from games.json, so a data
// refresh updates every view.
export function derive({ games: rawGames, upcoming: rawUpcoming, players, meta, odds, closing }) {
  const finals = [...rawGames].sort((a, b) => a.date.localeCompare(b.date) || a.wk - b.wk);

  // Winner/loser shape used by the charts and tables.
  const GAMES = finals.map((g) => {
    const awayWon = g.awayPts > g.homePts;
    const [w, l] = awayWon ? [g.away, g.home] : [g.home, g.away];
    return {
      id: g.id, key: matchKey(g.away, g.home, g.date), wk: g.wk, date: g.date.slice(5), fullDate: g.date,
      w, l, away: awayWon ? 1 : 0,
      pw: awayWon ? g.awayPts : g.homePts, pl: awayWon ? g.homePts : g.awayPts,
      yw: awayWon ? g.awayYds : g.homeYds, yl: awayWon ? g.homeYds : g.awayYds,
      tw: awayWon ? g.awayTO : g.homeTO, tl: awayWon ? g.homeTO : g.awayTO,
      tie: g.awayPts === g.homePts,
    };
  });

  const MAX_WEEK = GAMES.length ? Math.max(...GAMES.map((g) => g.wk)) : 1;

  const STANDINGS = (() => {
    const r = {};
    Object.keys(TEAMS).forEach((a) => { r[a] = { abbr: a, ...TEAMS[a], w: 0, l: 0, t: 0, pf: 0, pa: 0 }; });
    GAMES.forEach((g) => {
      r[g.w].pf += g.pw; r[g.w].pa += g.pl; r[g.l].pf += g.pl; r[g.l].pa += g.pw;
      if (g.tie) { r[g.w].t++; r[g.l].t++; } else { r[g.w].w++; r[g.l].l++; }
    });
    const rows = Object.values(r).map((x) => ({
      ...x, gp: x.w + x.l + x.t, pct: x.w + x.l + x.t ? (x.w + 0.5 * x.t) / (x.w + x.l + x.t) : 0, diff: x.pf - x.pa,
    }));
    const order = (a, b) => b.pct - a.pct || b.diff - a.diff;
    ["AFC", "NFC"].forEach((c) => rows.filter((x) => x.conf === c).sort(order).forEach((x, i) => { x.cr = i + 1; }));
    const divs = {};
    rows.forEach((x) => { (divs[x.conf + x.div] = divs[x.conf + x.div] || []).push(x); });
    Object.values(divs).forEach((d) => d.sort(order).forEach((x, i) => { x.dr = i + 1; }));
    return rows;
  })();

  // Yardage can be missing for a game whose box score hasn't posted yet, so
  // yards and turnovers are averaged over the games that have them.
  const SEASON_STATS = (() => {
    const s = {};
    Object.keys(TEAMS).forEach((a) => {
      s[a] = { abbr: a, conf: TEAMS[a].conf, name: TEAMS[a].name, w: 0, l: 0, t: 0, pf: 0, pa: 0, yf: 0, ya: 0, ygp: 0, ta: 0, gv: 0, weekly: {} };
    });
    GAMES.forEach((g) => {
      const rec = (team, pf, pa, yf, ya, gv, ta, res) => {
        const r = s[team];
        r.pf += pf; r.pa += pa;
        if (yf != null && ya != null) { r.yf += yf; r.ya += ya; r.ygp++; }
        r.gv += gv ?? 0; r.ta += ta ?? 0;
        if (res === "w") r.w++; else if (res === "l") r.l++; else r.t++;
        r.weekly[g.wk] = pf - pa;
      };
      rec(g.w, g.pw, g.pl, g.yw, g.yl, g.tw, g.tl, g.tie ? "t" : "w");
      rec(g.l, g.pl, g.pw, g.yl, g.yw, g.tl, g.tw, g.tie ? "t" : "l");
    });
    return Object.values(s).map((r) => {
      const gp = Math.max(1, r.w + r.l + r.t), ygp = Math.max(1, r.ygp);
      return {
        ...r,
        wins: r.w + 0.5 * r.t,
        pfPg: +(r.pf / gp).toFixed(1), paPg: +(r.pa / gp).toFixed(1),
        yfPg: +(r.yf / ygp).toFixed(0), yaPg: +(r.ya / ygp).toFixed(0),
        toMargin: r.ta - r.gv,
        ptsPer100: r.yf ? +((r.pf / r.yf) * 100).toFixed(2) : 0,
      };
    });
  })();

  // WEEKLY_YARDS[team][week] = { yf: gained, ya: allowed }
  const WEEKLY_YARDS = (() => {
    const m = {};
    Object.keys(TEAMS).forEach((a) => { m[a] = {}; });
    GAMES.forEach((g) => {
      m[g.w][g.wk] = { yf: g.yw, ya: g.yl };
      m[g.l][g.wk] = { yf: g.yl, ya: g.yw };
    });
    return m;
  })();

  const playedIds = new Set(rawGames.map((g) => g.id));
  const UPCOMING = rawUpcoming
    .filter((u) => !playedIds.has(u.id))
    .sort((a, b) => a.kickoff.localeCompare(b.kickoff))
    .map((u) => ({ ...u, ap: u.awayWinProb, hp: u.homeWinProb }));

  const last = finals[finals.length - 1];
  const pendingThisWeek = UPCOMING.filter((u) => u.wk === MAX_WEEK);
  const DATA_AS_OF = last
    ? `Week ${MAX_WEEK} (through ${DAY.format(new Date(last.date + "T12:00:00Z"))})` +
      (pendingThisWeek.length ? ` — ${pendingThisWeek.map((u) => `${u.away} @ ${u.home}`).join(", ")} pending` : "")
    : "No games played yet";

  const withPct = (k) => ({ ...k, fgPct: k.fgA ? +((100 * k.fgM) / k.fgA).toFixed(1) : 0 });
  const PLAYERS = { ...players, kicking: (players.kicking || []).map(withPct) };

  const record = (abbr) => {
    const s = STANDINGS.find((x) => x.abbr === abbr);
    return s ? `${s.w}-${s.l}${s.t ? `-${s.t}` : ""}` : "";
  };

  return {
    GAMES, MAX_WEEK, STANDINGS, SEASON_STATS, WEEKLY_YARDS, UPCOMING, PLAYERS, DATA_AS_OF, record,
    meta, odds, closing, finalsByKey: Object.fromEntries(finals.map((g) => [matchKey(g.away, g.home, g.date), g])),
  };
}
