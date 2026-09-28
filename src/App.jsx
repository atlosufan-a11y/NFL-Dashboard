import React, { useEffect, useState } from "react";
import { DataProvider, useData } from "./DataContext.jsx";
import { T } from "./components/ui.jsx";
import StandingsTab from "./components/StandingsTab.jsx";
import GamesTab from "./components/GamesTab.jsx";
import AnalyticsTab from "./components/AnalyticsTab.jsx";
import PlayersTab from "./components/PlayersTab.jsx";
import BettingTab from "./components/BettingTab.jsx";

const TABS = [
  ["standings", "Standings", StandingsTab],
  ["games", "Games", GamesTab],
  ["viz", "Analytics", AnalyticsTab],
  ["players", "Players", PlayersTab],
  ["betting", "Betting", BettingTab],
];

// Tabs live in the URL hash so a tab can be bookmarked or shared.
function useHashTab() {
  const read = () => {
    const h = window.location.hash.replace(/^#\/?/, "");
    return TABS.some(([id]) => id === h) ? h : "standings";
  };
  const [tab, setTab] = useState(read);
  useEffect(() => {
    const onHash = () => setTab(read());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);
  return [tab, (id) => { window.location.hash = `/${id}`; }];
}

const ago = (iso) => {
  const mins = Math.round((Date.now() - new Date(iso)) / 60000);
  if (mins < 60) return `${Math.max(1, mins)} min ago`;
  if (mins < 48 * 60) return `${Math.round(mins / 60)} hr ago`;
  return `${Math.round(mins / 1440)} days ago`;
};

function Shell() {
  const { GAMES, DATA_AS_OF, meta } = useData();
  const [tab, setTab] = useHashTab();
  const Active = TABS.find(([id]) => id === tab)[2];

  useEffect(() => {
    document.querySelector(".tab.active")?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [tab]);

  return (
    <div className="app">
      <header className="masthead">
        <div className="wrap">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
            <div style={{ fontSize: 11, letterSpacing: "0.24em", color: T.chalk, fontWeight: 700, textTransform: "uppercase" }}>Film Room</div>
            {meta.updatedAt && (
              <div style={{ fontSize: 11.5, color: T.muted }} title={new Date(meta.updatedAt).toLocaleString()}>
                <span className="live-dot" /> Data updated {ago(meta.updatedAt)}
              </div>
            )}
          </div>
          <h1 style={{ margin: "4px 0 2px", fontSize: 26, fontWeight: 700, letterSpacing: "-0.01em" }}>{meta.season} NFL Season Analysis</h1>
          <div style={{ fontSize: 12.5, color: T.muted }}>
            The {meta.season} season to date — {GAMES.length} games through {DATA_AS_OF}.
          </div>
          <nav className="tabs">
            {TABS.map(([id, name]) => (
              <button key={id} onClick={() => setTab(id)} className={tab === id ? "tab active" : "tab"}>{name}</button>
            ))}
          </nav>
        </div>
      </header>
      <main className="wrap content">
        <Active />
      </main>
    </div>
  );
}

const Centered = ({ children }) => (
  <div className="app" style={{ display: "grid", placeItems: "center", color: T.muted, fontSize: 14, padding: 24, textAlign: "center" }}>
    {children}
  </div>
);

export default function App() {
  return (
    <DataProvider
      fallback={<Centered>Loading the film…</Centered>}
      errorView={(e) => <Centered>Couldn't load season data ({e.message}). Try refreshing.</Centered>}>
      <Shell />
    </DataProvider>
  );
}
