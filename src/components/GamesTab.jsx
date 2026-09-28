import React, { useState, useMemo } from "react";
import { TEAMS, ABBRS } from "../lib/teams.js";
import { useData } from "../DataContext.jsx";
import { T, confColor, Label, Panel, inputStyle, subBtn, kickoffFmt } from "./ui.jsx";

/* ================================================================== */
/* Games tab — every completed game + upcoming slate                   */
/* ================================================================== */
export default function GamesTab() {
  const { GAMES, UPCOMING, MAX_WEEK, DATA_AS_OF, record, meta } = useData();
  const [week, setWeek] = useState("ALL");
  const [team, setTeam] = useState("ALL");
  const [gview, setGview] = useState("regular");

  const rows = useMemo(() => {
    let g = GAMES;
    if (week !== "ALL") g = g.filter((x) => x.wk === +week);
    if (team !== "ALL") g = g.filter((x) => x.w === team || x.l === team);
    return g;
  }, [week, team, GAMES]);

  // Season aggregates for a selected team, derived from every game
  const agg = useMemo(() => {
    if (team === "ALL") return null;
    let w = 0, l = 0, t = 0, pf = 0, pa = 0, yf = 0, ya = 0, yg = 0, tg = 0, tt = 0; // tg = takeaways, tt = giveaways
    GAMES.forEach((g) => {
      const mine = g.w === team ? "w" : g.l === team ? "l" : null;
      if (!mine) return;
      const opp = mine === "w" ? "l" : "w";
      pf += g["p" + mine]; pa += g["p" + opp]; tt += g["t" + mine] ?? 0; tg += g["t" + opp] ?? 0;
      if (g["y" + mine] != null) { yf += g["y" + mine]; ya += g["y" + opp]; yg++; }
      if (g.tie) t++; else if (mine === "w") w++; else l++;
    });
    const gp = w + l + t;
    return { w, l, t, gp, pf, pa, yf: yf / Math.max(1, yg) * gp, ya: ya / Math.max(1, yg) * gp, tg, tt, toDiff: tg - tt };
  }, [team, GAMES]);

  const abbrs = ABBRS;

  const TeamCell = ({ abbr, pts, win, tie }) => (
    <span style={{ display: "inline-flex", alignItems: "baseline", gap: 6 }}>
      <span style={{ fontFamily: T.mono, fontWeight: 700, fontSize: 12, color: confColor(TEAMS[abbr].conf) }}>{abbr}</span>
      <span style={{ fontFamily: T.mono, fontWeight: win && !tie ? 800 : 400, color: tie ? T.chalk : win ? T.text : T.muted, fontSize: 13.5 }}>{pts}</span>
    </span>
  );

  return (
    <div>
      <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
        <button onClick={() => setGview("regular")} style={subBtn(gview === "regular")}>Regular Season</button>
        <button onClick={() => setGview("upcoming")} style={subBtn(gview === "upcoming")}>Upcoming</button>
      </div>

      {gview === "upcoming" && (
        <Panel>
          <Label>Next Up{UPCOMING.length ? ` — Week ${UPCOMING[0].wk}${UPCOMING[UPCOMING.length - 1].wk !== UPCOMING[0].wk ? `–${UPCOMING[UPCOMING.length - 1].wk}` : ""}` : ""}</Label>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 520 }}>
              <thead>
                <tr style={{ fontSize: 10.5, textTransform: "uppercase", letterSpacing: "0.07em", color: T.muted, borderBottom: `1px solid ${T.line}` }}>
                  <th style={{ padding: "8px 6px", textAlign: "left" }}>Wk</th>
                  <th style={{ padding: "8px 6px", textAlign: "left" }}>Kickoff (ET)</th>
                  <th style={{ padding: "8px 6px", textAlign: "left" }}>Matchup</th>
                  <th style={{ padding: "8px 6px", textAlign: "left" }}>Records</th>
                  <th style={{ padding: "8px 6px", textAlign: "left", minWidth: 160 }}>Win probability</th>
                </tr>
              </thead>
              <tbody>
                {UPCOMING.map((g, i) => {
                  const rec = record;
                  return (
                    <tr key={i} style={{ borderBottom: `1px solid ${T.line}` }}>
                      <td style={{ padding: "8px 6px", fontFamily: T.mono, fontSize: 12, color: T.muted }}>{g.wk}</td>
                      <td style={{ padding: "8px 6px", fontFamily: T.mono, fontSize: 12, color: T.muted, whiteSpace: "nowrap" }}>{kickoffFmt(g.kickoff)}</td>
                      <td style={{ padding: "8px 6px", whiteSpace: "nowrap" }}>
                        <span style={{ fontFamily: T.mono, fontWeight: 700, color: confColor(TEAMS[g.away].conf) }}>{g.away}</span>
                        <span style={{ color: T.muted, margin: "0 6px" }}>@</span>
                        <span style={{ fontFamily: T.mono, fontWeight: 700, color: confColor(TEAMS[g.home].conf) }}>{g.home}</span>
                      </td>
                      <td style={{ padding: "8px 6px", fontFamily: T.mono, fontSize: 12, color: T.muted }}>{rec(g.away)} / {rec(g.home)}</td>
                      <td style={{ padding: "8px 6px" }}>
                        {g.ap == null ? <span style={{ fontSize: 12, color: T.muted }}>not yet published</span> : (
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <span style={{ fontFamily: T.mono, fontSize: 11.5, width: 36, textAlign: "right" }}>{g.ap.toFixed(0)}%</span>
                            <div style={{ flex: 1, height: 8, background: T.bg, borderRadius: 4, overflow: "hidden", display: "flex" }}>
                              <div style={{ width: `${g.ap}%`, background: confColor(TEAMS[g.away].conf) }} />
                              <div style={{ width: `${g.hp}%`, background: confColor(TEAMS[g.home].conf), opacity: 0.55 }} />
                            </div>
                            <span style={{ fontFamily: T.mono, fontSize: 11.5, width: 36 }}>{g.hp.toFixed(0)}%</span>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {UPCOMING.length === 0 && (
                  <tr><td colSpan={5} style={{ padding: "22px 6px", textAlign: "center", color: T.muted }}>No upcoming games in the data yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
          <div style={{ fontSize: 11.5, color: T.muted, marginTop: 10, lineHeight: 1.5 }}>
            Schedule and win probabilities from {meta.upcomingSource || "the scores feed"}. Probabilities are the feed's
            own model, not a Film Room forecast, and are only shown where the feed has published them. For market prices, see the Betting tab.
          </div>
        </Panel>
      )}

      {gview === "regular" && (
      <>
      {/* Filters */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 16 }}>
        <select value={week} onChange={(e) => setWeek(e.target.value)} style={{ ...inputStyle, width: "auto" }}>
          <option value="ALL">All weeks</option>
          {Array.from({ length: MAX_WEEK }, (_, i) => i + 1).map((w) => <option key={w} value={w}>Week {w}</option>)}
        </select>
        <select value={team} onChange={(e) => setTeam(e.target.value)} style={{ ...inputStyle, width: "auto", minWidth: 220 }}>
          <option value="ALL">All teams</option>
          {abbrs.map((a) => <option key={a} value={a}>{a} — {TEAMS[a].name}</option>)}
        </select>
        <div style={{ alignSelf: "center", fontSize: 12, color: T.muted }}>{rows.length} game{rows.length !== 1 ? "s" : ""}</div>
      </div>

      {/* Team season aggregates */}
      {agg && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 12, marginBottom: 16 }}>
          {[
            ["Record", `${agg.w}-${agg.l}${agg.t ? `-${agg.t}` : ""}`, T.text],
            ["Points for / gm", (agg.pf / agg.gp).toFixed(1), T.win],
            ["Points vs / gm", (agg.pa / agg.gp).toFixed(1), T.loss],
            ["Yards for / gm", (agg.yf / agg.gp).toFixed(0), T.text],
            ["Yards vs / gm", (agg.ya / agg.gp).toFixed(0), T.text],
            ["TO margin", (agg.toDiff > 0 ? "+" : "") + agg.toDiff, agg.toDiff >= 0 ? T.win : T.loss],
          ].map(([label, v, c]) => (
            <Panel key={label} style={{ padding: 13 }}>
              <Label>{label}</Label>
              <div style={{ fontFamily: T.mono, fontSize: 19, fontWeight: 700, color: c }}>{v}</div>
            </Panel>
          ))}
        </div>
      )}

      {/* Games table */}
      <Panel>
        <Label>{week === "ALL" ? `${meta.season} Season to Date` : `Week ${week}`}{team !== "ALL" ? ` — ${TEAMS[team].name}` : ""}</Label>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 620 }}>
            <thead>
              <tr style={{ fontSize: 10.5, textTransform: "uppercase", letterSpacing: "0.07em", color: T.muted, borderBottom: `1px solid ${T.line}` }}>
                <th style={{ padding: "8px 6px", textAlign: "left" }}>Wk</th>
                <th style={{ padding: "8px 6px", textAlign: "left" }}>Date</th>
                <th style={{ padding: "8px 6px", textAlign: "right" }}>Away</th>
                <th style={{ padding: "8px 4px" }}></th>
                <th style={{ padding: "8px 6px", textAlign: "left" }}>Home</th>
                <th style={{ padding: "8px 6px", textAlign: "right" }}>Yds (A/H)</th>
                <th style={{ padding: "8px 6px", textAlign: "right" }}>TO (A/H)</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((g, i) => {
                // away=1 → winner was the road team
                const awayTeam = g.away ? g.w : g.l;
                const homeTeam = g.away ? g.l : g.w;
                const awayPts = g.away ? g.pw : g.pl;
                const homePts = g.away ? g.pl : g.pw;
                const awayYds = g.away ? g.yw : g.yl;
                const homeYds = g.away ? g.yl : g.yw;
                const awayTO = g.away ? g.tw : g.tl;
                const homeTO = g.away ? g.tl : g.tw;
                return (
                  <tr key={i} style={{ borderBottom: `1px solid ${T.line}` }}>
                    <td style={{ padding: "8px 6px", fontFamily: T.mono, fontSize: 12, color: T.muted }}>{g.wk}</td>
                    <td style={{ padding: "8px 6px", fontFamily: T.mono, fontSize: 12, color: T.muted, whiteSpace: "nowrap" }}>{g.date}</td>
                    <td style={{ padding: "8px 6px", textAlign: "right", whiteSpace: "nowrap" }}>
                      <TeamCell abbr={awayTeam} pts={awayPts} win={g.w === awayTeam} tie={g.tie} />
                    </td>
                    <td style={{ padding: "8px 4px", color: T.muted, fontSize: 11 }}>@</td>
                    <td style={{ padding: "8px 6px", whiteSpace: "nowrap" }}>
                      <TeamCell abbr={homeTeam} pts={homePts} win={g.w === homeTeam} tie={g.tie} />
                      {g.tie && <span style={{ marginLeft: 8, fontSize: 10, color: T.chalk, fontWeight: 700 }}>TIE</span>}
                    </td>
                    <td style={{ padding: "8px 6px", textAlign: "right", fontFamily: T.mono, fontSize: 12, color: T.muted }}>
                      {awayYds ?? "—"} / {homeYds ?? "—"}
                    </td>
                    <td style={{ padding: "8px 6px", textAlign: "right", fontFamily: T.mono, fontSize: 12, color: T.muted }}>
                      {awayTO ?? "—"} / {homeTO ?? "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div style={{ fontSize: 11.5, color: T.muted, marginTop: 10, lineHeight: 1.5 }}>
          Every completed {meta.season} game with final score, total yards, and turnovers per team — {GAMES.length} games through {DATA_AS_OF}. Sources: {meta.gamesSource}.
        </div>
      </Panel>
      </>
      )}
    </div>
  );
}
