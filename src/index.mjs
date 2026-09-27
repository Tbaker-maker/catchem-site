import { isFeedPath, loadLatestFeed } from "./feed.mjs";

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (request.method === "GET" && isFeedPath(url.pathname)) {
      try {
        const html = await loadLatestFeed();
        return new Response(html, {
          headers: {
            "content-type": "text/html; charset=utf-8",
            "cache-control": "no-store",
            "cdn-cache-control": "no-store",
          },
        });
      } catch {
        // The last baked copy still answers if GitHub is down.
      }
    }
    return env.ASSETS.fetch(request);
  },
};
