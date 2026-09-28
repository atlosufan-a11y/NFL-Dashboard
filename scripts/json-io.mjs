import fs from "node:fs";

// One record per line keeps the automated data commits easy to diff.
const rows = (arr, pad = "") => arr.length ? `[\n${arr.map((r) => pad + "  " + JSON.stringify(r)).join(",\n")}\n${pad}]` : "[]";

export function format(value) {
  if (Array.isArray(value)) return rows(value);
  if (value && typeof value === "object") {
    const body = Object.entries(value).map(([k, v]) =>
      `  ${JSON.stringify(k)}: ${Array.isArray(v) ? rows(v, "  ") : JSON.stringify(v)}`);
    return `{\n${body.join(",\n")}\n}`;
  }
  return JSON.stringify(value);
}

export const readJson = (file, fallback) => {
  try { return JSON.parse(fs.readFileSync(file, "utf8")); } catch { return fallback; }
};

// Writes only when the content changed; returns whether it did.
export const writeJson = (file, value) => {
  const next = format(value) + "\n";
  let prev = null;
  try { prev = fs.readFileSync(file, "utf8"); } catch { /* new file */ }
  if (prev === next) return false;
  fs.writeFileSync(file, next);
  return true;
};
