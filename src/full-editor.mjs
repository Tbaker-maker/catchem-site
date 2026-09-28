// The full Post Office editor (Catchem-data research/assets/build.html).
// Prices on that file are the August read. This overlays the live catalog.

const RAW = "https://raw.githubusercontent.com/Tbaker-maker/Catchem-data/main/research/assets/";
export const EDITOR_URL = RAW + "build.html";
export const PAPER_URL = RAW + "paper-" + "rows.json";
export const POCKET_URL = RAW + "pocket-" + "rows.json";
export const PAPER_PATH = "/data/editor/" + "paper-" + "rows.json";
export const POCKET_PATH = "/data/editor/" + "pocket-" + "rows.json";

export const EXPORT_SIZES = [
  ["X", 1600, 900],
  ["Facebook", 1200, 630],
  ["Instagram", 1080, 1350],
  ["YouTube", 1280, 720],
];

const htmlCache = new Map();

export function setKey(name) {
  let t = String(name || "").toLowerCase().replace(/pokémon/g, "pokemon");
  const cut = t.lastIndexOf(":");
  if (cut >= 0) t = t.slice(cut + 1);
  t = t.replace(/&/g, " and ");
  t = t.replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
  return t;
}

const ERA = new Set(["sm", "xy", "bw", "dp", "hgss", "pop", "ex"]);
const DENY_STRIP = new Set(["base set", "base", "promos", "promo", "black star promos"]);

export function indexKeys(setName) {
  const key = setKey(setName);
  const keys = new Set([key]);
  const parts = key.split(" ");
  if (parts.length > 1 && ERA.has(parts[0])) {
    const rest = parts.slice(1).join(" ");
    if (rest && !DENY_STRIP.has(rest)) keys.add(rest);
  }
  return [...keys];
}

const SET_ALIAS = {
  "hidden fates shiny vault": ["shiny vault"],
  "shining fates shiny vault": ["shiny vault"],
  "expedition base set": ["expedition"],
  "crown zenith galarian gallery": ["galarian gallery"],
  "swsh black star promos": ["sword and shield promo cards"],
  "sm black star promos": ["sm promos"],
  "xy black star promos": ["xy promos"],
  "bw black star promos": ["black and white promos"],
  "dp black star promos": ["diamond and pearl promos"],
  "hgss black star promos": ["hgss promos"],
  "wizards black star promos": ["wotc promo"],
  "nintendo black star promos": ["nintendo promos"],
  "best of game": ["best of promos"],
  "sword and shield": ["sword and shield base set"],
  xy: ["xy base set"],
  "sun and moon": ["sm base set"],
};

export function lookupKeys(setName) {
  const key = setKey(setName);
  const keys = new Set([key]);
  if (key === "base") keys.add("base set");
  if (key === "151") keys.add("scarlet and violet 151");
  if (key.startsWith("hs ")) keys.add(key.slice(3));
  if (key.includes(" and ")) keys.add(key.replace(/ and /g, " "));
  const parts = key.split(" ");
  if (parts.length > 1 && ERA.has(parts[0])) {
    const rest = parts.slice(1).join(" ");
    if (rest && !DENY_STRIP.has(rest)) keys.add(rest);
  }
  for (const extra of SET_ALIAS[key] || []) keys.add(extra);
  return [...keys];
}

export function numOfId(id) {
  const tail = String(id || "").split("-").pop();
  if (/^[A-Za-z]+\d+$/.test(tail)) return tail.toUpperCase();
  if (/^\d+$/.test(tail)) return String(Number(tail));
  return "";
}

export function numOfPrinted(value) {
  const raw = String(value || "");
  const coded = raw.match(/^([A-Za-z]+\d+)\b/);
  if (coded) return coded[1].toUpperCase();
  const match = raw.match(/^(\d+)/);
  return match ? String(Number(match[1])) : "";
}

export function nameKey(name) {
    return String(name || "")
    .toLowerCase()
    .replace(/★/g, " star ")
    .replace(/δ/g, " delta ")
    .replace(/\(.*?\)/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function scoreName(paper, lite) {
  if (!paper || !lite) return 0;
  if (paper === lite) return 5;
  if (lite.startsWith(paper + " ") || paper.startsWith(lite + " ")) return 4;
  if (lite.startsWith(paper) || paper.startsWith(lite)) return 3;
  const left = paper.split(" ");
  const right = lite.split(" ");
  if (left[0] && left[0] === right[0] && left[0].length > 3) {
    if (left[1] && right[1] && left[1] === right[1]) return 3;
    if (!left[1] || !right[1]) return 2;
  }
  return 0;
}

function pick(cands, name) {
  let best = 0;
  let ties = [];
  for (const cand of cands || []) {
    const score = scoreName(name, cand.name);
    if (score > best) {
      best = score;
      ties = [cand];
    } else if (score === best && score > 0) ties.push(cand);
  }
  if (best < 2 || !ties.length) return null;
  ties.sort((a, b) => Math.abs(a.name.length - name.length) - Math.abs(b.name.length - name.length) || b.price - a.price);
  return ties[0];
}

export function patchPaperRows(rows, lite) {
  const bySetNum = new Map();
  for (const row of lite || []) {
    if (!row || row[5] === "sealed") continue;
    const price = Number(row[6]);
    if (!Number.isFinite(price) || price <= 0) continue;
    const own = setKey(row[2]);
    const rec = { price, name: nameKey(row[1]), set: own, num: numOfPrinted(row[3]), id: row[0], exact: new Set([own]) };
    if (!rec.num) continue;
    for (const key of indexKeys(row[2])) {
      if (key === own) rec.exact.add(key);
      const bucket = key + "|" + rec.num;
      if (!bySetNum.has(bucket)) bySetNum.set(bucket, []);
      bySetNum.get(bucket).push(rec);
    }
  }
  let matched = 0;
  const out = (rows || []).map((row) => {
    const copy = row.slice();
    const name = nameKey(row[1]);
    const num = numOfId(row[0]);
    let found = null;
    if (num) {
      const exactPool = [];
      const aliasPool = [];
      for (const key of lookupKeys(row[2])) {
        const hit = bySetNum.get(key + "|" + num);
        if (!hit) continue;
        for (const cand of hit) (cand.exact.has(key) ? exactPool : aliasPool).push(cand);
      }
      found = pick(exactPool, name) || pick(aliasPool, name);
    }
    if (found) {
      copy[6] = Math.round(found.price * 100) / 100;
      if (copy.length > 18) copy[18] = 0;
      matched += 1;
    } else if (copy.length > 6) {
      copy[6] = 0;
      if (copy.length > 18) copy[18] = 0;
    }
    return copy;
  });
  return { rows: out, matched, total: out.length };
}

const SIZE_JS = `<script id="sizes-boot">
(function(){
  var sizes = ${JSON.stringify(EXPORT_SIZES)};
  function boot(){
    var dl = document.getElementById("dl");
    if (!dl || document.getElementById("sizes")) return;
    var row = document.createElement("div");
    row.id = "sizes";
    row.style.cssText = "display:flex;flex-wrap:wrap;gap:8px;margin:8px 0 14px";
    sizes.forEach(function(spec){
      var button = document.createElement("button");
      button.type = "button";
      button.className = "sec";
      button.textContent = spec[0] + " " + spec[1] + "x" + spec[2];
      button.onclick = function(){ saveSize(spec[0], spec[1], spec[2]); };
      row.appendChild(button);
    });
    dl.parentNode.insertBefore(row, dl.nextSibling);
  }
  function saveSize(label, w, h){
    var shown = document.getElementById("outimg");
    var stage = document.getElementById("cv");
    function paint(im){
      var out = document.createElement("canvas");
      out.width = w; out.height = h;
      var g = out.getContext("2d");
      g.fillStyle = "#070910";
      g.fillRect(0, 0, w, h);
      var iw = im.naturalWidth || im.width, ih = im.naturalHeight || im.height;
      if (!iw || !ih) return;
      var scale = Math.min(w / iw, h / ih);
      var dw = Math.round(iw * scale), dh = Math.round(ih * scale);
      g.drawImage(im, Math.round((w - dw) / 2), Math.round((h - dh) / 2), dw, dh);
      out.toBlob(function(blob){
        if (!blob) return;
        var a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = "catchem-" + String(label).toLowerCase() + ".png";
        document.body.appendChild(a);
        a.click();
        a.remove();
      }, "image/png");
    }
    if (shown && shown.src && shown.src.indexOf("data:") === 0) {
      var im = new Image();
      im.onload = function(){ paint(im); };
      im.src = shown.src;
      return;
    }
    if (stage && stage.width > 2) { try { paint(stage); } catch (err) {} }
  }
  boot();
  setTimeout(boot, 0);
})();
</script>`;

export function patchEditorHtml(html, asOf) {
  const date = String(asOf || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("price date");
  let out = String(html || "");
  const fetchPaper = 'fetch("' + "paper-" + "rows.json";
  const fetchPocket = 'fetch("' + "pocket-" + "rows.json";
  out = out.split(fetchPaper).join('fetch("' + PAPER_PATH);
  out = out.split(fetchPocket).join('fetch("' + POCKET_PATH);
  out = out.replace(/const PRICES_AS_OF = "[^"]*";/, 'const PRICES_AS_OF = "' + date + '";');
  out = out.split('dateNote = "priced " + PRICES_AS_OF;').join('dateNote = "TCGplayer market (" + PRICES_AS_OF + ")";');
  const stale = ["sells", "for", "about"].join(" ");
  out = out.split(' + " ' + stale + ' " + ').join(' + " — TCGplayer market $" + ');
  out = out.split(' + " for about " + ').join(' + " — TCGplayer market $" + ');
  out = out.split('? fname() : "catchem") + ".jpg"').join('? fname() : "catchem.png")');
  out = out.split('? fname() : "catchem") + (b.type.indexOf("jpeg") >= 0 ? ".jpg" : ".png")').join('? fname() : "catchem.png")');
  out = out.split("window.__PAPER_ROWS : CORE_ROWS.slice()").join("window.__PAPER_ROWS : []");
  if (!out.includes('id="sizes-boot"')) out += SIZE_JS;
  return out;
}

async function textOf(url, fetchImpl) {
  if (htmlCache.has(url)) return htmlCache.get(url);
  const res = await fetchImpl(url);
  if (!res.ok) throw new Error(url + " " + res.status);
  const body = await res.text();
  htmlCache.set(url, body);
  return body;
}

export function resetEditorCache() {
  htmlCache.clear();
}

export async function editorDocument(asOf, fetchImpl = fetch) {
  const raw = await textOf(EDITOR_URL, fetchImpl);
  return patchEditorHtml(raw, asOf);
}

export async function patchedPaper(fetchImpl = fetch) {
  const key = "patched-paper";
  if (htmlCache.has(key)) return htmlCache.get(key);
  const [paperRes, lite] = await Promise.all([
    textOf(PAPER_URL, fetchImpl),
    (async () => {
      const { loadJson } = await import("./data.mjs");
      return loadJson("search-lite.json", fetchImpl);
    })(),
  ]);
  const rows = JSON.parse(paperRes);
  const patched = patchPaperRows(rows, lite);
  const body = JSON.stringify(patched.rows);
  htmlCache.set(key, body);
  htmlCache.set("patched-paper-stats", patched);
  return body;
}

export async function pocketDocument(fetchImpl = fetch) {
  return textOf(POCKET_URL, fetchImpl);
}
