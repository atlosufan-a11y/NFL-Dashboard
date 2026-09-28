import React, { useMemo, useState } from "react";
import { TEAMS, etDate, matchKey } from "../lib/teams.js";
import {
  implied, noVig, fmtOdds, fmtLine, consensus, best, grade, clv, profit, fromProb,
} from "../lib/odds.js";
import { useStored } from "../lib/useStored.js";
import { useData } from "../DataContext.jsx";
import { T, Label, Panel, Field, Note, TeamAbbr, inputStyle, subBtn, kickoffFmt } from "./ui.jsx";
import BetTools from "./BetTools.jsx";

const conf = (a) => TEAMS[a]?.conf;
const pct = (p) => (p == null ? "—" : `${(p * 100).toFixed(1)}%`);
const money = (v) => `${v < 0 ? "−" : ""}$${Math.abs(v).toFixed(2)}`;
const signed = (v, unit) => `${v > 0 ? "+" : ""}${v}${unit === "%" ? "%" : ""}`;

/* ------------------------------------------------------------------ */
/* Slate: upcoming games joined with their odds                        */
/* ------------------------------------------------------------------ */
function useSlate() {
  const { UPCOMING, odds, closing } = useData();
  return useMemo(() => {
    const byKey = Object.fromEntries((odds.games || []).map((g) => [g.key, g]));
    const seen = new Set();
    const slate = UPCOMING.map((u) => {
      const key = matchKey(u.away, u.home, etDate(u.kickoff));
      seen.add(key);
      return { ...u, key, odds: byKey[key] || null };
    });
    // Games the odds feed lists beyond the scores feed's window.
    (odds.games || []).forEach((g) => {
      if (!seen.has(g.key) && new Date(g.kickoff) > new Date()) {
        slate.push({ key: g.key, wk: g.wk ?? null, kickoff: g.kickoff, away: g.away, home: g.home, ap: null, hp: null, odds: g });
      }
    });
    slate.sort((a, b) => a.kickoff.localeCompare(b.kickoff));

    const closeByKey = Object.fromEntries(closing.map((c) => [c.key, c]));
    (odds.games || []).forEach((g) => {
      if (!closeByKey[g.key] && new Date(g.kickoff) <= new Date() && g.history?.length) {
        closeByKey[g.key] = g.history[g.history.length - 1];
      }
    });
    return { slate, closeByKey };
  }, [UPCOMING, odds, closing]);
}

/* ------------------------------------------------------------------ */
/* Bets                                                                */
/* ------------------------------------------------------------------ */
const newId = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

export const describeBet = (b) => {
  const side = b.market === "total" ? `${b.pick === "over" ? "Over" : "Under"} ${b.line}`
    : b.market === "spread" ? `${b.pick} ${fmtLine(b.line)}` : `${b.pick} ML`;
  return `${side} (${fmtOdds(b.odds)})`;
};

function settle(bet, finalsByKey, closeByKey) {
  const game = finalsByKey[bet.key];
  const auto = grade(bet, game);
  const result = bet.override || auto || "pending";
  const pl = result === "win" ? profit(bet.stake, bet.odds) : result === "loss" ? -bet.stake : 0;
  return { ...bet, game, result, auto, pl, clv: clv(bet, closeByKey[bet.key]) };
}

function BetForm({ initial, games, onSave, onCancel }) {
  const [b, setB] = useState(initial);
  const game = games.find((g) => g.key === b.key);
  const set = (patch) => setB((x) => ({ ...x, ...patch }));

  const pickGame = (key) => {
    const g = games.find((x) => x.key === key);
    if (g) set({ key, away: g.away, home: g.home, wk: g.wk ?? null, kickoff: g.kickoff, pick: b.market === "total" ? "over" : g.away });
  };
  const pickMarket = (market) => set({
    market, pick: market === "total" ? "over" : game?.away ?? b.pick, line: market === "ml" ? null : b.line ?? 0,
  });

  const valid = b.key && b.pick && Number.isFinite(+b.odds) && Math.abs(+b.odds) >= 100 && +b.stake > 0
    && (b.market === "ml" || Number.isFinite(+b.line));
  const toWin = valid ? profit(+b.stake, +b.odds) : null;

  return (
    <div style={{ border: `1px solid ${T.chalk}55`, background: T.bg, borderRadius: 8, padding: 14, marginTop: 12 }}>
      <div className="form-grid">
        {games.length > 1 && (
          <Field label="Game">
            <select value={b.key || ""} onChange={(e) => pickGame(e.target.value)} style={inputStyle}>
              <option value="" disabled>Choose a game…</option>
              {games.map((g) => (
                <option key={g.key} value={g.key}>
                  {g.wk ? `Wk ${g.wk} · ` : ""}{g.away} @ {g.home} · {g.final ? `final ${g.kickoff.slice(5, 10)}` : kickoffFmt(g.kickoff)}
                </option>
              ))}
            </select>
          </Field>
        )}
        <Field label="Market">
          <select value={b.market} onChange={(e) => pickMarket(e.target.value)} style={inputStyle}>
            <option value="spread">Spread</option>
            <option value="total">Total</option>
            <option value="ml">Moneyline</option>
          </select>
        </Field>
        <Field label="Pick">
          <select value={b.pick || ""} onChange={(e) => set({ pick: e.target.value })} style={inputStyle}>
            {b.market === "total"
              ? <><option value="over">Over</option><option value="under">Under</option></>
              : game && <><option value={game.away}>{game.away}</option><option value={game.home}>{game.home}</option></>}
          </select>
        </Field>
        {b.market !== "ml" && (
          <Field label={b.market === "total" ? "Total" : "Line"}>
            <input type="number" step="0.5" value={b.line ?? ""} onChange={(e) => set({ line: e.target.value === "" ? "" : +e.target.value })} style={inputStyle} />
          </Field>
        )}
        <Field label="Odds (American)">
          <input type="number" step="1" value={b.odds ?? ""} onChange={(e) => set({ odds: e.target.value === "" ? "" : +e.target.value })} style={inputStyle} />
        </Field>
        <Field label="Stake ($)">
          <input type="number" min="0" step="1" value={b.stake ?? ""} onChange={(e) => set({ stake: e.target.value === "" ? "" : +e.target.value })} style={inputStyle} />
        </Field>
        <Field label="Book">
          <input type="text" value={b.book || ""} placeholder="optional" onChange={(e) => set({ book: e.target.value })} style={inputStyle} />
        </Field>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 12, flexWrap: "wrap" }}>
        <button disabled={!valid} onClick={() => onSave({ ...b, line: b.market === "ml" ? null : +b.line, odds: +b.odds, stake: +b.stake })}
          style={{ ...subBtn(true), opacity: valid ? 1 : 0.4, cursor: valid ? "pointer" : "default" }}>Save bet</button>
        <button onClick={onCancel} style={subBtn(false)}>Cancel</button>
        <span style={{ fontSize: 12, color: T.muted, fontFamily: T.mono }}>
          {toWin != null ? `To win ${money(toWin)} · implied ${pct(implied(+b.odds))}` : "Odds must be ±100 or beyond"}
        </span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Lines board                                                         */
/* ------------------------------------------------------------------ */
function PriceCell({ label, main, bestLine, sub, onAdd }) {
  return (
    <button onClick={onAdd} className="price-cell" title="Add to my bets">
      <span style={{ fontSize: 10.5, color: T.muted, textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</span>
      <span style={{ fontFamily: T.mono, fontWeight: 700, fontSize: 14, color: T.text }}>{main}</span>
      {bestLine && <span style={{ fontFamily: T.mono, fontSize: 11, color: T.win }}>{bestLine}</span>}
      {sub && <span style={{ fontFamily: T.mono, fontSize: 11, color: T.muted }}>{sub}</span>}
    </button>
  );
}

function Movement({ history, field, fmt }) {
  if (!history || history.length < 2) return null;
  const open = history[0][field], now = history[history.length - 1][field];
  if (open == null || now == null || open === now) return <span style={{ color: T.muted }}>no move</span>;
  return (
    <span style={{ color: T.chalk }}>
      {fmt(open)} → {fmt(now)}
    </span>
  );
}

function GameCard({ g, record, onAdd, draft, onSaveDraft, onCancelDraft }) {
  const books = g.odds?.books || [];
  const c = books.length ? consensus(books) : null;
  const bestOf = (m, side) => (books.length ? best(books, m, side) : null);
  const fair = c && c.mlAway != null && c.mlHome != null ? noVig(c.mlAway, c.mlHome) : null;
  const hist = g.odds?.history;
  const base = { key: g.key, away: g.away, home: g.home, wk: g.wk ?? null, kickoff: g.kickoff };

  const add = (market, pick, point, price, book) =>
    onAdd({ ...base, market, pick, line: market === "ml" ? null : point, odds: price, book: book || "" });

  const bestTxt = (b, withPoint) => b && `best ${withPoint ? `${fmtLine(b.point)} ` : ""}${fmtOdds(b.price)} · ${b.book}`;
  const bestTotalTxt = (b) => b && `best ${b.point} ${fmtOdds(b.price)} · ${b.book}`;

  const sa = bestOf("spread", "away"), sh = bestOf("spread", "home");
  const to = bestOf("total", "over"), tu = bestOf("total", "under");
  const ma = bestOf("ml", "away"), mh = bestOf("ml", "home");

  return (
    <Panel style={{ padding: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
        <div style={{ fontSize: 16 }}>
          <TeamAbbr abbr={g.away} conf={conf(g.away)} />
          <span style={{ color: T.muted, fontSize: 12, fontFamily: T.mono, marginLeft: 6 }}>{record(g.away)}</span>
          <span style={{ color: T.muted, margin: "0 8px" }}>@</span>
          <TeamAbbr abbr={g.home} conf={conf(g.home)} />
          <span style={{ color: T.muted, fontSize: 12, fontFamily: T.mono, marginLeft: 6 }}>{record(g.home)}</span>
        </div>
        <div style={{ fontSize: 12, color: T.muted, fontFamily: T.mono }}>
          {g.wk ? `Wk ${g.wk} · ` : ""}{kickoffFmt(g.kickoff)} ET
        </div>
      </div>

      {c ? (
        <>
          <div className="lines-grid">
            <div className="lines-label">Spread</div>
            <PriceCell label={g.away} main={`${fmtLine(c.spreadHome == null ? null : -c.spreadHome)} (${fmtOdds(c.spreadAwayPrice)})`}
              bestLine={bestTxt(sa, true)} onAdd={() => add("spread", g.away, sa?.point ?? -c.spreadHome, sa?.price ?? c.spreadAwayPrice, sa?.book)} />
            <PriceCell label={g.home} main={`${fmtLine(c.spreadHome)} (${fmtOdds(c.spreadHomePrice)})`}
              bestLine={bestTxt(sh, true)} onAdd={() => add("spread", g.home, sh?.point ?? c.spreadHome, sh?.price ?? c.spreadHomePrice, sh?.book)} />

            <div className="lines-label">Total</div>
            <PriceCell label="Over" main={`${c.total ?? "—"} (${fmtOdds(c.overPrice)})`}
              bestLine={bestTotalTxt(to)} onAdd={() => add("total", "over", to?.point ?? c.total, to?.price ?? c.overPrice, to?.book)} />
            <PriceCell label="Under" main={`${c.total ?? "—"} (${fmtOdds(c.underPrice)})`}
              bestLine={bestTotalTxt(tu)} onAdd={() => add("total", "under", tu?.point ?? c.total, tu?.price ?? c.underPrice, tu?.book)} />

            <div className="lines-label">Moneyline</div>
            <PriceCell label={g.away} main={fmtOdds(c.mlAway)} bestLine={bestTxt(ma, false)}
              sub={`fair ${pct(fair?.[0])}${g.ap != null ? ` · ESPN ${g.ap.toFixed(1)}%` : ""}`}
              onAdd={() => add("ml", g.away, null, ma?.price ?? c.mlAway, ma?.book)} />
            <PriceCell label={g.home} main={fmtOdds(c.mlHome)} bestLine={bestTxt(mh, false)}
              sub={`fair ${pct(fair?.[1])}${g.hp != null ? ` · ESPN ${g.hp.toFixed(1)}%` : ""}`}
              onAdd={() => add("ml", g.home, null, mh?.price ?? c.mlHome, mh?.book)} />
          </div>
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap", fontSize: 11.5, color: T.muted, marginTop: 10, fontFamily: T.mono }}>
            <span>Spread ({g.home}): <Movement history={hist} field="spreadHome" fmt={fmtLine} /></span>
            <span>Total: <Movement history={hist} field="total" fmt={(v) => v} /></span>
            <span>{books.length} book{books.length !== 1 ? "s" : ""}</span>
          </div>
        </>
      ) : (
        <div style={{ marginTop: 12, fontSize: 12.5, color: T.muted }}>
          {g.ap != null
            ? <>No sportsbook lines yet. ESPN's model makes it {g.away} {g.ap.toFixed(1)}% / {g.home} {g.hp.toFixed(1)}% —
                a fair moneyline of <span style={{ fontFamily: T.mono, color: T.text }}>{fmtOdds(fromProb(g.ap / 100))}</span> /
                <span style={{ fontFamily: T.mono, color: T.text }}> {fmtOdds(fromProb(g.hp / 100))}</span> before any vig.</>
            : "No sportsbook lines or model probabilities published yet."}
          <div style={{ marginTop: 8 }}>
            <button onClick={() => onAdd({ ...base, market: "spread", pick: g.away, line: 0, odds: -110, book: "" })} style={subBtn(false)}>
              + Log a bet on this game
            </button>
          </div>
        </div>
      )}

      {draft && <BetForm initial={draft} games={[g]} onSave={onSaveDraft} onCancel={onCancelDraft} />}
    </Panel>
  );
}

function LinesView({ onSaveBet }) {
  const { record, odds, meta } = useData();
  const { slate } = useSlate();
  const [draft, setDraft] = useState(null);
  const [week, setWeek] = useState("ALL");
  const weeks = [...new Set(slate.map((g) => g.wk).filter(Boolean))];
  const shown = week === "ALL" ? slate : slate.filter((g) => g.wk === +week);
  const hasOdds = (odds.games || []).length > 0;

  return (
    <div>
      {!hasOdds && (
        <Panel style={{ marginBottom: 16, borderColor: `${T.chalk}55` }}>
          <Label>Sportsbook lines aren't connected yet</Label>
          <div style={{ fontSize: 13, color: T.muted, lineHeight: 1.6 }}>
            Add a free <a href="https://the-odds-api.com/" target="_blank" rel="noreferrer" style={{ color: T.chalk }}>The Odds API</a> key
            as the repository secret <code style={{ fontFamily: T.mono, color: T.text }}>ODDS_API_KEY</code>. The scheduled update
            will then pull spreads, totals and moneylines from the major US books, highlight the best price for every side,
            and track how each line moves. Until then, cards show ESPN's model and you can still log bets by hand.
          </div>
        </Panel>
      )}
      <div style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap", alignItems: "center" }}>
        <button onClick={() => setWeek("ALL")} style={subBtn(week === "ALL")}>All</button>
        {weeks.map((w) => <button key={w} onClick={() => setWeek(String(w))} style={subBtn(week === String(w))}>Week {w}</button>)}
        {meta.oddsUpdatedAt && (
          <span style={{ marginLeft: "auto", fontSize: 11.5, color: T.muted }}>Lines as of {kickoffFmt(meta.oddsUpdatedAt)} ET</span>
        )}
      </div>
      <div style={{ display: "grid", gap: 14 }}>
        {shown.map((g) => (
          <GameCard key={g.key} g={g} record={record}
            draft={draft?.key === g.key ? draft : null}
            onAdd={(b) => setDraft({ id: newId(), stake: 10, ...b })}
            onSaveDraft={(b) => { onSaveBet(b); setDraft(null); }}
            onCancelDraft={() => setDraft(null)} />
        ))}
        {shown.length === 0 && <Panel><div style={{ color: T.muted, fontSize: 13 }}>No upcoming games in the data.</div></Panel>}
      </div>
      <Note>
        Consensus is the median line and price across books; "best" is the most favorable number available for that side,
        then the best price at that number. Fair % strips the vig from the consensus moneyline. Tap any price to log a bet
        at it — adjust the number if your book differs.
      </Note>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* My bets                                                             */
/* ------------------------------------------------------------------ */
const RESULT_COLOR = { win: T.win, loss: T.loss, push: T.muted, void: T.muted, pending: T.chalk };

function MyBetsView({ bets, setBets, settings, setSettings }) {
  const { finalsByKey, GAMES } = useData();
  const { slate, closeByKey } = useSlate();
  const [adding, setAdding] = useState(false);
  const [filter, setFilter] = useState("all");

  const settled = useMemo(() => bets.map((b) => settle(b, finalsByKey, closeByKey))
    .sort((a, b) => (b.kickoff || "").localeCompare(a.kickoff || "")), [bets, finalsByKey, closeByKey]);

  const s = useMemo(() => {
    const done = settled.filter((b) => b.result !== "pending" && b.result !== "void");
    const w = done.filter((b) => b.result === "win").length, l = done.filter((b) => b.result === "loss").length;
    const p = done.filter((b) => b.result === "push").length;
    const staked = done.reduce((t, b) => t + b.stake, 0), pl = done.reduce((t, b) => t + b.pl, 0);
    const pending = settled.filter((b) => b.result === "pending");
    const clvs = settled.map((b) => b.clv).filter((c) => c && c.unit === "pts");
    // Current NFL week window: bets on games kicking off in the next/last 7 days.
    const now = Date.now(), weekMs = 7 * 864e5;
    const thisWeek = settled.filter((b) => b.kickoff && Math.abs(new Date(b.kickoff) - now) < weekMs)
      .reduce((t, b) => t + b.stake, 0);
    return {
      w, l, p, staked, pl, roi: staked ? (pl / staked) * 100 : null,
      pendingN: pending.length, atRisk: pending.reduce((t, b) => t + b.stake, 0),
      avgClv: clvs.length ? clvs.reduce((t, c) => t + c.value, 0) / clvs.length : null, clvN: clvs.length, thisWeek,
    };
  }, [settled]);

  // Games you can log against: the upcoming slate plus the last two weeks of finals.
  const logGames = useMemo(() => {
    const recent = GAMES.slice(-32).map((g) => {
      const f = finalsByKey[g.key];
      return { key: g.key, wk: g.wk, away: f.away, home: f.home, kickoff: `${f.date}T17:00:00Z`, final: true };
    });
    return [...slate, ...recent.reverse()];
  }, [slate, GAMES, finalsByKey]);

  const shown = settled.filter((b) => filter === "all" || (filter === "pending" ? b.result === "pending" : b.result !== "pending"));
  const setOverride = (id, override) => setBets((bs) => bs.map((b) => (b.id === id ? { ...b, override: override || null } : b)));

  const exportBets = () => {
    const blob = new Blob([JSON.stringify({ version: 1, bets }, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `film-room-bets-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };
  const importBets = (file) => {
    file.text().then((txt) => {
      const parsed = JSON.parse(txt);
      const incoming = Array.isArray(parsed) ? parsed : parsed.bets;
      if (!Array.isArray(incoming)) throw new Error("No bets found in file");
      setBets((bs) => {
        const ids = new Set(bs.map((b) => b.id));
        return [...bs, ...incoming.filter((b) => b && b.id && !ids.has(b.id))];
      });
    }).catch((e) => alert(`Couldn't import: ${e.message}`));
  };

  const limit = +settings.weeklyLimit || 0;
  const tiles = [
    ["Record", `${s.w}-${s.l}${s.p ? `-${s.p}` : ""}`, T.text],
    ["Profit", money(s.pl), s.pl > 0 ? T.win : s.pl < 0 ? T.loss : T.text],
    ["ROI", s.roi == null ? "—" : `${s.roi > 0 ? "+" : ""}${s.roi.toFixed(1)}%`, s.roi > 0 ? T.win : s.roi < 0 ? T.loss : T.text],
    ["Pending", `${s.pendingN} · ${money(s.atRisk)}`, T.chalk],
    ["Avg CLV (pts)", s.avgClv == null ? "—" : `${s.avgClv > 0 ? "+" : ""}${s.avgClv.toFixed(2)}`, s.avgClv > 0 ? T.win : s.avgClv < 0 ? T.loss : T.text],
  ];

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12, marginBottom: 16 }}>
        {tiles.map(([label, v, c]) => (
          <Panel key={label} style={{ padding: 13 }}>
            <Label>{label}</Label>
            <div style={{ fontFamily: T.mono, fontSize: 18, fontWeight: 700, color: c }}>{v}</div>
          </Panel>
        ))}
      </div>

      <Panel style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap" }}>
          <div style={{ width: 170 }}>
            <Field label="Weekly limit ($)">
              <input type="number" min="0" value={settings.weeklyLimit ?? ""} placeholder="none"
                onChange={(e) => setSettings({ ...settings, weeklyLimit: e.target.value })} style={inputStyle} />
            </Field>
          </div>
          {limit > 0 && (
            <div style={{ flex: 1, minWidth: 200 }}>
              <div style={{ fontSize: 12, color: s.thisWeek > limit ? T.loss : T.muted, marginBottom: 6, fontFamily: T.mono }}>
                {money(s.thisWeek)} of {money(limit)} staked on games within 7 days
                {s.thisWeek > limit ? " — over your limit" : ""}
              </div>
              <div style={{ height: 8, background: T.bg, borderRadius: 4, overflow: "hidden" }}>
                <div style={{ width: `${Math.min(100, (s.thisWeek / limit) * 100)}%`, height: "100%", background: s.thisWeek > limit ? T.loss : T.chalk }} />
              </div>
            </div>
          )}
        </div>
      </Panel>

      <Panel>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <div style={{ display: "flex", gap: 6 }}>
            {[["all", "All"], ["pending", "Pending"], ["settled", "Settled"]].map(([id, name]) => (
              <button key={id} onClick={() => setFilter(id)} style={subBtn(filter === id)}>{name}</button>
            ))}
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            <button onClick={() => setAdding(true)} style={subBtn(true)}>+ Add bet</button>
            <button onClick={exportBets} style={subBtn(false)} disabled={!bets.length}>Export</button>
            <label style={{ ...subBtn(false), display: "inline-block" }}>
              Import<input type="file" accept="application/json" hidden onChange={(e) => e.target.files[0] && importBets(e.target.files[0])} />
            </label>
          </div>
        </div>

        {adding && (
          <BetForm initial={{ id: newId(), market: "spread", stake: 10, odds: -110, line: 0 }} games={logGames}
            onSave={(b) => { setBets((bs) => [...bs, { ...b, createdAt: new Date().toISOString() }]); setAdding(false); }}
            onCancel={() => setAdding(false)} />
        )}

        <div style={{ overflowX: "auto", marginTop: 12 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 680 }}>
            <thead>
              <tr style={{ fontSize: 10.5, textTransform: "uppercase", letterSpacing: "0.07em", color: T.muted, borderBottom: `1px solid ${T.line}` }}>
                {["Game", "Bet", "Book", "Stake", "Result", "P/L", "CLV", ""].map((h, i) => (
                  <th key={i} style={{ padding: "8px 6px", textAlign: i >= 3 && i <= 6 ? "right" : "left" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {shown.map((b) => (
                <tr key={b.id} style={{ borderBottom: `1px solid ${T.line}` }}>
                  <td style={{ padding: "9px 6px", whiteSpace: "nowrap" }}>
                    <TeamAbbr abbr={b.away} conf={conf(b.away)} style={{ fontSize: 12 }} />
                    <span style={{ color: T.muted, margin: "0 5px" }}>@</span>
                    <TeamAbbr abbr={b.home} conf={conf(b.home)} style={{ fontSize: 12 }} />
                    <div style={{ fontSize: 11, color: T.muted, fontFamily: T.mono }}>
                      {b.game ? `Final ${b.game.awayPts}–${b.game.homePts}` : b.kickoff ? kickoffFmt(b.kickoff) : ""}
                    </div>
                  </td>
                  <td style={{ padding: "9px 6px", fontFamily: T.mono, whiteSpace: "nowrap" }}>{describeBet(b)}</td>
                  <td style={{ padding: "9px 6px", color: T.muted }}>{b.book || "—"}</td>
                  <td style={{ padding: "9px 6px", textAlign: "right", fontFamily: T.mono }}>{money(b.stake)}</td>
                  <td style={{ padding: "9px 6px", textAlign: "right" }}>
                    <select value={b.override || ""} onChange={(e) => setOverride(b.id, e.target.value)}
                      style={{ ...inputStyle, width: "auto", padding: "4px 6px", fontSize: 12, color: RESULT_COLOR[b.result], fontWeight: 700 }}>
                      <option value="">{b.auto ? `${b.auto} (auto)` : "pending"}</option>
                      <option value="win">win</option>
                      <option value="loss">loss</option>
                      <option value="push">push</option>
                      <option value="void">void</option>
                    </select>
                  </td>
                  <td style={{ padding: "9px 6px", textAlign: "right", fontFamily: T.mono, color: b.pl > 0 ? T.win : b.pl < 0 ? T.loss : T.muted }}>
                    {b.result === "pending" ? `+${money(profit(b.stake, b.odds))}` : money(b.pl)}
                  </td>
                  <td style={{ padding: "9px 6px", textAlign: "right", fontFamily: T.mono, color: b.clv ? (b.clv.value > 0 ? T.win : b.clv.value < 0 ? T.loss : T.muted) : T.muted }}>
                    {b.clv ? signed(b.clv.value, b.clv.unit) : "—"}
                  </td>
                  <td style={{ padding: "9px 6px", textAlign: "right" }}>
                    <button onClick={() => confirm("Delete this bet?") && setBets((bs) => bs.filter((x) => x.id !== b.id))}
                      style={{ background: "none", border: "none", color: T.muted, cursor: "pointer", fontSize: 14 }} aria-label="Delete bet">×</button>
                  </td>
                </tr>
              ))}
              {shown.length === 0 && (
                <tr><td colSpan={8} style={{ padding: "22px 6px", textAlign: "center", color: T.muted }}>
                  No bets yet. Tap a price on the Lines view, or use + Add bet.
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
        <Note>
          Bets grade themselves when the final score lands in the data; pick a result from the dropdown to override
          (for example, a bet your book voided). Pending P/L shows the amount to win. CLV compares your number with the
          consensus line just before kickoff — beating the close consistently is the best sign your picks have an edge.
          Bets are saved in this browser only; use Export to back them up or move them to another device.
        </Note>
      </Panel>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Tab                                                                 */
/* ------------------------------------------------------------------ */
export default function BettingTab() {
  const [view, setView] = useStored("filmroom.betView", "lines");
  const [bets, setBets] = useStored("filmroom.bets.v1", []);
  const [settings, setSettings] = useStored("filmroom.settings.v1", { weeklyLimit: "" });

  const saveBet = (b) => setBets((bs) => [...bs, { ...b, createdAt: new Date().toISOString() }]);

  return (
    <div>
      <div style={{ display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap" }}>
        <button onClick={() => setView("lines")} style={subBtn(view === "lines")}>Lines</button>
        <button onClick={() => setView("bets")} style={subBtn(view === "bets")}>My Bets{bets.length ? ` (${bets.length})` : ""}</button>
        <button onClick={() => setView("tools")} style={subBtn(view === "tools")}>Calculators</button>
      </div>
      {view === "lines" && <LinesView onSaveBet={saveBet} />}
      {view === "bets" && <MyBetsView bets={bets} setBets={setBets} settings={settings} setSettings={setSettings} />}
      {view === "tools" && <BetTools />}
      <div style={{ fontSize: 11.5, color: T.muted, marginTop: 24, textAlign: "center", lineHeight: 1.6 }}>
        For information and personal record-keeping only — this site doesn't place bets. Please bet within your means.
        If gambling stops being fun, call or text 1-800-GAMBLER.
      </div>
    </div>
  );
}
