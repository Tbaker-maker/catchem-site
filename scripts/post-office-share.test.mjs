// Post Office sharing: Copy text, Post to X (intent link, the user posts), Download,
// the price/date/90-day chart overlay, and Make the picture near the top on a phone.
import worker from "../src/index.mjs";
import { EDITOR_URL, patchEditorHtml, resetEditorCache } from "../src/full-editor.mjs";
import { resetCatalogCache } from "../src/ai.mjs";
import { miniSeries, OVERLAY_PATH } from "../src/office-overlay.mjs";
import { yDomain } from "../src/product-chart.mjs";
import { signSession } from "../src/quota.mjs";

let fail = 0;
const t = (name, cond) => {
  if (cond) console.log("  ok ", name);
  else { fail++; console.log("  FAIL", name); }
};

const raw = await (await fetch(EDITOR_URL)).text();
const html = patchEditorHtml(raw, "2026-11-10");
const share = html.slice(html.indexOf('<script id="share-boot">'), html.indexOf("</script>", html.indexOf('<script id="share-boot">')));
t("the share script ships once and parses", html.split('id="share-boot"').length === 2 && (() => { try { new Function(share.replace(/^<script[^>]*>/, "")); return true; } catch { return false; } })());
t("the picture goes through the overlay hook", html.includes('var png = (window.__ceOverlay ? window.__ceOverlay(canvas, sel) : canvas).toDataURL("image/png");') && !html.includes('var png = canvas.toDataURL("image/png");'));
t("each post line has Copy text and a Post to X intent link", html.includes('b.textContent = "Copy text";') && html.includes('"https://x.com/intent/post?text=" + encodeURIComponent(text)') && html.includes('x.textContent = "Post to X";') && html.includes('x.rel = "noopener";'));
t("nothing posts from the page", !/api\.x\.com|api\.twitter\.com|\/2\/tweets/.test(html));
t("Download saves the picture as a png", share.includes('dl.textContent = "Download";') && share.includes('a.download = fname();') && share.includes('.png"'));
t("the overlay is an opt-in checkbox", share.includes('id="ov-on"') && share.includes("Price, date, and 90-day chart on the picture") && share.includes(OVERLAY_PATH));
t("the overlay prints the supplied price and its date", share.includes("TCGplayer market, ") && share.includes("/^TCGplayer market: (\\$[\\d,]+(?:\\.\\d+)?) \\((\\d{4}-\\d{2}-\\d{2})\\)$/"));
t("on a phone the dock sits under the title", share.includes('matchMedia("(max-width: 899px)")') && share.includes('banner.insertAdjacentElement("afterend", dock)') && html.includes("#compose-dock.dock-top{position:static"));
t("on a phone a bar keeps Make the picture one tap away", share.includes('bar.id = "phone-make"') && share.includes('"Make the picture ("'));

const series = [];
for (let i = 0; i < 120; i++) {
  const day = new Date(Date.UTC(2026, 6, 1) + i * 86400000).toISOString().slice(0, 10);
  series.push([day, 100 + (i === 70 ? 50 : 0) - (i === 110 ? 40 : 0)]);
}
series.push(["2026-12-01", 999]);
const mini = miniSeries(series, "2026-10-28");
t("the mini chart is the last 90 days up to the price date", mini.to === "2026-10-28" && mini.from === "2026-07-30" && mini.points[0][0] === "2026-07-30" && mini.points.at(-1)[0] === "2026-10-28");
t("a day after the price date is left off", mini.points.every((p) => p[0] <= "2026-10-28"));
t("high and low carry their dates", mini.high[1] === 150 && mini.high[0] === "2026-09-09" && mini.low[1] === 60 && mini.low[0] === "2026-10-19");
t("the y domain is the product chart's", JSON.stringify(mini.domain) === JSON.stringify(yDomain(mini.points.map((p) => p[1]), "price")));
t("fewer than two points draws no chart", miniSeries([["2026-10-28", 5]], "2026-10-28") === null && miniSeries([], "2026-10-28") === null);

const baked = (id, name, set, year, price) => { const r = [id, name, set, year, "", "", price]; while (r.length < 22) r.push(0); return r; };
const paper = [baked("swsh7-215", "Umbreon VMAX", "Evolving Skies", "2021", 2410)];
const lite = [["tcgcsv-246723", "Umbreon VMAX (Alternate Art Secret)", "SWSH07: Evolving Skies", "215/203", "Keiichiro Ito", "single", 2214.79, "", "Secret Rare"]];
const hist = [["2026-11-01", 2100], ["2026-11-05", 2300], ["2026-11-10", 2214.79]];
const bucket = JSON.stringify([{ id: "tcgcsv-246723", name: "Umbreon VMAX", kind: "single", price: 2214.79, hist }]);
const fetchImpl = async (url) => {
  const u = String(url);
  const ok = (body) => ({ ok: true, status: 200, json: async () => JSON.parse(body), text: async () => body });
  if (u.includes("paper-rows.json")) return ok(JSON.stringify(paper));
  if (u.includes("search-lite.json")) return ok(JSON.stringify(lite));
  if (u.includes("counts.json")) return ok(JSON.stringify({ asOf: "2026-11-10" }));
  if (u.includes("/buckets/23.json")) return ok(bucket);
  return { ok: false, status: 404, json: async () => null, text: async () => "" };
};
resetEditorCache();
resetCatalogCache();
const secret = "test-secret";
const cookie = "ce_session=" + await signSession({ sub: "user-1" }, secret);
const get = (env, withCookie = true) => worker.fetch(new Request("https://catchemtcg.com" + OVERLAY_PATH + "?ids=swsh7-215", { headers: withCookie ? { cookie } : {} }), { SESSION_SECRET: secret, PUBLIC_FETCH: fetchImpl, POST_OFFICE_ALLOWLIST: "user-1", ...env });
t("the overlay data is closed while Post Office is closed", (await get({})).status === 404);
t("the overlay data needs an allowed sign-in", (await get({ POST_OFFICE: "on" }, false)).status === 403);
const open = await get({ POST_OFFICE: "on" });
const body = await open.json();
const card = body.cards && body.cards[0];
t("the overlay price is the live price with its date", open.status === 200 && card.id === "swsh7-215" && card.price === "TCGplayer market: $2,214.79 (2026-11-10)");
t("the overlay chart is the card's dated series", card.chart && card.chart.points.length === 3 && card.chart.to === "2026-11-10" && card.chart.high[1] === 2300);

if (fail) { console.log(fail + " failed"); process.exit(1); }
console.log("post-office share ok");
