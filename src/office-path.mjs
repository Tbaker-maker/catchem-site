// Deep links into Post Office. A product, a weekly move, or the share card
// can open the editor already holding that item. Query values are allow-listed.

const ID_OK = /^(tcgcsv-\d+|tcgp-[A-Za-z0-9-]+|[a-z][a-z0-9]*-[a-z0-9-]+)$/i;
const KINDS = new Set(["single", "sealed", "pocket"]);
const TONES = new Set(["informative", "hype", "chill", "funny"]);
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const MOVE = /^[+-]?\d+(?:\.\d+)?%$/;
const PRICE = /^\d+(?:\.\d{1,2})?$/;

function esc(value) {
  return String(value ?? "")
    .split("&").join("&amp;")
    .split("<").join("&lt;")
    .split(">").join("&gt;")
    .split('"').join("&quot;")
    .split("'").join("&#39;");
}

export function cleanIds(value) {
  const raw = Array.isArray(value) ? value : String(value || "").split(",");
  const out = [];
  for (const item of raw) {
    const id = String(item || "").trim();
    if (!ID_OK.test(id)) continue;
    const key = id.toLowerCase().startsWith("tcgcsv-") || id.toLowerCase().startsWith("tcgp-") ? id.toLowerCase() : id;
    if (!out.includes(key) && out.length < 4) out.push(key);
  }
  return out;
}

function cleanName(value) {
  const name = String(value || "").replace(/\s+/g, " ").trim().slice(0, 80);
  if (!name || /[\u2014\u2013]/.test(name)) return "";
  if (/\b(sold|buy|sell|invest|advice)\b/i.test(name)) return "";
  return name;
}

function cleanMoney(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return "";
  return n.toFixed(2);
}

export function parseOfficeQuery(search) {
  let raw = String(search || "").trim();
  if (raw.startsWith("/")) raw = "https://catchemtcg.com" + raw;
  else if (raw.startsWith("?")) raw = "https://catchemtcg.com/" + raw;
  const q = raw.includes("://")
    ? new URL(raw).searchParams
    : new URLSearchParams(raw);
  const ids = cleanIds(q.get("ids") || q.get("id") || "");
  const kind = KINDS.has(String(q.get("kind") || "").trim()) ? String(q.get("kind")).trim() : "";
  const tone = TONES.has(String(q.get("tone") || "").trim().toLowerCase()) ? String(q.get("tone")).trim().toLowerCase() : "";
  const move = MOVE.test(String(q.get("move") || "").trim()) ? String(q.get("move")).trim() : "";
  const from = DAY.test(String(q.get("from") || "").trim()) ? String(q.get("from")).trim() : "";
  const to = DAY.test(String(q.get("to") || "").trim()) ? String(q.get("to")).trim() : "";
  const p0 = PRICE.test(String(q.get("p0") || "").trim()) ? String(q.get("p0")).trim() : "";
  const p1 = PRICE.test(String(q.get("p1") || "").trim()) ? String(q.get("p1")).trim() : "";
  const name = cleanName(q.get("name") || "");
  const listings = String(q.get("listings") || "").trim() === "1";
  return { ids, kind, tone, move, from, to, p0, p1, name, listings };
}

export function officeQuery(fields = {}) {
  const q = new URLSearchParams();
  const ids = cleanIds(fields.ids);
  if (ids.length) q.set("ids", ids.join(","));
  if (KINDS.has(fields.kind)) q.set("kind", fields.kind);
  if (TONES.has(fields.tone)) q.set("tone", fields.tone);
  if (MOVE.test(String(fields.move || "").trim())) q.set("move", String(fields.move).trim());
  if (DAY.test(String(fields.from || "").trim())) q.set("from", String(fields.from).trim());
  if (DAY.test(String(fields.to || "").trim())) q.set("to", String(fields.to).trim());
  const p0 = cleanMoney(fields.p0);
  const p1 = cleanMoney(fields.p1);
  if (p0) q.set("p0", p0);
  if (p1) q.set("p1", p1);
  const name = cleanName(fields.name);
  if (name) q.set("name", name);
  if (fields.listings === true) q.set("listings", "1");
  return q.toString();
}

export function officeHref(fields = {}) {
  const qs = officeQuery(fields);
  return qs ? `/post-office?${qs}` : "/post-office";
}

export function officeAppQuery(search, rev = "") {
  const parsed = typeof search === "string" || search == null ? parseOfficeQuery(search || "") : search;
  const qs = officeQuery(parsed);
  const v = encodeURIComponent(String(rev || "dev").slice(0, 12) || "dev");
  return qs ? `/post-office/app?v=${v}&${qs}` : `/post-office/app?v=${v}`;
}

function moneyText(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return "";
  return "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function dayLabel(iso) {
  const s = String(iso || "").slice(0, 10);
  if (!DAY.test(s)) return "";
  return `${MONTHS[Number(s.slice(5, 7)) - 1]} ${Number(s.slice(8, 10))}, ${s.slice(0, 4)}`;
}

export function moveCaption(fields = {}) {
  const parsed = {
    name: cleanName(fields.name),
    move: MOVE.test(String(fields.move || "").trim()) ? String(fields.move).trim() : "",
    from: dayLabel(fields.from),
    to: dayLabel(fields.to),
    p0: moneyText(fields.p0),
    p1: moneyText(fields.p1),
    listings: fields.listings === true,
  };
  if (parsed.listings && parsed.name && Number(fields.p0) >= 0 && Number(fields.p1) >= 0 && parsed.from && parsed.to) {
    return `${parsed.name}: ${Number(fields.p0)} listings counted on ${parsed.from}, from ${Number(fields.p1)} on ${parsed.to}${parsed.move ? `. ${parsed.move}` : ""}.`;
  }
  if (parsed.name && parsed.p0 && parsed.p1 && parsed.from && parsed.to) {
    return `${parsed.name}: ${parsed.p0} on ${parsed.from} to ${parsed.p1} on ${parsed.to}${parsed.move ? `. ${parsed.move}` : ""}.`;
  }
  if (parsed.name && parsed.move) return `${parsed.name}: ${parsed.move}.`;
  return parsed.name;
}

export function makePostLink(fields = {}, opts = {}) {
  const href = officeHref(fields);
  const label = String(opts.label || "Make a post");
  const cls = opts.className || "make-post";
  return `<a class="${esc(cls)}" href="${esc(href)}">${esc(label)}</a>`;
}

export function makePostCss() {
  return `.make-post{display:inline-flex;align-items:center;justify-content:center;min-height:44px;padding:0 16px;border-radius:999px;border:1px solid #3a342c;background:#1c1916;color:#efe9de;text-decoration:none;font:600 15px/1 var(--sans,system-ui,sans-serif)}.make-post:hover{border-color:#d9b779;color:#d9b779}.wk-row{display:flex;gap:10px;align-items:center;flex-wrap:wrap}.wk-row-main{display:flex;gap:10px;align-items:center;flex:1;min-width:0;min-height:44px;color:inherit;text-decoration:none}.po-path-note{margin:8px 16px;padding:10px 14px;border-radius:14px;background:#1a1815;border:1px solid #2f2b26;color:#efe9de;font:500 15px/1.4 var(--sans,system-ui,sans-serif)}.po-path-note[data-kind=error]{border-color:#8a4a3a;color:#f0c7bc}`;
}

// Runs inside the patched editor. Waits for window.__ce, resolves tcgcsv ids
// via card.cid (column 22), pins them, and fills the caption when a move is in the URL.
export function prefillBootJs() {
  return `(function(){
  function params(){
    try { return new URLSearchParams(location.search || ""); }
    catch (e) { return new URLSearchParams(); }
  }
  function cleanIds(value){
    var out = [];
    String(value || "").split(",").forEach(function(item){
      var id = String(item || "").trim();
      if (!id || out.indexOf(id) >= 0 || out.length >= 4) return;
      if (/^(tcgcsv-\\d+|tcgp-[A-Za-z0-9-]+|[A-Za-z][A-Za-z0-9]*-[A-Za-z0-9-]+)$/.test(id)) out.push(id);
    });
    return out;
  }
  function note(text, kind){
    var el = document.getElementById("po-path-note");
    if (!el) {
      el = document.createElement("p");
      el.id = "po-path-note";
      el.className = "po-path-note";
      var banner = document.getElementById("banner") || document.querySelector("header") || document.body.firstElementChild;
      if (banner && banner.parentNode) banner.insertAdjacentElement("afterend", el);
      else document.body.insertBefore(el, document.body.firstChild);
    }
    el.textContent = text || "";
    el.hidden = !text;
    el.setAttribute("data-kind", kind || "info");
  }
  function resolve(id){
    if (window.__ce && typeof window.__ce.card === "function") {
      var direct = window.__ce.card(id);
      if (direct && direct.id) return direct.id;
    }
    var list = window.CARDS || [];
    for (var i = 0; i < list.length; i++) {
      var c = list[i];
      if (!c) continue;
      if (c.id === id || c.cid === id || String(c.cid || "").toLowerCase() === String(id).toLowerCase()) return c.id;
    }
    return "";
  }
  function captionOf(q){
    var name = String(q.get("name") || "").replace(/\\s+/g, " ").trim();
    var move = String(q.get("move") || "").trim();
    var from = String(q.get("from") || "").trim();
    var to = String(q.get("to") || "").trim();
    var p0 = String(q.get("p0") || "").trim();
    var p1 = String(q.get("p1") || "").trim();
    var listings = q.get("listings") === "1";
    function money(v){
      var n = Number(v);
      if (!(n > 0)) return "";
      return "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
    var M = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    function day(d){
      if (!/^\\d{4}-\\d{2}-\\d{2}$/.test(d)) return "";
      return M[+d.slice(5,7) - 1] + " " + (+d.slice(8,10)) + ", " + d.slice(0,4);
    }
    if (listings && name && p0 && p1 && day(from) && day(to)) {
      return name + ": " + p0 + " listings counted on " + day(from) + ", from " + p1 + " on " + day(to) + (move ? ". " + move : "") + ".";
    }
    if (name && money(p0) && money(p1) && day(from) && day(to)) {
      return name + ": " + money(p0) + " on " + day(from) + " to " + money(p1) + " on " + day(to) + (move ? ". " + move : "") + ".";
    }
    if (name && move) return name + ": " + move + ".";
    return name;
  }
  function applyTone(tone){
    if (!tone) return;
    window.__cePrefillTone = tone;
    var btn = document.querySelector('#ai-tones [data-tone="' + tone + '"]');
    if (btn) btn.click();
  }
  function started(names, caption, tone){
    note((names.length ? "Draft started for " + names.join(" and ") + ". " : "Draft started. ")
      + (caption ? caption + " " : "")
      + "Make the picture, then copy the text or post to X.");
    applyTone(tone);
    var dock = document.getElementById("compose-dock");
    if (dock && dock.scrollIntoView) dock.scrollIntoView({ block: "start" });
    return true;
  }
  function goSealed(want, caption, tone){
    if (!window.__ceSealed || typeof window.__ceSealed.prefill !== "function") return false;
    var result = window.__ceSealed.prefill(want);
    if (!result) return false;
    if (!result.ids || !result.ids.length) {
      note("That sealed product is not in the Post Office catalog yet.", "error");
      return true;
    }
    return started(result.names || [], caption, tone);
  }
  function go(){
    var q = params();
    var want = cleanIds(q.get("ids") || q.get("id") || "");
    var kind = String(q.get("kind") || "").trim();
    var tone = String(q.get("tone") || "").trim().toLowerCase();
    var caption = captionOf(q);
    if (!want.length) {
      note("Pick a card, then Make the picture. Write the post for copy or Post to X.");
      return true;
    }
    if (kind === "sealed") return goSealed(want, caption, tone);
    if (!window.__ce || typeof window.__ce.inject !== "function") return false;
    var pins = [];
    want.forEach(function(id){
      var hit = resolve(id);
      if (hit && pins.indexOf(hit) < 0) pins.push(hit);
    });
    if (!pins.length) {
      if (window.__ceSealed && typeof window.__ceSealed.prefill === "function") return goSealed(want, caption, tone);
      note("That product is not in the Post Office catalog.", "error");
      return true;
    }
    window.__ce.inject({ pins: pins, parent: caption || undefined, emptyTray: false });
    var names = pins.map(function(id){
      var c = window.__ce.card(id);
      return c && c.name ? c.name : id;
    }).filter(Boolean);
    return started(names, caption, tone);
  }
  function wait(n){
    if (go()) return;
    if (n > 80) {
      var q = params();
      if (cleanIds(q.get("ids") || q.get("id") || "").length) {
        note("The editor did not finish loading. Refresh, or pick the card from the catalog.", "error");
      }
      return;
    }
    setTimeout(function(){ wait(n + 1); }, 250);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", function(){ wait(0); });
  else wait(0);
})();`;
}

export function prefillBootTag() {
  return `<script id="path-boot">${prefillBootJs()}</script>`;
}
