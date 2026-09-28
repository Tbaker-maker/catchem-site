// Shared Post Office copy. Browser and Node. No invented prices.

export function priceLine(usd, date) {
  const n = Number(usd);
  if (!Number.isFinite(n) || n <= 0) return "No market price";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(date || ""))) return "No market price";
  const money = "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `TCGplayer market: ${money} (${date})`;
}

/** Always a single .png. Never .png.jpg or .jpg. */
export function downloadName(stem) {
  let base = String(stem || "catchem-post").trim() || "catchem-post";
  base = base.replace(/(\.(png|jpe?g))+$/i, "");
  return base + ".png";
}

export function parseQuery(raw, mode) {
  let q = String(raw || "").trim();
  let next = mode || "tcg";
  if (/,\s*both\s*$/i.test(q)) {
    next = "both";
    q = q.replace(/,\s*both\s*$/i, "").trim();
  }
  return { q, mode: next };
}

export function editionLabel(row) {
  const edition = row && row[2] ? String(row[2]) : "Edition not labeled";
  const printing = [row && row[8], row && row[3]].filter(Boolean).join(" · ") || "Printing not labeled";
  return { edition, printing };
}

function printingRank(row) {
  const r = String((row && row[8]) || "").toLowerCase();
  if (r.includes("crown")) return 6;
  if (r.includes("three star")) return 5;
  if (r.includes("special illustration") || r.includes("two star")) return 4;
  if (r.includes("secret")) return 3;
  if (r.includes("illustration") || r.includes("four diamond")) return 2;
  if (r.includes("ultra") || r.includes("three diamond")) return 1;
  return 0;
}

/** Keep search order. Only the top name's printings are reordered, so a higher rarity of a worse match cannot jump the queue. */
export function preferPrinting(hits) {
  const list = (hits || []).slice();
  if (!list.length) return list;
  const topName = String(list[0][1] || "").toLowerCase();
  const same = [];
  const rest = [];
  for (const row of list) {
    if (String(row[1] || "").toLowerCase() === topName) same.push(row);
    else rest.push(row);
  }
  same.sort((a, b) => printingRank(b) - printingRank(a) || (Number(b[6]) || 0) - (Number(a[6]) || 0));
  return same.concat(rest);
}

/** Highest priced prints. A page of sub-$20 commons is not the default when a notable print exists. */
export function artistNotable(rows) {
  const list = rows || [];
  const priced = list.filter((r) => Number(r[6]) >= 20).sort((a, b) => Number(b[6]) - Number(a[6]));
  const any = list.filter((r) => Number(r[6]) > 0).sort((a, b) => Number(b[6]) - Number(a[6]));
  return (priced.length ? priced : any).slice(0, 12);
}

/** Two cards, never one merged paper card. */
export function comparePair(tcg, pocket) {
  return {
    layout: "side-by-side",
    tcg: tcg || null,
    pocket: pocket || null,
  };
}

export function clientHelpers() {
  return [priceLine, downloadName, parseQuery, editionLabel, printingRank, preferPrinting, artistNotable, comparePair]
    .map((fn) => fn.toString())
    .join("\n");
}
