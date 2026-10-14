// Weekly changes and the scanner explainer. Every figure is a field on weekly.json.
import { esc, pageChrome } from "./ui.mjs";
import { imageTag, officialSrc } from "./catalogue-image.mjs";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function dayLabel(iso) {
  const s = String(iso || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return "";
  return `${MONTHS[Number(s.slice(5, 7)) - 1]} ${Number(s.slice(8, 10))}, ${s.slice(0, 4)}`;
}

function money(n) {
  const x = Number(n);
  if (!Number.isFinite(x) || x <= 0) return "";
  return "$" + x.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function parseWeeklyPattern(line) {
  const parts = String(line || "").split("|");
  if (parts.length < 6) return null;
  const name = String(parts[0] || "").trim().toLowerCase();
  const stage = String(parts[1] || "").trim().toLowerCase();
  if (!name || (stage !== "confirmed" && stage !== "passed")) return null;
  if (/stair|slow-climb|slowclimb|sealed-slow/.test(name) && stage !== "confirmed" && stage !== "passed") return null;
  const scope = String(parts[2] || "").trim().toLowerCase();
  const dir = String(parts[3] || "").trim().toLowerCase();
  const days = Number(String(parts[4] || "").replace(/d$/i, ""));
  const pick = (key) => {
    const bit = parts.find((part) => String(part).startsWith(key + "="));
    const n = Number(String(bit || "").slice(key.length + 1));
    return Number.isFinite(n) ? n : null;
  };
  const n = pick("n");
  const rate = pick("rate");
  const base = pick("base");
  if (!(n > 0) || rate == null || base == null || !(days > 0)) return null;
  const label = name.charAt(0).toUpperCase() + name.slice(1).replace(/-/g, " ");
  const who = scope === "single" ? "singles" : scope === "sealed" ? "sealed" : "";
  const way = dir === "up" || dir === "down" ? dir : "";
  const where = [who, way].filter(Boolean).join(", ");
  return {
    name,
    text: `${label}${where ? ` on ${where}` : ""}. This pattern was right ${rate}% of the time vs ${base}% normally, over ${Math.round(n)} cases, looking ${Math.round(days)} days ahead.`,
  };
}

function face(row, images) {
  const hit = officialSrc({ id: row.id, kind: "single" }, images || {});
  return imageTag(hit.src, "row", "", { ...row, kind: "single", catalogueCrop: hit.crop, alts: hit.alts || [] });
}

function moverItem(row, images) {
  const name = String(row?.name || "").trim();
  const id = String(row?.id || "").trim();
  const from = dayLabel(row?.from);
  const to = dayLabel(row?.to);
  const p0 = money(row?.p0);
  const p1 = money(row?.p1);
  if (!name || !id || !from || !to || !p0 || !p1) return "";
  const href = /^tcgcsv-\d+$/.test(id) ? `/c/${id}` : "";
  if (!href) return "";
  const num = String(row.number || "").trim();
  const set = String(row.set || "").trim();
  const pct = Number(row.pct);
  const move = Number.isFinite(pct) ? `${pct > 0 ? "+" : ""}${pct}%` : "";
  const meta = [num, set].filter(Boolean).join(" · ");
  return `<a class="wk-row" href="${esc(href)}">${face(row, images)}<span><b>${esc(name)}</b>${meta ? `<small>${esc(meta)}</small>` : ""}<small>${esc(p0)} on ${esc(from)} to ${esc(p1)} on ${esc(to)}${move ? `. ${esc(move)}` : ""}</small></span></a>`;
}

function listingItem(row) {
  const n = Number(row?.n);
  const prev = Number(row?.prev);
  const day = dayLabel(row?.date);
  const prevDay = dayLabel(row?.prevDate);
  const name = String(row?.name || row?.id || "").trim();
  if (!name || !Number.isFinite(n) || n < 0 || !day || !(prev >= 0) || !prevDay) return "";
  const href = /^tcgcsv-\d+$/.test(String(row?.id || "")) ? `/c/${row.id}` : "";
  const pct = prev > 0 ? Math.round(((n - prev) / prev) * 1000) / 10 : null;
  const change = pct == null ? "" : `, ${pct > 0 ? "+" : ""}${pct}%`;
  const text = `${name}: ${n} listings counted on ${day}, from ${prev} on ${prevDay}${change}.`;
  const inner = `<span><b>${esc(text)}</b></span>`;
  return href ? `<a class="wk-row" href="${esc(href)}">${inner}</a>` : `<div class="wk-row">${inner}</div>`;
}

const CSS = `<style>
.wk{display:grid;gap:16px}
.wk h1{margin:0}
.wk-nav{display:flex;gap:8px;overflow-x:auto}
.wk-nav a{flex:none;min-height:44px;display:inline-flex;align-items:center;padding:0 14px;border-radius:999px;background:rgba(255,255,255,.06);color:inherit;text-decoration:none;font:600 14px/1 var(--sans)}
.wk-list{display:grid;gap:8px}
.wk-row{display:flex;gap:10px;align-items:center;min-height:44px;padding:8px;border-radius:16px;background:#1a1815;border:1px solid #2f2b26;color:inherit;text-decoration:none}
.wk-row img,.wk-row .tile{width:44px;height:62px;object-fit:contain;border-radius:8px;background:#12100e;flex:none}
.wk-row b{display:block;font:600 16px/1.3 var(--sans)}
.wk-row small{display:block;color:var(--dim);font:500 14px/1.35 var(--sans)}
.wk-pat{margin:0;padding:14px 16px;border-radius:18px;background:#1a1815;border:1px solid #2f2b26;font:500 16px/1.4 var(--sans)}
</style>`;

function shell(title, active, body, stamp, opts) {
  return pageChrome(active, `<main id="main" tabindex="-1" class="wrap wk">${CSS}${body}</main>`, title, stamp, "", opts?.feed === true);
}

function subnav(active) {
  const link = (href, label) => `<a href="${href}"${active === label ? ' aria-current="page"' : ""}>${label}</a>`;
  return `<nav class="wk-nav" aria-label="Weekly">${link("/weekly", "Weekly")}${link("/scanner", "Scanner")}</nav>`;
}

export function weeklyBody(doc, images) {
  const asOf = dayLabel(doc?.asOf);
  const movers = (doc?.movers || []).map((row) => moverItem(row, images)).filter(Boolean).join("");
  const patterns = (doc?.patterns || []).map(parseWeeklyPattern).filter(Boolean);
  const listings = (doc?.listingsCounted?.changes || []).map(listingItem).filter(Boolean).join("");
  const blocks = [
    movers ? `<section><h2>Movers</h2><div class="wk-list">${movers}</div></section>` : "",
    patterns.length ? `<section><h2>Patterns that passed</h2>${patterns.map((row) => `<p class="wk-pat">${esc(row.text)}</p>`).join("")}</section>` : "",
    listings ? `<section><h2>Listings counted</h2><div class="wk-list">${listings}</div></section>` : "",
  ].filter(Boolean).join("");
  const when = asOf ? `<p class="muted">Weekly changes, ${esc(asOf)}.</p>` : "";
  return `${subnav("Weekly")}<h1>Weekly</h1>${when}${blocks}`;
}

export function scannerBody(doc) {
  const asOf = dayLabel(doc?.patternsAsOf || doc?.asOf);
  const patterns = (doc?.patterns || []).map(parseWeeklyPattern).filter(Boolean);
  const list = patterns.map((row) => `<p class="wk-pat">${esc(row.text)}</p>`).join("");
  const when = asOf ? `<p class="muted">Passed patterns, ${esc(asOf)}.</p>` : "";
  return `${subnav("Scanner")}<h1>Scanner</h1>${when}<p>These are the patterns that passed. The rate is how often the pattern was right, next to the usual rate, over the cases on file.</p>${list}`;
}

export function renderWeekly(doc, stamp, opts = {}, images = {}) {
  return shell("Weekly", "Weekly", weeklyBody(doc, images), stamp, opts);
}

export function renderScanner(doc, stamp, opts = {}) {
  return shell("Scanner", "Scanner", scannerBody(doc), stamp, opts);
}
