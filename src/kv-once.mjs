// One catalog value per key. The same bytes are not written again.
// A failed put leaves the previous value in place.

const mem = new Map();

export function resetKvOnce() {
  mem.clear();
}

export function textHash(value) {
  let h = 2166136261;
  const s = String(value ?? "");
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16);
}

// Returns "wrote", "same", "fail", or "skip".
// The hash lives on its own tiny key so a match does not read the body.
export async function putIfChanged(kv, key, value, ttlSec) {
  if (!kv || !key || value == null) return "skip";
  const hash = textHash(value);
  if (mem.get(key) === hash) return "same";
  const hashKey = key + "#h";
  let prev = null;
  try { prev = await kv.get(hashKey); } catch { prev = null; }
  if (prev === hash) {
    mem.set(key, hash);
    return "same";
  }
  const opts = ttlSec ? { expirationTtl: ttlSec } : undefined;
  try {
    await kv.put(key, value, opts);
  } catch {
    return "fail";
  }
  mem.set(key, hash);
  try { await kv.put(hashKey, hash, opts); } catch { /* body is stored; the next publish compares again */ }
  return "wrote";
}
