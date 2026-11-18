// Pulls MFFL data from MyFantasyLeague's public export API into data/mfl/.
//
//   npm run sync            -> fetch anything missing + refresh the current season
//   npm run sync -- --all   -> refetch every season from scratch
//
// MFL asks API clients to go slowly (about 1 request per second), cache results,
// and not retry failed requests. Finished seasons are fetched once and then kept.

import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import YAML from "yaml";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/, "$1")), "..");
const DATA = path.join(ROOT, "data", "mfl");
const LOGO_DIR = path.join(ROOT, "public", "mfl-logos");
const UA = "mffl-site-sync/1.0";
// MFL rate-limited us at ~1 request/second, so go slower. Override with MFL_DELAY_MS.
const DELAY_MS = Number(process.env.MFL_DELAY_MS ?? 4000);
const REFETCH_ALL = process.argv.includes("--all");

const site = YAML.parse(await fs.readFile(path.join(ROOT, "content", "site.yaml"), "utf8"));
const LEAGUE_ID = String(site.mflLeagueId);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let lastRequest = 0;
async function getJSON(year, type, params = {}) {
  const wait = lastRequest + DELAY_MS - Date.now();
  if (wait > 0) await sleep(wait);
  lastRequest = Date.now();
  const q = new URLSearchParams({ TYPE: type, ...params, JSON: "1" });
  const url = `https://api.myfantasyleague.com/${year}/export?${q}`;
  const tryFetch = async () => {
    // Network hiccups: wait 30 seconds and try again, up to 3 times.
    for (let i = 0; ; i++) {
      try { return await fetch(url, { headers: { "User-Agent": UA }, redirect: "follow" }); }
      catch (e) { if (i >= 2) throw e; console.log(`  network error (${e.message}); retrying in 30s`); await sleep(30_000); }
    }
  };
  let res = await tryFetch();
  // If MFL says slow down, wait it out (5 minutes at a time, up to an hour).
  for (let tries = 0; (res.status === 429 || res.status === 503) && tries < 12; tries++) {
    console.log(`  MFL asked us to slow down; waiting 5 minutes (${tries + 1}/12)...`);
    await sleep(300_000);
    lastRequest = Date.now();
    res = await tryFetch();
  }
  if (res.status === 429) throw new Error("MFL rate limit reached (HTTP 429). Stopping; run again later.");
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  const body = await res.json();
  if (body.error) throw new Error(`MFL error for ${type} ${year}: ${body.error.$t ?? JSON.stringify(body.error)}`);
  return body;
}

const arr = (x) => (x == null ? [] : Array.isArray(x) ? x : [x]);
const exists = (p) => fs.access(p).then(() => true, () => false);
const writeJSON = async (p, v) => {
  await fs.mkdir(path.dirname(p), { recursive: true });
  await fs.writeFile(p, JSON.stringify(v, null, 1) + "\n");
};

// ---------- logos ----------
const logoMapPath = path.join(DATA, "logos.json");
const logoMap = (await exists(logoMapPath)) ? JSON.parse(await fs.readFile(logoMapPath, "utf8")) : {};
async function saveLogo(url) {
  if (!url) return null;
  url = url.replace(/^http:\/\//, "https://");
  if (logoMap[url] !== undefined) return logoMap[url];
  const ext = (url.split("?")[0].match(/\.(png|jpe?g|gif|webp|svg)$/i)?.[1] ?? "png").toLowerCase();
  const file = crypto.createHash("sha1").update(url).digest("hex").slice(0, 16) + "." + ext;
  try {
    const wait = lastRequest + 300 - Date.now();
    if (wait > 0) await sleep(wait);
    lastRequest = Date.now();
    const res = await fetch(url, { headers: { "User-Agent": UA } });
    if (!res.ok || !/^image\//.test(res.headers.get("content-type") ?? "")) throw new Error(`HTTP ${res.status}`);
    await fs.mkdir(LOGO_DIR, { recursive: true });
    await fs.writeFile(path.join(LOGO_DIR, file), Buffer.from(await res.arrayBuffer()));
    logoMap[url] = `/mfl-logos/${file}`;
  } catch (e) {
    console.warn(`  logo skipped (${e.message}): ${url}`);
    logoMap[url] = null;
  }
  return logoMap[url];
}

// ---------- seasons ----------
function normalizeLeague(year, raw) {
  const L = raw.league;
  const divisions = Object.fromEntries(arr(L.divisions?.division).map((d) => [d.id, d.name]));
  return {
    year,
    leagueId: L.id,
    name: L.name,
    startWeek: Number(L.startWeek ?? 1),
    endWeek: Number(L.endWeek ?? 17),
    lastRegularSeasonWeek: Number(L.lastRegularSeasonWeek ?? 13),
    divisions,
    franchises: arr(L.franchises?.franchise).map((f) => ({
      id: f.id,
      name: (f.name ?? "").trim(),
      division: f.division ?? null,
      logoUrl: f.logo ?? null,
      iconUrl: f.icon ?? null,
    })),
  };
}

function normalizeWeek(week, raw) {
  const matchups = [];
  let playersSeen = 0;
  let playersLeft = 0;
  let anyPoints = false;
  const side = (f) => {
    for (const p of arr(f.players?.player)) {
      playersSeen++;
      if (Number(p.gameSecondsRemaining ?? 0) > 0) playersLeft++;
    }
    const score = Number(f.score ?? 0);
    if (score > 0) anyPoints = true;
    return { id: f.id, score };
  };
  for (const m of arr(raw.liveScoring?.matchup)) {
    const sides = arr(m.franchise).map(side);
    if (sides.length === 2) matchups.push(sides);
  }
  // Some early seasons have no head-to-head schedule on MFL, only each team's score.
  const scores = arr(raw.liveScoring?.franchise).map(side);
  // A week is final once every rostered player's game is over and points exist.
  const final = anyPoints && (playersSeen === 0 || playersLeft === 0);
  return { week, final, matchups, ...(scores.length ? { scores } : {}) };
}

async function main() {
  // Find the current season: try this calendar year, fall back to last year.
  const thisYear = new Date().getFullYear();
  let currentYear = thisYear;
  let currentRaw;
  try {
    currentRaw = await getJSON(thisYear, "league", { L: LEAGUE_ID });
  } catch {
    currentYear = thisYear - 1;
    currentRaw = await getJSON(currentYear, "league", { L: LEAGUE_ID });
  }
  const history = arr(currentRaw.league.history?.league)
    .map((h) => ({ year: Number(h.year), leagueId: h.url.match(/\/home\/(\d+)/)?.[1] }))
    .filter((h) => h.leagueId)
    .sort((a, b) => a.year - b.year);
  console.log(`MFFL on MFL: ${history.length} seasons (${history[0].year}–${history.at(-1).year}), current ${currentYear}`);

  const seasons = [];
  for (const { year, leagueId } of history) {
    const dir = path.join(DATA, String(year));
    const leaguePath = path.join(dir, "league.json");
    const isCurrent = year === currentYear;
    let league;
    if (!REFETCH_ALL && !isCurrent && (await exists(leaguePath))) {
      league = JSON.parse(await fs.readFile(leaguePath, "utf8"));
    } else {
      const raw = year === currentYear && leagueId === LEAGUE_ID ? currentRaw : await getJSON(year, "league", { L: leagueId });
      league = normalizeLeague(year, raw);
      for (const f of league.franchises) {
        f.logo = await saveLogo(f.logoUrl);
        f.icon = await saveLogo(f.iconUrl);
      }
      await writeJSON(leaguePath, league);
    }

    let weeksDone = 0;
    let weeksFetched = 0;
    for (let w = league.startWeek; w <= league.endWeek; w++) {
      const weekPath = path.join(dir, `week-${String(w).padStart(2, "0")}.json`);
      if (!REFETCH_ALL && (await exists(weekPath))) {
        const saved = JSON.parse(await fs.readFile(weekPath, "utf8"));
        if (saved.final) { weeksDone++; continue; }
      }
      const raw = await getJSON(year, "liveScoring", { L: leagueId, W: String(w) });
      const wk = normalizeWeek(w, raw);
      weeksFetched++;
      if (wk.matchups.length === 0 && !wk.scores && !wk.final) {
        // Future week in the current season: nothing to keep yet.
        if (isCurrent) break;
        // A past season with no games that week: remember it so we don't ask again.
        await writeJSON(weekPath, { week: w, final: true, empty: true, matchups: [] });
        continue;
      }
      await writeJSON(weekPath, wk);
      if (wk.final) weeksDone++;
      else if (isCurrent) break; // in progress; later weeks haven't started
    }
    console.log(`  ${year}: ${league.franchises.length} teams, ${weeksDone} final weeks (${weeksFetched} fetched)`);
    seasons.push({ year, leagueId, current: isCurrent });
  }

  await writeJSON(path.join(DATA, "seasons.json"), { updated: new Date().toISOString(), currentYear, seasons });
  await writeJSON(logoMapPath, logoMap);
  console.log("Done.");
}

main().catch(async (e) => {
  await writeJSON(logoMapPath, logoMap).catch(() => {});
  console.error(e.message);
  process.exit(1);
});
