// Smart Collection + Morning Brief. Pure helpers. Numbers only when on file.
// Copy rules: no em/en dashes, listings counted, no NM on sealed, no advice.

export const GOALS = ["collecting", "selling", "growth"];

const GOAL_LABEL = {
  collecting: "Collecting",
  selling: "Selling",
  growth: "Growth",
};

const SCORE_WEIGHTS = {
  collecting: { completion: 0.45, liquidity: 0.15, concentration: 0.1, momentum: 0.15, coverage: 0.15 },
  selling: { completion: 0.1, liquidity: 0.4, concentration: 0.15, momentum: 0.25, coverage: 0.1 },
  growth: { completion: 0.1, liquidity: 0.2, concentration: 0.35, momentum: 0.25, coverage: 0.1 },
};

const BRIEF_SECTIONS = {
  collecting: ["moved", "gaps", "cheapest", "rarest", "cost", "reads"],
  selling: ["moved", "cashout", "liquidity", "demand", "reads"],
  growth: ["moved", "risk", "reads", "gaps"],
};

export function normalizeGoal(raw) {
  const g = String(raw || "").toLowerCase().trim();
  return GOALS.includes(g) ? g : "";
}

export function defaultGoal(holdings) {
  const rows = Array.isArray(holdings) ? holdings.filter(Boolean) : [];
  if (!rows.length) return "collecting";
  const bySet = new Map();
  let sealedValue = 0;
  let singleValue = 0;
  for (const row of rows) {
    const line = lineValue(row);
    if (row.kind === "sealed") sealedValue += line;
    else singleValue += line;
    const slug = String(row.setSlug || "").trim();
    if (slug) bySet.set(slug, (bySet.get(slug) || 0) + 1);
  }
  const maxSet = Math.max(0, ...bySet.values());
  if (maxSet >= 5) return "collecting";
  if (sealedValue > singleValue * 1.25) return "selling";
  if (rows.some((r) => Number.isFinite(r.change7) && Math.abs(r.change7) >= 8)) return "growth";
  return "collecting";
}

export function goalLabel(goal) {
  return GOAL_LABEL[normalizeGoal(goal) || "collecting"] || "Collecting";
}

function lineValue(row) {
  const price = Number(row?.price);
  const qty = Number(row?.qty);
  if (!(price > 0) || !(qty > 0)) return 0;
  return price * qty;
}

export function concentration(holdings) {
  const rows = Array.isArray(holdings) ? holdings.filter((r) => lineValue(r) > 0) : [];
  const total = rows.reduce((n, r) => n + lineValue(r), 0);
  if (!(total > 0)) return { hhi: null, topShare: null, topName: "", n: 0, total: 0 };
  const sorted = rows.slice().sort((a, b) => lineValue(b) - lineValue(a));
  const top = sorted[0];
  const topShare = lineValue(top) / total;
  let hhi = 0;
  for (const row of rows) {
    const s = lineValue(row) / total;
    hhi += s * s;
  }
  return {
    hhi: Math.round(hhi * 10000) / 10000,
    topShare: Math.round(topShare * 1000) / 1000,
    topName: String(top.name || top.id || ""),
    n: rows.length,
    total: Math.round(total * 100) / 100,
  };
}

export function liquidityRank(holdings) {
  const rows = Array.isArray(holdings) ? holdings.filter(Boolean) : [];
  return rows
    .map((row) => {
      const listings = row.kind === "sealed" && Number.isFinite(Number(row.listings)) ? Number(row.listings) : null;
      const move = Number.isFinite(Number(row.change7)) ? Math.abs(Number(row.change7)) : null;
      const value = lineValue(row);
      let score = 0;
      if (listings != null) score += Math.min(40, Math.log10(listings + 1) * 20);
      if (move != null) score += Math.min(40, move);
      if (value > 0) score += Math.min(20, Math.log10(value + 1) * 8);
      return {
        id: row.id,
        name: row.name,
        kind: row.kind,
        href: row.href,
        listings,
        listingsAsOf: row.listingsAsOf || "",
        change7: Number.isFinite(Number(row.change7)) ? Number(row.change7) : null,
        price: row.price,
        asOf: row.asOf || "",
        value: Math.round(value * 100) / 100,
        score: Math.round(score * 10) / 10,
      };
    })
    .sort((a, b) => b.score - a.score);
}

export const CASHOUT_METHOD = {
  source: "TCGplayer market price",
  listingsSource: "listings counted on sealed rows when on file",
  note: "Cashout uses TCGplayer market on each line, then a keep rate from listings counted. It is a model, not a quote.",
  tiers: [
    { id: "sealed-missing", kind: "sealed", min: null, max: null, keep: 0.8, label: "Sealed with listings counted not on file" },
    { id: "sealed-thin", kind: "sealed", min: 0, max: 4, keep: 0.75, label: "Sealed with under 5 listings counted" },
    { id: "sealed-mid", kind: "sealed", min: 5, max: 19, keep: 0.85, label: "Sealed with 5 to 19 listings counted" },
    { id: "sealed-deep", kind: "sealed", min: 20, max: null, keep: 0.93, label: "Sealed with 20 or more listings counted" },
    { id: "single-default", kind: "single", min: null, max: null, keep: 0.9, label: "Singles (listings counted not applied)" },
  ],
};

export function cashoutKeepRate(row) {
  const kind = row?.kind === "sealed" ? "sealed" : "single";
  if (kind === "single") {
    return { keep: 0.9, tierId: "single-default", label: "Singles (listings counted not applied)", listings: null };
  }
  const listings = Number.isFinite(Number(row?.listings)) ? Number(row.listings) : null;
  if (listings == null) {
    return { keep: 0.8, tierId: "sealed-missing", label: "Sealed with listings counted not on file", listings: null };
  }
  if (listings < 5) {
    return { keep: 0.75, tierId: "sealed-thin", label: "Sealed with under 5 listings counted", listings };
  }
  if (listings < 20) {
    return { keep: 0.85, tierId: "sealed-mid", label: "Sealed with 5 to 19 listings counted", listings };
  }
  return { keep: 0.93, tierId: "sealed-deep", label: "Sealed with 20 or more listings counted", listings };
}

export function cashoutEstimate(holdings) {
  const ranked = liquidityRank(holdings);
  let gross = 0;
  let haircut = 0;
  const rows = [];
  const byTier = Object.create(null);
  for (const row of ranked) {
    if (!(row.value > 0)) continue;
    gross += row.value;
    const rate = cashoutKeepRate(row);
    const net = row.value * rate.keep;
    haircut += row.value - net;
    const line = {
      ...row,
      keep: rate.keep,
      tierId: rate.tierId,
      tierLabel: rate.label,
      net: Math.round(net * 100) / 100,
      source: CASHOUT_METHOD.source,
      listingsSource: row.kind === "sealed" ? CASHOUT_METHOD.listingsSource : "",
    };
    rows.push(line);
    const bucket = byTier[rate.tierId] || { id: rate.tierId, label: rate.label, keep: rate.keep, n: 0, gross: 0, net: 0 };
    bucket.n += 1;
    bucket.gross += row.value;
    bucket.net += net;
    byTier[rate.tierId] = bucket;
  }
  const tiers = Object.values(byTier).map((t) => ({
    ...t,
    gross: Math.round(t.gross * 100) / 100,
    net: Math.round(t.net * 100) / 100,
  }));
  return {
    gross: Math.round(gross * 100) / 100,
    net: Math.round((gross - haircut) * 100) / 100,
    haircut: Math.round(haircut * 100) / 100,
    n: rows.length,
    rows: rows.slice(0, 12),
    tiers,
    method: CASHOUT_METHOD,
    note: CASHOUT_METHOD.note,
  };
}

export function expandMasterRows(setDoc, { sealedOnly = false } = {}) {
  const items = Array.isArray(setDoc?.items) ? setDoc.items.filter(Boolean) : [];
  const out = [];
  for (const item of items) {
    const sealed = item.kind === "sealed";
    if (sealedOnly && !sealed) continue;
    if (!sealedOnly && sealed) continue;
    const printings = Array.isArray(item.printings) ? item.printings.filter(Boolean) : [];
    if (!sealed && printings.length) {
      for (const p of printings) {
        const id = String(p.id || item.id || "");
        if (!/^tcgcsv-\d+$/.test(id)) continue;
        const price = Number(p.price);
        out.push({
          id,
          name: String(item.name || id),
          printing: String(p.name || "Normal"),
          rarity: String(item.rarity || ""),
          price: price > 0 ? price : null,
          asOf: p.asOf || setDoc.asOf || "",
          kind: "single",
          href: `/c/${id}`,
        });
      }
      continue;
    }
    const id = String(item.id || "");
    if (!/^tcgcsv-\d+$/.test(id)) continue;
    const price = Number(item.price);
    out.push({
      id,
      name: String(item.name || id),
      printing: sealed ? "" : String(item.printing || "Normal"),
      rarity: String(item.rarity || ""),
      price: price > 0 ? price : null,
      asOf: setDoc.asOf || "",
      kind: sealed ? "sealed" : "single",
      href: sealed ? `/p/${id}` : `/c/${id}`,
    });
  }
  return out;
}

export function setGaps(holdings, setDoc, { mode = "singles" } = {}) {
  const owned = new Set(
    (Array.isArray(holdings) ? holdings : [])
      .filter((r) => r && /^tcgcsv-\d+$/.test(String(r.id || "")))
      .map((r) => String(r.id)),
  );
  const rows = expandMasterRows(setDoc, { sealedOnly: mode === "sealed" });
  const missing = rows.filter((r) => !owned.has(r.id));
  const have = rows.length - missing.length;
  const pricedMissing = missing.filter((r) => Number(r.price) > 0);
  const cost = pricedMissing.reduce((n, r) => n + Number(r.price), 0);
  const cheapest = pricedMissing.slice().sort((a, b) => a.price - b.price).slice(0, 5);
  const rarest = pricedMissing.slice().sort((a, b) => b.price - a.price).slice(0, 5);
  const pct = rows.length ? have / rows.length : null;
  return {
    slug: setDoc?.slug || "",
    name: setDoc?.name || "",
    asOf: setDoc?.asOf || "",
    source: setDoc?.source || "TCGplayer market",
    mode,
    total: rows.length,
    have,
    missing: missing.length,
    pct: pct == null ? null : Math.round(pct * 1000) / 1000,
    cost: Math.round(cost * 100) / 100,
    costPriced: pricedMissing.length,
    cheapest,
    rarest,
  };
}

export function closestSet(holdings, setDocs) {
  const docs = Array.isArray(setDocs) ? setDocs.filter(Boolean) : [];
  let best = null;
  for (const doc of docs) {
    const singles = setGaps(holdings, doc, { mode: "singles" });
    const sealed = setGaps(holdings, doc, { mode: "sealed" });
    const pick = singles.total >= sealed.total ? singles : sealed;
    if (!pick.total || pick.have <= 0) continue;
    if (pick.pct >= 1) continue;
    if (!best || pick.pct > best.pct || (pick.pct === best.pct && pick.cost < best.cost)) best = pick;
  }
  return best;
}

function clamp01(n) {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

export function collectionScore(holdings, goal, ctx = {}) {
  const g = normalizeGoal(goal) || defaultGoal(holdings);
  const w = SCORE_WEIGHTS[g];
  const rows = Array.isArray(holdings) ? holdings.filter(Boolean) : [];
  const conc = concentration(rows);
  const ranked = liquidityRank(rows);
  const withList = ranked.filter((r) => r.listings != null);
  const liq = withList.length
    ? withList.reduce((n, r) => n + clamp01((r.listings || 0) / 40), 0) / withList.length
    : rows.filter((r) => r.kind === "single").length
      ? 0.55
      : 0.25;
  const moves = rows.filter((r) => Number.isFinite(Number(r.change7)));
  const momentum = moves.length
    ? moves.reduce((n, r) => n + clamp01(Math.abs(Number(r.change7)) / 20), 0) / moves.length
    : 0.2;
  const gaps = Array.isArray(ctx.gapList) ? ctx.gapList : [];
  const completion = gaps.length
    ? gaps.reduce((n, g0) => n + (Number.isFinite(g0.pct) ? g0.pct : 0), 0) / gaps.length
    : rows.length
      ? clamp01(rows.length / 30)
      : 0;
  const coverage = rows.length ? clamp01(rows.filter((r) => Number(r.price) > 0).length / rows.length) : 0;
  const concentrationScore = conc.topShare == null ? 0.5 : clamp01(1 - conc.topShare);
  const parts = {
    completion: Math.round(completion * 1000) / 1000,
    liquidity: Math.round(liq * 1000) / 1000,
    concentration: Math.round(concentrationScore * 1000) / 1000,
    momentum: Math.round(momentum * 1000) / 1000,
    coverage: Math.round(coverage * 1000) / 1000,
  };
  let score = 0;
  for (const key of Object.keys(w)) score += parts[key] * w[key];
  return {
    goal: g,
    label: goalLabel(g),
    score: Math.round(score * 100),
    parts,
    weights: w,
    concentration: conc,
  };
}

export function movedSince(prevRows, nextRows) {
  const prev = new Map();
  for (const row of Array.isArray(prevRows) ? prevRows : []) {
    if (!row?.id) continue;
    prev.set(String(row.id), row);
  }
  const out = [];
  for (const row of Array.isArray(nextRows) ? nextRows : []) {
    if (!row?.id || !(Number(row.price) > 0)) continue;
    const before = prev.get(String(row.id));
    if (!before || !(Number(before.price) > 0)) continue;
    if (Number(before.price) === Number(row.price)) continue;
    const from = Number(before.price);
    const to = Number(row.price);
    out.push({
      id: row.id,
      name: row.name,
      kind: row.kind,
      href: row.href,
      from,
      to,
      pct: Math.round(((to - from) / from) * 1000) / 10,
      asOf: row.asOf || "",
      prevAsOf: before.asOf || "",
      source: "TCGplayer market",
      qty: row.qty || 1,
    });
  }
  out.sort((a, b) => Math.abs(b.pct) - Math.abs(a.pct));
  return out;
}

export function ownershipWeight(row) {
  return lineValue(row);
}

export function viewWeight(views, id) {
  const n = Number(views && views[id]);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export function rankOwned(holdings, views = {}) {
  return (Array.isArray(holdings) ? holdings : [])
    .filter(Boolean)
    .map((row) => ({
      row,
      weight: ownershipWeight(row) * 1 + viewWeight(views, row.id) * 8,
    }))
    .sort((a, b) => b.weight - a.weight)
    .map((x) => x.row);
}

export function readsOnOwned(holdings, readRows, views = {}) {
  const owned = new Map();
  for (const row of Array.isArray(holdings) ? holdings : []) {
    if (row?.id) owned.set(String(row.id), row);
  }
  const out = [];
  for (const read of Array.isArray(readRows) ? readRows : []) {
    const id = String(read?.id || read?.sku || "");
    if (!owned.has(id)) continue;
    out.push({
      id,
      name: read.name || owned.get(id).name,
      href: owned.get(id).href || read.href || `/c/${id}`,
      headline: String(read.headline || read.title || "").replace(/\s*[\u2014\u2013]\s*/g, ": "),
      asOf: read.asOf || read.date || "",
      source: read.source || "Catch'em read",
      weight: ownershipWeight(owned.get(id)) + viewWeight(views, id) * 8,
    });
  }
  out.sort((a, b) => b.weight - a.weight);
  return out;
}

export function normalizeBriefPrefs(raw) {
  const pinned = Array.isArray(raw?.pinned) ? raw.pinned.map(String).filter(Boolean).slice(0, 12) : [];
  const hidden = Array.isArray(raw?.hidden) ? raw.hidden.map(String).filter(Boolean).slice(0, 12) : [];
  return { pinned, hidden };
}

export function briefSectionOrder(goal, prefs) {
  const g = normalizeGoal(goal) || "collecting";
  const base = BRIEF_SECTIONS[g].slice();
  const { pinned, hidden } = normalizeBriefPrefs(prefs);
  const hide = new Set(hidden);
  const pin = pinned.filter((id) => base.includes(id) && !hide.has(id));
  const rest = base.filter((id) => !hide.has(id) && !pin.includes(id));
  return [...pin, ...rest];
}

export function morningBrief(input = {}) {
  const holdings = Array.isArray(input.holdings) ? input.holdings.filter(Boolean) : [];
  const goal = normalizeGoal(input.goal) || defaultGoal(holdings);
  const views = input.views && typeof input.views === "object" ? input.views : {};
  const prefs = normalizeBriefPrefs(input.briefPrefs);
  const setDocs = Array.isArray(input.setDocs) ? input.setDocs : [];
  const prev = Array.isArray(input.prevHoldings) ? input.prevHoldings : [];
  const readRows = Array.isArray(input.reads) ? input.reads : [];

  const moved = movedSince(prev, holdings).slice(0, 6);
  const gapList = setDocs.map((doc) => setGaps(holdings, doc, { mode: "singles" })).filter((g) => g.total > 0 && g.have > 0);
  const closest = closestSet(holdings, setDocs);
  const cashout = cashoutEstimate(holdings);
  const liq = liquidityRank(holdings).slice(0, 6);
  const demand = holdings
    .filter((r) => Number.isFinite(Number(r.change7)) && Number(r.price) > 0)
    .slice()
    .sort((a, b) => Math.abs(b.change7) - Math.abs(a.change7))
    .slice(0, 6)
    .map((r) => ({
      id: r.id,
      name: r.name,
      href: r.href,
      change7: r.change7,
      price: r.price,
      asOf: r.asOf || "",
      source: "TCGplayer market",
    }));
  const risk = concentration(holdings);
  const reads = readsOnOwned(holdings, readRows, views).slice(0, 6);
  const score = collectionScore(holdings, goal, { gapList });

  const sections = {
    moved: {
      id: "moved",
      title: "Moved since your last look",
      empty: "No price change on file since the last save on this device.",
      rows: moved,
    },
    gaps: {
      id: "gaps",
      title: "Set closest to done",
      empty: "Add cards from one set to see completion.",
      closest,
    },
    cheapest: {
      id: "cheapest",
      title: "Cheapest missing pieces",
      empty: "No priced gaps on file.",
      rows: closest ? closest.cheapest : [],
      setName: closest?.name || "",
      asOf: closest?.asOf || "",
    },
    rarest: {
      id: "rarest",
      title: "Rarest missing pieces",
      empty: "No priced gaps on file.",
      rows: closest ? closest.rarest : [],
      setName: closest?.name || "",
      asOf: closest?.asOf || "",
    },
    cost: {
      id: "cost",
      title: "Cost to finish",
      empty: "No priced gaps on file.",
      closest,
    },
    cashout: {
      id: "cashout",
      title: "Cashout value",
      empty: "No market prices on file.",
      cashout,
    },
    liquidity: {
      id: "liquidity",
      title: "Liquidity leaders",
      empty: "No listings counted on file for sealed rows.",
      rows: liq,
    },
    demand: {
      id: "demand",
      title: "Demand on your items",
      empty: "No 7-day moves on file.",
      rows: demand,
    },
    risk: {
      id: "risk",
      title: "Concentration risk",
      empty: "Save priced items to see concentration.",
      risk,
    },
    reads: {
      id: "reads",
      title: "Reads on items you own",
      empty: "No Catch'em reads match your items today.",
      rows: reads,
    },
  };

  const order = briefSectionOrder(goal, prefs);
  return {
    goal,
    label: goalLabel(goal),
    score,
    order,
    sections: order.map((id) => sections[id]).filter(Boolean),
    pinned: prefs.pinned,
    hidden: prefs.hidden,
  };
}

export function buildSmartPayload(body = {}) {
  const holdings = Array.isArray(body.holdings) ? body.holdings : [];
  const goal = normalizeGoal(body.goal) || defaultGoal(holdings);
  const setDocs = Array.isArray(body.setDocs) ? body.setDocs : [];
  const views = body.views && typeof body.views === "object" ? body.views : {};
  const briefPrefs = normalizeBriefPrefs(body.briefPrefs);
  const prevHoldings = Array.isArray(body.prevHoldings) ? body.prevHoldings : [];
  const reads = Array.isArray(body.reads) ? body.reads : [];
  const gapList = setDocs.map((doc) => setGaps(holdings, doc, { mode: "singles" })).filter((g) => g.total);
  const sealedGaps = setDocs.map((doc) => setGaps(holdings, doc, { mode: "sealed" })).filter((g) => g.total && g.have > 0);
  const brief = morningBrief({ holdings, goal, setDocs, views, briefPrefs, prevHoldings, reads });
  const score = collectionScore(holdings, goal, { gapList });
  return {
    ok: true,
    goal,
    label: goalLabel(goal),
    score,
    brief,
    panels: {
      collecting: {
        closest: closestSet(holdings, setDocs),
        sealedGaps: sealedGaps.slice(0, 5),
        singlesGaps: gapList.filter((g) => g.have > 0 && g.pct < 1).sort((a, b) => b.pct - a.pct).slice(0, 5),
      },
      selling: {
        cashout: cashoutEstimate(holdings),
        liquidity: liquidityRank(holdings).slice(0, 10),
      },
      growth: {
        risk: concentration(holdings),
        ranked: rankOwned(holdings, views).slice(0, 10),
        reads: readsOnOwned(holdings, reads, views).slice(0, 8),
      },
    },
  };
}
