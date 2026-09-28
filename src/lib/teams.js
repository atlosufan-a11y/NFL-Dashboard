export const TEAMS = {
  ARI: { name: "Arizona Cardinals", conf: "NFC", div: "West" },
  ATL: { name: "Atlanta Falcons", conf: "NFC", div: "South" },
  BAL: { name: "Baltimore Ravens", conf: "AFC", div: "North" },
  BUF: { name: "Buffalo Bills", conf: "AFC", div: "East" },
  CAR: { name: "Carolina Panthers", conf: "NFC", div: "South" },
  CHI: { name: "Chicago Bears", conf: "NFC", div: "North" },
  CIN: { name: "Cincinnati Bengals", conf: "AFC", div: "North" },
  CLE: { name: "Cleveland Browns", conf: "AFC", div: "North" },
  DAL: { name: "Dallas Cowboys", conf: "NFC", div: "East" },
  DEN: { name: "Denver Broncos", conf: "AFC", div: "West" },
  DET: { name: "Detroit Lions", conf: "NFC", div: "North" },
  GB: { name: "Green Bay Packers", conf: "NFC", div: "North" },
  HOU: { name: "Houston Texans", conf: "AFC", div: "South" },
  IND: { name: "Indianapolis Colts", conf: "AFC", div: "South" },
  JAC: { name: "Jacksonville Jaguars", conf: "AFC", div: "South" },
  KC: { name: "Kansas City Chiefs", conf: "AFC", div: "West" },
  LA: { name: "Los Angeles Rams", conf: "NFC", div: "West" },
  LAC: { name: "Los Angeles Chargers", conf: "AFC", div: "West" },
  LV: { name: "Las Vegas Raiders", conf: "AFC", div: "West" },
  MIA: { name: "Miami Dolphins", conf: "AFC", div: "East" },
  MIN: { name: "Minnesota Vikings", conf: "NFC", div: "North" },
  NE: { name: "New England Patriots", conf: "AFC", div: "East" },
  NO: { name: "New Orleans Saints", conf: "NFC", div: "South" },
  NYG: { name: "New York Giants", conf: "NFC", div: "East" },
  NYJ: { name: "New York Jets", conf: "AFC", div: "East" },
  PHI: { name: "Philadelphia Eagles", conf: "NFC", div: "East" },
  PIT: { name: "Pittsburgh Steelers", conf: "AFC", div: "North" },
  SEA: { name: "Seattle Seahawks", conf: "NFC", div: "West" },
  SF: { name: "San Francisco 49ers", conf: "NFC", div: "West" },
  TB: { name: "Tampa Bay Buccaneers", conf: "NFC", div: "South" },
  TEN: { name: "Tennessee Titans", conf: "AFC", div: "South" },
  WAS: { name: "Washington Commanders", conf: "NFC", div: "East" },
};

export const ABBRS = Object.keys(TEAMS).sort();

// ESPN uses a few different abbreviations than this dashboard.
const ESPN_ALIASES = { JAX: "JAC", LAR: "LA", WSH: "WAS" };
export const fromEspn = (abbr) => {
  const a = ESPN_ALIASES[abbr] || abbr;
  return TEAMS[a] ? a : null;
};

const BY_NAME = Object.fromEntries(Object.entries(TEAMS).map(([a, t]) => [t.name.toLowerCase(), a]));
export const fromName = (name) => BY_NAME[String(name).toLowerCase()] || null;

// Calendar date of a kickoff in US Eastern time, e.g. "2026-09-28".
export const etDate = (iso) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" })
    .format(new Date(iso));

// Stable key shared by scores, odds, closing lines and bets.
export const matchKey = (away, home, date) => `${away}@${home}:${date}`;
