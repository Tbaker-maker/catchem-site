// Routes the public site was 404ing: /feed, /try/, /app/.
// Cloudflare assets have no SPA fallback, so each path needs a real file.
// The Feed is the morning pulse. Banned market-hype words are rewritten
// on the way out so a data-repo page cannot put them back on the public URL.
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { ensureAffiliation } from "../src/affiliation.mjs";

export function neutralizeCopy(html) {
  return String(html)
    .replaceAll("Buy Pressure", "Demand")
    .replaceAll("buy pressure", "demand")
    .replaceAll("BULLISH", "HEAT")
    .replaceAll("Bullish", "HEAT")
    .replaceAll("bullish", "HEAT");
}

export function hidePublishedNotes(html) {
  let out = String(html || "");
  out = out.replace(/<h2>\s*Correction log\s*<\/h2>[\s\S]*?(?=<h2\b|<div class="foot"|$)/gi, "");
  out = out.replace(/<div class="c">[\s\S]*?<\/div>/gi, (block) => {
    if (/AFFECTED A PUBLISHED NUMBER/i.test(block)) return "";
    if (/auto-fix|autofix/i.test(block)) return "";
    return block;
  });
  return out;
}

async function htmlFiles(dir, out = []) {
  let entries = [];
  try { entries = await readdir(dir, { withFileTypes: true }); } catch { return out; }
  for (const entry of entries) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) await htmlFiles(path, out);
    else if (entry.name.endsWith(".html")) out.push(path);
  }
  return out;
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

const REDIRECT = `<!doctype html><html lang="en"><head><meta charset="utf-8">
<link rel="canonical" href="https://catchemtcg.com/feed">
<meta http-equiv="refresh" content="0;url=/feed">
<title>The Feed — Catch'em</title>
<script>location.replace("/feed")</script>
</head><body><p><a href="/feed">The Feed</a></p></body></html>
`;

export async function writePublicRoutes(outDir) {
  for (const path of await htmlFiles(outDir)) {
    let raw;
    try { raw = await readFile(path, "utf8"); } catch { continue; }
    const next = ensureAffiliation(hidePublishedNotes(neutralizeCopy(raw)));
    if (next !== raw) await writeFile(path, next);
  }
  let feed;
  try { feed = await readFile(join(outDir, "pulse.html"), "utf8"); } catch { feed = FALLBACK; }
  feed = hidePublishedNotes(neutralizeCopy(feed));
  feed = ensureAffiliation(feed);
  for (const rel of ROUTE_FILES) {
    const path = join(outDir, rel);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, ensureAffiliation(rel.startsWith("feed") ? feed : REDIRECT));
  }
  return ROUTE_FILES;
}
