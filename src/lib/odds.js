// Pure odds math, shared by the app and the data script.

export const implied = (a) => (a == null ? null : a < 0 ? -a / (-a + 100) : 100 / (a + 100));
export const toDecimal = (a) => (a > 0 ? 1 + a / 100 : 1 + 100 / -a);
export const fromDecimal = (d) => (d >= 2 ? Math.round((d - 1) * 100) : Math.round(-100 / (d - 1)));
export const fromProb = (p) => (p >= 0.5 ? Math.round((-100 * p) / (1 - p)) : Math.round((100 * (1 - p)) / p));
export const profit = (stake, a) => (a > 0 ? (stake * a) / 100 : (stake * 100) / -a);

// Two-way market with the bookmaker margin removed.
export const noVig = (a, b) => {
  const pa = implied(a), pb = implied(b);
  if (pa == null || pb == null) return null;
  return [pa / (pa + pb), pb / (pa + pb)];
};

export const fmtOdds = (a) => (a == null ? "—" : a > 0 ? `+${a}` : `${a}`);
export const fmtLine = (p) => (p == null ? "—" : p > 0 ? `+${p}` : p === 0 ? "PK" : `${p}`);

export const median = (xs) => {
  const v = xs.filter((x) => x != null && !Number.isNaN(x)).sort((a, b) => a - b);
  if (!v.length) return null;
  const m = Math.floor(v.length / 2);
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
};

// Market consensus across books: median line and median price.
export function consensus(books) {
  // Nearest half point, rounding symmetrically so home and away lines mirror.
  const r = (x) => (x == null ? null : (Math.sign(x) * Math.round(Math.abs(x) * 2)) / 2);
  const rp = (x) => (x == null ? null : Math.round(x));
  return {
    spreadHome: r(median(books.map((b) => b.spread?.home?.point))),
    spreadHomePrice: rp(median(books.map((b) => b.spread?.home?.price))),
    spreadAwayPrice: rp(median(books.map((b) => b.spread?.away?.price))),
    total: r(median(books.map((b) => b.total?.over?.point))),
    overPrice: rp(median(books.map((b) => b.total?.over?.price))),
    underPrice: rp(median(books.map((b) => b.total?.under?.price))),
    mlHome: rp(median(books.map((b) => b.ml?.home))),
    mlAway: rp(median(books.map((b) => b.ml?.away))),
  };
}

// Best available number for one side. "Better" means more points for the bettor,
// then the better price at that number.
export function best(books, market, side) {
  let top = null;
  for (const b of books) {
    if (market === "ml") {
      const price = b.ml?.[side];
      if (price != null && (!top || price > top.price)) top = { book: b.title, price, point: null };
      continue;
    }
    const o = b[market]?.[side];
    if (!o || o.point == null || o.price == null) continue;
    const gain = market === "total" && side === "over" ? -o.point : o.point;
    const topGain = top && (market === "total" && side === "over" ? -top.point : top.point);
    if (!top || gain > topGain || (gain === topGain && o.price > top.price)) top = { book: b.title, price: o.price, point: o.point };
  }
  return top;
}

// Grade a bet against a final score. Returns "win" | "loss" | "push" | null.
export function grade(bet, game) {
  if (!game) return null;
  const pts = { [game.away]: game.awayPts, [game.home]: game.homePts };
  const sign = (x) => (x > 0 ? "win" : x < 0 ? "loss" : "push");
  if (bet.market === "total") {
    const diff = game.awayPts + game.homePts - bet.line;
    return sign(bet.pick === "over" ? diff : -diff);
  }
  const opp = bet.pick === game.home ? game.away : game.home;
  if (pts[bet.pick] == null) return null;
  const margin = pts[bet.pick] - pts[opp];
  return sign(bet.market === "spread" ? margin + bet.line : margin);
}

// Closing line value: how much better the bet's number was than the close.
export function clv(bet, close) {
  if (!close) return null;
  if (bet.market === "spread") {
    if (close.spreadHome == null) return null;
    const c = bet.pick === bet.home ? close.spreadHome : -close.spreadHome;
    return { value: bet.line - c, unit: "pts" };
  }
  if (bet.market === "total") {
    if (close.total == null) return null;
    return { value: bet.pick === "over" ? close.total - bet.line : bet.line - close.total, unit: "pts" };
  }
  const c = bet.pick === bet.home ? close.mlHome : close.mlAway;
  if (c == null) return null;
  return { value: +((implied(c) - implied(bet.odds)) * 100).toFixed(1), unit: "%" };
}
