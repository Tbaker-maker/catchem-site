// A linked path this worker cannot serve fails the check.
// `node scripts/dead-paths.mjs https://host` exits 1 if any fetched path is dead.
// It follows same-origin HTML links and every set slug in sets.json. It does not
// walk the whole card catalog.

const STATIC = new Set([
  "/",
  "/corrections",
  "/favicon.svg",
  "/og.png",
  "/robots.txt",
  "/sitemap.xml",
]);

export function localPaths(html) {
  const out = new Set();
  const re = /href="([^"]+)"/g;
  let m;
  while ((m = re.exec(String(html || "")))) {
    let href = m[1];
    if (!href.startsWith("/") || href.startsWith("//")) continue;
    href = href.split("#")[0].split("?")[0];
    if (!href || href.startsWith("/data/") || href.startsWith("/api/") || href.startsWith("/auth/")) continue;
    // Script templates such as href="/dive/'+encodeURIComponent(id)+'" are not links.
    if (!/^\/[A-Za-z0-9._~%-]+(?:\/[A-Za-z0-9._~%-]+)*$/.test(href)) continue;
    out.add(href);
  }
  return [...out];
}

export function deadLocals(paths, pageKind) {
  const dead = [];
  for (const path of paths || []) {
    if (STATIC.has(path)) continue;
    if (typeof pageKind === "function" && pageKind(path)) continue;
    dead.push(path);
  }
  return dead;
}

async function crawl(base) {
  const origin = new URL(base).origin;
  const seen = new Set();
  const queue = [];
  const dead = [];
  const seed = [
    "/", "/feed", "/feed?f=sealed", "/sets", "/artists", "/search", "/post-office",
    "/premium", "/methodology", "/corrections", "/faq", "/build",
  ];
  for (const path of seed) queue.push(new URL(path, origin).href);
  const setsRes = await fetch(new URL("/data/sets.json", origin).href);
  if (setsRes.ok) {
    const doc = await setsRes.json();
    for (const row of doc.sets || []) {
      if (row && row.slug) queue.push(new URL("/sets/" + encodeURIComponent(row.slug), origin).href);
    }
  } else {
    dead.push({ href: new URL("/data/sets.json", origin).href, status: setsRes.status });
  }
  while (queue.length && seen.size < 800) {
    const href = queue.shift();
    if (seen.has(href)) continue;
    seen.add(href);
    let res;
    try { res = await fetch(href, { redirect: "manual" }); }
    catch (err) {
      dead.push({ href, status: 0, error: String(err && err.message || err) });
      continue;
    }
    if (res.status >= 300 && res.status < 400) continue;
    if (res.status >= 400) {
      dead.push({ href, status: res.status });
      continue;
    }
    const type = res.headers.get("content-type") || "";
    if (!type.includes("text/html")) continue;
    const html = await res.text();
    for (const path of localPaths(html)) {
      const next = new URL(path, origin).href;
      if (!seen.has(next)) queue.push(next);
    }
  }
  return { checked: seen.size, dead };
}

if (process.argv[2] && process.argv[2].startsWith("http")) {
  const report = await crawl(process.argv[2]);
  if (report.dead.length) {
    for (const row of report.dead) console.log("DEAD", row.status, row.href);
    console.log(`dead paths: ${report.dead.length} of ${report.checked}`);
    process.exit(1);
  }
  console.log(`no dead paths in ${report.checked} urls`);
}
