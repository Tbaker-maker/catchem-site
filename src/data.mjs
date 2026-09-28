const BASE = "https://raw.githubusercontent.com/Tbaker-maker/Catchem-data/main/research/assets/public/";
const mem = new Map();

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
  if (!res.ok) return new Response("Not found", { status: 404 });
  return new Response(res.body, {
    status: 200,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "public, max-age=300",
      "access-control-allow-origin": "*",
    },
  });
}
