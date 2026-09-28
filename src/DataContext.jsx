import React, { createContext, useContext, useEffect, useState } from "react";
import { derive } from "./lib/derive.js";

const DataContext = createContext(null);
export const useData = () => useContext(DataContext);

const FILES = { games: "games", upcoming: "upcoming", players: "players", meta: "meta", odds: "odds", closing: "closing-lines" };

async function loadAll() {
  const bust = Date.now();
  const entries = await Promise.all(Object.entries(FILES).map(async ([key, file]) => {
    const res = await fetch(`${import.meta.env.BASE_URL}data/${file}.json?v=${bust}`);
    if (!res.ok) throw new Error(`${file}.json: HTTP ${res.status}`);
    return [key, await res.json()];
  }));
  return derive(Object.fromEntries(entries));
}

export function DataProvider({ children, fallback, errorView }) {
  const [state, setState] = useState({ data: null, error: null });

  useEffect(() => {
    let alive = true;
    const load = () => loadAll()
      .then((data) => alive && setState({ data, error: null }))
      .catch((error) => alive && setState((s) => (s.data ? s : { data: null, error })));
    load();
    // Pick up a fresh deploy when the tab comes back into view.
    const onVisible = () => document.visibilityState === "visible" && load();
    document.addEventListener("visibilitychange", onVisible);
    return () => { alive = false; document.removeEventListener("visibilitychange", onVisible); };
  }, []);

  if (state.error) return errorView(state.error);
  if (!state.data) return fallback;
  return <DataContext.Provider value={state.data}>{children}</DataContext.Provider>;
}
