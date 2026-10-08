// A linked path this worker cannot serve fails the check.
// `node scripts/dead-paths.mjs https://host` exits 1 if any fetched path is dead.
// It follows same-origin HTML links, literal fetch() URLs inside scripts, and
// every set slug in sets.json. It does not walk the whole card catalog.
// A fetch built with + or ${} is a template, not a path.

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

// Literal fetch("…") / fetch('…') / fetch(`…`) and assetUrl("…") calls.
// A string closed and then concatenated is a template and is skipped.
export function scriptFetchPaths(html) {
  const text = String(html || "");
  const out = new Set();
  const re = /fetch\(\s*(["'`])([^"'`]+)\1/g;
  let m;
  while ((m = re.exec(text))) {
    const after = text.slice(m.index + m[0].length, m.index + m[0].length + 12);
    if (/^\s*\+/.test(after)) continue;
    let href = m[2].trim();
    if (!href || href.includes("${") || href.includes("+")) continue;
    if (/^https?:\/\//i.test(href)) {
      out.add(href.split("#")[0]);
      continue;
    }
    if (!href.startsWith("/") || href.startsWith("//")) continue;
    const path = href.split("#")[0].split("?")[0];
    if (!path || !/^\/[A-Za-z0-9._~%-]+(?:\/[A-Za-z0-9._~%-]+)*$/.test(path)) continue;
    out.add(path);
  }
  const assetRe = /assetUrl\(\s*(["'])([^"']+)\1\s*\)/g;
  while ((m = assetRe.exec(text))) {
    const rel = m[2].trim();
    if (!rel || rel.includes("+") || rel.includes("${")) continue;
    out.add("asset:" + rel.split("#")[0]);
  }
  return [...out];
}

export function deadLocals(paths, pageKind) {
  const dead = [];
  for (const path of paths || []) {
    if (typeof path !== "string") continue;
    if (path.startsWith("http://") || path.startsWith("https://") || path.startsWith("asset:")) continue;
    if (STATIC.has(path)) continue;
    if (path.startsWith("/api/") || path.startsWith("/auth/") || path.startsWith("/data/")) continue;
    if (typeof pageKind === "function" && pageKind(path)) continue;
    dead.push(path);
  }
  return dead;
}

function scriptTargets(html, origin) {
  const next = [];
  const raw = String(html || "").match(/https:\/\/raw\.githubusercontent\.com\/[^"'\\\s]+/);
  for (const item of scriptFetchPaths(html)) {
    if (item.startsWith("asset:")) {
      const rel = item.slice("asset:".length).replace(/^\//, "");
      if (raw) next.push(raw[0] + rel);
      else next.push(new URL("/" + rel, origin).href);
      continue;
    }
    if (item.startsWith("http://") || item.startsWith("https://")) {
      next.push(item);
      continue;
    }
    next.push(new URL(item, origin).href);
  }
  return next;
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
    if (!type.includes("text/html") && !type.includes("javascript")) continue;
    const html = await res.text();
    for (const path of localPaths(html)) {
      const next = new URL(path, origin).href;
      if (!seen.has(next)) queue.push(next);
    }
    for (const next of scriptTargets(html, origin)) {
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
