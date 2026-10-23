// POST_OFFICE defaults to off. No route may render the tools, and no page may link them.
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import worker, { renderPath, pageKind } from "../src/index.mjs";
import { POST_OFFICE_LINE, postOfficeOn } from "../src/post-office-flag.mjs";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
let fail = 0;
const t = (name, cond) => {
  if (cond) console.log("  ok ", name);
  else { fail++; console.log("  FAIL", name); }
};

const LINE = POST_OFFICE_LINE;
const TOOL = /post-office\/app|Post Office editor|id="prompts"|Pin two cards|data-p="connect"|id="desk-ir"/;

t("the flag is off unless the value is on", postOfficeOn({}) === false && postOfficeOn({ POST_OFFICE: "" }) === false && postOfficeOn({ POST_OFFICE: "off" }) === false && postOfficeOn({ POST_OFFICE: "ON" }) === true);

const home = await readFile(join(root, "index.html"), "utf8");
const homeHrefs = [...home.matchAll(/href="([^"]*post-office[^"]*)"/g)].map((m) => m[1]);
t("a closed home shows Closed Beta and links only to the coming soon page", home.includes("Closed Beta") && home.includes("Email and social tools, rebuilt. Closed beta.") && homeHrefs.length >= 2 && homeHrefs.every((href) => href === "/post-office") && !home.includes("/post-office/app") && !home.includes("Post Office editor") && !home.includes("Post Office is open"));

const fetchImpl = async (url) => {
  const u = String(url);
  if (u.includes("sitemap-00.xml")) {
    return new Response(`<?xml version="1.0"?><urlset><url><loc>https://catchemtcg.com/</loc></url><url><loc>https://catchemtcg.com/post-office</loc></url><url><loc>https://catchemtcg.com/build</loc></url></urlset>`, { status: 200, headers: { "content-type": "application/xml" } });
  }
  if (u.includes("sets.json")) return Response.json({ sets: [] });
  if (u.includes("counts.json")) return Response.json({ asOf: "2026-10-20", updatedAt: "2026-10-20T00:00:00Z" });
  return new Response("no", { status: 404 });
};

const routes = ["/post-office", "/post-office/", "/post-office/app", "/build", "/post-office.html"];
for (const path of routes) {
  if (path === "/post-office/app") {
    t("render " + path + " is not a page", pageKind(path) === null);
    continue;
  }
  const res = await renderPath(path, fetchImpl);
  const body = await res.text();
  const closed = body.includes(LINE) && body.includes("Coming soon") && body.includes('content="noindex"') && !TOOL.test(body) && !body.includes("/post-office/app") && body.includes('href="/post-office"') && body.includes("Closed Beta");
  t("render " + path + " does not show the tools", closed);
}

const sets = await (await renderPath("/sets", fetchImpl)).text();
t("set pages link the coming soon page, not the editor", sets.includes('href="/post-office"') && sets.includes("Closed Beta") && !sets.includes("/post-office/app") && !sets.includes("Post Office editor"));
const setsOn = await (await renderPath("/sets", fetchImpl, { POST_OFFICE: "on" })).text();
t("the plain nav link returns only when the flag is on", setsOn.includes('href="/post-office">Post Office') && !setsOn.includes("Closed Beta"));

const open = await (await renderPath("/post-office", fetchImpl, { POST_OFFICE: "on" })).text();
t("the flag on restores the editor", open.includes('src="/post-office/app?v=') && open.includes("Post Office editor") && !open.includes(LINE));

const assets = {
  fetch: async (req) => {
    const path = new URL(req.url).pathname;
    if (path === "/robots.txt") return new Response("User-agent: *\nAllow: /\n", { status: 200, headers: { "content-type": "text/plain" } });
    return new Response("missing", { status: 404, headers: { "content-type": "text/plain" } });
  },
};
const env = { PUBLIC_FETCH: fetchImpl, ASSETS: assets };
const closedApp = await worker.fetch(new Request("https://catchemtcg.com/post-office/app"), env);
const closedAppHtml = await closedApp.text();
t("the app route is closed", closedApp.status === 200 && closedApp.headers.get("x-robots-tag") === "noindex" && closedAppHtml.includes(LINE) && !TOOL.test(closedAppHtml));
const closedBuild = await worker.fetch(new Request("https://catchemtcg.com/build"), env);
const closedBuildHtml = await closedBuild.text();
t("build is closed", closedBuild.status === 200 && closedBuildHtml.includes(LINE) && !closedBuildHtml.includes("Post Office editor"));
const robots = await worker.fetch(new Request("https://catchemtcg.com/robots.txt"), env);
const robotsText = await robots.text();
t("robots keeps the tools out", robotsText.includes("Disallow: /post-office") && robotsText.includes("Disallow: /build"));
const map = await worker.fetch(new Request("https://catchemtcg.com/sitemap-00.xml"), env);
const mapText = await map.text();
t("the sitemap drops the tools", !mapText.includes("/post-office") && !mapText.includes("/build") && mapText.includes("https://catchemtcg.com/</loc>"));
const opened = await worker.fetch(new Request("https://catchemtcg.com/post-office/app"), { ...env, POST_OFFICE: "on" });
const openedHtml = await opened.text();
t("the app route opens with the flag only for the allowlist", opened.status === 403 && openedHtml.includes("This tool is invite only."));

const homeAssets = {
  fetch: async () => new Response(home, { status: 200, headers: { "content-type": "text/html; charset=utf-8" } }),
};
const homeOff = await (await worker.fetch(new Request("https://catchemtcg.com/"), { ...env, ASSETS: homeAssets })).text();
const homeOffHrefs = [...homeOff.matchAll(/href="([^"]*post-office[^"]*)"/g)].map((m) => m[1]);
t("served home stays Closed Beta and never reaches the editor", homeOff.includes("Closed Beta") && homeOff.includes("Email and social tools, rebuilt. Closed beta.") && homeOffHrefs.length >= 2 && homeOffHrefs.every((href) => href === "/post-office") && !homeOff.includes("/post-office/app") && !homeOff.includes("Post Office editor"));
const homeOn = await (await worker.fetch(new Request("https://catchemtcg.com/"), { ...env, ASSETS: homeAssets, POST_OFFICE: "on" })).text();
t("an open home has no Closed Beta text", !homeOn.includes("Closed Beta") && !homeOn.includes("Email and social tools, rebuilt. Closed beta.") && homeOn.includes('href="/post-office">Post Office') && homeOn.includes("Every card and every artist. Pick one and the post is ready for X or Facebook.") && !homeOn.includes('class="po-beta"'));

const notes = await readFile(join(root, "docs/post-office-show-causes.md"), "utf8");
for (const name of ["All", "Compare", "IR / SIR first", "30th Celebration", "Connecting art", "Gold Star", "SIR", "Futuristic", "BWR"]) {
  t("notes name " + name, notes.includes("- " + name + ":"));
}
t("notes name the wrong image and the French card", notes.includes("Italian Zapdos") && notes.includes("Artikodin") && !notes.includes("\u2014") && !notes.includes("\u2013"));

if (fail) process.exit(1);
console.log("post office closed ok");
