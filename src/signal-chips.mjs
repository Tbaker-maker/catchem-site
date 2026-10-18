// Renders signal chips. Values arrive already chosen. This file does not
// decide cutoffs, and it does not explain how a chip was chosen.

export const ICON_LINES = Object.freeze([
  ["Arrow", "Green is up, red is down, and grey is flat. The days shown are the days on file."],
  ["Grey line", "Price being checked."],
  ["Listings", "The change in listings counted. Fewer listings are amber. That colour is not a good or bad mark."],
  ["Flame", "How fast listings are gone. One dot is light, two is steady, three is fast."],
  ["Range", "Where today sits in the price range on file."],
  ["Word", "Rising, Flat, or Cooling."],
  ["Clock", "Rotates in the months shown, when a date is on file."],
  ["Badge", "SIR, IR, or FA. That is the art on the card."],
  ["Tag", "Vintage or Modern."],
  ["Bars", "How much data is on file. More bars means more data."],
  ["Dots", "One dot is a quiet reading. Five dots is an unusual reading."],
]);

export const ICON_SOURCE = "TCGplayer market and eBay listings counted. The date is the date on the read.";

export const SIGNAL_CSS = `
.sig-block{display:flex;flex-direction:column;gap:6px;max-width:100%;min-width:0}
.sig-row{display:flex;flex-wrap:wrap;align-items:center;gap:6px;max-width:100%;min-width:0;min-height:44px;margin:0;padding:0;color:inherit;text-decoration:none}
.sig{display:inline-flex;align-items:center;gap:6px;min-height:32px;max-width:100%;padding:0 10px;border-radius:999px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);color:#efe9de;font:600 13px/1 var(--sans,"IBM Plex Sans",system-ui,sans-serif)}
.sig svg{display:block;flex:0 0 auto}
.sig.is-up{color:#7fc79a}
.sig.is-down{color:#e0675b}
.sig.is-flat,.sig.is-dash{color:#9a948a}
.sig.is-amber{color:#e0a15a}
.sig.is-neutral{color:#d9b779}
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
.sig-score{display:flex;flex-wrap:wrap;align-items:center;gap:8px;max-width:100%;min-width:0;min-height:44px;margin:0;color:#d9b779;font:600 13px/1 var(--sans,"IBM Plex Sans",system-ui,sans-serif)}
.sig-blurb{margin:0;max-width:100%;font:400 15px/1.4 var(--sans,"IBM Plex Sans",system-ui,sans-serif);color:var(--dim,#c4baab);overflow-wrap:anywhere}
.is-fast .sig-blurb,.is-fast .one-line,.is-fast .print-run{display:none}
.feed-tools{display:flex;flex-wrap:wrap;gap:8px;align-items:flex-start;max-width:100%;margin:0 0 8px}
.fast-toggle,.icon-key summary{min-height:44px;display:inline-flex;align-items:center;padding:0 14px;border-radius:999px;border:1px solid var(--line,#2f2b26);background:#1a1815;color:var(--txt,#efe9de);font:600 14px/1 var(--sans,"IBM Plex Sans",system-ui,sans-serif);cursor:pointer;list-style:none}
.icon-key summary::-webkit-details-marker{display:none}
.fast-toggle[aria-pressed="true"]{background:var(--gold,#d9b779);color:#1a1407;border-color:transparent}
.icon-key{max-width:100%;min-width:0}
.icon-key[open] summary{border-color:var(--gold,#d9b779)}
.icon-key-body{margin-top:8px;padding:12px 14px;border-radius:18px;background:#1a1815;border:1px solid #2f2b26;display:grid;gap:8px}
.icon-key-body p{margin:0;font:500 14px/1.4 var(--sans,"IBM Plex Sans",system-ui,sans-serif)}
.icon-key-body b{font-weight:600}
.sig-block.on-light .sig{background:#fff;border-color:#e5e5ea;color:#1c1c1e}
.sig-block.on-light .sig.is-up{color:#1b7a45}
.sig-block.on-light .sig.is-down{color:#b42318}
.sig-block.on-light .sig.is-flat,.sig-block.on-light .sig.is-dash{color:#6e6e73}
.sig-block.on-light .sig.is-amber{color:#9a6700}
.sig-block.on-light .sig.is-neutral{color:#8a6a2f}
.sig-block.on-light .sig-blurb{color:#3a3a3c}
.sig-block.on-light .sig-track{background:#e5e5ea}
.sig-block.on-light .sig-strength,.sig-block.on-light .sig-score{color:#8a6a2f}
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
      if (chip.dir === "dash") return '<span class="sig is-dash">' + glyph("dash") + '<span class="visually-hidden">' + e(chip.label || "Price being checked") + "</span></span>";
      const tone = chip.dir === "up" ? "is-up" : chip.dir === "down" ? "is-down" : "is-flat";
      const shown = mark(chip.dir) || glyph("flat");
      return '<span class="sig ' + tone + '"><span aria-hidden="true">' + shown + "</span> " + e(chip.text || "") + meter(chip.strength) + "</span>";
    }
    if (kind === "listings") {
      const tone = chip.dir === "down" ? "is-amber" : "is-neutral";
      return '<span class="sig ' + tone + '">' + glyph("stack") + '<span aria-hidden="true">' + mark(chip.dir) + "</span> " + e(chip.text || "") + meter(chip.strength) + "</span>";
    }
    if (kind === "gone") {
      const n = Math.max(1, Math.min(3, Number(chip.dots) || 1));
      const dots = [1, 2, 3].map(function (i) { return '<i class="' + (i <= n ? "on" : "") + '"></i>'; }).join("");
      return '<span class="sig is-neutral">' + glyph("flame") + '<span class="sig-dots" aria-hidden="true">' + dots + "</span>" + meter(chip.strength) + "</span>";
    }
    if (kind === "range") {
      const pos = Math.max(0, Math.min(1, Number(chip.pos) || 0));
      return '<span class="sig is-neutral"><span class="sig-track" aria-hidden="true"><span class="sig-dot" style="left:' + Math.round(pos * 100) + '%"></span></span>' + meter(chip.strength) + "</span>";
    }
    if (kind === "momentum") return '<span class="sig is-neutral">' + e(chip.word || "") + meter(chip.strength) + "</span>";
    if (kind === "rotation") return '<span class="sig is-neutral">' + glyph("clock") + " " + e(chip.text || "") + meter(chip.strength) + "</span>";
    if (kind === "art") return '<span class="sig is-neutral">' + e(chip.badge || "") + meter(chip.strength) + "</span>";
    if (kind === "era") return '<span class="sig is-neutral">' + e(chip.tag || "") + meter(chip.strength) + "</span>";
    if (kind === "confidence") {
      const n = Math.max(1, Math.min(3, Number(chip.bars) || 1));
      const bars = [1, 2, 3].map(function (i) { return '<i class="' + (i <= n ? "on" : "") + '"></i>'; }).join("");
      return '<span class="sig is-neutral"><span class="sig-bars" aria-hidden="true">' + bars + "</span>" + meter(chip.strength) + "</span>";
    }
    return "";
  }
  const chips = Array.isArray(card && card.signals) ? card.signals.slice(0, 4) : [];
  if (!chips.length) return "";
  const light = opts && opts.light ? " on-light" : "";
  const href = opts && opts.href ? String(opts.href) : "";
  const bits = chips.map(one).join("");
  const label = chips.map(function (chip) { return String(chip && chip.label || "").trim(); }).filter(Boolean).join(". ");
  const row = href
    ? '<a class="sig-row" href="' + e(href) + '" aria-label="' + e(label) + '">' + bits + "</a>"
    : '<div class="sig-row" role="group" aria-label="' + e(label) + '">' + bits + "</div>";
  const blurb = String(card && card.blurb || "").trim();
  const line = blurb ? '<p class="sig-blurb">' + e(blurb) + "</p>" : "";
  const scoreN = Math.round(Number(card && card.strength));
  const score = scoreN >= 1 && scoreN <= 5
    ? '<p class="sig-score"><span class="sig-score-label">Signal strength</span>' + meter(scoreN) + "</p>"
    : "";
  return '<div class="sig-block' + light + '">' + score + row + line + "</div>";
}

export function signalRowHtml(card, opts = {}) {
  return signalMarkup(card, null, opts);
}

export const SIGNAL_CLIENT = `${signalMarkup.toString()}\n${mountSignalTools.toString()}\nfunction signalBits(card){if(pageMode==="read")return "";var href="/feed/r/"+encodeURIComponent(card&&card.id||"");return signalMarkup(card, html, {href:href});}\n`;

function esc(s) {
  return String(s ?? "").replace(/&/g, "&" + "amp;").replace(/</g, "&" + "lt;").replace(/>/g, "&" + "gt;").replace(/"/g, "&" + "quot;");
}

export function iconKeyHtml(asOf) {
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const m = String(asOf || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const when = m ? months[Number(m[2]) - 1] + " " + Number(m[3]) : "";
  const rows = ICON_LINES.map(([name, line]) => `<p><b>${esc(name)}.</b> ${esc(line)}</p>`).join("");
  const score = "Signal strength" + (when ? ", " + when : "") + ".";
  return `<details class="icon-key" id="icon-key"><summary>What the icons mean</summary><div class="icon-key-body">${rows}<p>${esc(score)}</p><p>${esc(ICON_SOURCE)}</p></div></details>`;
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
}
