import React, { useState, useMemo } from "react";
import { TEAMS } from "../lib/teams.js";
import { useData } from "../DataContext.jsx";
import { T, confColor, Label, Panel, inputStyle } from "./ui.jsx";

const playerCats = (P) => ({
  passing: {
    label: "Passing", data: P.passing || [], defaultSort: "rate",
    cols: [["yds","Yds"],["td","TD"],["int","Int"],["cmp","Cmp"],["att","Att"],["pct","Pct"],["ypa","YPA"],["sacks","Sk"],["rate","Rate"]],
  },
  rushing: {
    label: "Rushing", data: P.rushing || [], defaultSort: "yds",
    cols: [["att","Att"],["yds","Yds"],["avg","Avg"],["td","TD"],["fd","FD"]],
  },
  receiving: {
    label: "Receiving", data: P.receiving || [], defaultSort: "yds",
    cols: [["rec","Rec"],["yds","Yds"],["avg","Avg"],["td","TD"],["tar","Tgt"],["yac","YAC"]],
  },
  defense: {
    label: "Pass Rush", data: P.defense || [], defaultSort: "sacks",
    cols: [["sacks","Sacks"],["tackles","Tkl"],["int","Int"]],
  },
  interceptions: {
    label: "Interceptions", data: P.interceptions || [], defaultSort: "int",
    cols: [["int","Int"],["retYds","Ret Yds"],["td","Pick-6"],["tackles","Tkl"]],
  },
  kicking: {
    label: "Kicking", data: P.kicking || [], defaultSort: "pts",
    cols: [["patM","XPM"],["fgM","FGM"],["fgA","FGA"],["fgPct","FG%"],["fg40","40-49"],["fg50","50+"],["lg","Lg"],["pts","Pts"]],
  },
});

/* ================================================================== */
/* Players tab — 2026 season-to-date stats, filterable by team         */
/* ================================================================== */
export default function PlayersTab() {
  const { PLAYERS, meta } = useData();
  const PLAYER_CATS = useMemo(() => playerCats(PLAYERS), [PLAYERS]);
  const [cat, setCat] = useState("passing");
  const [teamFilter, setTeamFilter] = useState("ALL");
  const [sort, setSort] = useState({ key: "rate", dir: "desc" });

  const conf = PLAYER_CATS[cat];

  const switchCat = (id) => {
    setCat(id);
    setSort({ key: PLAYER_CATS[id].defaultSort, dir: "desc" });
  };

  const rows = useMemo(() => {
    let r = conf.data;
    if (teamFilter !== "ALL") r = r.filter((p) => p.team === teamFilter);
    return [...r].sort((a, b) => {
      const av = a[sort.key], bv = b[sort.key];
      if (typeof av === "string") return sort.dir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
      return sort.dir === "asc" ? av - bv : bv - av;
    });
  }, [cat, teamFilter, sort, conf.data]);

  // Team leader summary when a team is selected
  const teamLeaders = useMemo(() => {
    if (teamFilter === "ALL") return null;
    const top = (data, key) => {
      const arr = data.filter((p) => p.team === teamFilter);
      return arr.length ? arr.reduce((m, p) => (p[key] > m[key] ? p : m)) : null;
    };
    return {
      pass: top(PLAYERS.passing || [], "yds"),
      rush: top(PLAYERS.rushing || [], "yds"),
      rec: top(PLAYERS.receiving || [], "yds"),
      def: top(PLAYERS.defense || [], "sacks"),
      pick: top(PLAYERS.interceptions || [], "int"),
      kick: top(PLAYERS.kicking || [], "pts"),
    };
  }, [teamFilter, PLAYERS]);

  const teamsWithPlayers = useMemo(() => {
    const s = new Set();
    Object.values(PLAYER_CATS).forEach((c) => c.data.forEach((p) => s.add(p.team)));
    return [...s].sort();
  }, [PLAYER_CATS]);

  const th = (key, label) => (
    <th key={key} onClick={() => setSort((s) => ({ key, dir: s.key === key && s.dir === "desc" ? "asc" : "desc" }))}
      style={{ padding: "8px 6px", textAlign: "right", cursor: "pointer", userSelect: "none", whiteSpace: "nowrap",
        color: sort.key === key ? T.chalk : T.muted }}>
      {label}{sort.key === key ? (sort.dir === "desc" ? " ↓" : " ↑") : ""}
    </th>
  );

  const fmt = (v) => typeof v === "number" && !Number.isInteger(v) ? v.toFixed(v < 30 ? 2 : 1) : v.toLocaleString();

  return (
    <div>
      {/* Category + team filter */}
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", marginBottom: 16 }}>
        <div style={{ display: "flex", gap: 6, overflowX: "auto", maxWidth: "100%" }}>
          {Object.entries(PLAYER_CATS).map(([id, c]) => (
            <button key={id} onClick={() => switchCat(id)} style={{
              background: cat === id ? T.panelSoft : "transparent", color: cat === id ? T.chalk : T.muted,
              border: `1px solid ${cat === id ? T.line : "transparent"}`, borderRadius: 6,
              padding: "7px 14px", fontSize: 12.5, fontWeight: 700, cursor: "pointer",
            }}>{c.label}</button>
          ))}
        </div>
        <select value={teamFilter} onChange={(e) => setTeamFilter(e.target.value)}
          style={{ ...inputStyle, width: "auto", minWidth: 220 }}>
          <option value="ALL">All teams</option>
          {teamsWithPlayers.map((a) => <option key={a} value={a}>{a} — {TEAMS[a].name}</option>)}
        </select>
      </div>

      {/* Team leader cards */}
      {teamLeaders && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12, marginBottom: 16 }}>
          {[
            ["Passing leader", teamLeaders.pass, (p) => `${p.yds.toLocaleString()} yds · ${p.td} TD · ${p.rate} rate`],
            ["Rushing leader", teamLeaders.rush, (p) => `${p.yds.toLocaleString()} yds · ${p.td} TD · ${p.avg} avg`],
            ["Receiving leader", teamLeaders.rec, (p) => `${p.yds.toLocaleString()} yds · ${p.rec} rec · ${p.td} TD`],
            ["Sack leader", teamLeaders.def, (p) => `${p.sacks} sacks · ${p.tackles} tackles`],
            ["INT leader", teamLeaders.pick, (p) => `${p.int} INT · ${p.retYds} ret yds${p.td ? ` · ${p.td} TD` : ""}`],
            ["Kicker", teamLeaders.kick, (p) => `${p.fgM}/${p.fgA} FG (${p.fgPct}%) · ${p.pts} pts · long ${p.lg}`],
          ].map(([label, p, line]) => (
            <Panel key={label} style={{ padding: 14 }}>
              <Label>{label}</Label>
              {p ? (
                <>
                  <div style={{ fontSize: 15, fontWeight: 700 }}>{p.name}</div>
                  <div style={{ fontSize: 12, color: T.muted, fontFamily: T.mono, marginTop: 3 }}>{line(p)}</div>
                </>
              ) : (
                <div style={{ fontSize: 12.5, color: T.muted }}>No qualifier in dataset</div>
              )}
            </Panel>
          ))}
        </div>
      )}

      {/* Stats table */}
      <Panel>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 8 }}>
          <Label>{meta.season} {conf.label} — {teamFilter === "ALL" ? "League" : TEAMS[teamFilter].name} ({rows.length})</Label>
          <span style={{ fontSize: 11, color: T.muted }}>Click any column to sort</span>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 560 }}>
            <thead>
              <tr style={{ fontSize: 10.5, textTransform: "uppercase", letterSpacing: "0.07em", borderBottom: `1px solid ${T.line}` }}>
                <th style={{ padding: "8px 6px", textAlign: "left", color: T.muted }}>Player</th>
                <th style={{ padding: "8px 6px", textAlign: "left", color: T.muted }}>Team</th>
                <th style={{ padding: "8px 6px", textAlign: "right", color: T.muted }}>GP</th>
                {conf.cols.map(([key, label]) => th(key, label))}
              </tr>
            </thead>
            <tbody>
              {rows.map((p, i) => (
                <tr key={p.name + p.team} style={{ borderBottom: `1px solid ${T.line}`, background: i === 0 && sort.dir === "desc" ? "rgba(244,211,94,0.05)" : "transparent" }}>
                  <td style={{ padding: "9px 6px", fontWeight: 600, whiteSpace: "nowrap" }}>{p.name}</td>
                  <td style={{ padding: "9px 6px" }}>
                    <span style={{ fontFamily: T.mono, fontWeight: 700, fontSize: 12, color: confColor(TEAMS[p.team].conf) }}>{p.team}</span>
                  </td>
                  <td style={{ padding: "9px 6px", textAlign: "right", fontFamily: T.mono, color: T.muted }}>{p.gp}</td>
                  {conf.cols.map(([key]) => (
                    <td key={key} style={{ padding: "9px 6px", textAlign: "right", fontFamily: T.mono,
                      fontWeight: key === sort.key ? 700 : 400, color: key === sort.key ? T.text : T.muted }}>
                      {fmt(p[key])}
                    </td>
                  ))}
                </tr>
              ))}
              {rows.length === 0 && (
                <tr><td colSpan={3 + conf.cols.length} style={{ padding: "22px 6px", textAlign: "center", color: T.muted }}>
                  No {conf.label.toLowerCase()} qualifiers for this team in the dataset.
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
        <div style={{ fontSize: 11.5, color: T.muted, marginTop: 10, lineHeight: 1.5 }}>
          Season-to-date totals across six categories: passing, rushing, receiving, pass rush, interceptions, and
          kicking, as of {meta.playersAsOf}. Source: {meta.playersSource}. Coverage is league leaders per category.
          Early in the season every leaderboard is volatile — a single big afternoon can top a list.
        </div>
      </Panel>
    </div>
  );
}
