import React, { useState, useMemo } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell, ReferenceLine,
  ScatterChart, Scatter, LabelList, LineChart, Line, Legend,
} from "recharts";
import { TEAMS, ABBRS } from "../lib/teams.js";
import { useData } from "../DataContext.jsx";
import { T, confColor, Label, Panel, inputStyle } from "./ui.jsx";

const VIZ_METRICS = {
  wins: { label: "Wins", fmt: (v) => v },
  pfPg: { label: "Points scored / gm", fmt: (v) => v },
  paPg: { label: "Points allowed / gm", fmt: (v) => v },
  yfPg: { label: "Yards gained / gm", fmt: (v) => v },
  yaPg: { label: "Yards allowed / gm", fmt: (v) => v },
  toMargin: { label: "Turnover margin", fmt: (v) => (v > 0 ? "+" : "") + v },
  ptsPer100: { label: "Points per 100 yards", fmt: (v) => v },
};

const mean = (arr) => arr.reduce((s, v) => s + v, 0) / arr.length;

function ScatterTooltip({ active, payload, xKey, yKey }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div style={{ background: T.panelSoft, border: `1px solid ${T.line}`, borderRadius: 8, padding: "8px 12px", fontSize: 12 }}>
      <div style={{ fontWeight: 700, marginBottom: 3 }}>{d.name}</div>
      <div style={{ fontFamily: T.mono, color: T.muted }}>
        {VIZ_METRICS[xKey].label}: {VIZ_METRICS[xKey].fmt(d[xKey])}<br />
        {VIZ_METRICS[yKey].label}: {VIZ_METRICS[yKey].fmt(d[yKey])}
      </div>
    </div>
  );
}

function TeamScatter({ xKey, yKey, height = 380 }) {
  const { SEASON_STATS } = useData();
  const xAvg = mean(SEASON_STATS.map((d) => d[xKey]));
  const yAvg = mean(SEASON_STATS.map((d) => d[yKey]));
  return (
    <div style={{ height }}>
      <ResponsiveContainer>
        <ScatterChart margin={{ top: 16, right: 24, bottom: 8, left: 0 }}>
          <CartesianGrid stroke={T.line} strokeDasharray="3 3" />
          <XAxis type="number" dataKey={xKey} domain={["auto", "auto"]} tick={{ fill: T.muted, fontSize: 11, fontFamily: T.mono }}
            tickLine={false} axisLine={{ stroke: T.line }}
            label={{ value: VIZ_METRICS[xKey].label, position: "insideBottom", offset: -4, fill: T.muted, fontSize: 11 }} />
          <YAxis type="number" dataKey={yKey} domain={["auto", "auto"]} tick={{ fill: T.muted, fontSize: 11, fontFamily: T.mono }}
            tickLine={false} axisLine={false} width={52}
            label={{ value: VIZ_METRICS[yKey].label, angle: -90, position: "insideLeft", fill: T.muted, fontSize: 11 }} />
          <ReferenceLine x={xAvg} stroke={T.muted} strokeDasharray="4 4" />
          <ReferenceLine y={yAvg} stroke={T.muted} strokeDasharray="4 4" />
          <Tooltip content={<ScatterTooltip xKey={xKey} yKey={yKey} />} cursor={{ strokeDasharray: "3 3", stroke: T.muted }} />
          <Scatter data={SEASON_STATS} isAnimationActive={false}>
            <LabelList dataKey="abbr" position="top" style={{ fill: T.muted, fontSize: 9, fontFamily: T.mono }} />
            {SEASON_STATS.map((d, i) => <Cell key={i} fill={confColor(d.conf)} />)}
          </Scatter>
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
}


function MarginHistogram() {
  const { GAMES } = useData();
  const [sel, setSel] = useState(null);

  const { data, byMargin, stats } = useMemo(() => {
    const counts = {}, byMargin = {};
    let oneScore = 0, exact3 = 0, exact7 = 0, blowouts = 0, ties = 0;
    GAMES.forEach((g) => {
      const m = g.pw - g.pl;
      counts[m] = (counts[m] || 0) + 1;
      (byMargin[m] = byMargin[m] || []).push(g);
      if (m === 0) ties++;
      if (m <= 8) oneScore++;
      if (m === 3) exact3++;
      if (m === 7) exact7++;
      if (m >= 17) blowouts++;
    });
    const maxM = Math.max(...Object.keys(counts).map(Number));
    const data = Array.from({ length: maxM + 1 }, (_, m) => ({ m, n: counts[m] || 0 }));
    return { data, byMargin, stats: { oneScore, exact3, exact7, blowouts, ties } };
  }, [GAMES]);

  const isKey = (m) => m === 3 || m === 7;
  const selGames = sel !== null ? (byMargin[sel] || []) : [];

  return (
    <Panel style={{ marginBottom: 18 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 8 }}>
        <Label>Margin of Victory — All {GAMES.length} Games</Label>
        <span style={{ fontSize: 11.5, color: sel !== null ? T.chalk : T.muted }}>
          {sel !== null ? `Showing games decided by ${sel === 0 ? "a tie" : sel} — click the bar again to clear` : "Click any bar to list its games"}
        </span>
      </div>
      <div style={{ height: 260 }}>
        <ResponsiveContainer>
          <BarChart data={data} margin={{ top: 12, right: 8, bottom: 4, left: -16 }}>
            <CartesianGrid stroke={T.line} strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="m" tick={{ fill: T.muted, fontSize: 10, fontFamily: T.mono }} tickLine={false}
              axisLine={{ stroke: T.line }} interval={1}
              label={{ value: "Final margin (points)", position: "insideBottom", offset: -2, fill: T.muted, fontSize: 11 }} />
            <YAxis tick={{ fill: T.muted, fontSize: 11, fontFamily: T.mono }} tickLine={false} axisLine={false} allowDecimals={false} />
            <Tooltip contentStyle={{ background: T.panelSoft, border: `1px solid ${T.line}`, borderRadius: 8, fontSize: 12 }}
              labelFormatter={(m) => (m === 0 ? "Tie" : `Decided by ${m}`)} formatter={(v) => [v + " games — click to view", "Count"]}
              cursor={{ fill: "rgba(255,255,255,0.04)" }} />
            <Bar dataKey="n" radius={[2, 2, 0, 0]} isAnimationActive={false} cursor="pointer"
              onClick={(d) => d && setSel((s) => (s === d.m ? null : d.m))}>
              {data.map((d, i) => (
                <Cell key={i}
                  fill={d.m === 0 ? T.muted : isKey(d.m) ? T.chalk : "#3D5166"}
                  stroke={sel === d.m ? T.text : "none"} strokeWidth={sel === d.m ? 1.5 : 0}
                  opacity={sel !== null && sel !== d.m ? 0.35 : 1} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Drill-down: every game at the selected margin */}
      {sel !== null && (
        <div style={{ marginTop: 10, border: `1px solid ${T.line}`, borderRadius: 8, background: T.bg, padding: "10px 12px" }}>
          <div style={{ fontSize: 11, color: T.chalk, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>
            {selGames.length} game{selGames.length !== 1 ? "s" : ""} decided by {sel === 0 ? "a tie" : `${sel} point${sel !== 1 ? "s" : ""}`}
          </div>
          <div style={{ maxHeight: 240, overflowY: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
              <tbody>
                {selGames.map((g, i) => {
                  const awayTeam = g.away ? g.w : g.l, homeTeam = g.away ? g.l : g.w;
                  const awayPts = g.away ? g.pw : g.pl, homePts = g.away ? g.pl : g.pw;
                  return (
                    <tr key={i} style={{ borderBottom: i < selGames.length - 1 ? `1px solid ${T.line}` : "none" }}>
                      <td style={{ padding: "6px 6px", fontFamily: T.mono, fontSize: 11.5, color: T.muted, whiteSpace: "nowrap" }}>Wk {g.wk}</td>
                      <td style={{ padding: "6px 6px", fontFamily: T.mono, fontSize: 11.5, color: T.muted }}>{g.date}</td>
                      <td style={{ padding: "6px 6px", textAlign: "right", whiteSpace: "nowrap" }}>
                        <span style={{ fontFamily: T.mono, fontWeight: 700, fontSize: 11.5, color: confColor(TEAMS[awayTeam].conf) }}>{awayTeam}</span>
                        <span style={{ fontFamily: T.mono, marginLeft: 6, fontWeight: g.w === awayTeam && !g.tie ? 800 : 400, color: g.w === awayTeam && !g.tie ? T.text : T.muted }}>{awayPts}</span>
                      </td>
                      <td style={{ padding: "6px 4px", color: T.muted, fontSize: 10.5 }}>@</td>
                      <td style={{ padding: "6px 6px", whiteSpace: "nowrap" }}>
                        <span style={{ fontFamily: T.mono, fontWeight: 700, fontSize: 11.5, color: confColor(TEAMS[homeTeam].conf) }}>{homeTeam}</span>
                        <span style={{ fontFamily: T.mono, marginLeft: 6, fontWeight: g.w === homeTeam && !g.tie ? 800 : 400, color: g.w === homeTeam && !g.tie ? T.text : T.muted }}>{homePts}</span>
                      </td>
                      <td style={{ padding: "6px 6px", textAlign: "right", fontFamily: T.mono, fontSize: 11.5, color: T.muted }}>
                        {g.away ? `${g.yw}/${g.yl}` : `${g.yl}/${g.yw}`} yds
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 12, marginTop: 12 }}>
        {[
          ["One-score (≤8)", `${stats.oneScore} · ${(stats.oneScore / GAMES.length * 100).toFixed(0)}%`, T.text],
          ["Decided by 3", `${stats.exact3} · ${(stats.exact3 / GAMES.length * 100).toFixed(1)}%`, T.chalk],
          ["Decided by 7", `${stats.exact7} · ${(stats.exact7 / GAMES.length * 100).toFixed(1)}%`, T.chalk],
          ["Blowouts (17+)", `${stats.blowouts} · ${(stats.blowouts / GAMES.length * 100).toFixed(0)}%`, T.loss],
          ["Ties", `${stats.ties}`, T.muted],
        ].map(([label, v, c]) => (
          <div key={label}>
            <div style={{ fontSize: 10.5, color: T.muted, textTransform: "uppercase", letterSpacing: "0.08em" }}>{label}</div>
            <div style={{ fontFamily: T.mono, fontSize: 16, fontWeight: 700, color: c, marginTop: 2 }}>{v}</div>
          </div>
        ))}
      </div>
      <div style={{ fontSize: 12, color: T.muted, marginTop: 12, lineHeight: 1.5 }}>
        Gold bars are the key numbers, 3 and 7 — the margins produced by a field goal or touchdown difference,
        and the numbers point spreads cluster around. How often games land exactly on them is what makes buying
        or selling the half-point around 3 and 7 matter, and why teasers that cross both have structural value.
      </div>
    </Panel>
  );
}

/* Weekly yardage trajectory — offense (yards gained) or defense (yards allowed) */
function YardsTrajectory({ side }) {
  const { SEASON_STATS, WEEKLY_YARDS, MAX_WEEK } = useData();
  const isOff = side === "off";
  const [a, setA] = useState(isOff ? "LA" : "DEN");
  const [b, setB] = useState("NONE");
  const key = isOff ? "yf" : "ya";
  const abbrs = ABBRS;

  const data = useMemo(() =>
    Array.from({ length: MAX_WEEK }, (_, i) => {
      const wk = i + 1;
      const row = { wk, [a]: WEEKLY_YARDS[a][wk]?.[key] ?? null };
      if (b !== "NONE") row[b] = WEEKLY_YARDS[b][wk]?.[key] ?? null;
      return row;
    }), [a, b, key, WEEKLY_YARDS, MAX_WEEK]);

  const leagueAvg = mean(SEASON_STATS.map((d) => (isOff ? d.yfPg : d.yaPg)));
  const seasonAvg = (abbr) => {
    const d = SEASON_STATS.find((t) => t.abbr === abbr);
    return isOff ? d.yfPg : d.yaPg;
  };

  return (
    <Panel style={{ marginTop: 18 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
        <Label>{isOff ? "Offensive Yards Produced — Week by Week" : "Defensive Yards Allowed — Week by Week"}</Label>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <select value={a} onChange={(e) => { const v = e.target.value; setA(v); if (v === b) setB("NONE"); }} style={{ ...inputStyle, width: "auto" }}>
            {abbrs.map((x) => <option key={x} value={x}>{x}</option>)}
          </select>
          {b !== "NONE" && <span style={{ fontSize: 12, color: T.muted }}>vs</span>}
          <select value={b} onChange={(e) => setB(e.target.value)}
            style={{ ...inputStyle, width: "auto", color: b === "NONE" ? T.muted : T.text }}>
            <option value="NONE">+ Compare…</option>
            {abbrs.filter((x) => x !== a).map((x) => <option key={x} value={x}>{x}</option>)}
          </select>
        </div>
      </div>
      <div style={{ height: 300 }}>
        <ResponsiveContainer>
          <LineChart data={data} margin={{ top: 12, right: 16, bottom: 0, left: 0 }}>
            <CartesianGrid stroke={T.line} strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="wk" tick={{ fill: T.muted, fontSize: 11, fontFamily: T.mono }} tickLine={false}
              axisLine={{ stroke: T.line }} label={{ value: "Week", position: "insideBottom", offset: -2, fill: T.muted, fontSize: 11 }} />
            <YAxis tick={{ fill: T.muted, fontSize: 11, fontFamily: T.mono }} tickLine={false} axisLine={false} width={48}
              domain={isOff ? [100, 600] : [50, 600]} ticks={isOff ? [100, 200, 300, 400, 500, 600] : [50, 150, 250, 350, 450, 550]} />
            <Tooltip contentStyle={{ background: T.panelSoft, border: `1px solid ${T.line}`, borderRadius: 8, fontSize: 12 }}
              labelFormatter={(w) => `Week ${w}`} formatter={(v, n) => [v === null ? "Bye" : v + " yds", n]} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <ReferenceLine y={leagueAvg} stroke={T.muted} strokeDasharray="4 4"
              label={{ value: `Lg avg ${leagueAvg.toFixed(0)}`, position: "insideTopRight", fill: T.muted, fontSize: 10 }} />
            <Line type="monotone" dataKey={a} stroke={T.chalk} strokeWidth={2.5} dot={{ r: 3, fill: T.chalk }} connectNulls isAnimationActive={false} />
            {b !== "NONE" && (
              <Line type="monotone" dataKey={b} stroke={confColor(TEAMS[b].conf)} strokeWidth={2.5}
                dot={{ r: 3, fill: confColor(TEAMS[b].conf) }} connectNulls isAnimationActive={false} />
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div style={{ fontSize: 12, color: T.muted, marginTop: 6, lineHeight: 1.5 }}>
        {isOff
          ? <>Season averages: {a} {seasonAvg(a)} yds/gm{b !== "NONE" ? `, ${b} ${seasonAvg(b)} yds/gm` : ""}, league {leagueAvg.toFixed(0)}. Weeks above the dashed line beat the league norm; sustained stretches under it are cold spells. Byes bridge with a straight segment.</>
          : <>Season averages allowed: {a} {seasonAvg(a)} yds/gm{b !== "NONE" ? `, ${b} ${seasonAvg(b)} yds/gm` : ""}, league {leagueAvg.toFixed(0)}. For defense, lower is better — staying under the dashed line means holding offenses below the league norm.</>}
      </div>
    </Panel>
  );
}

/* Season game log: production each week, colored by opponent defense rank */
function MatchupProduction() {
  const { GAMES, SEASON_STATS, MAX_WEEK } = useData();
  const [team, setTeam] = useState("NE");
  const [metric, setMetric] = useState("yards"); // yards | points
  const abbrs = ABBRS;
  const isYards = metric === "yards";

  // Season-to-date defensive ranks: 1 = stingiest
  const defRanks = useMemo(() => {
    const byYards = [...SEASON_STATS].sort((a, b) => a.yaPg - b.yaPg);
    const byPts = [...SEASON_STATS].sort((a, b) => a.paPg - b.paPg);
    const r = {};
    byYards.forEach((t, i) => { r[t.abbr] = { y: i + 1 }; });
    byPts.forEach((t, i) => { r[t.abbr].p = i + 1; });
    return r;
  }, [SEASON_STATS]);

  const { data, splits } = useMemo(() => {
    const byWeek = {};
    GAMES.forEach((g) => {
      let opp, val;
      if (g.w === team) { opp = g.l; val = isYards ? g.yw : g.pw; }
      else if (g.l === team) { opp = g.w; val = isYards ? g.yl : g.pl; }
      else return;
      byWeek[g.wk] = { opp, val, rank: isYards ? defRanks[opp].y : defRanks[opp].p };
    });
    const data = Array.from({ length: MAX_WEEK }, (_, i) => {
      const wk = i + 1, g = byWeek[wk];
      return g ? { wk, val: g.val, opp: g.opp, rank: g.rank } : { wk, val: null, opp: null, rank: null };
    });
    const vs = (f) => {
      const arr = Object.values(byWeek).filter(f);
      return arr.length ? arr.reduce((s, g) => s + g.val, 0) / arr.length : null;
    };
    return { data, splits: { tough: vs((g) => g.rank <= 10), soft: vs((g) => g.rank >= 23), n: Object.keys(byWeek).length } };
  }, [team, isYards, defRanks, GAMES, MAX_WEEK]);

  const leagueAvg = mean(SEASON_STATS.map((d) => (isYards ? d.yfPg : d.pfPg)));
  const tierColor = (rank) => (rank == null ? T.panelSoft : rank <= 10 ? T.chalk : rank >= 23 ? "#7A4E4E" : "#3D5166");

  const MTooltip = ({ active, payload }) => {
    if (!active || !payload?.length) return null;
    const d = payload[0].payload;
    if (d.val == null) return (
      <div style={{ background: T.panelSoft, border: `1px solid ${T.line}`, borderRadius: 8, padding: "8px 12px", fontSize: 12, color: T.muted }}>
        Week {d.wk} — bye
      </div>
    );
    return (
      <div style={{ background: T.panelSoft, border: `1px solid ${T.line}`, borderRadius: 8, padding: "8px 12px", fontSize: 12 }}>
        <div style={{ fontWeight: 700 }}>Wk {d.wk} vs {d.opp}</div>
        <div style={{ fontFamily: T.mono, color: T.muted }}>
          {d.val} {isYards ? "yards" : "points"} · {d.opp} D ranked #{d.rank} in {isYards ? "yards" : "points"} allowed
        </div>
      </div>
    );
  };

  return (
    <Panel style={{ marginTop: 18 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
        <Label>Season Game Log — {TEAMS[team].name}</Label>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <select value={team} onChange={(e) => setTeam(e.target.value)} style={{ ...inputStyle, width: "auto" }}>
            {abbrs.map((x) => <option key={x} value={x}>{x} — {TEAMS[x].name}</option>)}
          </select>
          <div style={{ display: "flex", background: T.bg, borderRadius: 7, padding: 3, border: `1px solid ${T.line}` }}>
            {[["yards", "Yards"], ["points", "Points"]].map(([id, name]) => (
              <button key={id} onClick={() => setMetric(id)} style={{
                background: metric === id ? T.panelSoft : "transparent", color: metric === id ? T.chalk : T.muted,
                border: "none", borderRadius: 5, padding: "5px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer",
              }}>{name}</button>
            ))}
          </div>
        </div>
      </div>
      <div style={{ height: 320 }}>
        <ResponsiveContainer>
          <BarChart data={data} margin={{ top: 22, right: 8, bottom: 4, left: -10 }}>
            <CartesianGrid stroke={T.line} strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="wk" tick={{ fill: T.muted, fontSize: 10.5, fontFamily: T.mono }} tickLine={false}
              axisLine={{ stroke: T.line }} interval={0}
              label={{ value: "Week", position: "insideBottom", offset: -2, fill: T.muted, fontSize: 11 }} />
            <YAxis tick={{ fill: T.muted, fontSize: 11, fontFamily: T.mono }} tickLine={false} axisLine={false}
              domain={isYards ? [0, 600] : [0, "auto"]} />
            <Tooltip content={<MTooltip />} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
            <ReferenceLine y={leagueAvg} stroke={T.muted} strokeDasharray="4 4"
              label={{ value: `Lg avg ${leagueAvg.toFixed(0)}`, position: "insideTopRight", fill: T.muted, fontSize: 10 }} />
            <Bar dataKey="val" radius={[3, 3, 0, 0]} isAnimationActive={false}>
              <LabelList dataKey="opp" position="top" style={{ fill: T.muted, fontSize: 8.5, fontFamily: T.mono }} />
              {data.map((d, i) => <Cell key={i} fill={tierColor(d.rank)} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div style={{ display: "flex", gap: 16, fontSize: 11.5, color: T.muted, marginTop: 8, flexWrap: "wrap" }}>
        <span><span style={{ display: "inline-block", width: 10, height: 10, borderRadius: 2, background: T.chalk, marginRight: 5 }} />vs top-10 defense</span>
        <span><span style={{ display: "inline-block", width: 10, height: 10, borderRadius: 2, background: "#3D5166", marginRight: 5 }} />vs mid-tier</span>
        <span><span style={{ display: "inline-block", width: 10, height: 10, borderRadius: 2, background: "#7A4E4E", marginRight: 5 }} />vs bottom-10 defense</span>
      </div>
      <div style={{ fontSize: 12, color: T.muted, marginTop: 10, lineHeight: 1.5 }}>
        Every game in season order, colored by how the opponent's defense ranks so far this season.
        {splits.tough != null && splits.soft != null && (
          <> Against top-10 defenses this team averaged <span style={{ fontFamily: T.mono, color: T.text }}>{splits.tough.toFixed(0)}</span>{" "}
          {isYards ? "yards" : "points"}; against bottom-10 defenses, <span style={{ fontFamily: T.mono, color: T.text }}>{splits.soft.toFixed(0)}</span>.
          {" "}{splits.tough >= splits.soft * 0.9
            ? "A narrow gap — the production traveled regardless of matchup."
            : "A wide gap — the totals leaned on soft matchups, so discount the season averages accordingly."}</>
        )} Tall gold bars are the strongest signal: big output against defenses that stopped everyone else.
      </div>
    </Panel>
  );
}

export default function AnalyticsTab() {
  const { SEASON_STATS, MAX_WEEK } = useData();
  const [xKey, setXKey] = useState("paPg");
  const [yKey, setYKey] = useState("pfPg");
  const [trajA, setTrajA] = useState("SEA");
  const [trajB, setTrajB] = useState("NONE");

  // cumulative point differential by week (byes carry forward)
  const trajData = useMemo(() => {
    const series = (abbr) => {
      const t = SEASON_STATS.find((d) => d.abbr === abbr);
      let cum = 0;
      const out = [];
      for (let wk = 1; wk <= MAX_WEEK; wk++) {
        if (t.weekly[wk] !== undefined) cum += t.weekly[wk];
        out.push(cum);
      }
      return out;
    };
    const a = series(trajA), b = trajB !== "NONE" ? series(trajB) : null;
    return Array.from({ length: MAX_WEEK }, (_, i) => ({
      wk: i + 1, [trajA]: a[i], ...(b ? { [trajB]: b[i] } : {}),
    }));
  }, [trajA, trajB, SEASON_STATS, MAX_WEEK]);

  const effSorted = [...SEASON_STATS].sort((a, b) => b.ptsPer100 - a.ptsPer100);
  const abbrs = ABBRS;
  const selStyle = { ...inputStyle, width: "auto" };

  return (
    <div>
      {/* 1 — Relationship explorer */}
      <Panel style={{ marginBottom: 18 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
          <Label>Relationship Explorer</Label>
          <div style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 12, color: T.muted }}>
            X:
            <select value={xKey} onChange={(e) => setXKey(e.target.value)} style={selStyle}>
              {Object.entries(VIZ_METRICS).map(([k, m]) => <option key={k} value={k}>{m.label}</option>)}
            </select>
            Y:
            <select value={yKey} onChange={(e) => setYKey(e.target.value)} style={selStyle}>
              {Object.entries(VIZ_METRICS).map(([k, m]) => <option key={k} value={k}>{m.label}</option>)}
            </select>
          </div>
        </div>
        <TeamScatter xKey={xKey} yKey={yKey} />
        <div style={{ fontSize: 12, color: T.muted, marginTop: 6, lineHeight: 1.5 }}>
          Every team plotted on any two season metrics; dashed lines mark league average, splitting the field into
          quadrants. With points allowed on X and points scored on Y, top-left is the contender quadrant (score a lot,
          allow little). Try turnover margin against wins to see how tightly ball security has tracked winning so far this season — early-season samples are small, so treat patterns as provisional.
        </div>
      </Panel>

      {/* 2 — Margin of victory distribution (interactive) */}
      <MarginHistogram />

      {/* 3 — Efficiency */}
      <Panel style={{ marginBottom: 18 }}>
        <Label>Yards → Points Efficiency</Label>
        <TeamScatter xKey="yfPg" yKey="pfPg" height={340} />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 12 }}>
          <div>
            <div style={{ fontSize: 11, color: T.win, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>
              Most efficient (pts / 100 yds)
            </div>
            {effSorted.slice(0, 4).map((d) => (
              <div key={d.abbr} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", fontSize: 12.5, borderBottom: `1px solid ${T.line}` }}>
                <span><span style={{ fontFamily: T.mono, fontWeight: 700, color: confColor(d.conf), marginRight: 6 }}>{d.abbr}</span>{d.name.split(" ").pop()}</span>
                <span style={{ fontFamily: T.mono, color: T.win }}>{d.ptsPer100}</span>
              </div>
            ))}
          </div>
          <div>
            <div style={{ fontSize: 11, color: T.loss, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>
              Least efficient
            </div>
            {effSorted.slice(-4).reverse().map((d) => (
              <div key={d.abbr} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", fontSize: 12.5, borderBottom: `1px solid ${T.line}` }}>
                <span><span style={{ fontFamily: T.mono, fontWeight: 700, color: confColor(d.conf), marginRight: 6 }}>{d.abbr}</span>{d.name.split(" ").pop()}</span>
                <span style={{ fontFamily: T.mono, color: T.loss }}>{d.ptsPer100}</span>
              </div>
            ))}
          </div>
        </div>
        <div style={{ fontSize: 12, color: T.muted, marginTop: 10, lineHeight: 1.5 }}>
          Teams above the pack at the same yardage converted drives into points — red-zone finishing, field position,
          takeaway scores. Teams below moved the ball and left points on the field. That gap between yards-rank and
          points-rank is often where records diverge from talent.
        </div>
      </Panel>

      {/* 3 — Season trajectory */}
      <Panel>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
          <Label>Season Trajectory — Cumulative Point Differential</Label>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <select value={trajA} onChange={(e) => { const v = e.target.value; setTrajA(v); if (v === trajB) setTrajB("NONE"); }} style={selStyle}>
              {abbrs.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
            {trajB !== "NONE" && <span style={{ fontSize: 12, color: T.muted }}>vs</span>}
            <select value={trajB} onChange={(e) => setTrajB(e.target.value)}
              style={{ ...selStyle, color: trajB === "NONE" ? T.muted : T.text }}>
              <option value="NONE">+ Compare…</option>
              {abbrs.filter((a) => a !== trajA).map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
        </div>
        <div style={{ height: 320 }}>
          <ResponsiveContainer>
            <LineChart data={trajData} margin={{ top: 12, right: 16, bottom: 0, left: 0 }}>
              <CartesianGrid stroke={T.line} strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="wk" tick={{ fill: T.muted, fontSize: 11, fontFamily: T.mono }} tickLine={false}
                axisLine={{ stroke: T.line }} label={{ value: "Week", position: "insideBottom", offset: -2, fill: T.muted, fontSize: 11 }} />
              <YAxis tick={{ fill: T.muted, fontSize: 11, fontFamily: T.mono }} tickLine={false} axisLine={false} width={46} />
              <Tooltip contentStyle={{ background: T.panelSoft, border: `1px solid ${T.line}`, borderRadius: 8, fontSize: 12 }}
                labelFormatter={(w) => `Week ${w}`} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <ReferenceLine y={0} stroke={T.muted} strokeDasharray="4 4" />
              <Line type="monotone" dataKey={trajA} stroke={T.chalk} strokeWidth={2.5} dot={false} isAnimationActive={false} />
              {trajB !== "NONE" && (
                <Line type="monotone" dataKey={trajB} stroke={confColor(TEAMS[trajB].conf)} strokeWidth={2.5} dot={false} isAnimationActive={false} />
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div style={{ fontSize: 12, color: T.muted, marginTop: 6, lineHeight: 1.5 }}>
          Running point differential week by week — flat stretches are bye weeks. The slope tells the story a record
          hides: steady climbs are consistent teams, hockey sticks are late surges, plateaus that turn down are fades.
          Two identical records can look completely different here.
        </div>
      </Panel>

      {/* 5 — Offensive yards per week */}
      <YardsTrajectory side="off" />

      {/* 6 — Defensive yards allowed per week */}
      <YardsTrajectory side="def" />

      {/* 7 — Production vs opponent defensive rank */}
      <MatchupProduction />
    </div>
  );
}
