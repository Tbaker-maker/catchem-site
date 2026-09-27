import { isFeedPath, loadLatestFeed, redirectPath } from "./feed.mjs";

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (request.method === "GET") {
      const dest = redirectPath(url.pathname);
      if (dest) return Response.redirect(new URL(dest, url), 301);
    }
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
    const asset = await env.ASSETS.fetch(request);
    const headers = new Headers(asset.headers);
    const type = headers.get("content-type") || "";
    if (type.includes("text/html")) {
      headers.set("cache-control", "no-store");
      headers.set("cdn-cache-control", "no-store");
    }
    return new Response(asset.body, { status: asset.status, statusText: asset.statusText, headers });
  },
};
