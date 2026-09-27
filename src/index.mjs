import { isFeedPath, loadLatestFeed } from "./feed.mjs";

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (request.method === "GET" && isFeedPath(url.pathname)) {
      try {
        const cache = caches.default;
        const key = new Request(new URL("/feed", url.origin), { method: "GET" });
        const hit = await cache.match(key);
        if (hit) return hit;
        const html = await loadLatestFeed();
        const res = new Response(html, {
          headers: {
            "content-type": "text/html; charset=utf-8",
            "cache-control": "public, max-age=60",
          },
        });
        ctx.waitUntil(cache.put(key, res.clone()));
        return res;
      } catch {
        // The last baked copy still answers if GitHub is down.
      }
    }
    return env.ASSETS.fetch(request);
  },
};
