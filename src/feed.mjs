// The Feed on catchemtcg.com. The baked pulse.html is only a fallback.
// The worker reads the latest run from Catchem-data and stamps its clock.

export const PULSE_URL = "https://raw.githubusercontent.com/Tbaker-maker/Catchem-data/main/research/assets/the-pulse.html";
export const REPORT_URL = "https://raw.githubusercontent.com/Tbaker-maker/Catchem-data/main/data/ppt/run-report.json";
const FRESH_HOURS = 48;
const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/;

const FIT = `<style id="feed-fit">html,body{overflow-x:hidden}img,svg{max-width:100%;height:auto}img.thumb{width:46px;max-width:46px;min-width:0}img.thumb.logo{width:56px;max-width:56px;min-width:0;height:auto}.sig,.sigbody,.row{min-width:0;max-width:100%}</style>`;

function normalize(pathname) {
  let path = String(pathname || "").split("?")[0];
  if (path.length > 1 && path.endsWith("/")) path = path.slice(0, -1);
  if (path.endsWith("/index.html")) path = path.slice(0, -"/index.html".length);
  else if (path.endsWith(".html")) path = path.slice(0, -5);
  return path;
}

export function redirectPath(pathname) {
  const path = normalize(pathname);
  if (path === "/app" || path === "/try") return "/feed";
  return null;
}

export function isFeedPath(pathname) {
  const path = normalize(pathname);
  return path === "/feed" || path === "/pulse";
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
  const label = `Updated ${formatPt(iso)}`;
  if ((now - t) / 3600000 > FRESH_HOURS) return { label: `${label} · STALE`, at };
  return { label, at };
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
  const when = fresh.at ? formatPt(fresh.at) : null;
  if (when) out = out.replace(/<div class="byline">\s*Written by the machine[\s\S]*?<\/div>/, "");
  out = out.replaceAll("A floor that far below the median usually rewards patience.", "The lowest ask sits far below the median.");
  return out;
}

export async function loadLatestFeed(fetchImpl = fetch, now = Date.now()) {
  const headers = {
    "user-agent": "catchem-site",
    accept: "application/vnd.github+json",
    "cache-control": "no-cache",
  };
  const tip = await fetchImpl("https://api.github.com/repos/Tbaker-maker/Catchem-data/commits/main", {
    headers,
    cache: "no-store",
  });
  if (!tip.ok) throw new Error(`tip ${tip.status}`);
  const sha = (await tip.json())?.sha;
  if (!/^[0-9a-f]{40}$/.test(sha || "")) throw new Error("tip sha missing");
  const base = `https://raw.githubusercontent.com/Tbaker-maker/Catchem-data/${sha}`;
  const rawHeaders = { "user-agent": "catchem-site", "cache-control": "no-cache" };
  const [pulseRes, reportRes] = await Promise.all([
    fetchImpl(`${base}/research/assets/the-pulse.html`, { headers: rawHeaders, cache: "no-store" }),
    fetchImpl(`${base}/data/ppt/run-report.json`, { headers: rawHeaders, cache: "no-store" }),
  ]);
  if (!pulseRes.ok) throw new Error(`pulse ${pulseRes.status}`);
  const html = await pulseRes.text();
  let iso = "";
  if (reportRes.ok) {
    try { iso = JSON.parse(await reportRes.text())?.finishedAt || ""; } catch { iso = ""; }
  }
  return stampFeed(html, iso, now);
}
