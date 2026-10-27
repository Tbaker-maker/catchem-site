// Worker entry. /data-explorer and /sealed-pulse are served here so
// src/index.mjs can stay unchanged while other open branches own that file.
import worker from "./index.mjs";
import { dataExplorerResponse } from "./data-explorer.mjs";
import { sealedPulseResponse } from "./brand-visuals.mjs";

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname.length > 1 && url.pathname.endsWith("/") ? url.pathname.slice(0, -1) : url.pathname;
    if (path === "/data-explorer" || path.startsWith("/data-explorer/")) {
      try {
        const hit = await dataExplorerResponse(request, env);
        if (hit) return hit;
      } catch {
        return new Response("The published files did not load.", {
          status: 503,
          headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" },
        });
      }
    }
    if (path === "/sealed-pulse" || path === "/heat") {
      try {
        return await sealedPulseResponse(request, env);
      } catch {
        return new Response("The sealed market pulse did not load.", {
          status: 503,
          headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" },
        });
      }
    }
    return worker.fetch(request, env, ctx);
  },
};
