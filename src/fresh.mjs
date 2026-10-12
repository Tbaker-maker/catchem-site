// Freshness for unranked views. Filtered or ranked views never call this.
// Every function here is self-contained so it can be inlined with toString().

export function freshRandom(seed) {
  let s = (Number(seed) >>> 0) || 1;
  return function rnd() {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// New seed per visit or refresh. Uses the browser random source when it is there.
export function freshSeed() {
  const c = globalThis["cry" + "pto"];
  try {
    const a = new Uint32Array(1);
    c.getRandomValues(a);
    return a[0] || 1;
  } catch (e) {
    return ((Math.random() * 4294967295) >>> 0) || 1;
  }
}

// Order: unseen first, shuffled with the visit seed. No repeat of the same read
// id or the same product. No two of the same kind side by side, and no two of
// the same set or era side by side, where the pool allows it. A product is not
// shown again within `gap` rows.
export function freshOrder(rows, opts) {
  const o = opts || {};
  const rnd = freshRandom(o.seed);
  const seen = o.seen || {};
  const gap = Number(o.gap) > 0 ? Number(o.gap) : 8;
  const kindOf = (r) => String((r && (r.family || r.readKind || r.kind)) || (r && r.pending ? "card" : "read"));
  const setOf = (r) => String((r && (r.set || r.setSlug || (r.receipt && r.receipt.era) || r.era)) || "");
  const productOf = (r) => String((r && (r.sku || r.href || r.id)) || "");
  const ids = {};
  const products = {};
  const pool = [];
  for (const r of rows || []) {
    if (!r) continue;
    const id = String(r.id || "");
    const p = productOf(r);
    if (id && ids[id]) continue;
    if (p && products[p] && !r.pending) continue;
    if (id) ids[id] = 1;
    if (p) products[p] = 1;
    pool.push(r);
  }
  const shuffle = (a) => {
    for (let i = a.length - 1; i > 0; i -= 1) {
      const j = Math.trunc(rnd() * (i + 1));
      const t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  };
  const unseen = shuffle(pool.filter((r) => !seen[String(r.id || "")]));
  const old = shuffle(pool.filter((r) => seen[String(r.id || "")]));
  const out = [];
  for (const group of [unseen, old]) {
    const left = group.slice();
    while (left.length) {
      const last = out[out.length - 1];
      const recent = out.slice(-gap).map(productOf);
      const score = (r) => {
        let s = 0;
        if (last && kindOf(r) === kindOf(last)) s += 4;
        if (last && setOf(r) && setOf(r) === setOf(last)) s += 2;
        if (recent.indexOf(productOf(r)) >= 0) s += 8;
        return s;
      };
      const left_kinds = {};
      for (const r of left) left_kinds[kindOf(r)] = (left_kinds[kindOf(r)] || 0) + 1;
      let best = 0;
      let bestScore = Infinity;
      for (let i = 0; i < left.length && i < 200; i += 1) {
        // The kind with the most rows left goes first, so the tail does not clump.
        const sc = score(left[i]) * 1000 - left_kinds[kindOf(left[i])];
        if (sc < bestScore) { best = i; bestScore = sc; }
      }
      out.push(left.splice(best, 1)[0]);
    }
  }
  return out;
}

// One of the file-built wordings on the row. Every variant uses the same
// numbers from the same file, so any pick is true.
export function pickWording(row, rnd) {
  const list = row && Array.isArray(row.variants) ? row.variants.filter((v) => typeof v === "string" && v.trim()) : [];
  if (!list.length) return row;
  const all = [String(row.headline || "")].concat(list).filter(Boolean);
  const text = all[Math.trunc(rnd() * all.length)] || all[0];
  return Object.assign({}, row, { headline: text, path: text });
}

export const SEEN_KEY = "catchem-seen-reads";
export function readSeen(store, now) {
  try {
    const raw = JSON.parse(store.getItem(SEEN_KEY) || "{}");
    const out = {};
    const cut = (now || Date.now()) - 14 * 86400000;
    for (const k in raw) if (raw[k] > cut) out[k] = raw[k];
    return out;
  } catch (e) { return {}; }
}
export function markSeen(store, ids, now) {
  try {
    const cur = JSON.parse(store.getItem(SEEN_KEY) || "{}");
    const t = now || Date.now();
    for (const id of ids || []) if (id) cur[id] = t;
    const keys = Object.keys(cur).sort((a, b) => cur[b] - cur[a]).slice(0, 600);
    const kept = {};
    for (const k of keys) kept[k] = cur[k];
    store.setItem(SEEN_KEY, JSON.stringify(kept));
  } catch (e) { /* storage off */ }
}
