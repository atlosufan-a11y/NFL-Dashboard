import React, { useState } from "react";
import { implied, noVig, toDecimal, fromDecimal, fromProb, profit, fmtOdds } from "../lib/odds.js";
import { useStored } from "../lib/useStored.js";
import { T, Label, Panel, Field, Note, inputStyle, subBtn } from "./ui.jsx";

const num = (v) => (v === "" || v == null ? NaN : +v);
const validOdds = (a) => Number.isFinite(a) && Math.abs(a) >= 100;
const Stat = ({ label, value, color }) => (
  <div>
    <div style={{ fontSize: 10.5, color: T.muted, textTransform: "uppercase", letterSpacing: "0.08em" }}>{label}</div>
    <div style={{ fontFamily: T.mono, fontSize: 16, fontWeight: 700, color: color || T.text, marginTop: 2 }}>{value}</div>
  </div>
);
const statRow = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))", gap: 12, marginTop: 14 };

function Converter() {
  const [odds, setOdds] = useState("-110");
  const a = num(odds);
  const ok = validOdds(a);
  return (
    <Panel>
      <Label>Odds Converter</Label>
      <Field label="American odds">
        <input type="number" value={odds} onChange={(e) => setOdds(e.target.value)} style={inputStyle} />
      </Field>
      <div style={statRow}>
        <Stat label="Decimal" value={ok ? toDecimal(a).toFixed(3) : "—"} />
        <Stat label="Implied" value={ok ? `${(implied(a) * 100).toFixed(2)}%` : "—"} />
        <Stat label="Win on $100" value={ok ? `$${profit(100, a).toFixed(2)}` : "—"} />
        <Stat label="Break-even" value={ok ? `${(implied(a) * 100).toFixed(1)}% wins` : "—"} />
      </div>
    </Panel>
  );
}

function NoVigCalc() {
  const [a, setA] = useState("-120");
  const [b, setB] = useState("+100");
  const x = num(a), y = num(b);
  const ok = validOdds(x) && validOdds(y);
  const fair = ok ? noVig(x, y) : null;
  const hold = ok ? (implied(x) + implied(y) - 1) * 100 : null;
  return (
    <Panel>
      <Label>No-Vig Fair Odds</Label>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <Field label="Side A"><input type="number" value={a} onChange={(e) => setA(e.target.value)} style={inputStyle} /></Field>
        <Field label="Side B"><input type="number" value={b} onChange={(e) => setB(e.target.value)} style={inputStyle} /></Field>
      </div>
      <div style={statRow}>
        <Stat label="Fair A" value={fair ? `${(fair[0] * 100).toFixed(1)}% · ${fmtOdds(fromProb(fair[0]))}` : "—"} />
        <Stat label="Fair B" value={fair ? `${(fair[1] * 100).toFixed(1)}% · ${fmtOdds(fromProb(fair[1]))}` : "—"} />
        <Stat label="Book hold" value={hold == null ? "—" : `${hold.toFixed(2)}%`} color={hold > 5 ? T.loss : T.text} />
      </div>
      <Note>Enter both sides of a two-way market. The hold is the book's built-in margin; lower is better for you.</Note>
    </Panel>
  );
}

function Parlay() {
  const [legs, setLegs] = useStored("filmroom.parlay.v1", ["-110", "-110"]);
  const [stake, setStake] = useState("10");
  const parsed = legs.map(num);
  const ok = parsed.length > 0 && parsed.every(validOdds);
  const dec = ok ? parsed.reduce((d, a) => d * toDecimal(a), 1) : null;
  const s = num(stake);
  return (
    <Panel>
      <Label>Parlay Calculator</Label>
      <div style={{ display: "grid", gap: 8 }}>
        {legs.map((l, i) => (
          <div key={i} style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <span style={{ fontSize: 12, color: T.muted, width: 44 }}>Leg {i + 1}</span>
            <input type="number" value={l} onChange={(e) => setLegs(legs.map((x, j) => (j === i ? e.target.value : x)))} style={inputStyle} />
            <button onClick={() => setLegs(legs.filter((_, j) => j !== i))} disabled={legs.length <= 1}
              style={{ background: "none", border: "none", color: T.muted, cursor: "pointer", fontSize: 16 }} aria-label="Remove leg">×</button>
          </div>
        ))}
      </div>
      <div style={{ display: "flex", gap: 10, marginTop: 10, alignItems: "flex-end", flexWrap: "wrap" }}>
        <button onClick={() => setLegs([...legs, "-110"])} style={subBtn(false)} disabled={legs.length >= 12}>+ Leg</button>
        <div style={{ width: 130 }}>
          <Field label="Stake ($)"><input type="number" value={stake} onChange={(e) => setStake(e.target.value)} style={inputStyle} /></Field>
        </div>
      </div>
      <div style={statRow}>
        <Stat label="Parlay odds" value={dec ? fmtOdds(fromDecimal(dec)) : "—"} />
        <Stat label="Payout" value={dec && s > 0 ? `$${(s * dec).toFixed(2)}` : "—"} color={T.win} />
        <Stat label="Implied hit rate" value={dec ? `${(100 / dec).toFixed(1)}%` : "—"} />
      </div>
      <Note>Assumes independent legs. Each leg carries its own vig, so the combined margin grows with every leg you add.</Note>
    </Panel>
  );
}

export default function BetTools() {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 16 }}>
      <Converter />
      <NoVigCalc />
      <Parlay />
    </div>
  );
}
