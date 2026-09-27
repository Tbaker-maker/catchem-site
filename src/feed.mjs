// The Feed on catchemtcg.com. The baked pulse.html is only a fallback.
// The worker reads the latest run from Catchem-data and stamps its clock.

export const PULSE_URL = "https://raw.githubusercontent.com/Tbaker-maker/Catchem-data/main/research/assets/the-pulse.html";
export const REPORT_URL = "https://raw.githubusercontent.com/Tbaker-maker/Catchem-data/main/data/ppt/run-report.json";
const FRESH_HOURS = 36;
const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/;

const FIT = `<style id="feed-fit">html,body{overflow-x:hidden;max-width:100%}img,svg{max-width:100%;height:auto}img.thumb{width:46px;max-width:46px;min-width:0}img.thumb.logo{width:56px;max-width:56px;min-width:0;height:auto}.sig,.sigbody,.row{min-width:0;max-width:100%}</style>`;

export function isFeedPath(pathname) {
  let path = String(pathname || "").split("?")[0];
  if (path.length > 1 && path.endsWith("/")) path = path.slice(0, -1);
  if (path.endsWith("/index.html")) path = path.slice(0, -"/index.html".length);
  else if (path.endsWith(".html")) path = path.slice(0, -5);
  return path === "/feed" || path === "/pulse" || path === "/try" || path === "/app";
}

export function formatPt(iso) {
  const t = Date.parse(iso || "");
  if (!Number.isFinite(t)) return null;
  const clock = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(t));
  return `${clock} PT`;
}

export function freshnessFrom(iso, now = Date.now()) {
  const t = Date.parse(iso || "");
  if (!Number.isFinite(t)) return { label: "Data delayed", at: "" };
  const at = new Date(t).toISOString();
  if ((now - t) / 3600000 > FRESH_HOURS) return { label: "Data delayed", at };
  return { label: `Updated ${formatPt(iso)}`, at };
}

export function stampFeed(html, iso, now = Date.now()) {
  const raw = String(html || "");
  const existing = raw.match(/id="fresh"[^>]*data-at="([^"]*)"/);
  const clock = (ISO.test(iso || "") && iso) || (existing && ISO.test(existing[1]) ? existing[1] : "");
  const fresh = freshnessFrom(clock, now);
  const block = `<div class="byline" id="fresh" data-at="${fresh.at}">${fresh.label}</div>`;
  let out = raw.includes('id="fresh"')
    ? raw.replace(/<div class="byline" id="fresh"[^>]*>[^<]*<\/div>/, block)
    : raw.includes("<body>")
      ? raw.replace("<body>", `<body>${block}`)
      : block + raw;
  if (!out.includes('id="feed-fit"')) {
    out = out.includes("</head>") ? out.replace("</head>", `${FIT}</head>`) : FIT + out;
  }
  return out;
}

export async function loadLatestFeed(fetchImpl = fetch, now = Date.now()) {
  const headers = { "user-agent": "catchem-site", "cache-control": "no-cache" };
  const [pulseRes, reportRes] = await Promise.all([
    fetchImpl(PULSE_URL, { headers }),
    fetchImpl(REPORT_URL, { headers }),
  ]);
  if (!pulseRes.ok) throw new Error(`pulse ${pulseRes.status}`);
  const html = await pulseRes.text();
  let iso = "";
  if (reportRes.ok) {
    try { iso = JSON.parse(await reportRes.text())?.finishedAt || ""; } catch { iso = ""; }
  }
  return stampFeed(html, iso, now);
}
