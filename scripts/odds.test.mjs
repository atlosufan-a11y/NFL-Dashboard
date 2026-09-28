import { test } from "node:test";
import assert from "node:assert/strict";
import { implied, noVig, fromProb, profit, best, grade, clv, consensus } from "../src/lib/odds.js";

const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} != ${b}`);

test("price conversions", () => {
  close(implied(-110), 110 / 210);
  close(implied(150), 0.4);
  assert.equal(fromProb(0.6), -150);
  assert.equal(fromProb(0.4), 150);
  close(profit(10, -110), 100 / 11);
  close(profit(10, 250), 25);
  const [a, b] = noVig(-110, -110);
  close(a, 0.5); close(b, 0.5);
});

const books = [
  { title: "A", spread: { home: { point: -3, price: -110 }, away: { point: 3, price: -110 } }, total: { over: { point: 44.5, price: -110 }, under: { point: 44.5, price: -110 } }, ml: { home: -150, away: 130 } },
  { title: "B", spread: { home: { point: -2.5, price: -120 }, away: { point: 2.5, price: 100 } }, total: { over: { point: 44, price: -115 }, under: { point: 44, price: -105 } }, ml: { home: -140, away: 125 } },
];

test("best price picks the most favorable number, then price", () => {
  assert.deepEqual(best(books, "spread", "home"), { book: "B", price: -120, point: -2.5 });
  assert.deepEqual(best(books, "spread", "away"), { book: "A", price: -110, point: 3 });
  assert.deepEqual(best(books, "total", "over"), { book: "B", price: -115, point: 44 });
  assert.deepEqual(best(books, "total", "under"), { book: "A", price: -110, point: 44.5 });
  assert.deepEqual(best(books, "ml", "away"), { book: "A", price: 130, point: null });
});

test("consensus uses medians", () => {
  const c = consensus(books);
  assert.equal(c.spreadHome, -3); // -2.75 rounds to the nearest half point
  assert.equal(c.mlHome, -145);
});

const game = { away: "PIT", home: "CLE", awayPts: 20, homePts: 17 };
const bet = (b) => ({ away: "PIT", home: "CLE", ...b });

test("grading", () => {
  assert.equal(grade(bet({ market: "ml", pick: "PIT" }), game), "win");
  assert.equal(grade(bet({ market: "ml", pick: "CLE" }), game), "loss");
  assert.equal(grade(bet({ market: "spread", pick: "PIT", line: -3 }), game), "push");
  assert.equal(grade(bet({ market: "spread", pick: "CLE", line: 3.5 }), game), "win");
  assert.equal(grade(bet({ market: "spread", pick: "PIT", line: -3.5 }), game), "loss");
  assert.equal(grade(bet({ market: "total", pick: "over", line: 36.5 }), game), "win");
  assert.equal(grade(bet({ market: "total", pick: "under", line: 37 }), game), "push");
  assert.equal(grade(bet({ market: "ml", pick: "PIT" }), undefined), null);
});

test("closing line value", () => {
  const c = { spreadHome: -4, total: 45, mlHome: -170, mlAway: 150 };
  assert.deepEqual(clv(bet({ market: "spread", pick: "CLE", line: -3 }), c), { value: 1, unit: "pts" });
  assert.deepEqual(clv(bet({ market: "spread", pick: "PIT", line: 3 }), c), { value: -1, unit: "pts" });
  assert.deepEqual(clv(bet({ market: "total", pick: "over", line: 43.5 }), c), { value: 1.5, unit: "pts" });
  assert.deepEqual(clv(bet({ market: "ml", pick: "CLE", odds: -150 }), c), { value: 3, unit: "%" });
  assert.equal(clv(bet({ market: "ml", pick: "CLE", odds: -150 }), undefined), null);
});
