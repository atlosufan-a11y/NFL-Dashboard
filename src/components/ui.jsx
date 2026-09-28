import React from "react";

/* ================================================================== */
/* Design tokens — "Film Room": coaches'-tape slate, AFC/NFC coding    */
/* ================================================================== */
export const T = {
  bg: "#0E1216",
  panel: "#171E25",
  panelSoft: "#1F2830",
  line: "#2A343E",
  text: "#E7ECF0",
  muted: "#8795A2",
  chalk: "#F4D35E",   // first-down-marker amber
  afc: "#D50A0A",     // AFC red
  nfc: "#013A87",     // NFC blue
  nfcSoft: "#2E6FC9",
  win: "#4BA85E",
  loss: "#D8564F",
  mono: "ui-monospace, 'SF Mono', 'Cascadia Mono', Menlo, monospace",
};

export const confColor = (c) => (c === "AFC" ? T.afc : T.nfcSoft);

export const pct3 = (n) => (n === 1 ? "1.000" : n.toFixed(3).replace(/^0/, ""));

/* Shared bits */
export const Label = ({ children }) => (
  <div style={{ fontSize: 10.5, letterSpacing: "0.16em", textTransform: "uppercase", color: T.muted, fontWeight: 700, marginBottom: 8 }}>
    {children}
  </div>
);
export const Panel = ({ children, style }) => (
  <div style={{ background: T.panel, border: `1px solid ${T.line}`, borderRadius: 10, padding: 18, ...style }}>{children}</div>
);
export const Pill = ({ conf }) => (
  <span style={{
    display: "inline-block", fontSize: 9.5, fontWeight: 800, letterSpacing: "0.06em",
    color: "#fff", background: confColor(conf), borderRadius: 3, padding: "1px 5px", verticalAlign: "middle",
  }}>{conf}</span>
);
export const inputStyle = {
  background: T.bg, border: `1px solid ${T.line}`, borderRadius: 6, color: T.text,
  padding: "8px 10px", fontSize: 13, width: "100%", fontFamily: "inherit", outline: "none", boxSizing: "border-box",
};
export const Field = ({ label, children }) => (
  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
    <span style={{ fontSize: 11, color: T.muted, letterSpacing: "0.05em", textTransform: "uppercase" }}>{label}</span>
    {children}
  </div>
);
export const subBtn = (active) => ({
  background: active ? T.panelSoft : "transparent", color: active ? T.chalk : T.muted,
  border: `1px solid ${active ? T.line : "transparent"}`, borderRadius: 6,
  padding: "6px 14px", fontSize: 12.5, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap",
});
export const Note = ({ children, style }) => (
  <div style={{ fontSize: 11.5, color: T.muted, marginTop: 10, lineHeight: 1.5, ...style }}>{children}</div>
);
export const TeamAbbr = ({ abbr, conf, style }) => (
  <span style={{ fontFamily: T.mono, fontWeight: 700, color: confColor(conf), ...style }}>{abbr}</span>
);
export const kickoffFmt = (iso) =>
  new Date(iso).toLocaleString("en-US", {
    timeZone: "America/New_York", weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
  });
