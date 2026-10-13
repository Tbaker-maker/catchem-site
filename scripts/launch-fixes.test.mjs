// Launch fixes: 404 page, favicon, practice out of nav, no-data text hidden, share meta.
import worker, { notFoundPage, FAVICON_SVG } from "../src/index.mjs";
import { renderNotFound, renderRotation } from "../src/ui.mjs";
import { setValueBlock } from "../src/features.mjs";
import { addShareMeta } from "../src/seo.mjs";
import { PAID_FOOTER } from "../src/pokemon.mjs";
import fs from "node:fs";

let fail = 0;
const t = (name, cond) => { console.log(`${cond ? "  ok " : "  FAIL"} ${name}`); if (!cond) fail++; };
const BANNED = /\b(buy|sell|hold|support|resistance|bottom|printed|play|target|invest|stack|load up|crypto)\b/i;
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
t("footer commission line", PAID_FOOTER === "Paid link. We may earn a commission from links on this page." && !/\bbuy\b/.test(PAID_FOOTER));
t("rotation copy avoids printed", !/printed/i.test(visible(renderRotation(""))));
t("set value hides with no prices", setValueBlock(null) === "" && setValueBlock({ top: [], master: {} }) === "");
const ui = fs.readFileSync(new URL("../src/ui.mjs", import.meta.url), "utf8");
t("set list does not print No market price", !ui.includes('const money=n=>!(n>0)?"No market price"'));
const card = `<html><head><title>Charizard · Catch'em</title></head><body><img alt="Charizard" loading="eager" src="/data/editor/tcg/base1/4_hires.png"><span>$968.91</span><span>Oct 13, 2026</span></body></html>`;
const meta = addShareMeta(card, "/c/tcgcsv-42382", "card");
t("card share meta uses the card picture and price", meta.includes('og:image" content="https://catchemtcg.com/data/editor/tcg/base1/4_hires.png"') && meta.includes('og:title" content="Charizard · Catch\'em"') && meta.includes("$968.91 TCGplayer market on Oct 13, 2026"));
const set = addShareMeta(`<html><head><title>ME06: Delta Reign · Catch'em</title></head><body></body></html>`, "/sets/me06-delta-reign", "set");
t("set share meta has its own title and description", set.includes('og:title" content="ME06: Delta Reign · Catch\'em"') && set.includes("in ME06: Delta Reign"));
const signin = fs.readFileSync(new URL("../src/auth.mjs", import.meta.url), "utf8");
t("sign in has a description", /<meta name="description" content="Sign in/.test(signin));

if (fail) { console.log(`${fail} failed`); process.exit(1); }
console.log("launch fixes: all passed");
