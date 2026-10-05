const BASE = "https://raw.githubusercontent.com/Tbaker-maker/Catchem-data/main/research/assets/public/";
const mem = new Map();

export function resetJsonCache() {
  mem.clear();
}

export async function loadJson(rel, fetchImpl = fetch) {
  if (mem.has(rel)) return mem.get(rel);
  const res = await fetchImpl(BASE + rel, { cf: { cacheTtl: 300 } });
  if (!res.ok) throw new Error(`${rel} ${res.status}`);
  const data = await res.json();
  if (mem.size > 24) mem.clear();
  mem.set(rel, data);
  return data;
}

export async function proxyPublic(rel, fetchImpl = fetch) {
  const res = await fetchImpl(BASE + rel, { cf: { cacheTtl: 300 } });
  if (!res.ok) return new Response("Not found", { status: 404, headers: { "cache-control": "no-store" } });
  const type = rel.endsWith(".xml") ? "application/xml; charset=utf-8"
    : rel.endsWith(".mjs") ? "text/javascript; charset=utf-8"
    : "application/json; charset=utf-8";
  return new Response(res.body, {
    status: 200,
    headers: {
      "content-type": type,
      "cache-control": "public, max-age=300",
      "access-control-allow-origin": "*",
    },
  });
}
