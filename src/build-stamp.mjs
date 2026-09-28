// Overwritten by scripts/build.mjs on deploy with the git commit being shipped.
export const BUILD_SHA = "dev";
export const BUILD_DATE = "2026-09-28";

export function formatStamp(sha, date) {
  const short = String(sha || "dev").slice(0, 7) || "dev";
  const day = /^\d{4}-\d{2}-\d{2}/.test(String(date || "")) ? String(date).slice(0, 10) : BUILD_DATE;
  return "Post Office build " + short + " · " + day;
}

let cached = "";
let cachedAt = 0;

export async function liveStamp(fetchImpl = fetch) {
  if (BUILD_SHA && BUILD_SHA !== "dev") return formatStamp(BUILD_SHA, BUILD_DATE);
  if (cached && Date.now() - cachedAt < 60000) return cached;
  try {
    const res = await fetchImpl("https://api.github.com/repos/Tbaker-maker/catchem-site/commits/main", {
      headers: { accept: "application/vnd.github+json", "user-agent": "catchem-site" },
    });
    if (res.ok) {
      const data = await res.json();
      const sha = String(data.sha || "");
      const date = String(data.commit?.committer?.date || data.commit?.author?.date || "");
      if (sha && date) {
        cached = formatStamp(sha, date);
        cachedAt = Date.now();
        return cached;
      }
    }
  } catch { /* baked stamp */ }
  return formatStamp(BUILD_SHA, BUILD_DATE);
}
