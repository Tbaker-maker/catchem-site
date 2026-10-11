// Same split as Catchem-data scripts/lib/public-search-shards.mjs.
// Kind plus the first two letters of the normalized name.
// Helpers stay inside queryShardIds so the search page can embed one function.

export function queryShardIds(query) {
  function normalize(value) {
    return String(value || "")
      .toLowerCase()
      .replace(/&/g, " and ")
      .replace(/[^a-z0-9]+/g, " ")
      .trim()
      .replace(/\s+/g, " ");
  }
  function namePrefix(name) {
    const flat = normalize(name).replace(/ /g, "");
    if (flat.length < 2) return "__";
    return flat.slice(0, 2);
  }
  const q = normalize(query);
  if (q.replace(/ /g, "").length < 2) return [];
  const prefs = new Set();
  const whole = namePrefix(q);
  if (whole !== "__") prefs.add(whole);
  for (const token of q.split(" ")) {
    const pref = namePrefix(token);
    if (pref !== "__") prefs.add(pref);
  }
  const ids = [];
  for (const kind of ["single", "sealed", "slab"]) for (const pref of prefs) ids.push(`${kind}-${pref}`);
  return ids.sort();
}
