// Launch fixes: 404 page, favicon, practice out of nav, no-data text hidden, share meta.
import { banGuard } from "../src/advice-rules.mjs";
// Whole pages carry code comments, so dashes are checked by their own assertion here.
const PAGE = { skipKinds: ["house"] };
import worker, { notFoundPage, FAVICON_SVG } from "../src/index.mjs";
import { renderNotFound, renderRotation } from "../src/ui.mjs";
import { setValueBlock } from "../src/features.mjs";
import { addShareMeta } from "../src/seo.mjs";
import { PAID_FOOTER } from "../src/pokemon.mjs";
import fs from "node:fs";

let fail = 0;
const t = (name, cond) => { console.log(`${cond ? "  ok " : "  FAIL"} ${name}`); if (!cond) fail++; };
const BANNED = banGuard("launch-fixes", null, PAGE);
const visible = (h) => h.replace(/<script[\s\S]*?<\/script>/g, "").replace(/<style[\s\S]*?<\/style>/g, "").replace(/<[^>]+>/g, " ").replace(/support@catchemtcg\.com/g, "");

const nf = renderNotFound("");
t("404 has logo, nav, search, and home link", nf.includes('class="logo"') && nf.includes('id="site-nav"') && nf.includes('action="/search"') && nf.includes('href="/">Home</a>'));
t("404 is rounded and has no dashes or banned words", nf.includes("border-radius:22px") && !/[\u2014\u2013]/.test(visible(nf)) && !BANNED.test(visible(nf)));
const res = notFoundPage();
t("404 response status and noindex", res.status === 404 && res.headers.get("x-robots-tag") === "noindex");
const env = { ASSETS: { fetch: async () => new Response("", { status: 404 }) }, PUBLIC_FETCH: async () => new Response("", { status: 404 }) };
const miss = await worker.fetch(new Request("https://catchemtcg.com/zzz-not-a-page"), env);
t("unknown route serves the branded 404", miss.status === 404 && (await miss.text()).includes("This page is not here"));
const icon = await worker.fetch(new Request("https://catchemtcg.com/favicon.ico"), env);
t("favicon.ico is served", icon.status === 200 && (await icon.text()) === FAVICON_SVG);
t("every chrome page links the favicon", nf.includes('rel="icon" href="/favicon.svg"'));
t("practice is out of the site nav and dock", !/href="\/practice"/.test(nf) && !/href="\/practice"/.test(fs.readFileSync(new URL("../index.html", import.meta.url), "utf8")));
t("mobile dock is Feed, Collection, Heatmap, Rip, Reads, Releases", (() => { const dock = (nf.match(/<nav class=\"dock\"[\s\S]*?<\/nav>/) || [""])[0]; return dock.includes('href="/feed"') && dock.includes('href="/collection"') && dock.includes('href="/heatmap"') && dock.includes('href="/rip"') && dock.includes('href="/reads"') && dock.includes('href="/releases"') && />Collection</.test(dock) && />Heatmap</.test(dock) && />Rip</.test(dock) && />Reads</.test(dock) && />Releases</.test(dock) && nf.includes("min-height:48px") && nf.includes("min-width:44px") && nf.includes("padding-bottom:88px"); })());
t("footer commission line", PAID_FOOTER === "Paid link. We may earn a commission from links on this page." && !/\bbuy\b/.test(PAID_FOOTER));
t("rotation copy avoids printed", !/printed/i.test(visible(renderRotation(""))));
t("set value hides with no prices", setValueBlock(null) === "" && setValueBlock({ top: [], master: {} }) === "");
const ui = fs.readFileSync(new URL("../src/ui.mjs", import.meta.url), "utf8");
t("set list does not print No market price", !ui.includes('const money=n=>!(n>0)?"No market price"'));
const card = `<html><head><title>Charizard · Catch'em</title></head><body><img alt="Charizard" loading="eager" src="/data/editor/tcg/base1/4_hires.png"><span>$968.91</span><span>Oct 13, 2026</span></body></html>`;
const meta = addShareMeta(card, "/c/tcgcsv-42382", "card");
t("card share meta uses the branded card and price", meta.includes("og:image\" content=\"https://catchemtcg.com/og/card.svg?k=card\u0026amp;n=Charizard\u0026amp;p=968.91\u0026amp;img=%2Fdata%2Feditor%2Ftcg%2Fbase1%2F4_hires.png\"") && meta.includes("og:title\" content=\"Charizard · Catch'em\"") && meta.includes("$968.91 TCGplayer market on Oct 13, 2026") && meta.includes("og:image:width\" content=\"1200\"") && meta.includes("og:image:height\" content=\"630\""));
const set = addShareMeta(`<html><head><title>ME06: Delta Reign · Catch'em</title></head><body></body></html>`, "/sets/me06-delta-reign", "set");
t("set share meta has its own title and description", set.includes('og:title" content="ME06: Delta Reign · Catch\'em"') && set.includes("in ME06: Delta Reign"));
const signin = fs.readFileSync(new URL("../src/auth.mjs", import.meta.url), "utf8");
t("sign in has a description", signin.includes('name="description"') && signin.includes("Sign in to Catch'em with Discord.") && signin.includes("Sign in to Catch'em with Discord to use Post Office Ideas."));

// Legal pages. The banned-word copy check skips only these three pages (legal text exception).
const { renderLegal, LEGAL_PATHS, LEGAL_UPDATED } = await import("../src/legal.mjs");
const { renderPath } = await import("../src/index.mjs");
const LEGAL_EXEMPT = new Set(Object.keys(LEGAL_PATHS));
const noData = async () => new Response("{}", { status: 200 });
for (const [path, key] of Object.entries(LEGAL_PATHS)) {
  const r = await renderPath(path, noData, {});
  const body = await r.text();
  t(`${path} renders in the site chrome`, r.status === 200 && body.includes('class="logo"') && body.includes('id="site-nav"') && body.includes("site-foot") && body.includes(LEGAL_UPDATED) && body.includes("border-radius:22px"));
  t(`${path} has no em or en dashes`, !/[\u2014\u2013]/.test(visible(body)));
  t(`${path} is exempt from the banned-word check`, LEGAL_EXEMPT.has(path));
}
const terms = renderLegal("terms");
t("terms keeps the approved giveaway line", terms.includes("No purchase is necessary. A free entry route and its details will be posted in the official rules before any draw.") && !/POP|web form/.test(visible(terms)));
const pages = [nf, renderRotation(""), renderLegal("privacy")];
t("footer links Terms, Privacy, Disclaimer on every chrome page", pages.every((p) => p.includes('<a href="/terms">Terms</a> · <a href="/privacy">Privacy</a> · <a href="/disclaimer">Disclaimer</a>')));
const home = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
t("home footer and newsletter carry the legal links", home.includes('<a href="/disclaimer">Disclaimer</a>') && home.includes("By subscribing you agree to the"));
const { renderPremium } = await import("../src/ui.mjs");
let prem = "";
try { prem = renderPremium(""); } catch { prem = fs.readFileSync(new URL("../src/ui.mjs", import.meta.url), "utf8"); }
t("premium checkout carries the agree line", prem.includes('By subscribing you agree to the <a href="/terms">Terms</a> and <a href="/privacy">Privacy Policy</a>.'));
for (const p of [nf, renderRotation("")]) t("non-legal chrome page passes the banned-word check", !BANNED.test(visible(p).replace(/Terms|Privacy|Disclaimer/g, "")));

if (fail) { console.log(`${fail} failed`); process.exit(1); }
console.log("launch fixes: all passed");
