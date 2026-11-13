// 1200x630 product share card as a PNG. X, Facebook, Discord and iMessage
// do not render an SVG, so og:image and twitter:image point here.
// The public URL is /og/product/<id>.png. Name, price, date and source come
// from the product's own data on the server, never from query text.
// A PNG hero is copied on when one is passed. WebP is left off the card:
// this worker has no WebP decoder.

import { bucketRow, setRawKv, setDataVersion, publicDataVersion, currentDataVersion, loadDive, loadDiveIndex, loadItemRead } from "./data.mjs";
import { marketDepthFor } from "./market-depth.mjs";
import { BUILD_SHA } from "./build-stamp.mjs";
import { edgeBuildId } from "./edge-cache.mjs";
import { money } from "./clean-text.mjs";

const W = 1200;
const H = 630;
const ORIGIN = "https://catchemtcg.com";
const SHARE_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,80}$/;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// 5x7 glyphs, 5 bits per row, high bit is the left pixel.
const FONT = {
  " ": [0, 0, 0, 0, 0, 0, 0],
  "?": [14, 17, 1, 2, 4, 0, 4],
  A: [14, 17, 17, 31, 17, 17, 17],
  B: [30, 17, 17, 30, 17, 17, 30],
  C: [14, 17, 16, 16, 16, 17, 14],
  D: [30, 17, 17, 17, 17, 17, 30],
  E: [31, 16, 16, 30, 16, 16, 31],
  F: [31, 16, 16, 30, 16, 16, 16],
  G: [14, 17, 16, 23, 17, 17, 14],
  H: [17, 17, 17, 31, 17, 17, 17],
  I: [14, 4, 4, 4, 4, 4, 14],
  J: [7, 2, 2, 2, 2, 18, 12],
  K: [17, 18, 20, 24, 20, 18, 17],
  L: [16, 16, 16, 16, 16, 16, 31],
  M: [17, 27, 21, 21, 17, 17, 17],
  N: [17, 25, 21, 19, 17, 17, 17],
  O: [14, 17, 17, 17, 17, 17, 14],
  P: [30, 17, 17, 30, 16, 16, 16],
  Q: [14, 17, 17, 17, 21, 18, 13],
  R: [30, 17, 17, 30, 20, 18, 17],
  S: [15, 16, 16, 14, 1, 1, 30],
  T: [31, 4, 4, 4, 4, 4, 4],
  U: [17, 17, 17, 17, 17, 17, 14],
  V: [17, 17, 17, 17, 17, 10, 4],
  W: [17, 17, 17, 21, 21, 21, 10],
  X: [17, 17, 10, 4, 10, 17, 17],
  Y: [17, 17, 10, 4, 4, 4, 4],
  Z: [31, 1, 2, 4, 8, 16, 31],
  0: [14, 17, 19, 21, 25, 17, 14],
  1: [4, 12, 4, 4, 4, 4, 14],
  2: [14, 17, 1, 6, 8, 16, 31],
  3: [30, 1, 1, 14, 1, 1, 30],
  4: [2, 6, 10, 18, 31, 2, 2],
  5: [31, 16, 30, 1, 1, 17, 14],
  6: [6, 8, 16, 30, 17, 17, 14],
  7: [31, 1, 2, 4, 8, 8, 8],
  8: [14, 17, 17, 14, 17, 17, 14],
  9: [14, 17, 17, 15, 1, 2, 12],
  $: [4, 15, 20, 14, 5, 30, 4],
  ".": [0, 0, 0, 0, 0, 12, 12],
  ",": [0, 0, 0, 0, 6, 4, 8],
  "-": [0, 0, 0, 31, 0, 0, 0],
  ":": [0, 12, 12, 0, 12, 12, 0],
  "+": [0, 4, 4, 31, 4, 4, 0],
  "%": [19, 19, 2, 4, 8, 25, 25],
  "/": [1, 1, 2, 4, 8, 16, 16],
  "'": [6, 6, 4, 0, 0, 0, 0],
  "(": [2, 4, 8, 8, 8, 4, 2],
  ")": [8, 4, 2, 2, 2, 4, 8],
  "!": [4, 4, 4, 4, 4, 0, 4],
  "#": [10, 10, 31, 10, 31, 10, 10],
  "&": [12, 18, 18, 12, 21, 18, 13],
  "É": [10, 31, 16, 30, 16, 16, 31],
  "é": [10, 14, 17, 31, 16, 17, 14],
};

function glyph(ch) {
  if (FONT[ch]) return FONT[ch];
  const up = String(ch || "").toUpperCase();
  return FONT[up] || FONT["?"];
}

// True when a character would be drawn as the '?' fallback, not as itself.
export function usesFallbackGlyph(text) {
  return [...String(text || "")].some((ch) => {
    if (ch === "?") return false;
    if (FONT[ch] || FONT[String(ch).toUpperCase()]) return false;
    return true;
  });
}

function fillRect(rgb, x, y, w, h, color) {
  const x0 = Math.max(0, x | 0);
  const y0 = Math.max(0, y | 0);
  const x1 = Math.min(W, (x + w) | 0);
  const y1 = Math.min(H, (y + h) | 0);
  for (let yy = y0; yy < y1; yy++) {
    const row = yy * W * 3;
    for (let xx = x0; xx < x1; xx++) {
      const i = row + xx * 3;
      rgb[i] = color[0];
      rgb[i + 1] = color[1];
      rgb[i + 2] = color[2];
    }
  }
}

function setPx(rgb, x, y, color) {
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const i = (y * W + x) * 3;
  rgb[i] = color[0];
  rgb[i + 1] = color[1];
  rgb[i + 2] = color[2];
}

function drawGlyph(rgb, bits, x, y, scale, color) {
  for (let row = 0; row < 7; row++) {
    const line = bits[row] || 0;
    for (let col = 0; col < 5; col++) {
      if ((line & (16 >> col)) === 0) continue;
      fillRect(rgb, x + col * scale, y + row * scale, scale, scale, color);
    }
  }
}

function textWidth(text, scale) {
  const gap = Math.max(1, scale);
  return [...String(text)].reduce((n, ch, i) => n + 5 * scale + (i ? gap : 0), 0);
}

function drawText(rgb, text, x, y, scale, color) {
  const gap = Math.max(1, scale);
  let cx = x;
  for (const ch of String(text)) {
    drawGlyph(rgb, glyph(ch), cx, y, scale, color);
    cx += 5 * scale + gap;
  }
  return cx;
}

function wrapText(text, scale, maxW) {
  const words = String(text || "").split(/\s+/).filter(Boolean);
  const lines = [];
  let cur = "";
  for (const word of words) {
    const next = cur ? `${cur} ${word}` : word;
    if (textWidth(next, scale) <= maxW) cur = next;
    else {
      if (cur) lines.push(cur);
      cur = word;
    }
  }
  if (cur) lines.push(cur);
  return lines.slice(0, 3);
}

function line(rgb, x0, y0, x1, y1, color, thick) {
  let dx = Math.abs(x1 - x0);
  let dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;
  let x = x0;
  let y = y0;
  const r = thick >> 1;
  for (;;) {
    for (let oy = -r; oy <= r; oy++) for (let ox = -r; ox <= r; ox++) setPx(rgb, x + ox, y + oy, color);
    if (x === x1 && y === y1) break;
    const e2 = err << 1;
    if (e2 > -dy) { err -= dy; x += sx; }
    if (e2 < dx) { err += dx; y += sy; }
  }
}

function blit(rgb, image, dx, dy, dw, dh) {
  if (!image || !image.rgba || !image.w || !image.h) return;
  const { w, h, rgba } = image;
  for (let y = 0; y < dh; y++) {
    const sy = Math.min(h - 1, (y * h / dh) | 0);
    for (let x = 0; x < dw; x++) {
      const sx = Math.min(w - 1, (x * w / dw) | 0);
      const si = (sy * w + sx) * 4;
      const a = rgba[si + 3];
      if (a < 16) continue;
      const di = ((dy + y) * W + (dx + x)) * 3;
      if (dx + x < 0 || dy + y < 0 || dx + x >= W || dy + y >= H) continue;
      const t = a / 255;
      rgb[di] = (rgba[si] * t + rgb[di] * (1 - t)) | 0;
      rgb[di + 1] = (rgba[si + 1] * t + rgb[di + 1] * (1 - t)) | 0;
      rgb[di + 2] = (rgba[si + 2] * t + rgb[di + 2] * (1 - t)) | 0;
    }
  }
}

export function sparkPoints(html) {
  const m = String(html || "").match(/data-p="([^"]*)"/);
  if (!m) return [];
  let rows = [];
  const quot = new RegExp("&" + "quot;", "g");
  try { rows = JSON.parse(m[1].replace(quot, '"').replace(/&#39;/g, "'")); } catch { return []; }
  if (!Array.isArray(rows)) return [];
  return rows
    .filter((p) => Array.isArray(p) && Number(p[1]) > 0 && !p[3])
    .slice(-36)
    .map((p) => Math.round(Number(p[1]) * 100) / 100);
}

export function productShareId(pathname) {
  const m = String(pathname || "").match(/^\/og\/product\/([^/]+)\.png$/);
  if (!m) return "";
  let id = m[1];
  try { id = decodeURIComponent(id); } catch { return ""; }
  return SHARE_ID.test(id) ? id : "";
}

export function productShareUrl(id) {
  const raw = typeof id === "string" ? id : (id && id.id) || "";
  const safe = String(raw || "").trim();
  if (!SHARE_ID.test(safe)) return "";
  return `${ORIGIN}/og/product/${encodeURIComponent(safe)}.png`;
}

function formatDay(iso) {
  const [y, mo, d] = String(iso).split("-").map(Number);
  if (!(y > 0 && mo >= 1 && mo <= 12 && d >= 1)) return "";
  return `${MONTHS[mo - 1]} ${d}, ${y}`;
}

function publicSource(card) {
  const src = String(card && card.source || "").trim();
  if (!src || /tcgcsv|ebay-browse-api|\.json/i.test(src)) return "TCGplayer market";
  return src;
}

export function shareFieldsFromProduct(card) {
  if (!card) return null;
  const name = String(card.name || "").replace(/[\u0000-\u001f]/g, "").replace(/\s+/g, " ").trim().slice(0, 90) || "Product";
  const priceNum = Number(card.price);
  const day = String(card.asOf || card.priceDate || "").slice(0, 10);
  const hist = Array.isArray(card.hist) ? card.hist : [];
  const points = hist
    .filter((p) => Array.isArray(p) && Number(p[1]) > 0 && !p[3])
    .slice(-36)
    .map((p) => Math.round(Number(p[1]) * 100) / 100);
  return {
    name,
    price: priceNum > 0 ? money(priceNum) : "",
    date: /^\d{4}-\d{2}-\d{2}$/.test(day) ? formatDay(day) : "",
    source: publicSource(card),
    points,
  };
}

const SHARE_ISO = /^\d{4}-\d{2}-\d{2}$/;

function lastListing(series) {
  const pts = [];
  for (const row of series || []) {
    const d = Array.isArray(row) ? row[0] : row && row.date;
    const n = Number(Array.isArray(row) ? row[1] : row && row.listingCount);
    const day = String(d || "").slice(0, 10);
    if (!SHARE_ISO.test(day) || !Number.isFinite(n) || n < 0) continue;
    pts.push([day, Math.round(n)]);
  }
  pts.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
  if (!pts.length) return null;
  return { n: pts[pts.length - 1][1], day: pts[pts.length - 1][0] };
}

// Last real listings counted night. Sealed uses the dive series. A single uses
// its item-read count. A miss returns null. Never estimated.
export async function shareListings(card, fetchImpl = fetch) {
  if (!card || !card.id) return null;
  try {
    if (card.kind === "sealed") {
      const diveMap = await loadDiveIndex(fetchImpl);
      const id = String(card.id);
      const sealedId = (diveMap && diveMap.byTcgcsv && diveMap.byTcgcsv[id]) || ((diveMap && diveMap.ids || []).includes(id) ? id : "");
      if (!sealedId) return null;
      const dive = await loadDive(sealedId, fetchImpl);
      return lastListing(dive && dive.series);
    }
    if (card.setSlug) {
      const row = await loadItemRead(card.setSlug, card.id, fetchImpl);
      const listed = row && row.listings;
      const day = String(listed && listed.date || "").slice(0, 10);
      const n = Number(listed && listed.n);
      if (Number.isInteger(n) && n >= 0 && SHARE_ISO.test(day)) return { n, day };
    }
  } catch { return null; }
  return null;
}

// Lines for the share card. Listings counted, sold median, and graded pop
// only when those numbers are real. Pop stays off sealed. EUR is not drawn:
// the bitmap font has no euro sign, and the page already shows Cardmarket.
export function shareFactLines({ depth = null, listings = null, kind = "single" } = {}) {
  const lines = [];
  const n = Number(listings && listings.n);
  const day = String(listings && listings.day || "").slice(0, 10);
  if (Number.isFinite(n) && n >= 0 && SHARE_ISO.test(day)) lines.push(`${Math.round(n).toLocaleString("en-US")} listings counted`);
  const sold = depth && depth.sold;
  if (sold && sold.n >= 5 && sold.median > 0 && SHARE_ISO.test(String(sold.first || "")) && SHARE_ISO.test(String(sold.last || ""))) {
    const cash = money(sold.median);
    if (cash) lines.push(`Sold median ${cash}`);
  }
  const pop = depth && depth.pop;
  if (kind !== "sealed" && pop && Number(pop.total) > 0) lines.push(`${Math.round(Number(pop.total)).toLocaleString("en-US")} graded`);
  return lines.slice(0, 3);
}

export function productShareCacheKey(id, dataVersion = "", buildId = "") {
  const url = new URL(`${ORIGIN}/og/product/${encodeURIComponent(id)}.png`);
  const day = String(dataVersion || "").slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(day)) url.searchParams.set("dv", day);
  url.searchParams.set("bv", edgeBuildId(buildId));
  url.searchParams.sort();
  return new Request(url.toString(), { method: "GET" });
}

function cleanName(value) {
  return String(value || "Product").replace(/[\u0000-\u001f]/g, "").replace(/\s+/g, " ").trim().slice(0, 90) || "Product";
}

export function drawProductShare(opts = {}) {
  const rgb = new Uint8Array(W * H * 3);
  const bg = [16, 14, 12];
  const gold = [217, 183, 121];
  const ink = [246, 241, 231];
  const dim = [176, 168, 156];
  const panel = [32, 28, 24];
  fillRect(rgb, 0, 0, W, H, bg);
  fillRect(rgb, 0, 0, W, 10, gold);

  const image = opts.image;
  const hasPhoto = !!(image && image.w && image.h);
  let textX = 56;
  if (hasPhoto) {
    fillRect(rgb, 48, 78, 360, 360, panel);
    blit(rgb, image, 64, 94, 328, 328);
    textX = 448;
  }
  const maxW = W - textX - 56;
  drawText(rgb, "Catch'em", textX, 48, 4, gold);
  const name = cleanName(opts.name);
  const lines = wrapText(name, 6, maxW);
  lines.forEach((lineText, i) => drawText(rgb, lineText, textX, 120 + i * 58, 6, ink));
  const price = String(opts.price || "").replace(/[^0-9$.,]/g, "").slice(0, 16);
  if (price) drawText(rgb, price, textX, hasPhoto ? 320 : 340, 8, gold);
  const date = String(opts.date || "").replace(/[^\w ,]/g, "").slice(0, 32);
  const source = String(opts.source || "").replace(/[^\w .]/g, "").slice(0, 32) || "TCGplayer market";
  const meta = [source, date].filter(Boolean).join("  ");
  drawText(rgb, meta, textX, hasPhoto ? 410 : 430, 4, dim);
  const facts = (Array.isArray(opts.facts) ? opts.facts : [])
    .map((lineText) => [...String(lineText)].filter((ch) => FONT[ch] || FONT[String(ch).toUpperCase()]).join("").replace(/\s+/g, " ").trim().slice(0, 42))
    .filter(Boolean)
    .slice(0, 3);
  facts.forEach((lineText, i) => {
    drawText(rgb, lineText, textX, (hasPhoto ? 448 : 468) + i * 28, 3, ink);
  });

  const pts = (Array.isArray(opts.points) ? opts.points : []).map(Number).filter((n) => n > 0).slice(-36);
  const boxX = hasPhoto ? 448 : 56;
  const boxY = facts.length ? (hasPhoto ? 540 : 548) : (hasPhoto ? 460 : 490);
  const boxW = hasPhoto ? 696 : 1088;
  const boxH = facts.length ? (hasPhoto ? 72 : 64) : (hasPhoto ? 130 : 100);
  if (pts.length >= 2) {
    fillRect(rgb, boxX, boxY, boxW, boxH, panel);
    const min = Math.min(...pts);
    const max = Math.max(...pts);
    const span = max - min || Math.abs(max) * 0.08 || 1;
    const lo = min - span * 0.08;
    const hi = max + span * 0.08;
    const coords = pts.map((v, i) => [
      boxX + 16 + (i / (pts.length - 1)) * (boxW - 32),
      boxY + boxH - 16 - ((v - lo) / (hi - lo)) * (boxH - 32),
    ]);
    for (let i = 1; i < coords.length; i++) {
      line(rgb, coords[i - 1][0] | 0, coords[i - 1][1] | 0, coords[i][0] | 0, coords[i][1] | 0, gold, 3);
    }
  }
  return rgb;
}

function crc32(bytes) {
  let c = ~0;
  for (let i = 0; i < bytes.length; i++) {
    c ^= bytes[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}

function chunk(type, data) {
  const out = new Uint8Array(12 + data.length);
  const view = new DataView(out.buffer);
  view.setUint32(0, data.length);
  out[4] = type.charCodeAt(0);
  out[5] = type.charCodeAt(1);
  out[6] = type.charCodeAt(2);
  out[7] = type.charCodeAt(3);
  out.set(data, 8);
  const crc = crc32(out.subarray(4, 8 + data.length));
  view.setUint32(8 + data.length, crc);
  return out;
}

function concat(parts) {
  const n = parts.reduce((s, p) => s + p.length, 0);
  const out = new Uint8Array(n);
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}

async function zlibDeflate(raw) {
  const cs = new CompressionStream("deflate");
  const stream = new Blob([raw]).stream().pipeThrough(cs);
  const zipped = new Uint8Array(await new Response(stream).arrayBuffer());
  if (zipped.length >= 2 && zipped[0] === 0x78) return zipped;
  const ds = new CompressionStream("deflate-raw");
  const rawZip = new Uint8Array(await new Response(new Blob([raw]).stream().pipeThrough(ds)).arrayBuffer());
  const wrapped = new Uint8Array(rawZip.length + 6);
  wrapped[0] = 0x78;
  wrapped[1] = 0x01;
  wrapped.set(rawZip, 2);
  let a = 1;
  let b = 0;
  for (let i = 0; i < raw.length; i++) {
    a = (a + raw[i]) % 65521;
    b = (b + a) % 65521;
  }
  const view = new DataView(wrapped.buffer);
  view.setUint32(wrapped.length - 4, (b << 16) | a);
  return wrapped;
}

export async function renderProductSharePng(opts = {}) {
  const rgb = drawProductShare(opts);
  const raw = new Uint8Array((W * 3 + 1) * H);
  for (let y = 0; y < H; y++) {
    const row = y * (W * 3 + 1);
    raw[row] = 0;
    raw.set(rgb.subarray(y * W * 3, (y + 1) * W * 3), row + 1);
  }
  const idat = await zlibDeflate(raw);
  const ihdr = new Uint8Array(13);
  const view = new DataView(ihdr.buffer);
  view.setUint32(0, W);
  view.setUint32(4, H);
  ihdr[8] = 8;
  ihdr[9] = 2;
  const sig = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
  return concat([sig, chunk("IHDR", ihdr), chunk("IDAT", idat), chunk("IEND", new Uint8Array())]);
}

function paeth(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  if (pb <= pc) return b;
  return c;
}

export async function decodePng(bytes) {
  const u = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  if (u.length < 8 || u[0] !== 137 || u[1] !== 80) return null;
  let w = 0;
  let h = 0;
  let color = 2;
  const idats = [];
  let o = 8;
  while (o + 8 <= u.length) {
    const len = new DataView(u.buffer, u.byteOffset + o, 4).getUint32(0);
    const type = String.fromCharCode(u[o + 4], u[o + 5], u[o + 6], u[o + 7]);
    const data = u.subarray(o + 8, o + 8 + len);
    if (type === "IHDR") {
      const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
      w = view.getUint32(0);
      h = view.getUint32(4);
      color = data[9];
    } else if (type === "IDAT") idats.push(data);
    else if (type === "IEND") break;
    o += 12 + len;
  }
  if (!w || !h || (color !== 2 && color !== 6)) return null;
  const zipped = concat(idats);
  const inflated = new Uint8Array(await new Response(new Blob([zipped]).stream().pipeThrough(new DecompressionStream("deflate"))).arrayBuffer());
  const bpp = color === 6 ? 4 : 3;
  const stride = w * bpp;
  const out = new Uint8Array(w * h * 4);
  let prev = new Uint8Array(stride);
  let i = 0;
  for (let y = 0; y < h; y++) {
    const filter = inflated[i++];
    const row = inflated.subarray(i, i + stride);
    i += stride;
    const cur = new Uint8Array(stride);
    for (let x = 0; x < stride; x++) {
      const left = x >= bpp ? cur[x - bpp] : 0;
      const up = prev[x] || 0;
      const ul = x >= bpp ? prev[x - bpp] : 0;
      const v = row[x];
      if (filter === 0) cur[x] = v;
      else if (filter === 1) cur[x] = (v + left) & 255;
      else if (filter === 2) cur[x] = (v + up) & 255;
      else if (filter === 3) cur[x] = (v + ((left + up) >> 1)) & 255;
      else cur[x] = (v + paeth(left, up, ul)) & 255;
    }
    for (let x = 0; x < w; x++) {
      const di = (y * w + x) * 4;
      const si = x * bpp;
      if (bpp === 4) {
        out[di] = cur[si];
        out[di + 1] = cur[si + 1];
        out[di + 2] = cur[si + 2];
        out[di + 3] = cur[si + 3];
      } else {
        out[di] = cur[si];
        out[di + 1] = cur[si + 1];
        out[di + 2] = cur[si + 2];
        out[di + 3] = 255;
      }
    }
    prev = cur;
  }
  return { w, h, rgba: out };
}

function safeImagePath(value) {
  const raw = String(value || "").trim();
  if (!raw || raw.includes("..") || raw.includes("\\") || raw.includes(" ")) return "";
  if (raw.startsWith(ORIGIN + "/")) return raw;
  if (raw.startsWith("/") && !raw.startsWith("//")) return ORIGIN + raw;
  return "";
}

function edgePngCache() {
  try { return typeof caches !== "undefined" && caches.default ? caches.default : null; } catch { return null; }
}

function asPngHit(hit, dataVersion) {
  const h = new Headers(hit.headers);
  h.set("cdn-cache-control", "no-store");
  h.set("x-edge-cache", "hit");
  if (dataVersion) h.set("x-data-version", dataVersion);
  return new Response(hit.body, { status: 200, headers: h });
}

export async function handleProductShare(request, url, opts = {}) {
  if (typeof opts === "function") opts = { fetchImpl: opts };
  const fetchImpl = opts.fetchImpl || fetch;
  const id = productShareId(url.pathname);
  if (!id) {
    return new Response("Not found", {
      status: 404,
      headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" },
    });
  }

  const env = opts.env;
  const ctx = opts.ctx;
  if (env?.FEED_KV) setRawKv(env.FEED_KV, ctx?.waitUntil ? (job) => ctx.waitUntil(job) : undefined);
  let dataVersion = String(opts.dataVersion || currentDataVersion() || "").slice(0, 10);
  if (!dataVersion) {
    dataVersion = String(await publicDataVersion(fetchImpl) || "").slice(0, 10);
    if (dataVersion) setDataVersion(dataVersion);
  }
  const buildId = opts.buildId != null ? opts.buildId : BUILD_SHA;
  const cache = edgePngCache();
  const key = productShareCacheKey(id, dataVersion, buildId);
  if (cache) {
    try {
      const hit = await cache.match(key);
      if (hit) return asPngHit(hit, dataVersion);
    } catch { /* miss */ }
  }

  const loadProduct = opts.loadProduct || ((pid) => bucketRow(pid, fetchImpl));
  const card = await loadProduct(id);
  const fields = shareFieldsFromProduct(card);
  if (!fields) {
    return new Response("Not found", {
      status: 404,
      headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" },
    });
  }
  let facts = [];
  if (opts.shareExtras !== false) {
    try {
      const depth = typeof opts.loadDepth === "function" ? await opts.loadDepth(card) : await marketDepthFor(card, fetchImpl);
      const listings = typeof opts.loadListings === "function" ? await opts.loadListings(card) : await shareListings(card, fetchImpl);
      facts = shareFactLines({ depth, listings, kind: card.kind === "sealed" ? "sealed" : "single" });
    } catch { facts = []; }
  }
  const png = await renderProductSharePng({ ...fields, facts, image: opts.image });
  const headers = {
    "content-type": "image/png",
    "cache-control": "public, max-age=86400",
    "cdn-cache-control": "no-store",
    "x-content-type-options": "nosniff",
  };
  if (dataVersion) headers["x-data-version"] = dataVersion;
  const res = new Response(request.method === "HEAD" ? null : png, { status: 200, headers });
  if (cache && request.method !== "HEAD") {
    try {
      const stored = res.clone();
      const h = new Headers(stored.headers);
      h.set("cache-control", "public, max-age=86400");
      h.delete("cdn-cache-control");
      const put = cache.put(key, new Response(stored.body, { status: 200, headers: h })).catch(() => {});
      if (ctx?.waitUntil) ctx.waitUntil(put); else await put;
    } catch { /* never block the image on the cache */ }
  }
  return res;
}
