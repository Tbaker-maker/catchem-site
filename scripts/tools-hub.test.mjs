// Tools hub: only links to pages this branch already answers.
import entry from "../src/site-entry.mjs";
import { pageKind, renderPath } from "../src/index.mjs";
import { banGuard } from "../src/advice-rules.mjs";
import { resetJsonCache } from "../src/data.mjs";

let fail = 0;
const t = (name, ok) => { console.log((ok ? "ok   " : "FAIL ") + name); if (!ok) fail++; };
const words = (s) => String(s || "").trim().split(/\s+/).filter(Boolean);
const BANNED = banGuard("tools", /Collectr|\bNM\b|coming soon|placeholder/i);

const INTENDED = [
  ["/heatmap", "Sealed Market Pulse", "Sealed month changes, dated."],
  ["/reads", "Your reads", "Dated reads on cards, sets, and sealed you follow."],
  ["/releases", "Release calendar", "Upcoming Pokémon TCG releases with a confirmed date and source."],
];

const env = {
  PUBLIC_FETCH: async () => new Response("no", { status: 404, headers: { "content-type": "text/plain" } }),
  ASSETS: { fetch: async () => new Response("missing", { status: 404, headers: { "content-type": "text/plain" } }) },
};
const ctx = { waitUntil() {} };

const res = await entry.fetch(new Request("https://catchemtcg.com/tools"), env, ctx);
const html = await res.text();
t("tools answers", res.status === 200 && pageKind("/tools") === "tools");

const hrefs = [...html.matchAll(/\shref="([^"]*)"/g)].map((m) => m[1]);
const paths = hrefs.map((href) => {
  if (!href || href.startsWith("#") || /^mailto:/i.test(href)) return "";
  if (/^https?:\/\//i.test(href)) {
    const u = new URL(href);
    return u.host === "catchemtcg.com" ? u.pathname : "external:" + href;
  }
  return href.startsWith("/") ? href.split(/[?#]/)[0] : "other:" + href;
}).filter(Boolean);

const cards = [...html.matchAll(/<a class="tool" href="([^"]+)"><strong>([^<]+)<\/strong><span>([^<]+)<\/span><\/a>/g)].map((m) => [m[1], m[2], m[3]]);
t("page contains only the intended links", paths.length === INTENDED.length && INTENDED.every((row, i) => paths[i] === row[0] && cards[i] && cards[i][0] === row[0] && cards[i][1] === row[1] && cards[i][2] === row[2]));
t("titles under seven words", cards.length === 3 && cards.every((row) => words(row[1]).length < 7));
t("lines under twelve words", cards.length === 3 && cards.every((row) => words(row[2]).length < 12));
t("one column, dark paper, gold, 44px taps", html.includes("background:#12100e") && html.includes("#d9b779") && html.includes("min-height:44px") && html.includes("flex-direction:column") && !/grid-template-columns:\s*repeat\([2-9]/.test(html));
t("no coming soon and no placeholder", !/coming soon/i.test(html) && !/placeholder/i.test(html));
t("copy has no em or en dash", !/[\u2014\u2013]/.test(html));
const visible = html.replace(/<style[\s\S]*?<\/style>/g, " ").replace(/<[^>]+>/g, " ");
t("no advice, Collectr, or plan pricing", !BANNED.test(visible) && !/\$\d/.test(visible) && !/Premium/i.test(visible));
t("explore is not linked", !html.includes("/explore") && !html.includes("/data-explorer"));

for (const [path] of INTENDED) {
  resetJsonCache();
  const hit = await entry.fetch(new Request("https://catchemtcg.com" + path), env, ctx);
  const viaRender = path === "/heatmap" ? null : await renderPath(path, env.PUBLIC_FETCH, {});
  const renderedOk = path === "/heatmap" ? true : viaRender && viaRender.status !== 404;
  t(path + " is a real route", Boolean(pageKind(path)) && hit.status !== 404 && renderedOk);
}

resetJsonCache();
const explore = await entry.fetch(new Request("https://catchemtcg.com/explore"), env, ctx);
t("explore is not a route on this branch", pageKind("/explore") == null && explore.status === 404);

resetJsonCache();
const search = await renderPath("/search", env.PUBLIC_FETCH, {});
const searchHtml = await search.text();
const more = (searchHtml.match(/class="nav-more-list"[\s\S]*?<\/div>/) || [""])[0];
t("Tools is in the existing More list", more.includes('href="/tools">Tools</a>'));

if (fail) { console.log(fail + " failed"); process.exit(1); }
console.log("tools hub ok");
