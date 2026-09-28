import React, { useState, useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from "recharts";
import { ChevronRight } from "lucide-react";
import { useData } from "../DataContext.jsx";
import { T, confColor, pct3, Label, Panel, Pill, subBtn } from "./ui.jsx";

/* ================================================================== */
/* Standings table                                                     */
/* ================================================================== */
function StandingsTable({ rows }) {
  const [sort, setSort] = useState({ key: "pct", dir: "desc" });
  const sorted = useMemo(() => {
    const s = [...rows].sort((a, b) => {
      const av = a[sort.key], bv = b[sort.key];
      if (typeof av === "string") return sort.dir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
      return sort.dir === "asc" ? av - bv : bv - av;
    });
    return s;
  }, [rows, sort]);

  const th = (key, label, align = "left") => (
    <th onClick={() => setSort((s) => ({ key, dir: s.key === key && s.dir === "desc" ? "asc" : "desc" }))}
      style={{ padding: "8px 6px", textAlign: align, cursor: "pointer", color: sort.key === key ? T.chalk : T.muted, userSelect: "none", whiteSpace: "nowrap" }}>
      {label}{sort.key === key ? (sort.dir === "desc" ? " ↓" : " ↑") : ""}
    </th>
  );

  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 520 }}>
        <thead>
          <tr style={{ fontSize: 10.5, textTransform: "uppercase", letterSpacing: "0.07em", borderBottom: `1px solid ${T.line}` }}>
            {th("name", "Team")}{th("conf", "Conf", "center")}{th("w", "W", "center")}{th("l", "L", "center")}{th("t", "T", "center")}
            {th("pct", "Pct", "center")}{th("diff", "Diff", "center")}
          </tr>
        </thead>
        <tbody>
          {sorted.map((r) => (
            <tr key={r.abbr} style={{ borderBottom: `1px solid ${T.line}` }}>
              <td style={{ padding: "9px 6px" }}>
                <span style={{ fontFamily: T.mono, fontWeight: 700, color: confColor(r.conf), marginRight: 8, fontSize: 12 }}>{r.abbr}</span>
                <span style={{ fontWeight: 600 }}>{r.name}</span>
              </td>
              <td style={{ padding: "9px 6px", textAlign: "center" }}><Pill conf={r.conf} /></td>
              <td style={{ padding: "9px 6px", textAlign: "center", fontFamily: T.mono, color: T.win, fontWeight: 700 }}>{r.w}</td>
              <td style={{ padding: "9px 6px", textAlign: "center", fontFamily: T.mono, color: T.loss }}>{r.l}</td>
              <td style={{ padding: "9px 6px", textAlign: "center", fontFamily: T.mono, color: r.t ? T.chalk : T.muted }}>{r.t || 0}</td>
              <td style={{ padding: "9px 6px", textAlign: "center", fontFamily: T.mono, fontWeight: 700 }}>{pct3(r.pct)}</td>
              <td style={{ padding: "9px 6px", textAlign: "center", fontFamily: T.mono, color: r.diff > 0 ? T.win : r.diff < 0 ? T.loss : T.muted }}>{r.diff > 0 ? "+" : ""}{r.diff}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function StandingsTab() {
  const { STANDINGS, DATA_AS_OF } = useData();
  const [confFilter, setConfFilter] = useState("all");
  const [standView, setStandView] = useState("league");

  const filtered = useMemo(() => {
    if (confFilter === "all") return STANDINGS;
    return STANDINGS.filter((r) => r.conf === confFilter);
  }, [confFilter, STANDINGS]);

  const byDivision = useMemo(() => {
    const g = {};
    STANDINGS.forEach((r) => {
      const k = `${r.conf} ${r.div}`;
      (g[k] = g[k] || []).push(r);
    });
    Object.values(g).forEach((arr) => arr.sort((a, b) => a.dr - b.dr));
    return g;
  }, [STANDINGS]);

  const topTeams = useMemo(() => [...STANDINGS].sort((a, b) => b.pct - a.pct).slice(0, 12), [STANDINGS]);

  return (
    <>
          <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
            <button onClick={() => setStandView("league")} style={subBtn(standView === "league")}>League</button>
            <button onClick={() => setStandView("divisions")} style={subBtn(standView === "divisions")}>Divisions</button>
          </div>

        {standView === "league" && (
          <>
            <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
              {[["all", "All 32"], ["AFC", "AFC"], ["NFC", "NFC"]].map(([id, name]) => (
                <button key={id} onClick={() => setConfFilter(id)} style={{
                  background: confFilter === id ? (id === "AFC" ? T.afc : id === "NFC" ? T.nfcSoft : T.panelSoft) : "transparent",
                  color: confFilter === id && id !== "all" ? "#fff" : confFilter === id ? T.chalk : T.muted,
                  border: `1px solid ${confFilter === id ? "transparent" : T.line}`, borderRadius: 6,
                  padding: "6px 14px", fontSize: 12.5, fontWeight: 700, cursor: "pointer",
                }}>{name}</button>
              ))}
            </div>
            <Panel>
              <Label>Standings — {DATA_AS_OF}</Label>
              <StandingsTable rows={filtered} />
            </Panel>
            <Panel style={{ marginTop: 16 }}>
              <Label>Top Teams by Win Percentage</Label>
              <div style={{ height: 300 }}>
                <ResponsiveContainer>
                  <BarChart data={topTeams.map((r) => ({ abbr: r.abbr, pct: +(r.pct * 100).toFixed(1), conf: r.conf }))} margin={{ top: 8, right: 8, left: -14, bottom: 0 }}>
                    <CartesianGrid stroke={T.line} strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="abbr" tick={{ fill: T.muted, fontSize: 11, fontFamily: T.mono }} axisLine={{ stroke: T.line }} tickLine={false} />
                    <YAxis tick={{ fill: T.muted, fontSize: 11, fontFamily: T.mono }} axisLine={false} tickLine={false} tickFormatter={(v) => v + "%"} />
                    <Tooltip contentStyle={{ background: T.panelSoft, border: `1px solid ${T.line}`, borderRadius: 8, fontSize: 12 }} cursor={{ fill: "rgba(255,255,255,0.04)" }} formatter={(v) => [v + "%", "Win rate"]} />
                    <Bar dataKey="pct" radius={[3, 3, 0, 0]}>
                      {topTeams.map((r, i) => <Cell key={i} fill={confColor(r.conf)} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div style={{ display: "flex", gap: 16, fontSize: 11.5, color: T.muted, marginTop: 6 }}>
                <span><span style={{ display: "inline-block", width: 10, height: 10, borderRadius: 2, background: T.afc, marginRight: 5 }} />AFC</span>
                <span><span style={{ display: "inline-block", width: 10, height: 10, borderRadius: 2, background: T.nfcSoft, marginRight: 5 }} />NFC</span>
              </div>
            </Panel>
          </>
        )}

        {standView === "divisions" && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 16 }}>
            {["AFC East", "AFC North", "AFC South", "AFC West", "NFC East", "NFC North", "NFC South", "NFC West"].map((div) => {
              const rows = byDivision[div] || [];
              const conf = div.startsWith("AFC") ? "AFC" : "NFC";
              return (
                <Panel key={div}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                    <span style={{ width: 4, height: 16, borderRadius: 2, background: confColor(conf) }} />
                    <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: "0.03em" }}>{div}</span>
                  </div>
                  {rows.map((r, i) => (
                    <div key={r.abbr} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "7px 0", borderTop: i > 0 ? `1px solid ${T.line}` : "none" }}>
                      <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        {i === 0 && <ChevronRight size={13} color={T.chalk} />}
                        <span style={{ fontFamily: T.mono, fontWeight: 700, color: confColor(conf), fontSize: 12, marginLeft: i === 0 ? 0 : 21 }}>{r.abbr}</span>
                        <span style={{ fontSize: 13, color: i === 0 ? T.text : T.muted, fontWeight: i === 0 ? 600 : 400 }}>{r.name}</span>
                      </span>
                      <span style={{ fontFamily: T.mono, fontSize: 12.5, fontWeight: 600 }}>{r.w}-{r.l}{r.t ? `-${r.t}` : ""}</span>
                    </div>
                  ))}
                </Panel>
              );
            })}
          </div>
        )}
    </>
  );
}
