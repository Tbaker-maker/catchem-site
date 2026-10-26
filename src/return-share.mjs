// Camera card, 1200 by 675. SVG, same-origin pictures only.
// A price is drawn only when a source and a date come with it.

const ORIGIN = "https://catchemtcg.com";
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const xml = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({
  "&": "\u0026amp;",
  "<": "\u0026lt;",
  ">": "\u0026gt;",
  '"': "\u0026quot;",
  "'": "\u0026apos;",
}[c]));

function clip(value, max) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, max);
}

export function isoDay(value) {
  const s = String(value || "").slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : "";
}

export function prettyDateToIso(value) {
  const m = /^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) (\d{1,2}), (\d{4})$/.exec(String(value || "").trim());
  if (!m) return "";
  const month = String(MONTHS.indexOf(m[1]) + 1).padStart(2, "0");
  const day = String(Number(m[2])).padStart(2, "0");
  return isoDay(`${m[3]}-${month}-${day}`);
}

export function monthDay(iso) {
  const d = isoDay(iso);
  if (!d) return "";
  return MONTHS[Number(d.slice(5, 7)) - 1] + " " + Number(d.slice(8, 10));
}

function moneyText(price) {
  const n = Number(String(price || "").replace(/[$,]/g, ""));
  if (!(n > 0)) return "";
  return "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function frameImagePath(value) {
  const raw = String(value || "").trim();
  if (!raw || raw.includes("..") || raw.includes("\\") || raw.includes(" ")) return "";
  let path = raw;
  if (path.startsWith(ORIGIN)) path = path.slice(ORIGIN.length);
  if (!path.startsWith("/")) return "";
  if (/^\/data\/editor\/tcg\/[a-z0-9]+\/[A-Za-z0-9._-]+$/i.test(path)) return path;
  if (/^\/img\/[a-z0-9]+\/logo\.png$/i.test(path)) return path;
  if (/^\/data\/cutouts\/[a-z0-9-]+\.(webp|png)$/i.test(path)) return path;
  if (/^\/api\/card-img\?pid=\d+$/.test(path)) return path;
  return "";
}

export function framePoints(value) {
  const out = [];
  const raw = Array.isArray(value) ? value : String(value || "").split(",");
  for (const bit of raw) {
    if (Array.isArray(bit)) {
      const day = isoDay(bit[0]);
      const price = Number(bit[1]);
      if (day && price > 0) out.push({ date: day, price });
      continue;
    }
    const part = String(bit || "");
    const cut = part.lastIndexOf(":");
    if (cut < 0) continue;
    const day = isoDay(part.slice(0, cut));
    const price = Number(part.slice(cut + 1));
    if (day && price > 0) out.push({ date: day, price });
  }
  out.sort((a, b) => (a.date < b.date ? -1 : 1));
  return out.slice(-24);
}

function sparkPath(points) {
  if (points.length < 2) return "";
  const min = Math.min(...points.map((point) => point.price));
  const max = Math.max(...points.map((point) => point.price));
  const span = max - min || 1;
  const x = 420;
  const y = 470;
  const w = 640;
  const h = 110;
  const step = (w - 8) / (points.length - 1);
  const d = points.map((point, i) => {
    const px = (x + 4 + i * step).toFixed(1);
    const py = (y + h - 8 - ((point.price - min) / span) * (h - 16)).toFixed(1);
    return `${i ? "L" : "M"}${px} ${py}`;
  }).join(" ");
  return `<path d="${d}" fill="none" stroke="#d9b779" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>`;
}

function wrapName(name) {
  const words = clip(name, 80).split(" ");
  const lines = [];
  let cur = "";
  for (const word of words) {
    const next = cur ? `${cur} ${word}` : word;
    if (next.length > 28 && cur) {
      lines.push(cur);
      cur = word;
    } else cur = next;
    if (lines.length === 2) break;
  }
  if (cur && lines.length < 2) lines.push(cur);
  return lines.slice(0, 2);
}

export function frameUrl(fields = {}) {
  const q = new URLSearchParams();
  const name = clip(fields.name, 80);
  if (name) q.set("n", name);
  const date = isoDay(fields.date) || prettyDateToIso(fields.date);
  const source = fields.source === "eBay asks" ? "ebay" : (fields.source === "TCGplayer market" ? "tcg" : "");
  const price = moneyText(fields.price).replace(/[$,]/g, "");
  if (price && date && source) q.set("p", price);
  if (date) q.set("d", date);
  const fact = clip(fields.fact, 120);
  if (fact && !/[\u2014\u2013]/.test(fact)) q.set("f", fact);
  const img = frameImagePath(fields.img);
  if (img) q.set("img", img);
  if (fields.sealed) q.set("s", "1");
  if (source) q.set("src", source);
  const pts = framePoints(fields.points);
  if (pts.length >= 2) q.set("pts", pts.map((point) => `${point.date}:${point.price}`).join(","));
  const url = `${ORIGIN}/og/frame.svg?${q.toString()}`;
  if (url.length > 1800) {
    q.delete("pts");
    return `${ORIGIN}/og/frame.svg?${q.toString()}`;
  }
  return url;
}

export function frameSvg(search) {
  const q = search instanceof URLSearchParams ? search : new URLSearchParams(String(search || "").replace(/^\?/, ""));
  const name = clip(q.get("n"), 80) || "Catch'em";
  const date = monthDay(isoDay(q.get("d")));
  const src = q.get("src") === "ebay" ? "eBay asks" : (q.get("src") === "tcg" ? "TCGplayer market" : "");
  const price = date && src ? moneyText(q.get("p")) : "";
  const fact = clip(q.get("f"), 120);
  const img = frameImagePath(q.get("img"));
  const points = framePoints(q.get("pts"));
  const lines = wrapName(name);
  const nameSvg = lines.map((line, i) => `<text x="420" y="${188 + i * 52}" fill="#efe9de" font-family="Georgia, serif" font-size="42">${xml(line)}</text>`).join("");
  const photo = img
    ? `<image href="${xml(ORIGIN + img)}" x="92" y="160" width="260" height="380" preserveAspectRatio="xMidYMid meet"/>`
    : `<text x="222" y="360" text-anchor="middle" fill="#d9b779" font-family="Georgia, serif" font-size="28">Catch'em</text>`;
  const priceY = 188 + lines.length * 52 + 28;
  const priceSvg = price
    ? `<text x="420" y="${priceY}" fill="#efe9de" font-family="Georgia, serif" font-size="64">${xml(price)}</text>`
    : "";
  const factSvg = fact && !/[\u2014\u2013]/.test(fact)
    ? `<text x="420" y="${priceY + (price ? 56 : 20)}" fill="#c4baab" font-family="system-ui, sans-serif" font-size="28">${xml(fact)}</text>`
    : "";
  const sourceSvg = src && date
    ? `<text x="420" y="620" fill="#8f877a" font-family="system-ui, sans-serif" font-size="20">${xml(src + ", " + date)}</text>`
    : "";
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="675" viewBox="0 0 1200 675" role="img">
<title>${xml(name)}</title>
<rect width="1200" height="675" fill="#12100e"/>
<rect x="28" y="28" width="1144" height="619" rx="32" fill="#161410"/>
<text x="72" y="96" fill="#d9b779" font-family="Georgia, serif" font-size="32" font-weight="600">Catch'em</text>
${date ? `<text x="1100" y="96" text-anchor="end" fill="#c4baab" font-family="system-ui, sans-serif" font-size="24">${xml(date)}</text>` : ""}
<rect x="72" y="140" width="300" height="420" rx="28" fill="#221e1a"/>
${photo}
${nameSvg}
${priceSvg}
${factSvg}
${sparkPath(points)}
${sourceSvg}
</svg>
`;
}

export function handleFrame(request, url) {
  const svg = frameSvg(url.searchParams);
  const headers = {
    "content-type": "image/svg+xml; charset=utf-8",
    "cache-control": "public, max-age=86400",
    "x-content-type-options": "nosniff",
  };
  return new Response(request.method === "HEAD" ? null : svg, { status: 200, headers });
}
