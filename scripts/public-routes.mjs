// Routes the public site was 404ing: /feed, /try/, /app/.
// Cloudflare assets have no SPA fallback, so each path needs a real file.
// The Feed is the morning pulse. Banned market-hype words are rewritten
// on the way out so a data-repo page cannot put them back on the public URL.
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

export function neutralizeCopy(html) {
  return String(html)
    .replaceAll("Buy Pressure", "Demand")
    .replaceAll("buy pressure", "demand")
    .replaceAll("BULLISH", "HEAT")
    .replaceAll("Bullish", "Heat")
    .replaceAll("bullish", "heat");
}

const ROUTE_FILES = [
  "feed.html",
  "feed/index.html",
  "try.html",
  "try/index.html",
  "app.html",
  "app/index.html",
];

const FALLBACK = `<!doctype html>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Catch'em — The Feed</title>
<link rel="canonical" href="https://catchemtcg.com/feed">
<main style="font:18px/1.5 system-ui,sans-serif;max-width:40rem;margin:3rem auto;padding:0 1rem">
<h1>The Feed</h1>
<p>Sealed and singles, kept apart. Calls we track until they hit or miss.</p>
<p><a href="https://discord.gg/fUSjxDX4Hy">Discord Premium is $14.99/mo. Join Discord.</a></p>
</main>
`;

export async function writePublicRoutes(outDir) {
  for (const name of ["index.html", "pulse.html", "methodology.html", "board.html"]) {
    const path = join(outDir, name);
    let raw;
    try { raw = await readFile(path, "utf8"); } catch { continue; }
    const next = neutralizeCopy(raw);
    if (next !== raw) await writeFile(path, next);
  }
  let feed;
  try { feed = await readFile(join(outDir, "pulse.html"), "utf8"); } catch { feed = FALLBACK; }
  feed = neutralizeCopy(feed);
  for (const rel of ROUTE_FILES) {
    const path = join(outDir, rel);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, feed);
  }
  return ROUTE_FILES;
}
