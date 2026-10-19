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
.sig-blurb{margin:0;max-width:100%;font:400 15px/1.4 var(--sans,"IBM Plex Sans",system-ui,sans-serif);color:var(--dim,#c4baab);overflow-wrap:anywhere}
.is-fast .sig-blurb,.is-fast .one-line,.is-fast .print-run{display:none}
.feed-tools{display:flex;flex-wrap:wrap;gap:8px;align-items:flex-start;max-width:100%;margin:0 0 8px}
.fast-toggle{min-height:44px;display:inline-flex;align-items:center;padding:0 14px;border-radius:999px;border:1px solid var(--line,#2f2b26);background:#1a1815;color:var(--txt,#efe9de);font:600 14px/1 var(--sans,"IBM Plex Sans",system-ui,sans-serif);cursor:pointer}
.fast-toggle[aria-pressed="true"]{background:var(--gold,#d9b779);color:#1a1407;border-color:transparent}
.tiles{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;max-width:100%;min-width:0;margin:4px 0 2px}
.tl{position:relative;display:block;width:100%;min-width:0;min-height:112px;margin:0;padding:0;border:0;background:none;color:#efe9de;text-align:left;font:inherit;cursor:pointer;perspective:900px;-webkit-tap-highlight-color:transparent;border-radius:20px}
.tl.wide{grid-column:1/-1}
.tl:focus-visible{outline:2px solid var(--gold,#d9b779);outline-offset:3px}
.tl-in{display:grid;min-height:112px;height:100%;transition:transform .45s cubic-bezier(.2,.7,.2,1);transform-style:preserve-3d}
.tl[aria-pressed="true"] .tl-in{transform:rotateY(180deg)}
.tl-face{grid-area:1/1;display:flex;flex-direction:column;justify-content:space-between;gap:6px;min-width:0;padding:12px 14px;border-radius:20px;background:linear-gradient(180deg,rgba(255,255,255,.055),rgba(255,255,255,.03));border:1px solid rgba(255,255,255,.09);-webkit-backface-visibility:hidden;backface-visibility:hidden}
.tl-back{transform:rotateY(180deg);background:#262119;border-color:rgba(217,183,121,.55)}
.tl-k{display:block;padding-right:26px;font:600 11px/1.2 var(--sans,"IBM Plex Sans",system-ui,sans-serif);letter-spacing:.05em;text-transform:uppercase;color:#a79e90}
.tl-back .tl-k{color:var(--gold,#d9b779)}
.tl-v{display:flex;align-items:baseline;flex-wrap:wrap;gap:6px;font:700 20px/1.1 var(--sans,"IBM Plex Sans",system-ui,sans-serif)}
.tl-v.is-up{color:#7fc79a}.tl-v.is-down{color:#e0675b}.tl-v.is-flat,.tl-v.is-dash{color:#9a948a}
.tl-v.is-dash{font-size:15px}
.tl-w{color:var(--gold,#d9b779)}
.tl-n{font-size:15px;font-weight:600;color:#efe9de}
.tl-d{font-size:12px;font-weight:600;color:#a79e90}
.tl-s{display:block;font:500 12px/1.35 var(--sans,"IBM Plex Sans",system-ui,sans-serif);color:#a79e90}
.tl-p{display:block;font:500 13px/1.4 var(--sans,"IBM Plex Sans",system-ui,sans-serif);color:#e8dfd1}
.tl-i{position:absolute;top:10px;right:10px;z-index:2;width:22px;height:22px;border-radius:999px;border:1px solid rgba(255,255,255,.18);display:flex;align-items:center;justify-content:center;font:600 11px/1 var(--sans,"IBM Plex Sans",system-ui,sans-serif);color:#a79e90;pointer-events:none}
.tl[aria-pressed="true"] .tl-i{border-color:rgba(217,183,121,.6);color:var(--gold,#d9b779)}
.tl-bars{display:flex;align-items:flex-end;gap:3px;height:28px}
.tl-bars i{display:block;width:7px;border-radius:3px;background:rgba(217,183,121,.22)}
.tl-bars i.on{background:var(--gold,#d9b779)}
.tl-sp{position:relative;display:block;width:100%;height:26px}.tl-spark{display:block;width:100%;height:26px;overflow:visible}.tl-dot{position:absolute;width:6px;height:6px;margin:-3px 0 0 -3px;border-radius:999px}
.tl-tags{display:flex;flex-wrap:wrap;gap:6px;margin-top:2px}.tl-tag{display:inline-flex;align-items:center;min-height:26px;padding:0 10px;border-radius:999px;font:600 12px/1 var(--sans,"IBM Plex Sans",system-ui,sans-serif);border:1px solid #5a4724;background:#2a2216;color:#d9b779}.tl-tag.is-up{border-color:#2c5a3c;background:#16241b;color:#7fc79a}.tl-tag.is-down{border-color:#5e2c27;background:#2a1714;color:#e98b7c}
.tl-p b{color:#f3ece0;font-weight:600}
.sig-block.on-light .tl-tag{background:#f6efe1;border-color:#e3d3b0;color:#7a5a1c}.sig-block.on-light .tl-tag.is-up{background:#eaf6ee;border-color:#bfe0c9;color:#256b3c}.sig-block.on-light .tl-tag.is-down{background:#fbecea;border-color:#efc6c0;color:#a3352a}.sig-block.on-light .tl-p b{color:#1d1d1f}
.tl-hint{grid-column:1/-1;margin:2px 0 0;text-align:center;font:500 12px/1.3 var(--sans,"IBM Plex Sans",system-ui,sans-serif);color:#8d8577}
.is-fast .tl-hint{display:none}
.is-fast .tiles{display:grid}
.sig-block.is-compact .tl,.sig-block.is-compact .tl-in,.sig-block.is-compact .tl-face,.is-fast .tl,.is-fast .tl-in,.is-fast .tl-face{min-height:64px}
.sig-block.is-compact .tl-v,.is-fast .tl-v{font-size:16px}
.sig-block.is-compact .tl-hint{display:none}
@media (prefers-reduced-motion:reduce){.tl-in{transition:none;transform:none!important}.tl-face{-webkit-backface-visibility:visible;backface-visibility:visible;transition:opacity .2s linear}.tl-back{transform:none;opacity:0}.tl[aria-pressed="true"] .tl-back{opacity:1}.tl[aria-pressed="true"] .tl-front{opacity:0}}
.sig-block.on-light .tl-face{background:#fff;border-color:#e5e5ea;color:#1c1c1e}
.sig-block.on-light .tl-back{background:#fff8ee;border-color:#e6d3a8}
.sig-block.on-light .tl-k,.sig-block.on-light .tl-s,.sig-block.on-light .tl-d{color:#6e6e73}
.sig-block.on-light .tl-p,.sig-block.on-light .tl-n{color:#1c1c1e}
.sig-block.on-light .tl-v.is-up{color:#1b7a45}.sig-block.on-light .tl-v.is-down{color:#b42318}
.sig-block.on-light .tl-w,.sig-block.on-light .tl-back .tl-k{color:#8a6a2f}
.sig-block.on-light .tl-bars i{background:rgba(138,106,47,.22)}.sig-block.on-light .tl-bars i.on{background:#8a6a2f}
.sig-block.on-light .sig{background:#fff;border-color:#e5e5ea;color:#1c1c1e}
.sig-block.on-light .sig.is-up{color:#1b7a45}
.sig-block.on-light .sig.is-down{color:#b42318}
.sig-block.on-light .sig.is-flat,.sig-block.on-light .sig.is-dash{color:#6e6e73}
.sig-block.on-light .sig.is-amber{color:#9a6700}
.sig-block.on-light .sig.is-neutral{color:#8a6a2f}
.sig-block.on-light .sig.is-lead{color:#1c1c1e;background:#fff8ee;border-color:#e6d3a8}
.sig-block.on-light .sig-blurb{color:#3a3a3c}
.sig-block.on-light .sig-track{background:#e5e5ea}
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
  function meter() {
    return "";
  }
  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  function day(iso, year) {
    const m = String(iso || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!m) return "";
    return MONTHS[Number(m[2]) - 1] + " " + Number(m[3]) + (year ? ", " + m[1] : "");
  }
  function cash(n) {
    const v = Number(n);
    return v > 0 ? "$" + v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "";
  }
  function spark(vals, band, color) {
    const list = (Array.isArray(vals) ? vals : []).map(Number).filter(function (v) { return Number.isFinite(v); });
    if (list.length < 2) return "";
    const two = Array.isArray(band) && band.length === 2;
    const lo = two ? Number(band[0]) : 0;
    const hi = two ? Number(band[1]) : 0;
    const hasBand = two && Number.isFinite(lo) && Number.isFinite(hi) && hi >= lo;
    let mn = Math.min.apply(null, list);
    let mx = Math.max.apply(null, list);
    if (hasBand) { mn = Math.min(mn, lo); mx = Math.max(mx, hi); }
    const W = 100, H = 26, P = 3;
    const x = function (i) { return (P + i * (W - 2 * P) / (list.length - 1)).toFixed(1); };
    const y = function (v) { return (P + (H - 2 * P) * (1 - (v - mn) / ((mx - mn) || 1))).toFixed(1); };
    const d = list.map(function (v, i) { return (i ? "L" : "M") + x(i) + " " + y(v); }).join(" ");
    const rect = hasBand ? '<rect x="0" y="' + y(hi) + '" width="' + W + '" height="' + Math.max(1, Number(y(lo)) - Number(y(hi))).toFixed(1) + '" rx="3" fill="rgba(217,183,121,.16)"/>' : "";
    const last = list.length - 1;
    const dot = '<i class="tl-dot" style="left:' + x(last) + "%;top:" + (Number(y(list[last])) / H * 100).toFixed(1) + "%;background:" + color + '"></i>';
    return '<span class="tl-sp"><svg class="tl-spark" viewBox="0 0 ' + W + " " + H + '" preserveAspectRatio="none" aria-hidden="true">' + rect + '<path d="' + d + '" fill="none" stroke="' + color + '" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"/></svg>' + dot + "</span>";
  }
  const STAGES = { Building: 1, Slowing: 1, Stalled: 1, Reversing: 1 };
  const TAGS = { "Few sellers hold most": 1, "Spread out": 1 };
  function stageOf(x) {
    return x && STAGES[x.word] === 1 && Number(x.days) > 0 ? x : null;
  }
  function tagOf(x) {
    return x && TAGS[x.word] === 1 && Number(x.share) >= 0 ? x : null;
  }
  function stagePill(st) {
    const dir = st.dir === "down" ? "down" : "up";
    return '<span class="tl-tag is-' + dir + '">' + e(st.word + (dir === "down" ? " ▼" : " ▲")) + "</span>";
  }
  function stageWords(st, sealed) {
    const n = Math.round(Number(st.days));
    const way = st.dir === "down" ? "fallen" : "climbed";
    const other = st.dir === "down" ? "up" : "down";
    let line;
    if (st.word === "Building") line = "price has " + way + " over the last " + n + " days";
    else if (st.word === "Slowing") line = "price is still moving " + (st.dir === "down" ? "down" : "up") + ", but more slowly than the " + n + " days before";
    else if (st.word === "Stalled") line = "price went flat after moving " + (st.dir === "down" ? "down" : "up") + " over the " + n + " days before";
    else line = "price turned " + (st.dir === "down" ? "down" : "up") + " after moving " + other + " over the " + n + " days before";
    if (sealed && st.listings === "falling") line += ", and listings counted are falling";
    else if (sealed && st.listings === "rising") line += ", and listings counted are rising";
    else if (sealed && st.listings === "flat") line += ", and listings counted are flat";
    return st.word + ": " + line + ".";
  }
  function tagWords(tg) {
    const share = Math.round(Number(tg.share));
    const usual = Math.round(Number(tg.usual));
    const peers = Math.round(Number(tg.peers));
    const base = "the top 2 sellers hold " + share + "% of listings counted";
    if (tg.word === "Spread out") return "Spread out: " + base + ", below this product's usual " + usual + "% and similar products near " + peers + "%.";
    return "Few sellers hold most: " + base + ". This product usually sits near " + usual + "%, and similar products near " + peers + "%.";
  }
  function boldLead(text) {
    const i = text.indexOf(":");
    return i > 0 ? "<b>" + e(text.slice(0, i + 1)) + "</b>" + e(text.slice(i + 1)) : e(text);
  }
  function tile(label, front, back, wide) {
    return '<button type="button" class="tl' + (wide ? " wide" : "") + '" aria-pressed="false" aria-label="' + e(label) + '"><span class="tl-in" aria-hidden="true"><span class="tl-face tl-front">' + front + '</span><span class="tl-face tl-back">' + back + '</span></span><span class="tl-i" aria-hidden="true">i</span></button>';
  }
  function tilesHtml(t) {
    const out = [];
    const data = t && t.data;
    if (data && Number(data.bars) >= 1) {
      const of = Math.max(2, Math.min(5, Math.round(Number(data.of) || 3)));
      const on = Math.max(1, Math.min(of, Math.round(Number(data.bars))));
      const hs = [];
      for (let i = 0; i < of; i++) hs.push(Math.round(8 + (20 * i) / Math.max(1, of - 1)));
      const bars = '<span class="tl-bars" aria-hidden="true">' + hs.map(function (h, i) { return '<i class="' + (i < on ? "on" : "") + '" style="height:' + h + 'px"></i>'; }).join("") + "</span>";
      const span = String(data.span || "");
      const prices = Math.round(Number(data.prices) || 0);
      const recent = Math.round(Number(data.recent) || 0);
      const counts = prices + " prices on file" + (recent > 0 ? ", " + recent + " in the last 30 days." : ".");
      const src = String(data.source || "TCGplayer market") + ", " + day(data.since, true) + " to " + day(data.through, true);
      out.push(tile(
        "Data on file: " + on + " of " + of + " bars" + (span ? ", " + span + " on file" : "") + ". More bars means more data. " + counts + " " + src + ".",
        '<span class="tl-k">Data</span>' + bars + (span ? '<span class="tl-s">' + e(span) + " on file</span>" : ""),
        '<span class="tl-k">Data</span><span class="tl-p">More bars, more data. ' + e(counts) + '</span><span class="tl-s">' + e(src) + "</span>",
        false));
    }
    const price = t && t.price;
    if (price && price.dash) {
      const src = String(price.source || "TCGplayer market") + ", " + day(price.asOf, true);
      out.push(tile("Price being checked. " + src + ".",
        '<span class="tl-k">Price</span><span class="tl-v is-dash">Price being checked</span>',
        '<span class="tl-k">Price</span><span class="tl-p">This price is being checked before it shows.</span><span class="tl-s">' + e(src) + "</span>", false));
    } else if (price && Number(price.days) > 0) {
      const dir = price.dir === "up" ? "up" : price.dir === "down" ? "down" : "flat";
      const color = dir === "up" ? "#7fc79a" : dir === "down" ? "#e0675b" : "#9a948a";
      const arrow = dir === "up" ? "▲ " : dir === "down" ? "▼ " : "";
      const pct = dir === "flat" ? "Flat" : arrow + Number(price.pct) + "%";
      const days = Math.round(Number(price.days));
      const from = cash(price.from) && day(price.fromDate) ? "from " + cash(price.from) + ", " + day(price.fromDate) : "";
      const src = String(price.source || "TCGplayer market") + ", " + day(price.asOf, true);
      const said = dir === "flat" ? "flat" : dir + " " + Number(price.pct) + " percent";
      const pst = stageOf(price.stage);
      out.push(tile(
        "Price " + days + " days: " + said + (from ? ", " + from : "") + ". " + (pst ? stageWords(pst, false) + " " : "Green is up, red is down, grey is flat. ") + src + ".",
        '<span class="tl-k">Price ' + days + "D</span>" + '<span class="tl-v is-' + dir + '">' + e(pct) + "</span>" + spark(price.spark, null, color) + (from ? '<span class="tl-s">' + e(from) + "</span>" : "") + (pst ? '<span class="tl-tags">' + stagePill(pst) + "</span>" : ""),
        '<span class="tl-k">Price ' + days + 'D</span>' + (pst ? '<span class="tl-p">' + boldLead(stageWords(pst, false)) + "</span>" : '<span class="tl-p">Green is up, red is down, grey is flat. The window is ' + days + " days.</span>") + '<span class="tl-s">' + e(src) + "</span>",
        false));
    }
    const listed = t && t.listings;
    if (listed && Number(listed.days) > 0 && Array.isArray(listed.spark) && listed.spark.length >= 2) {
      const word = /^(Draining|Stacking|Steady)$/.test(String(listed.word)) ? String(listed.word) : "Steady";
      const dir = listed.dir === "up" ? "up" : listed.dir === "down" ? "down" : "flat";
      const arrow = dir === "up" ? "▲ " : dir === "down" ? "▼ " : "";
      const days = Math.round(Number(listed.days));
      const band = Array.isArray(listed.band) && listed.band.length === 2;
      const src = "eBay listings counted, " + day(listed.from) + " to " + day(listed.to);
      const said = dir === "flat" ? "flat" : (dir === "down" ? "down " : "up ") + Number(listed.pct) + " percent";
      const ltg = tagOf(listed.tag);
      const lst = stageOf(listed.stage);
      const pills = (ltg ? '<span class="tl-tag">' + e(ltg.word) + "</span>" : "") + (lst ? stagePill(lst) : "");
      const extra = (ltg ? '<span class="tl-p">' + boldLead(tagWords(ltg)) + "</span>" : "") + (lst ? '<span class="tl-p">' + boldLead(stageWords(lst, true)) + "</span>" : "");
      const when = day((ltg && ltg.date) || (lst && lst.date) || listed.to, true);
      const backSrc = (ltg || lst) ? "Source: eBay listings counted, " + when : src;
      out.push(tile(
        "Listings counted: " + word + ", " + said + " over " + days + " days. " + (ltg ? tagWords(ltg) + " " : "") + (lst ? stageWords(lst, true) + " " : "") + (band ? "The shaded band is this product's usual range. " : "") + backSrc + ".",
        '<span class="tl-k">Listings counted</span><span class="tl-v"><span class="tl-w">' + e(word) + '</span><span class="tl-n">' + e(arrow + Number(listed.pct) + "%") + '</span><span class="tl-d">' + days + "D</span></span>" + spark(listed.spark, band ? listed.band : null, "#d9b779") + (pills ? '<span class="tl-tags">' + pills + "</span>" : ""),
        '<span class="tl-k">Listings counted</span>' + (extra || '<span class="tl-p">eBay listings counted each night.' + (band ? " The shaded band is this product's usual range." : "") + "</span>") + '<span class="tl-s">' + e(backSrc) + "</span>",
        true));
    }
    if (!out.length) return "";
    return '<div class="tiles" role="group" aria-label="What this read is built on">' + out.join("") + '<p class="tl-hint">Tap a tile to flip it.</p></div>';
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
  const light = opts && opts.light ? " on-light" : "";
  const compact = opts && opts.compact ? " is-compact" : "";
  const tiled = card && card.tiles && typeof card.tiles === "object" && !(opts && opts.pills) ? tilesHtml(card.tiles) : "";
  if (tiled) return '<div class="sig-block' + light + compact + '">' + tiled + "</div>";
  const chips = Array.isArray(card && card.signals) ? card.signals.slice(0, 4) : [];
  if (!chips.length) return "";
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
  const tapClass = tap ? " has-tap" : "";
  return '<div class="sig-block' + light + tapClass + '">' + row + line + "</div>";
}

export function signalRowHtml(card, opts = {}) {
  const asOf = opts.asOf || (card && card.signalAsOf) || "";
  return signalMarkup(card, null, { ...opts, asOf });
}

function withAsOf(doc, hit) {
  if (!hit) return null;
  const asOf = String(doc && doc.asOf || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(asOf)) return hit;
  return { ...hit, signalAsOf: asOf };
}

function hasTiles(row) {
  const t = row && row.tiles;
  return !!(t && typeof t === "object" && (t.data || t.price || t.listings));
}

function usable(row) {
  return !!(row && ((Array.isArray(row.signals) && row.signals.length) || hasTiles(row)));
}

// One sku map for the whole file. Exact id still wins when that row has tiles.
function skuIndex(doc) {
  if (!doc || typeof doc !== "object") return {};
  if (doc.__skuIndex) return doc.__skuIndex;
  const idx = {};
  function put(key, hit) {
    if (!key || !usable(hit)) return;
    const prev = idx[key];
    if (!prev || (hasTiles(hit) && !hasTiles(prev))) idx[key] = hit;
  }
  const by = doc.byId || {};
  for (const id of Object.keys(by)) {
    const hit = by[id];
    put(id, hit);
    if (hit && hit.sku) put(String(hit.sku), hit);
    const m = String(id).match(/tcgcsv-\d+/);
    if (m) put(m[0], hit);
  }
  const sku = doc.bySku || {};
  for (const key of Object.keys(sku)) {
    const raw = sku[key];
    put(key, typeof raw === "string" ? by[raw] : raw);
  }
  try { Object.defineProperty(doc, "__skuIndex", { value: idx, enumerable: false }); }
  catch (err) { doc.__skuIndex = idx; }
  return idx;
}

function skuHit(doc, key) {
  return skuIndex(doc)[key] || null;
}

export function chipLookup(doc, id) {
  const key = String(id || "");
  if (!doc || !key) return null;
  const exact = doc.byId ? doc.byId[key] : null;
  const idx = skuIndex(doc);
  const keys = [];
  const sku = (key.match(/tcgcsv-\d+/) || [])[0];
  if (sku) keys.push(sku);
  if (key !== sku) keys.push(key);
  let alt = null;
  for (const one of keys) {
    const hit = idx[one];
    if (!usable(hit) || hit === exact) continue;
    if (!alt || (hasTiles(hit) && !hasTiles(alt))) alt = hit;
    if (hasTiles(hit)) break;
  }
  const hit = hasTiles(exact) ? exact : hasTiles(alt) ? alt : usable(exact) ? exact : usable(alt) ? alt : null;
  return hit ? withAsOf(doc, hit) : null;
}

// Joins tiles onto a feed card. The card id, its sku, or the tcgcsv id inside either one.
export function signalJoin(card, doc) {
  if (!card) return card;
  if (hasTiles(card) || !doc) return card;
  const id = String(card.id || "");
  const exact = doc.byId && id ? doc.byId[id] : null;
  const idx = skuIndex(doc);
  const keys = [];
  if (card.sku) keys.push(String(card.sku));
  const href = String(card.href || "");
  const hm = href.match(/\/(?:c|p)\/([^/?#]+)/);
  if (hm) keys.push(decodeURIComponent(hm[1]));
  const tm = id.match(/tcgcsv-\d+/);
  if (tm) keys.push(tm[0]);
  let alt = null;
  for (const key of keys) {
    const row = idx[key];
    if (!usable(row) || row === exact) continue;
    if (!alt || (hasTiles(row) && !hasTiles(alt))) alt = row;
    if (hasTiles(row)) break;
  }
  const hit = hasTiles(exact) ? exact : hasTiles(alt) ? alt : usable(exact) ? exact : usable(alt) ? alt : null;
  if (!hit) return card;
  const next = {};
  for (const k in card) next[k] = card[k];
  if (!(Array.isArray(card.signals) && card.signals.length) && Array.isArray(hit.signals) && hit.signals.length) {
    next.signals = hit.signals;
    if (hit.blurb) next.blurb = hit.blurb;
  }
  if (hasTiles(hit)) next.tiles = hit.tiles;
  return next;
}

export function signalLeadMarkup(card, doc, escape) {
  const row = signalJoin(card, doc);
  if (!row) return "";
  if (hasTiles(row)) return signalMarkup(row, escape, { tap: false, compact: true });
  if (!Array.isArray(row.signals) || !row.signals.length) return "";
  return signalMarkup({ signals: row.signals.slice(0, 1) }, escape, { tap: false, pills: true });
}

export function signalBitsMarkup(card, doc, escape) {
  const row = signalJoin(card, doc);
  const href = "/feed/r/" + encodeURIComponent((row && row.id) || "");
  const htmlOut = signalMarkup(row, escape, { href, asOf: (doc && doc.asOf) || "" });
  if (typeof pageMode !== "undefined" && pageMode === "read" && typeof document !== "undefined") {
    const blocks = document.querySelectorAll("main .sig-block");
    for (let i = 0; i < blocks.length; i++) {
      if (blocks[i].closest && blocks[i].closest("article")) continue;
      if (htmlOut) blocks[i].remove();
    }
    if (!htmlOut) return "";
  }
  return htmlOut;
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

// One listener for every flip tile on the page. Tap or Enter flips, Escape flips back.
export const TILE_JS = `(function(){if(window.__ceTiles)return;window.__ceTiles=1;function set(b,on){b.setAttribute("aria-pressed",on?"true":"false");}document.addEventListener("click",function(ev){var b=ev.target&&ev.target.closest?ev.target.closest(".tl"):null;if(!b)return;ev.preventDefault();ev.stopPropagation();set(b,b.getAttribute("aria-pressed")!=="true");},true);document.addEventListener("keydown",function(ev){if(ev.key!=="Escape")return;var b=document.activeElement;if(b&&b.classList&&b.classList.contains("tl"))set(b,false);});})();`;

export const SIGNAL_CLIENT = `${signalMarkup.toString()}\n${mountSignalTools.toString()}\n${hasTiles.toString()}\n${usable.toString()}\n${skuIndex.toString()}\n${signalJoin.toString()}\n${signalLeadMarkup.toString()}\n${signalBitsMarkup.toString()}\n${TILE_JS}\nvar signalDoc=null;\nfunction signalLead(card){return signalLeadMarkup(card, signalDoc, html);}\nfunction signalBits(card){return signalBitsMarkup(card, signalDoc, html);}\n`;

function esc(s) {
  return String(s ?? "").replace(/&/g, "&" + "amp;").replace(/</g, "&" + "lt;").replace(/>/g, "&" + "gt;").replace(/"/g, "&" + "quot;");
}

// Fast mode only. The meaning of each tile lives on the tile itself.
export function feedToolsHtml() {
  return `<div class="feed-tools"><button type="button" id="fast-mode" class="fast-toggle" aria-pressed="false">Fast mode</button></div>`;
}


export function attachSignals(bundle, doc) {
  if (!bundle || !doc || !doc.byId) return bundle;
  const reads = (bundle.reads || []).map((row) => {
    if (!row || !row.id) return row;
    const hit = chipLookup(doc, row.id);
    if (!hit) return row;
    const hasChips = Array.isArray(row.signals) && row.signals.length;
    if (hasChips && (hasTiles(row) || !hasTiles(hit))) return row;
    const next = { ...row };
    if (!hasChips && Array.isArray(hit.signals) && hit.signals.length) {
      next.signals = hit.signals.slice(0, 4);
      next.blurb = hit.blurb || row.blurb || "";
    }
    if (hasTiles(hit) && !hasTiles(row)) next.tiles = hit.tiles;
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
}
