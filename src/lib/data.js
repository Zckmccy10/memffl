// Build-time data layer. Combines the MFL data in data/mfl/ with the hand-written
// content in content/ (team colors, owners, season finishes, recaps).
import fs from "node:fs";
import path from "node:path";
import YAML from "yaml";
import { marked } from "marked";

const ROOT = process.cwd();
const MFL = path.join(ROOT, "data", "mfl");
const CONTENT = path.join(ROOT, "content");

const readJSON = (p) => JSON.parse(fs.readFileSync(p, "utf8"));
const readYAML = (p) => (fs.existsSync(p) ? YAML.parse(fs.readFileSync(p, "utf8")) ?? {} : {});
export const slugify = (s) =>
  String(s).toLowerCase().replace(/['’]/g, "").replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const round2 = (n) => Math.round(n * 100) / 100;

// Fallback colors for teams that have none in content/teams.yaml.
const PALETTE = [
  ["#2f57c4", "#ffd23f"], ["#c0272d", "#1b1b1b"], ["#1f8a9e", "#0f2f45"], ["#6b3fa0", "#f2c230"],
  ["#2e9e4f", "#17181c"], ["#d99a26", "#24365e"], ["#23415c", "#4fc3c9"], ["#9e1b32", "#c7ccd4"],
];

let cache;
export function getData() {
  if (cache) return cache;

  const site = readYAML(path.join(CONTENT, "site.yaml"));
  // teams.yaml and seasons.yaml are lists (so the admin page can edit them); key them here.
  const teamsCfg = {};
  for (const t of readYAML(path.join(CONTENT, "teams.yaml")).teams ?? []) {
    if (!t?.name) continue;
    const colors = t.colors?.primary ? [t.colors.primary, t.colors.secondary ?? t.colors.primary] : null;
    teamsCfg[t.name] = { ...t, colors, aliases: t.aliases ?? [] };
  }
  const ownersCfg = readYAML(path.join(CONTENT, "owners.yaml")).owners ?? [];
  const finishesRaw = readYAML(path.join(CONTENT, "seasons.yaml")).seasons ?? [];
  const finishesCfg = Array.isArray(finishesRaw) ? Object.fromEntries(finishesRaw.map((s) => [s.year, s])) : finishesRaw;
  const meta = readJSON(path.join(MFL, "seasons.json"));

  // ----- alias map: any listed alias (or the name itself) -> canonical team name
  const aliasToName = {};
  for (const [name, cfg] of Object.entries(teamsCfg)) {
    aliasToName[slugify(name)] = name;
    for (const a of cfg.aliases) aliasToName[slugify(typeof a === "string" ? a : a?.name ?? "")] = name;
  }
  const canonical = (name) => aliasToName[slugify(name)] ?? name;

  // ----- seasons, franchises and games
  const seasons = [];
  const games = [];
  const solo = [];
  const franchiseYear = {}; // `${year}:${fid}` -> { name, logo, division }
  for (const { year } of meta.seasons) {
    const dir = path.join(MFL, String(year));
    if (!fs.existsSync(path.join(dir, "league.json"))) continue;
    const league = readJSON(path.join(dir, "league.json"));
    for (const f of league.franchises) {
      franchiseYear[`${year}:${f.id}`] = {
        name: canonical(f.name || `Team ${f.id}`),
        rawName: f.name,
        logo: f.logo || f.icon || null,
        icon: f.icon || f.logo || null,
        division: f.division ? league.divisions[f.division] ?? null : null,
      };
    }
    const weeks = [];
    for (const file of fs.readdirSync(dir).filter((x) => /^week-\d+\.json$/.test(x)).sort()) {
      const wk = readJSON(path.join(dir, file));
      if (!wk.final || wk.empty) continue;
      if (!wk.matchups.length && !wk.scores?.length) continue;
      weeks.push(wk.week);
      if (!wk.matchups.length) {
        // Scores-only week (no head-to-head schedule on MFL that season).
        for (const s of wk.scores) {
          if (franchiseYear[`${year}:${s.id}`]) solo.push({ year, week: wk.week, playoff: wk.week > league.lastRegularSeasonWeek, fid: s.id, score: s.score });
        }
        continue;
      }
      wk.matchups.forEach(([a, b], i) => {
        if (!franchiseYear[`${year}:${a.id}`] || !franchiseYear[`${year}:${b.id}`]) return;
        games.push({
          year, week: wk.week, order: i,
          playoff: wk.week > league.lastRegularSeasonWeek,
          a: { fid: a.id, score: a.score },
          b: { fid: b.id, score: b.score },
        });
      });
    }
    seasons.push({ ...league, weeks, current: year === meta.currentYear });
  }
  const seasonByYear = Object.fromEntries(seasons.map((s) => [s.year, s]));
  const lastSeason = seasons.at(-1);

  // ----- teams: one per (franchise, canonical name)
  // Group seasons by (franchise slot, name), then hand out URL slugs. When two
  // slots used the same name, the most recent one gets the plain slug and older
  // ones get the year they started (e.g. /teams/hackers-2008/).
  const groups = {};
  for (const s of seasons) {
    for (const f of s.franchises) {
      const fy = franchiseYear[`${s.year}:${f.id}`];
      const g = (groups[`${f.id}:${fy.name}`] ??= { name: fy.name, franchiseId: f.id, years: [] });
      g.years.push(s.year);
      g.mflLogo = fy.logo ?? g.mflLogo; // latest season wins
      g.mflIcon = fy.icon ?? g.mflIcon;
      g.division = fy.division;
    }
  }
  const teams = {};
  const teamKeyByFY = {};
  const byName = {};
  for (const g of Object.values(groups)) (byName[slugify(g.name)] ??= []).push(g);
  for (const [base, list] of Object.entries(byName)) {
    list.sort((a, b) => Math.max(...b.years) - Math.max(...a.years));
    list.forEach((g, i) => {
      const slug = i === 0 ? base : `${base}-${Math.min(...g.years)}`;
      teams[slug] = { slug, ...g };
      for (const y of g.years) teamKeyByFY[`${y}:${g.franchiseId}`] = slug;
    });
  }
  const teamList = Object.values(teams);
  teamList.forEach((t, i) => {
    const cfg = teamsCfg[t.name] ?? {};
    t.first = Math.min(...t.years);
    t.last = Math.max(...t.years);
    t.active = t.last === lastSeason.year;
    t.colors = cfg.colors ?? PALETTE[i % PALETTE.length];
    t.logo = cfg.logo ?? t.mflLogo ?? null;
    t.icon = cfg.icon ?? t.mflIcon ?? t.logo;
    t.jersey = cfg.jersey ?? String(t.first).slice(-2);
    t.standingsNote = cfg.standingsNote ?? null;
    t.note = cfg.note ?? null;
    t.abbr = cfg.abbr ?? t.name.replace(/['’]/g, "").split(/[\s-]+/).filter(Boolean).map((w) => w[0]).join("").slice(0, 3).toUpperCase();
  });
  const teamOf = (year, fid) => teams[teamKeyByFY[`${year}:${fid}`]];
  for (const g of games) {
    g.a.team = teamOf(g.year, g.a.fid);
    g.b.team = teamOf(g.year, g.b.fid);
    g.winner = g.a.score === g.b.score ? null : g.a.score > g.b.score ? g.a : g.b;
    g.loser = g.winner ? (g.winner === g.a ? g.b : g.a) : null;
    g.margin = round2(Math.abs(g.a.score - g.b.score));
  }
  for (const s of solo) s.team = teamOf(s.year, s.fid);
  // Every team-week score, with or without an opponent.
  const scores = [
    ...games.flatMap((g) => [g.a, g.b].map((s) => ({ year: g.year, week: g.week, playoff: g.playoff, fid: s.fid, team: s.team, score: s.score, game: g }))),
    ...solo.map((s) => ({ ...s, game: null })),
  ];

  // ----- season finishes (content/seasons.yaml) and playoff game labels
  const findTeam = (year, name) => {
    if (!name) return null;
    const c = canonical(name);
    return teamList.find((t) => t.name === c && t.years.includes(year)) ?? null;
  };
  const finishes = {};
  for (const s of seasons) {
    const cfg = finishesCfg[s.year] ?? finishesCfg[String(s.year)] ?? {};
    finishes[s.year] = {
      champion: findTeam(s.year, cfg.champion),
      runnerUp: findTeam(s.year, cfg.runnerUp),
      third: findTeam(s.year, cfg.third),
      toiletBowl: findTeam(s.year, cfg.toiletBowl),
    };
    const f = finishes[s.year];
    const lastWeek = s.weeks.at(-1);
    for (const g of games.filter((x) => x.year === s.year && x.playoff)) {
      const has = (t) => t && (g.a.team === t || g.b.team === t);
      if (g.week === lastWeek && has(f.champion) && has(f.runnerUp)) g.label = "Championship";
      else if (g.week === lastWeek && has(f.third)) g.label = "3rd Place";
      else if (g.week === lastWeek && has(f.toiletBowl)) g.label = "Toilet Bowl";
      else g.label = "Playoffs";
    }
  }

  // ----- owners
  const owners = ownersCfg
    .filter((o) => o?.name)
    .map((o) => {
      const stints = (o.franchises ?? []).map((s) => ({ fid: String(s.id).padStart(4, "0"), from: Number(s.from), to: s.to ? Number(s.to) : 9999 }));
      return { slug: slugify(o.name), name: o.name, photo: o.photo ?? null, note: o.note ?? null, stints };
    });
  const ownerOf = (year, fid) => owners.find((o) => o.stints.some((s) => s.fid === fid && year >= s.from && year <= s.to)) ?? null;
  for (const t of teamList) t.owner = ownerOf(t.last, t.franchiseId);
  for (const o of owners) {
    o.teams = teamList.filter((t) => t.years.some((y) => ownerOf(y, t.franchiseId) === o)).sort((a, b) => b.last - a.last);
    o.years = [...new Set(o.teams.flatMap((t) => t.years.filter((y) => ownerOf(y, t.franchiseId) === o)))].sort();
    o.since = o.years[0];
  }

  // ----- recaps
  const recaps = {};
  const recapDir = path.join(CONTENT, "recaps");
  const walk = (d) => (fs.existsSync(d) ? fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)])) : []);
  for (const file of walk(recapDir).filter((f) => f.endsWith(".md"))) {
    const raw = fs.readFileSync(file, "utf8");
    const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
    const fm = m ? YAML.parse(m[1]) ?? {} : {};
    const body = m ? m[2] : raw;
    if (!fm.season || !fm.week) continue;
    recaps[`${fm.season}:${fm.week}`] = { ...fm, html: marked.parse(body.trim()) };
  }

  cache = { site, seasons, seasonByYear, lastSeason, games, scores, teams, teamList, owners, finishes, recaps, ownerOf, teamOf, updated: meta.updated };
  return cache;
}

// ---------- stats helpers ----------
export function record(games, isMine) {
  let w = 0, l = 0, t = 0, pf = 0, pa = 0, high = null, low = null;
  for (const g of games) {
    const me = isMine(g.a) ? g.a : g.b;
    const them = me === g.a ? g.b : g.a;
    pf += me.score; pa += them.score;
    if (me.score > them.score) w++; else if (me.score < them.score) l++; else t++;
    if (!high || me.score > high.score) high = { score: me.score, game: g };
    if (!low || me.score < low.score) low = { score: me.score, game: g };
  }
  const gp = w + l + t;
  return { w, l, t, gp, pct: gp ? (w + t / 2) / gp : 0, pf: round2(pf), pa: round2(pa), diff: round2(pf - pa), ppg: gp ? round2(pf / gp) : 0, high, low };
}

// Points stats from team-week scores (includes weeks with no opponent on MFL).
export function points(list) {
  let pf = 0, high = null, low = null;
  for (const s of list) {
    pf += s.score;
    if (!high || s.score > high.score) high = s;
    if (s.score > 0 && (!low || s.score < low.score)) low = s;
  }
  return { pf: round2(pf), n: list.length, ppg: list.length ? round2(pf / list.length) : 0, high, low };
}

export const gamesFor =(games, pred) => games.filter((g) => pred(g.a) || pred(g.b));
export const sideOf = (g, pred) => (pred(g.a) ? g.a : g.b);
export const otherSide = (g, pred) => (pred(g.a) ? g.b : g.a);

export function weeklyAwards(weekGames) {
  const decided = weekGames.filter((g) => g.winner);
  if (!decided.length) return [];
  const sides = weekGames.flatMap((g) => [g.a, g.b]);
  const by = (list, f, dir) => list.reduce((best, x) => (best == null || (dir > 0 ? f(x) > f(best) : f(x) < f(best)) ? x : best), null);
  const blow = by(decided, (g) => g.margin, 1);
  const narrow = by(decided, (g) => g.margin, -1);
  const hi = by(sides, (s) => s.score, 1);
  const lo = by(sides, (s) => s.score, -1);
  const loWin = by(decided.map((g) => g.winner), (s) => s.score, -1);
  const hiLoss = by(decided.map((g) => g.loser), (s) => s.score, 1);
  const f = (n) => n.toFixed(2);
  return [
    { key: "Biggest Blowout", team: blow.winner.team, text: `${blow.winner.team.name} won by ${f(blow.margin)}` },
    { key: "Highest Score", team: hi.team, text: `${hi.team.name}, ${f(hi.score)}` },
    { key: "Lowest Score in a Win", team: loWin.team, text: `${loWin.team.name}, ${f(loWin.score)}` },
    { key: "Narrowest Win", team: narrow.winner.team, text: `${narrow.winner.team.name} by ${f(narrow.margin)}` },
    { key: "Lowest Score", team: lo.team, text: `${lo.team.name}, ${f(lo.score)}` },
    { key: "Highest Score in a Loss", team: hiLoss.team, text: `${hiLoss.team.name}, ${f(hiLoss.score)}` },
  ];
}

// Trophy-case finishes for any set of (team, year) pairs. `has(team, year)` -> boolean
export function finishesFor(has) {
  const { finishes } = getData();
  const out = { titles: [], runnerUp: [], third: [], toilet: [] };
  for (const [y, f] of Object.entries(finishes)) {
    const year = Number(y);
    if (f.champion && has(f.champion, year)) out.titles.push(year);
    if (f.runnerUp && has(f.runnerUp, year)) out.runnerUp.push(year);
    if (f.third && has(f.third, year)) out.third.push(year);
    if (f.toiletBowl && has(f.toiletBowl, year)) out.toilet.push(year);
  }
  return out;
}

// Latest week that has final scores, as { year, week }.
export function latestWeek() {
  const { games } = getData();
  const last = games.reduce((a, g) => (!a || g.year > a.year || (g.year === a.year && g.week > a.week) ? g : a), null);
  return last ? { year: last.year, week: last.week } : null;
}

// Regular-season standings for one season through a given week, grouped by division.
export function divisionStandings(year, throughWeek) {
  const { games, seasonByYear, teamOf } = getData();
  const season = seasonByYear[year];
  const regular = games.filter((g) => g.year === year && !g.playoff && g.week <= throughWeek);
  const rows = season.franchises.map((f) => {
    const team = teamOf(year, f.id);
    const r = record(gamesFor(regular, (s) => s.fid === f.id), (s) => s.fid === f.id);
    return { team, r, division: f.division ? season.divisions[f.division] ?? "League" : "League" };
  });
  const groups = {};
  for (const row of rows) (groups[row.division] ??= []).push(row);
  for (const list of Object.values(groups)) list.sort((a, b) => b.r.pct - a.r.pct || b.r.pf - a.r.pf);
  return groups;
}

export const fmt = (n) => Number(n).toFixed(2);
export const fmt1 = (n) => Number(n).toFixed(1);
export const pctStr = (p) => (p * 100).toFixed(1) + "%";
export const recStr = (r) => `${r.w}–${r.l}${r.t ? "–" + r.t : ""}`;
