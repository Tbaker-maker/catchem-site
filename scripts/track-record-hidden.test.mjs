import { renderPath } from "../src/index.mjs";
import { resetJsonCache } from "../src/data.mjs";
import { TRACK_RECORD_MIN, trackScoredCount } from "../src/ui.mjs";
let fails = 0;
const t = (name, ok) => { console.log(`${ok ? "ok" : "FAIL"}: ${name}`); if (!ok) fails++; };
const SITEMAP = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n<url><loc>https://catchemtcg.com/</loc></url>\n<url><loc>https://catchemtcg.com/track-record</loc></url>\n</urlset>`;
const PROOF = { reads30: 383, week: [{ name: "Example Box", asOf: "2026-10-17", kind: "sealed" }] };
const fetchFor = (doc) => async (url) => {
  const u = String(url);
  if (doc && u.includes("track-record.json")) return { ok: true, status: 200, headers: new Headers(), json: async () => doc, text: async () => JSON.stringify(doc) };
  if (u.includes("premium-proof.json")) return { ok: true, status: 200, headers: new Headers(), json: async () => PROOF, text: async () => JSON.stringify(PROOF) };
  if (u.includes("sitemap-00.xml")) return new Response(SITEMAP, { status: 200, headers: { "content-type": "application/xml" } });
  return { ok: false, status: 404, headers: new Headers(), json: async () => null, text: async () => "" };
};
const get = async (path, doc, opts = {}) => { resetJsonCache(); const res = await renderPath(path, fetchFor(doc), opts); return { status: res.status, body: await res.text(), robots: res.headers.get("x-robots-tag") || "" }; };
const mainOf = (body) => body.slice(body.indexOf("<main"), body.indexOf("</main>"));
const footOf = (body) => body.slice(body.indexOf('<footer class="site-foot"'));
const doc = (scored, extra = {}) => {
  const moved = Math.floor(scored / 3);
  return { public: true, asOf: "2026-10-17", thin: true, disclaimer: "Past moves don't predict future prices.", summary: `Of ${scored} reads in 90 days, ${moved} moved the way the read described.`,
    windows: { d90: { reads: scored, moved, line: `Of ${scored} reads in 90 days, ${moved} moved the way the read described.` } },
    rows: [{ date: "2026-10-01", name: "Example Box", said: "Recorded at $10.00.", priceThen: 10, priceNow: 11, source: "eBay asking prices", priceDate: "2026-10-02", kind: "sealed", moved: true }], ...extra };
};
t("min is 60", TRACK_RECORD_MIN === 60);
t("count reads the 90 day window", trackScoredCount(doc(9)) === 9);
t("count falls back to hits plus misses", trackScoredCount({ rows: [{ moved: true }, { moved: false }, { moved: null }] }) === 2);

// Closed: below 60, private, malformed or missing.
for (const [label, d] of [["9 scored", doc(9)], ["59 scored", doc(59)], ["public false at 80", doc(80, { public: false })], ["no public field", { count: 5, rows: [] }], ["missing file", null]]) {
  const page = await get("/track-record", d);
  const main = mainOf(page.body);
  const vis = main.replace(/<style>[\s\S]*?<\/style>/g, "").replace(/<[^>]+>/g, " ");
  t(`${label}: 200 friendly page`, page.status === 200 && main.includes("Our track record goes live once we've scored enough reads.") && main.includes("More history added nightly."));
  t(`${label}: no numbers or rows`, !/\d/.test(vis) && !main.includes("tr-row") && !main.includes("moved the way"));
  t(`${label}: noindex`, page.robots.includes("noindex") && page.body.includes('content="noindex"'));
  t(`${label}: no em dash`, !/[\u2013\u2014]/.test(main));
}
{
  const d = doc(59);
  const prem = await get("/premium", d, { premiumMode: "live" });
  const main = mainOf(prem.body);
  t("closed: premium proof keeps the 383 count", main.includes("383"));
  t("closed: no track record link on /premium", !main.includes('href="/track-record"'));
  t("closed: no track record link in the footer", !footOf(prem.body).includes('href="/track-record"'));
  const home = await get("/methodology", d);
  t("closed: footer elsewhere has no link", !footOf(home.body).includes('href="/track-record"'));
  const map = await get("/sitemap-00.xml", d);
  t("closed: sitemap leaves it out", map.status === 200 && !map.body.includes("/track-record") && map.body.includes("https://catchemtcg.com/</loc>"));
}

// Open: 60 or more comes back on its own.
for (const n of [60, 120]) {
  const d = doc(n);
  const page = await get("/track-record", d);
  const main = mainOf(page.body);
  t(`open ${n}: full page renders`, page.status === 200 && main.includes(`Of ${n} reads in 90 days`) && main.includes("Past moves don") && main.includes("tr-row") && !main.includes("goes live once"));
  t(`open ${n}: indexable`, !page.robots.includes("noindex"));
  t(`open ${n}: page hides the scoring method`, !main.includes("scored so far") && !main.includes("14 days") && !main.includes("too early"));
  const prem = await get("/premium", d, { premiumMode: "live" });
  t(`open ${n}: premium link back`, mainOf(prem.body).includes('href="/track-record"') && mainOf(prem.body).includes("383"));
  t(`open ${n}: footer link back`, footOf(prem.body).includes('href="/track-record"'));
  const map = await get("/sitemap-00.xml", d);
  t(`open ${n}: sitemap lists it once`, (map.body.match(/catchemtcg\.com\/track-record</g) || []).length === 1);
}
if (fails) { console.log(`track-record-hidden: ${fails} failed`); process.exit(1); }
console.log("track-record-hidden ok");
