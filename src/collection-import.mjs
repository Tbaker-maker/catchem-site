// Collection CSV import. Preview before save. Fill setSlug from catalogue when missing.
// Copy rules: no em/en dashes, listings counted, no NM on sealed, no advice.

const CONDITIONS = ["NM", "LP", "MP", "HP", "DMG"];

export function validSku(value) {
  const id = String(value || "").trim();
  return /^tcgcsv-\d+$/.test(id) ? id : "";
}

export function parseCsv(text) {
  const raw = String(text || "").replace(/^\uFEFF/, "");
  if (!raw.trim()) return { headers: [], rows: [], error: "CSV is empty." };
  const lines = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i];
    const next = raw[i + 1];
    if (inQuotes) {
      if (ch === '"' && next === '"') {
        cur += '"';
        i++;
        continue;
      }
      if (ch === '"') {
        inQuotes = false;
        continue;
      }
      cur += ch;
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      continue;
    }
    if (ch === "," ) {
      lines.push(cur);
      cur = "";
      // accumulate fields into row buffer via parallel arrays below
      continue;
    }
    if (ch === "\n" || (ch === "\r" && next === "\n") || ch === "\r") {
      lines.push(cur);
      cur = "";
      if (ch === "\r" && next === "\n") i++;
      lines.push("\n");
      continue;
    }
    cur += ch;
  }
  lines.push(cur);

  const rows = [];
  let row = [];
  for (const cell of lines) {
    if (cell === "\n") {
      rows.push(row);
      row = [];
      continue;
    }
    row.push(cell);
  }
  if (row.length && row.some((c) => String(c).trim())) rows.push(row);
  if (!rows.length) return { headers: [], rows: [], error: "CSV is empty." };

  const headers = rows[0].map((h) => String(h || "").trim().toLowerCase());
  const body = rows.slice(1).filter((r) => r.some((c) => String(c || "").trim()));
  return { headers, rows: body, error: "" };
}

function headerIndex(headers, names) {
  for (const name of names) {
    const i = headers.indexOf(name);
    if (i >= 0) return i;
  }
  return -1;
}

export function mapCsvRow(headers, cells) {
  const get = (names) => {
    const i = headerIndex(headers, names);
    return i >= 0 ? String(cells[i] ?? "").trim() : "";
  };
  const id = validSku(get(["id", "sku", "tcgcsv", "tcgcsv_id", "productid", "product_id"]));
  const name = get(["name", "product", "card", "title"]);
  const setName = get(["set", "setname", "set_name", "expansion"]);
  const setSlugRaw = get(["setslug", "set_slug", "slug"]).toLowerCase();
  const setSlug = /^[a-z0-9-]+$/.test(setSlugRaw) ? setSlugRaw : "";
  const kindRaw = get(["kind", "type"]).toLowerCase();
  const kind = kindRaw === "sealed" || /booster|etb|box|tin|bundle|collection box/.test(name.toLowerCase())
    ? "sealed"
    : kindRaw === "single"
      ? "single"
      : "";
  const qtyRaw = Number(get(["qty", "quantity", "count", "amount"]));
  const qty = Number.isFinite(qtyRaw) && qtyRaw > 0 ? Math.min(99, Math.round(qtyRaw)) : 1;
  const condRaw = get(["condition", "cond"]).toUpperCase();
  const condition = CONDITIONS.includes(condRaw) ? condRaw : "";
  return { id, name, set: setName, setSlug, kind, qty, condition };
}

export function matchCatalogue(row, catalogue) {
  const list = Array.isArray(catalogue) ? catalogue.filter(Boolean) : [];
  if (row.id) {
    const hit = list.find((c) => c.sku === row.id || c.id === row.id);
    if (hit) return hit;
  }
  const wantName = String(row.name || "").toLowerCase();
  const wantSet = String(row.set || "").toLowerCase();
  if (!wantName) return null;
  const scored = [];
  for (const c of list) {
    const n = String(c.name || "").toLowerCase();
    if (!n) continue;
    if (n !== wantName && !n.includes(wantName) && !wantName.includes(n)) continue;
    let score = n === wantName ? 10 : 5;
    const set = String(c.set || "").toLowerCase();
    const slug = String(c.setSlug || "").toLowerCase();
    if (wantSet && (set === wantSet || set.includes(wantSet) || wantSet.includes(set))) score += 5;
    if (row.setSlug && slug === row.setSlug) score += 5;
    if (row.kind && c.kind === row.kind) score += 2;
    scored.push({ score, c });
  }
  scored.sort((a, b) => b.score - a.score);
  if (!scored.length) return null;
  if (scored.length > 1 && scored[0].score === scored[1].score) return null; // ambiguous
  return scored[0].score >= 5 ? scored[0].c : null;
}

export function previewImport({ text, catalogue }) {
  const parsed = parseCsv(text);
  if (parsed.error) {
    return { ok: false, error: parsed.error, rows: [], accepted: 0, rejected: 0 };
  }
  const headers = parsed.headers;
  if (!headers.length) {
    return { ok: false, error: "CSV needs a header row.", rows: [], accepted: 0, rejected: 0 };
  }
  const out = [];
  let accepted = 0;
  let rejected = 0;
  for (const cells of parsed.rows.slice(0, 500)) {
    const mapped = mapCsvRow(headers, cells);
    const hit = matchCatalogue(mapped, catalogue);
    if (!hit) {
      rejected += 1;
      out.push({
        ok: false,
        reason: mapped.id || mapped.name ? "No catalogue match." : "Missing id or name.",
        input: mapped,
        holding: null,
      });
      continue;
    }
    const kind = mapped.kind || (hit.kind === "sealed" ? "sealed" : "single");
    const holding = {
      id: hit.sku || hit.id,
      sku: hit.sku || hit.id,
      name: hit.name || mapped.name,
      kind,
      condition: kind === "sealed" ? null : (mapped.condition || "NM"),
      qty: mapped.qty,
      price: Number(hit.price) > 0 ? Number(hit.price) : null,
      asOf: hit.asOf || "",
      set: hit.set || mapped.set || "",
      setSlug: hit.setSlug || mapped.setSlug || "",
      change7: hit.change7 ?? null,
      change30: hit.change30 ?? null,
      change90: hit.change90 ?? null,
      listings: kind === "sealed" && hit.listings != null ? hit.listings : null,
      listingsAsOf: kind === "sealed" && hit.listingsAsOf ? hit.listingsAsOf : "",
      href: kind === "sealed" ? `/p/${hit.sku || hit.id}` : `/c/${hit.sku || hit.id}`,
      source: "TCGplayer market price",
    };
    if (kind === "sealed" && holding.name) {
      holding.name = String(holding.name).replace(/\bNM\b/g, "").replace(/\s+/g, " ").trim();
    }
    accepted += 1;
    out.push({ ok: true, reason: "", input: mapped, holding });
  }
  return {
    ok: true,
    error: "",
    headers,
    rows: out,
    accepted,
    rejected,
    truncated: parsed.rows.length > 500,
    note: "Preview only. Nothing is saved until you confirm.",
  };
}

export function holdingsFromPreview(preview) {
  const rows = Array.isArray(preview?.rows) ? preview.rows : [];
  const out = [];
  const seen = new Set();
  for (const row of rows) {
    if (!row?.ok || !row.holding) continue;
    const id = row.holding.id;
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(row.holding);
  }
  return out;
}
