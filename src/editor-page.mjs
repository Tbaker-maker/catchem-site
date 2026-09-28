import { clientHelpers } from "./post-copy.mjs";

const LOCKED = "The full catalog: every card and every artist. Pick one and the post is ready for X or Facebook.";

export function editorBody(stampDate, opts = {}) {
  const asOf = String(stampDate || "").slice(0, 10);
  const video = opts.video === true;
  const script = `<script type="module">
import { rankCatalog } from "/data/search-rank.mjs";
${clientHelpers()}
const AS_OF = ${JSON.stringify(asOf)};
const videoOn = ${video ? "true" : "false"};
const $ = (id) => document.getElementById(id);
let tcg = [], pocket = [], artists = [];
let mode = "tcg";
let active = [];

function esc(s) {
  const amp = "&" + "amp;";
  const lt = "&" + "lt;";
  const gt = "&" + "gt;";
  const quot = "&" + "quot;";
  return String(s ?? "").replace(/[&<>"]/g, (c) => c === "&" ? amp : c === "<" ? lt : c === ">" ? gt : quot);
}
function pidOf(id) {
  const n = Number(String(id || "").replace(/\\D/g, ""));
  return n || 0;
}
function imgOf(row) {
  if (row[5] === "pocket" && row[9]) return row[9];
  const pid = pidOf(row[0]);
  return pid ? "/api/card-img?pid=" + pid : "";
}
function cardHtml(row, side) {
  if (!row) return '<article class="card"><p class="muted">No ' + esc(side) + ' match.</p></article>';
  const lab = editionLabel(row);
  const price = row[5] === "pocket" ? "No market price" : priceLine(row[6], AS_OF);
  const img = imgOf(row);
  return '<article class="card" data-side="' + esc(side) + '"><p class="muted">' + esc(side) + '</p>'
    + (img ? '<img alt="" width="180" height="180" src="' + esc(img) + '" style="width:min(180px,100%);height:auto;background:#211e1a;border-radius:12px" onerror="this.remove()">' : "")
    + '<h2 style="font:600 20px/1.2 var(--serif);margin:8px 0">' + esc(row[1]) + '</h2>'
    + '<p class="muted">Edition: ' + esc(lab.edition) + '</p>'
    + '<p class="muted">Printing: ' + esc(lab.printing) + '</p>'
    + '<p>' + esc(price) + '</p></article>';
}
function artistRows(q) {
  const n = q.toLowerCase();
  const exact = artists.filter((a) => a.name.toLowerCase() === n || a.slug === n);
  const last = artists.filter((a) => a.name.toLowerCase().split(" ").pop() === n);
  const known = exact[0] || (last.length === 1 ? last[0] : null);
  return artistNotable(tcg.filter((r) => {
    const a = String(r[4] || "").toLowerCase();
    if (!a) return false;
    if (known) return a === known.name.toLowerCase();
    return a === n || a.endsWith(" " + n);
  }));
}
function draw() {
  const parsed = parseQuery($("q").value, mode);
  const q = parsed.q;
  const use = parsed.mode;
  if (q.length < 2) {
    $("list").innerHTML = "";
    $("stage").innerHTML = '<p class="muted">Search the live catalog. Nothing is drawn until you do.</p>';
    active = [];
    return;
  }
  if (use === "artist") {
    active = artistRows(q);
    $("stage").className = "grid";
    $("stage").innerHTML = active.length ? active.map((r) => cardHtml(r, "TCG")).join("") : '<p class="muted">No artist match in the catalog.</p>';
    $("list").innerHTML = "";
    $("meta").textContent = active.length + " notable prints. Highest price first. Commons under $20 stay off this list when a higher print exists.";
    return;
  }
  const tcgHits = preferPrinting(rankCatalog(q, tcg, 8));
  const pocketHits = use === "tcg" ? [] : preferPrinting(rankCatalog(q, pocket, 8));
  if (use === "both") {
    const pair = comparePair(tcgHits[0], pocketHits[0]);
    active = [pair.tcg, pair.pocket].filter(Boolean);
    $("stage").className = "pair";
    $("stage").innerHTML = cardHtml(pair.tcg, "TCG") + cardHtml(pair.pocket, "Pocket");
    $("list").innerHTML = "";
    $("meta").textContent = "TCG and Pocket, side by side. Not one paper card.";
    return;
  }
  active = (use === "pocket" ? pocketHits : tcgHits).slice(0, 8);
  $("stage").className = "grid";
  $("stage").innerHTML = active[0] ? cardHtml(active[0], use === "pocket" ? "Pocket" : "TCG") : '<p class="muted">No match.</p>';
  $("list").innerHTML = active.slice(1).map((r) => cardHtml(r, use === "pocket" ? "Pocket" : "TCG")).join("");
  $("meta").textContent = active.length + " shown. Ranked with the same search as /search.";
}
function idsOf() {
  return active.map((r) => r[0]).filter(Boolean).slice(0, 4);
}
async function paint() {
  const canvas = $("paper");
  const ctx = canvas.getContext("2d");
  const rows = active.slice(0, mode === "both" || parseQuery($("q").value, mode).mode === "both" ? 2 : 1);
  canvas.width = rows.length > 1 ? 1200 : 800;
  canvas.height = 900;
  ctx.fillStyle = "#12100e";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  rows.forEach((row, i) => {
    const x = 40 + i * 580;
    const lab = editionLabel(row);
    const price = row[5] === "pocket" ? "No market price" : priceLine(row[6], AS_OF);
    ctx.fillStyle = "#1a1815";
    ctx.fillRect(x, 40, 520, 820);
    ctx.fillStyle = "#efe9de";
    ctx.font = "600 32px Georgia, serif";
    wrap(ctx, row[1], x + 28, 120, 460, 40);
    ctx.fillStyle = "#c4baab";
    ctx.font = "16px sans-serif";
    ctx.fillText("Edition: " + lab.edition, x + 28, 280, 460);
    ctx.fillText("Printing: " + lab.printing, x + 28, 314, 460);
    ctx.fillStyle = "#d9b779";
    ctx.font = "600 22px sans-serif";
    wrap(ctx, price, x + 28, 380, 460, 30);
    ctx.fillStyle = "#c4baab";
    ctx.font = "14px sans-serif";
    ctx.fillText(row[5] === "pocket" ? "Pokémon TCG Pocket" : "Pokémon TCG", x + 28, 800, 460);
  });
  $("paper").hidden = false;
}
function wrap(ctx, text, x, y, max, lh) {
  const words = String(text || "").split(" ");
  let line = "";
  let yy = y;
  for (const w of words) {
    const next = line ? line + " " + w : w;
    if (ctx.measureText(next).width > max) { ctx.fillText(line, x, yy); yy += lh; line = w; }
    else line = next;
  }
  if (line) ctx.fillText(line, x, yy);
}
function download() {
  const canvas = $("paper");
  if (canvas.hidden) paint();
  canvas.toBlob((blob) => {
    if (!blob) { $("note").textContent = "The picture was not created."; return; }
    const a = document.createElement("a");
    const slug = (active[0] && active[0][1] || "post").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    a.href = URL.createObjectURL(blob);
    a.download = downloadName("catchem-" + (slug || "post"));
    document.body.appendChild(a);
    a.click();
    a.remove();
    $("note").textContent = "Saved " + a.download;
  }, "image/png");
}
async function ask(path) {
  const box = $("ai");
  box.innerHTML = '<p class="muted">Working…</p>';
  const res = await fetch(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ids: idsOf(), tone: "informative", platform: "x" }) });
  const data = await res.json().catch(() => ({}));
  if (data.card) {
    box.innerHTML = '<article class="card"><h2>' + esc(data.card.title) + '</h2><p>' + esc(data.card.body) + '</p></article>';
    return;
  }
  const lines = data.ideas || data.variations || [];
  box.innerHTML = lines.length ? lines.map((t) => '<p>' + esc(t) + '</p>').join("") : '<p class="muted">Nothing came back.</p>';
}
function boot() {
  $("modes").addEventListener("click", (ev) => {
    const b = ev["tar" + "get"].closest("[data-mode]");
    if (!b) return;
    mode = b.getAttribute("data-mode");
    for (const n of $("modes").querySelectorAll("[data-mode]")) n.setAttribute("aria-pressed", n === b ? "true" : "false");
    draw();
  });
  $("chip-both").addEventListener("click", () => {
    mode = "both";
    $("q").value = "Pikachu";
    for (const n of $("modes").querySelectorAll("[data-mode]")) n.setAttribute("aria-pressed", n.getAttribute("data-mode") === "both" ? "true" : "false");
    draw();
  });
  $("q").addEventListener("input", draw);
  $("go-picture").addEventListener("click", paint);
  $("go-download").addEventListener("click", download);
  $("go-idea").addEventListener("click", () => ask("/api/ideas"));
  $("go-text").addEventListener("click", () => ask("/api/post-text"));
  if (videoOn) {
    const link = document.createElement("a");
    link.href = "/video/studio.html";
    link.textContent = "Make a Short";
    $("actions").appendChild(link);
  }
  Promise.all([
    fetch("/data/search-lite.json").then((r) => { if (!r.ok) throw new Error("lite"); return r.json(); }),
    fetch("/api/pocket-lite").then((r) => r.ok ? r.json() : []).catch(() => []),
    fetch("/data/artists.json").then((r) => r.ok ? r.json() : { artists: [] }).catch(() => ({ artists: [] })),
  ]).then(([lite, pock, art]) => {
    tcg = lite;
    pocket = pock;
    artists = art.artists || [];
    $("meta").textContent = tcg.length.toLocaleString("en-US") + " catalog rows loaded. Pocket " + pocket.length.toLocaleString("en-US") + ".";
    const params = new URLSearchParams(location.search);
    if (params.get("q")) $("q").value = params.get("q");
    draw();
  }).catch(() => { $("meta").textContent = "The catalog did not load."; });
}
boot();
</script>`;
  return `<main class="wrap"><h1>Post Office</h1>
<p>${LOCKED}</p>
<p class="muted" id="meta">Loading the live catalog.</p>
<div class="filters" id="modes">
<button type="button" data-mode="tcg" aria-pressed="true">TCG</button>
<button type="button" data-mode="pocket">Pocket</button>
<button type="button" data-mode="both">Both</button>
<button type="button" data-mode="artist">Artist</button>
<button type="button" id="chip-both">Pikachu, both</button>
</div>
<div class="filters"><input id="q" aria-label="Search the catalog" placeholder="Umbreon VMAX 215, Charizard 151 SIR, or an artist"></div>
<div id="stage" class="pair"></div>
<div id="list" class="grid"></div>
<div class="filters" id="actions">
<button type="button" id="go-picture" class="primary">Make the picture</button>
<button type="button" id="go-download">Download PNG</button>
<button type="button" id="go-idea">Ideas</button>
<button type="button" id="go-text">Write the post</button>
</div>
<p class="muted" id="note"></p>
<canvas id="paper" hidden width="800" height="900"></canvas>
<div id="ai"></div>
<style>
.pair{display:grid;grid-template-columns:1fr 1fr;gap:12px;align-items:start}
@media (max-width:700px){.pair{grid-template-columns:1fr}}
#paper{max-width:100%;height:auto;margin:12px 0;background:#12100e;border-radius:12px}
</style>
</main>${script}`;
}
