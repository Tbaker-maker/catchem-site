// Renders signal chips. Values arrive already chosen. This file does not
// decide cutoffs, and it does not explain how a chip was chosen.

export const ICON_LINES = Object.freeze([
  ["move", "Green is up, red is down, and grey is flat. The days shown are the days on file."],
  ["dash", "Price being checked."],
  ["listings", "eBay listings counted."],
  ["gone", "How fast listings are gone. Light, steady, or fast."],
  ["range", "Where today sits in the price range on file."],
  ["momentum", "Rising, Flat, or Cooling."],
  ["rotation", "Rotates in the months shown, when a date is on file."],
  ["art", "SIR, IR, or FA. That is the art on the card."],
  ["era", "Vintage or Modern."],
  ["confidence", "How much data is on file. More bars means more data."],
  ["dots", "One dot is a quiet reading. Five dots is an unusual reading."],
]);

export const ICON_SOURCE = "TCGplayer market and eBay listings counted. The date is the date on the read.";

export const SIGNAL_CSS = `
.sig-block{display:flex;flex-direction:column;gap:6px;max-width:100%;min-width:0}
.sig-row{display:flex;flex-wrap:wrap;align-items:center;gap:6px;max-width:100%;min-width:0;min-height:44px;margin:0;padding:0;color:inherit;text-decoration:none;position:relative}
.sig-open{display:flex;flex-wrap:wrap;align-items:center;gap:6px;max-width:100%;min-width:0;color:inherit;text-decoration:none}
.sig{display:inline-flex;align-items:center;gap:6px;min-height:32px;max-width:100%;padding:0 10px;border-radius:999px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);color:#efe9de;font:600 13px/1 var(--sans,"IBM Plex Sans",system-ui,sans-serif)}
.sig svg{display:block;flex:0 0 auto}
.sig.is-up{color:#7fc79a}
.sig.is-down{color:#e0675b}
.sig.is-flat,.sig.is-dash{color:#9a948a}
.sig.is-amber{color:#e0a15a}
.sig.is-neutral{color:#d9b779}
.sig.is-lead{flex:1 1 100%;justify-content:flex-start;min-height:44px;padding:0 14px;color:#efe9de;font-size:15px;background:rgba(217,183,121,.14);border-color:rgba(217,183,121,.55)}
.has-tap .sig.is-lead{padding-right:48px}
.sig-itap{position:absolute;top:0;right:0;z-index:2}
.sig-speed{font-weight:600}
.sig-track{position:relative;width:56px;height:8px;border-radius:999px;background:rgba(255,255,255,.16)}
.sig-dot{position:absolute;top:50%;width:10px;height:10px;margin:-5px 0 0 -5px;border-radius:999px;background:currentColor}
.sig-bars{display:inline-flex;align-items:flex-end;gap:2px;height:12px}
.sig-bars i{display:block;width:4px;border-radius:999px;background:rgba(255,255,255,.2)}
.sig-bars i.on{background:currentColor}
.sig-bars i:nth-child(1){height:5px}.sig-bars i:nth-child(2){height:8px}.sig-bars i:nth-child(3){height:12px}
.sig-dots{display:inline-flex;gap:3px}
.sig-dots i{width:6px;height:6px;border-radius:999px;background:rgba(255,255,255,.25)}
.sig-dots i.on{background:currentColor}
.sig-strength{display:inline-flex;gap:3px;align-items:center;margin-left:2px;color:#d9b779}
.sig-strength i{width:6px;height:6px;border-radius:999px;background:rgba(217,183,121,.35)}
.sig-strength i.on{background:#d9b779}
.sig.is-up .sig-strength,.sig.is-down .sig-strength,.sig.is-amber .sig-strength,.sig.is-flat .sig-strength,.sig.is-neutral .sig-strength{color:#d9b779}
.sig-overall{display:flex;flex-wrap:wrap;align-items:center;gap:8px;max-width:100%;min-width:0;min-height:44px;margin:0;color:#d9b779;font:600 13px/1 var(--sans,"IBM Plex Sans",system-ui,sans-serif)}
.sig-blurb{margin:0;max-width:100%;font:400 15px/1.4 var(--sans,"IBM Plex Sans",system-ui,sans-serif);color:var(--dim,#c4baab);overflow-wrap:anywhere}
.is-fast .sig-blurb,.is-fast .one-line,.is-fast .print-run{display:none}
.feed-tools{display:flex;flex-wrap:wrap;gap:8px;align-items:flex-start;max-width:100%;margin:0 0 8px}
.fast-toggle,.icon-key summary{min-height:44px;display:inline-flex;align-items:center;padding:0 14px;border-radius:999px;border:1px solid var(--line,#2f2b26);background:#1a1815;color:var(--txt,#efe9de);font:600 14px/1 var(--sans,"IBM Plex Sans",system-ui,sans-serif);cursor:pointer;list-style:none}
.icon-key summary::-webkit-details-marker{display:none}
.fast-toggle[aria-pressed="true"]{background:var(--gold,#d9b779);color:#1a1407;border-color:transparent}
.icon-key{max-width:100%;min-width:0}
.icon-key[open] summary{border-color:var(--gold,#d9b779)}
.icon-key-body{margin-top:8px;padding:12px 14px;border-radius:18px;background:#1a1815;border:1px solid #2f2b26;display:grid;gap:8px;color:#efe9de}
.icon-key-body p,.icon-key-row{margin:0;color:#efe9de;font:500 14px/1.4 var(--sans,"IBM Plex Sans",system-ui,sans-serif)}
.icon-key-row{display:flex;gap:10px;align-items:center;min-height:44px}
.icon-key-row[hidden]{display:none}
.rd-wrap .icon-key-body,.rd-wrap .icon-key-body p,.rd-wrap .icon-key-row{background:#1a1815;color:#efe9de}
.icon-key-body b{font-weight:600}
.sig-block.on-light .sig{background:#fff;border-color:#e5e5ea;color:#1c1c1e}
.sig-block.on-light .sig.is-up{color:#1b7a45}
.sig-block.on-light .sig.is-down{color:#b42318}
.sig-block.on-light .sig.is-flat,.sig-block.on-light .sig.is-dash{color:#6e6e73}
.sig-block.on-light .sig.is-amber{color:#9a6700}
.sig-block.on-light .sig.is-neutral{color:#8a6a2f}
.sig-block.on-light .sig.is-lead{color:#1c1c1e;background:#fff8ee;border-color:#e6d3a8}
.sig-block.on-light .sig-blurb{color:#3a3a3c}
.sig-block.on-light .sig-track{background:#e5e5ea}
.sig-block.on-light .sig-strength,.sig-block.on-light .sig-overall{color:#8a6a2f}
.sig-block.on-light .sig-strength i{background:rgba(138,106,47,.25)}
.sig-block.on-light .sig-strength i.on{background:#8a6a2f}
.rd-wrap .icon-key summary{background:#fff;color:#1c1c1e;border-color:#e5e5ea}
.visually-hidden{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}
`;

export function signalMarkup(card, escape, opts) {
  function e(s) {
    const fn = typeof escape === "function" ? escape : function (v) {
      return String(v ?? "").replace(/&/g, "&" + "amp;").replace(/</g, "&" + "lt;").replace(/>/g, "&" + "gt;").replace(/"/g, "&" + "quot;");
    };
    return fn(s);
  }
  function glyph(kind) {
    if (kind === "flame") return '<svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><path fill="currentColor" d="M7 1s3 2.2 3 5a3 3 0 1 1-6 0c0-1.2.7-2.2 1.4-3C6.2 2.2 7 1 7 1z"/></svg>';
    if (kind === "clock") return '<svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><circle cx="7" cy="7" r="5.2" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M7 4.2V7l2 1.4" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>';
    if (kind === "stack") return '<svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><rect x="2" y="8" width="10" height="2.2" rx="1" fill="currentColor"/><rect x="3" y="5" width="8" height="2.2" rx="1" fill="currentColor" opacity=".75"/><rect x="4" y="2" width="6" height="2.2" rx="1" fill="currentColor" opacity=".5"/></svg>';
    return '<svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><path d="M3 7h8" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';
  }
  function mark(dir) {
    if (dir === "up") return "▲";
    if (dir === "down") return "▼";
    return "";
  }
  function meter(n) {
    const v = Math.round(Number(n));
    if (!(v >= 1) || v > 5) return "";
    const bits = [1, 2, 3, 4, 5].map(function (i) { return '<i class="' + (i <= v ? "on" : "") + '"></i>'; }).join("");
    return '<span class="sig-strength" aria-hidden="true">' + bits + '</span><span class="visually-hidden"> Signal strength ' + v + " of 5.</span>";
  }
  function one(chip) {
    const kind = String(chip && chip.kind || "");
    if (kind === "move") {
      if (chip.dir === "dash") return '<span class="sig is-dash" data-kind="dash">' + glyph("dash") + '<span class="visually-hidden">' + e(chip.label || "Price being checked") + "</span></span>";
      const tone = chip.dir === "up" ? "is-up" : chip.dir === "down" ? "is-down" : "is-flat";
      const shown = mark(chip.dir) || glyph("flat");
      return '<span class="sig ' + tone + '" data-kind="move"><span aria-hidden="true">' + shown + "</span> " + e(chip.text || "") + meter(chip.strength) + "</span>";
    }
    if (kind === "listings") {
      return '<span class="sig is-lead" data-kind="listings">' + glyph("stack") + " " + e(chip.text || "") + meter(chip.strength) + "</span>";
    }
    if (kind === "gone") {
      const n = Math.max(1, Math.min(3, Number(chip.dots) || 1));
      const raw = String(chip.word || (n === 1 ? "light" : n === 2 ? "steady" : "fast"));
      const speed = raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase();
      return '<span class="sig is-neutral" data-kind="gone">' + glyph("flame") + ' <span class="sig-speed">' + e(speed) + "</span>" + meter(chip.strength) + "</span>";
    }
    if (kind === "range") {
      const pos = Math.max(0, Math.min(1, Number(chip.pos) || 0));
      return '<span class="sig is-neutral" data-kind="range"><span class="sig-track" aria-hidden="true"><span class="sig-dot" style="left:' + Math.round(pos * 100) + '%"></span></span>' + meter(chip.strength) + "</span>";
    }
    if (kind === "momentum") return '<span class="sig is-neutral" data-kind="momentum">' + e(chip.word || "") + meter(chip.strength) + "</span>";
    if (kind === "rotation") return '<span class="sig is-neutral" data-kind="rotation">' + glyph("clock") + " " + e(chip.text || "") + meter(chip.strength) + "</span>";
    if (kind === "art") return '<span class="sig is-neutral" data-kind="art">' + e(chip.badge || "") + meter(chip.strength) + "</span>";
    if (kind === "era") return '<span class="sig is-neutral" data-kind="era">' + e(chip.tag || "") + meter(chip.strength) + "</span>";
    if (kind === "confidence") {
      const n = Math.max(1, Math.min(3, Number(chip.bars) || 1));
      const bars = [1, 2, 3].map(function (i) { return '<i class="' + (i <= n ? "on" : "") + '"></i>'; }).join("");
      return '<span class="sig is-neutral" data-kind="confidence"><span class="sig-bars" aria-hidden="true">' + bars + "</span>" + meter(chip.strength) + "</span>";
    }
    return "";
  }
  const chips = Array.isArray(card && card.signals) ? card.signals.slice(0, 4) : [];
  if (!chips.length) return "";
  const light = opts && opts.light ? " on-light" : "";
  const href = opts && opts.href ? String(opts.href) : "";
  const bits = chips.map(one).join("");
  const label = chips.map(function (chip) { return String(chip && chip.label || "").trim(); }).filter(Boolean).join(". ");
  const src = String((opts && opts.asOf) || (card && card.signalAsOf) || "");
  const dm = src.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const when = dm ? months[Number(dm[2]) - 1] + " " + Number(dm[3]) : "";
  const tapOn = !(opts && opts.tap === false) && chips.some(function (chip) { return chip && chip.kind === "listings"; });
  const tapText = when ? "eBay listings counted, " + when + "." : "eBay listings counted.";
  const tap = tapOn
    ? '<button type="button" class="itap sig-itap" aria-label="Where this number comes from: ' + e(tapText) + '"><span class="itap-i" aria-hidden="true">i</span><span class="itap-pop" role="tooltip">' + e(tapText) + "</span></button>"
    : "";
  const row = href && tap
    ? '<div class="sig-row" role="group"><a class="sig-open" href="' + e(href) + '" aria-label="' + e(label) + '">' + bits + "</a>" + tap + "</div>"
    : href
      ? '<a class="sig-row" href="' + e(href) + '" aria-label="' + e(label) + '">' + bits + "</a>"
      : '<div class="sig-row" role="group" aria-label="' + e(label) + '">' + bits + tap + "</div>";
  const blurb = String(card && card.blurb || "").trim();
  const line = blurb ? '<p class="sig-blurb">' + e(blurb) + "</p>" : "";
  const scoreN = Math.round(Number(card && card.strength));
  const score = scoreN >= 1 && scoreN <= 5
    ? '<p class="sig-overall"><span class="sig-overall-label">Signal strength</span>' + meter(scoreN) + "</p>"
    : "";
  const tapClass = tap ? " has-tap" : "";
  return '<div class="sig-block' + light + tapClass + '">' + score + row + line + "</div>";
}

export function signalRowHtml(card, opts = {}) {
  const asOf = opts.asOf || (card && card.signalAsOf) || "";
  return signalMarkup(card, null, { ...opts, asOf });
}

export function paintIconKey() {
  var box = document.querySelector(".icon-key-body");
  if (!box) return;
  var seen = {};
  document.querySelectorAll(".sig[data-kind]").forEach(function (el) {
    var kind = el.getAttribute("data-kind");
    if (kind) seen[kind] = 1;
  });
  if (document.querySelector(".sig-strength")) seen.dots = 1;
  box.querySelectorAll("[data-icon]").forEach(function (row) {
    var id = row.getAttribute("data-icon");
    if (id === "score") {
      row.hidden = !document.querySelector(".sig-overall");
      return;
    }
    row.hidden = !seen[id];
  });
}

function withAsOf(doc, hit) {
  if (!hit) return null;
  const asOf = String(doc && doc.asOf || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(asOf)) return hit;
  return { ...hit, signalAsOf: asOf };
}

export function chipLookup(doc, id) {
  const key = String(id || "");
  if (!doc || !key) return null;
  if (doc.byId && doc.byId[key] && Array.isArray(doc.byId[key].signals) && doc.byId[key].signals.length) return withAsOf(doc, doc.byId[key]);
  if (doc.bySku && doc.bySku[key] && Array.isArray(doc.bySku[key].signals) && doc.bySku[key].signals.length) return withAsOf(doc, doc.bySku[key]);
  const sku = (key.match(/tcgcsv-\d+/) || [])[0];
  if (sku && doc.bySku && doc.bySku[sku] && Array.isArray(doc.bySku[sku].signals)) return withAsOf(doc, doc.bySku[sku]);
  return null;
}

export function chipForSample(sample, doc) {
  const text = String(sample || "");
  let best = null;
  for (const row of Object.values(doc?.byId || {})) {
    const name = String(row?.name || "").trim();
    if (name.length < 8 || !text.includes(name)) continue;
    if (!best || name.length > best.name.length) best = row;
  }
  return best;
}

export const SIGNAL_CLIENT = `${signalMarkup.toString()}\n${paintIconKey.toString()}\n${mountSignalTools.toString()}\nvar signalDoc=null;\nfunction signalJoin(card){if(!card)return card;if(Array.isArray(card.signals)&&card.signals.length)return card;var doc=signalDoc;if(!doc)return card;var hit=doc.byId&&card.id?doc.byId[card.id]:null;if(!hit&&doc.bySku){var keys=[];if(card.sku)keys.push(String(card.sku));var href=String(card.href||"");var hm=href.match(/\\/(?:c|p)\\/([^/?#]+)/);if(hm)keys.push(decodeURIComponent(hm[1]));var tm=String(card.id||"").match(/tcgcsv-\\d+/);if(tm)keys.push(tm[0]);for(var i=0;i<keys.length;i++){if(keys[i]&&doc.bySku[keys[i]]){hit=doc.bySku[keys[i]];break;}}}if(!hit||!Array.isArray(hit.signals)||!hit.signals.length)return card;var next={};for(var k in card)next[k]=card[k];next.signals=hit.signals;if(hit.blurb)next.blurb=hit.blurb;var score=Math.round(Number(hit.strength));if(score>=1&&score<=5)next.strength=score;return next;}\nfunction signalLead(card){var row=signalJoin(card);if(!row||!Array.isArray(row.signals)||!row.signals.length)return "";return signalMarkup({signals:row.signals.slice(0,1)}, html, {tap:false});}\nfunction signalBits(card){if(pageMode==="read")return "";var row=signalJoin(card);var href="/feed/r/"+encodeURIComponent(row&&row.id||"");var bits=signalMarkup(row, html, {href:href, asOf:(signalDoc&&signalDoc.asOf)||""});if(typeof paintIconKey==="function")paintIconKey();return bits;}\n`;

function esc(s) {
  return String(s ?? "").replace(/&/g, "&" + "amp;").replace(/</g, "&" + "lt;").replace(/>/g, "&" + "gt;").replace(/"/g, "&" + "quot;");
}

function iconMark(id) {
  if (id === "move") return '<span class="sig is-up" aria-hidden="true"><span>▲</span></span>';
  if (id === "dash") return '<span class="sig is-dash" aria-hidden="true"><svg width="14" height="14" viewBox="0 0 14 14"><path d="M3 7h8" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg></span>';
  if (id === "listings") return '<span class="sig is-lead" aria-hidden="true"><svg width="14" height="14" viewBox="0 0 14 14"><rect x="2" y="8" width="10" height="2.2" rx="1" fill="currentColor"/><rect x="3" y="5" width="8" height="2.2" rx="1" fill="currentColor" opacity=".75"/><rect x="4" y="2" width="6" height="2.2" rx="1" fill="currentColor" opacity=".5"/></svg></span>';
  if (id === "gone") return '<span class="sig is-neutral" aria-hidden="true"><svg width="14" height="14" viewBox="0 0 14 14"><path fill="currentColor" d="M7 1s3 2.2 3 5a3 3 0 1 1-6 0c0-1.2.7-2.2 1.4-3C6.2 2.2 7 1 7 1z"/></svg> Steady</span>';
  if (id === "range") return '<span class="sig is-neutral" aria-hidden="true"><span class="sig-track"><span class="sig-dot" style="left:70%"></span></span></span>';
  if (id === "momentum") return '<span class="sig is-neutral" aria-hidden="true">Rising</span>';
  if (id === "rotation") return '<span class="sig is-neutral" aria-hidden="true"><svg width="14" height="14" viewBox="0 0 14 14"><circle cx="7" cy="7" r="5.2" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M7 4.2V7l2 1.4" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg></span>';
  if (id === "art") return '<span class="sig is-neutral" aria-hidden="true">SIR</span>';
  if (id === "era") return '<span class="sig is-neutral" aria-hidden="true">Vintage</span>';
  if (id === "confidence") return '<span class="sig is-neutral" aria-hidden="true"><span class="sig-bars"><i class="on"></i><i class="on"></i><i></i></span></span>';
  if (id === "dots") return '<span class="sig-strength" aria-hidden="true"><i class="on"></i><i class="on"></i><i class="on"></i><i></i><i></i></span>';
  return "";
}

export function iconKeyHtml(asOf, kinds) {
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const m = String(asOf || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const when = m ? months[Number(m[2]) - 1] + " " + Number(m[3]) : "";
  const want = Array.isArray(kinds) ? new Set(kinds) : null;
  const rows = ICON_LINES.map(([id, line]) => {
    const text = id === "listings" && when ? "eBay listings counted, " + when + "." : line;
    const hidden = want && !want.has(id) ? " hidden" : "";
    return `<p class="icon-key-row" data-icon="${esc(id)}"${hidden}><span>${iconMark(id)}</span><span>${esc(text)}</span></p>`;
  }).join("");
  const score = "Signal strength" + (when ? ", " + when : "") + ".";
  const showScore = Array.isArray(kinds) && kinds.indexOf("score") >= 0;
  return `<details class="icon-key" id="icon-key"><summary>What the icons mean</summary><div class="icon-key-body">${rows}<p class="icon-key-row" data-icon="score"${showScore ? "" : " hidden"}>${esc(score)}</p><p>${esc(ICON_SOURCE)}</p></div></details>`;
}

export function feedToolsHtml(asOf) {
  return `<div class="feed-tools"><button type="button" id="fast-mode" class="fast-toggle" aria-pressed="false">Fast mode</button>${iconKeyHtml(asOf)}</div>`;
}

export function attachSignals(bundle, doc) {
  const byId = doc && doc.byId && typeof doc.byId === "object" ? doc.byId : null;
  if (!bundle || !byId) return bundle;
  const reads = (bundle.reads || []).map((row) => {
    if (!row || !row.id) return row;
    const hit = byId[row.id];
    if (!hit || !Array.isArray(hit.signals) || !hit.signals.length) return row;
    if (Array.isArray(row.signals) && row.signals.length) return row;
    const next = { ...row, signals: hit.signals.slice(0, 4), blurb: hit.blurb || row.blurb || "" };
    const score = Math.round(Number(hit.strength));
    if (score >= 1 && score <= 5) next.strength = score;
    return next;
  });
  return { ...bundle, reads };
}

export function mountSignalTools() {
  var page = document.querySelector(".feed-page");
  var btn = document.getElementById("fast-mode");
  var on = false;
  try { on = localStorage.getItem("catchem-fast") === "1"; } catch (err) { on = false; }
  function paint() {
    if (page) page.classList.toggle("is-fast", on);
    if (btn) btn.setAttribute("aria-pressed", on ? "true" : "false");
  }
  paint();
  if (btn) btn.addEventListener("click", function () {
    on = !on;
    try { localStorage.setItem("catchem-fast", on ? "1" : "0"); } catch (err) {}
    paint();
  });
  var box = document.getElementById("icon-key");
  if (!box) return;
  var seen = false;
  try { seen = localStorage.getItem("catchem-icon-key") === "1"; } catch (err) { seen = false; }
  if (!seen) box.open = true;
  box.addEventListener("toggle", function () {
    if (!box.open) { try { localStorage.setItem("catchem-icon-key", "1"); } catch (err) {} }
  });
  paintIconKey();
}
