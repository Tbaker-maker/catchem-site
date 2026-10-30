// Pulse heatmap. Flag TF_PULSE defaults off.
// Month-end mood and heat are the last reading of each month in
// research/assets/public/market-meter.json (as of 2026-10-25).
// A month with no reading is blank. It is never filled with 0.

export const FLAG = "TF_PULSE";
export const AS_OF = "2026-10-25";
export const SOURCE = "TCGplayer market indexes";

const INK = "#12100e";
const IVORY = "#efe9de";
const GOLD = "#d9b779";

export function pulseOn(env) {
  return String(env && env.TF_PULSE || "").trim().toLowerCase() === "on";
}

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => {
    if (c === "&") return "&" + "amp;";
    if (c === "<") return "&" + "lt;";
    if (c === ">") return "&" + "gt;";
    if (c === '"') return "&" + "quot;";
    return "&" + "#39;";
  });
}


const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function prettyDay(iso) {
  const d = String(iso || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return "";
  return MONTHS[Number(d.slice(5, 7)) - 1] + " " + Number(d.slice(8, 10)) + ", " + d.slice(0, 4);
}

function monthLabel(ym) {
  const [y, m] = String(ym).split("-");
  return MONTHS[Number(m) - 1] + " " + String(y).slice(2);
}

// Last on-file reading of each month. Sep 29, 2026 mood is 0. That is the score on file.
export const MONTH_ENDS = [
  { ym: "2026-03", d: "2026-03-31", mood: 81, heat: 66 },
  { ym: "2026-04", d: "2026-04-30", mood: 89, heat: 60 },
  { ym: "2026-05", d: "2026-05-31", mood: 61, heat: 57 },
  { ym: "2026-06", d: "2026-06-30", mood: 27, heat: 32 },
  { ym: "2026-07", d: "2026-07-31", mood: 24, heat: 28 },
  { ym: "2026-08", d: "2026-08-31", mood: 36, heat: 17 },
  { ym: "2026-09", d: "2026-09-29", mood: 0, heat: 45 },
  { ym: "2026-10", d: "2026-10-25", mood: 74, heat: 44 },
];

export const MIRROR_NOTE = "Mirrored history: the card repeats these month ends. It is not a second count.";

export function cellText(value, prev) {
  if (value == null || value === "") return "No reading";
  const n = Number(value);
  if (!Number.isFinite(n)) return "No reading";
  let move = "";
  if (prev != null && Number.isFinite(Number(prev))) {
    const diff = n - Number(prev);
    if (diff === 0) move = " Flat";
    else move = diff > 0 ? " Up +" + diff : " Down " + diff;
  }
  return String(n) + move;
}

function heatCells(key) {
  return MONTH_ENDS.map((row, i) => {
    const prev = i ? MONTH_ENDS[i - 1][key] : null;
    const text = cellText(row[key], prev);
    const label = key + " " + text + " on " + prettyDay(row.d);
    return `<button type="button" class="tf-cell" data-receipt="1" data-title="${esc(key)}" data-price="${esc(text)}" data-source="${esc(SOURCE)}" data-date="${esc(prettyDay(row.d))}" data-listings="No listings counted" data-method="Month-end reading from the market meter file.">${esc(text)}</button>`;
  }).join("");
}

export function pulseShareSvg() {
  const last = MONTH_ENDS[MONTH_ENDS.length - 1];
  const lineA = MONTH_ENDS.slice(0, 4).map((row) => monthLabel(row.ym) + " " + row.mood).join("  ");
  const lineB = MONTH_ENDS.slice(4).map((row) => monthLabel(row.ym) + " " + row.mood).join("  ");
  const texts = [
    [72, 110, GOLD, 40, "Catch'em"],
    [72, 168, GOLD, 28, "Pulse"],
    [72, 320, IVORY, 112, String(last.mood)],
    [72, 390, IVORY, 32, "Mood on " + prettyDay(last.d) + "."],
    [72, 440, IVORY, 28, "Heat " + last.heat + ", Cool."],
    [72, 530, IVORY, 26, lineA],
    [72, 570, IVORY, 26, lineB],
    [72, 650, "#b7b1a6", 26, SOURCE],
    [72, 700, "#b7b1a6", 26, prettyDay(AS_OF)],
    [72, 770, GOLD, 28, "catchemtcg.com/pulse"],
    [72, 830, "#b7b1a6", 22, MIRROR_NOTE],
  ];
  const body = texts.map(([x, y, fill, size, text]) => `<text x="${x}" y="${y}" fill="${fill}" font-family="Georgia, serif" font-size="${size}">${esc(text)}</text>`).join("");
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="900" viewBox="0 0 1200 900" role="img">
<title>Catch'em Pulse</title>
<rect width="1200" height="900" rx="36" fill="${INK}"/>
<rect x="28" y="28" width="1144" height="844" rx="28" fill="none" stroke="${GOLD}" stroke-width="8"/>
<text x="600" y="520" text-anchor="middle" fill="${IVORY}" fill-opacity="0.07" font-family="Georgia, serif" font-size="140">Catch'em</text>
${body}
</svg>`;
}

export function pulseMain() {
  const heads = MONTH_ENDS.map((row) => `<th scope="col">${esc(monthLabel(row.ym))}</th>`).join("");
  return `<main id="main" class="tf-pulse">
    <p class="kicker">Pulse</p>
    <h1>Market mood and heat.</h1>
    <p>One row for mood, one row for heat. ${esc(SOURCE)}, ${esc(prettyDay(AS_OF))}. A blank month would say No reading. Sep 29 mood is 0 because that is the score on file, not a missing price.</p>
    <div class="tf-scroll">
      <table class="tf-heat">
        <caption class="sr">Month-end mood and heat</caption>
        <thead><tr><th scope="col">Reading</th>${heads}</tr></thead>
        <tbody>
          <tr><th scope="row">Mood</th>${heatCells("mood")}</tr>
          <tr><th scope="row">Heat</th>${heatCells("heat")}</tr>
        </tbody>
      </table>
    </div>
    <p>${esc(MIRROR_NOTE)}</p>
    <h2>Share card</h2>
    <div class="tf-card">${pulseShareSvg()}</div>
    <p><a href="/meter">Market meter</a></p>
  </main>`;
}

export const PULSE_CSS = `
.tf-pulse h1{font:500 40px/1.05 Georgia,serif;margin:8px 0 12px}
.tf-scroll{overflow-x:auto;border-radius:22px}
.tf-heat{border-collapse:separate;border-spacing:6px;min-width:720px}
.tf-heat th,.tf-heat td,.tf-cell{min-height:44px;min-width:44px}
.tf-cell{display:inline-flex;align-items:center;justify-content:center;padding:8px;border-radius:14px;border:0;background:#221e1a;color:${IVORY};font:600 13px/1.3 "IBM Plex Sans",system-ui,sans-serif;text-align:center;cursor:pointer}
.tf-heat th{font:600 13px/1.2 "IBM Plex Sans",system-ui,sans-serif;text-align:left}
.tf-card svg{width:100%;height:auto;border-radius:22px}
.sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)}
html[data-theme="light"] .tf-cell{background:#fff;color:${INK}}
`;

export function pageWrap(main, theme, title) {
  const mode = theme === "light" ? "light" : "dark";
  return `<!doctype html><html lang="en" data-theme="${mode}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)} · Catch'em</title>
<style>
*{box-sizing:border-box}body{margin:0;background:${INK};color:${IVORY};font:16px/1.45 "IBM Plex Sans",system-ui,sans-serif;padding:16px 16px 96px}
html[data-theme="light"] body{background:${IVORY};color:${INK}}
html[data-theme="light"] a,html[data-theme="light"] .kicker,html[data-theme="light"] .logo span,html[data-theme="light"] .tf-tab[aria-pressed="true"],html[data-theme="light"] .tf-chip[aria-pressed="true"],html[data-theme="light"] .tf-dock a[aria-current="page"]{color:#7a5a1e}
a{color:${GOLD}}.logo{font:600 28px/1 Georgia,serif;color:inherit;text-decoration:none;min-height:44px;display:inline-flex;align-items:center}.logo span{color:${GOLD}}
.kicker{letter-spacing:.08em;text-transform:uppercase;color:${GOLD};font:600 12px/1 system-ui}
${PULSE_CSS}
</style></head><body>
<a class="logo" href="/">Catch'em<span>.</span></a>
${main}
<script>
try{var k="tf-scroll:"+location.pathname+location.search;var y=sessionStorage.getItem(k);if(y)requestAnimationFrame(function(){scrollTo(0,Number(y)||0)});addEventListener("pagehide",function(){sessionStorage.setItem(k,String(scrollY||0))});}catch(e){}
</script>
</body></html>`;
}

export function previewPage(theme) {
  return pageWrap(pulseMain(), theme, "Pulse");
}

export function pulseResponse(request) {
  const url = new URL(request.url);
  const theme = url.searchParams.get("theme") === "light" ? "light" : "dark";
  const body = request.method === "HEAD" ? null : previewPage(theme);
  return new Response(body, {
    status: 200,
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
  });
}
