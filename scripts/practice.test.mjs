// Practice pack. Imported by rebuild.test.mjs so CI runs it.
import { banGuard } from "../src/advice-rules.mjs";
// Whole pages carry code comments, so dashes are checked by their own assertion here.
const PAGE = { skipKinds: ["house"] };
import { renderPath, pageKind } from "../src/index.mjs";
import { resetJsonCache } from "../src/data.mjs";
import { drawPack, buildPack, packArt, practicePool, practiceSets, PRACTICE_NOTE, SLOTS, TIERS } from "../src/practice.mjs";
import vm from "node:vm";

let fail = 0;
const t = (name, cond) => { if (cond) console.log("  ok ", name); else { fail++; console.log("  FAIL", name); } };

const items = Array.from({ length: 40 }, (_, i) => ({ id: `tcgcsv-${9000 + i}`, name: `Card ${i} - ${i + 1}/40`, num: `${i + 1}/40`, kind: "single", rarity: "Common", price: i % 7 ? i + 0.5 : null, printing: "Normal", printings: [{ name: "Normal", price: i + 0.5, asOf: "2026-10-12" }] }));
items.push({ id: "tcgcsv-1", name: "Booster Box", kind: "sealed", price: 100 });
const setDoc = { slug: "new-set", name: "New Set", asOf: "2026-10-12", items };
const setsDoc = { sets: [
  { slug: "old-set", name: "Old Set", release: "2020-01-01", single: 40 },
  { slug: "new-set", name: "New Set", release: "2026-09-16", single: 40 },
  { slug: "future-set", name: "Future", release: "2026-11-06", single: 0 },
  ...Array.from({ length: 10 }, (_, i) => ({ slug: `promo-${i}`, name: `Promo ${i}`, release: "2026-09-27", single: 20 })),
] };
const pool = practicePool(setDoc, {});
const ids = new Set(items.filter((r) => r.kind === "single").map((r) => r.id));
t("pool is singles only, from the file", pool.length === 40 && pool.every((c) => ids.has(c.id)));
let allIn = true;
for (let seed = 1; seed <= 500; seed++) { const p = drawPack(pool, 10, seed); if (p.length !== 10 || new Set(p.map((c) => c.id)).size !== 10 || !p.every((c) => ids.has(c.id))) allIn = false; }
t("every drawn id is in the set file, 10 different cards, 500 seeds", allIn);
t("seeded draw is repeatable", JSON.stringify(drawPack(pool, 10, 12345)) === JSON.stringify(drawPack(pool, 10, 12345)));
t("different seeds differ", JSON.stringify(drawPack(pool, 10, 1)) !== JSON.stringify(drawPack(pool, 10, 2)));
t("a small set never repeats or invents", drawPack(pool.slice(0, 3), 10, 7).length === 3);
t("unpriced card has no date", pool.find((c) => c.id === "tcgcsv-9000").price === 0 && pool.find((c) => c.id === "tcgcsv-9000").date === "");
t("name drops the trailing number", pool[1].name === "Card 1");
const list = practiceSets(setsDoc, "2026-10-12");
t("default is newest dated set with singles", list[0].slug === "new-set" && !list.some((x) => x.slug === "future-set"));

// A set with no Uncommon and odd rarities still fills from Commons only.
const odd = practicePool({ asOf: "2026-10-12", items: [...Array.from({ length: 12 }, (_, i) => ({ id: `tcgcsv-${6000 + i}`, name: `C${i}`, kind: "single", rarity: "Common", price: 1 })), { id: "tcgcsv-6100", name: "CC", kind: "single", rarity: "Classic Collection", price: 9 }, { id: "tcgcsv-6101", name: "R", kind: "single", rarity: "Rare", price: 2 }] }, {});
const op = buildPack(odd, 5);
t("filler never pulls special subsets", op.slice(0, 9).every((c) => c.rarity === "Common") && op[9].rarity === "Rare");
// Slot layout on a mixed-rarity pool.
const rar = ["Common", "Uncommon", "Rare", "Double Rare", "Illustration Rare", "Special Illustration Rare"];
const mixed = Array.from({ length: 90 }, (_, i) => ({ id: `tcgcsv-${7000 + i}`, name: `M${i}`, num: `${i + 1}/90`, kind: "single", rarity: i < 30 ? "Common" : i < 55 ? "Uncommon" : rar[2 + (i % 4)], price: i + 1, printing: "Normal", printings: [{ name: "Normal", price: i + 1, asOf: "2026-10-12" }, ...(i < 70 ? [{ name: "Reverse Holofoil", price: i + 2, asOf: "2026-10-11" }] : [])] }));
mixed.push({ id: "tcgcsv-5", name: "Mix Set Booster Pack", kind: "sealed", pid: 5, price: 5 }, { id: "tcgcsv-6", name: "Mix Set Booster Box", kind: "sealed", pid: 6 });
const mdoc = { slug: "mix", name: "Mix", asOf: "2026-10-12", items: mixed };
const mpool = practicePool(mdoc, {});
const mids = new Set(mixed.filter((r) => r.kind === "single").map((r) => r.id));
let layoutOk = true, tierCount = {};
for (let seed = 1; seed <= 500; seed++) {
  const p = buildPack(mpool, seed);
  const ok = p.length === 10 && p.map((c) => c.slot).join() === SLOTS.join() && p.every((c) => mids.has(c.id)) && new Set(p.map((c) => c.id)).size === 10
    && p.slice(0, 5).every((c) => c.rarity === "Common") && p.slice(5, 8).every((c) => c.rarity === "Uncommon") && p[8].rh && TIERS.includes(p[9].rarity) && p.some((c) => c.hit);
  if (!ok) layoutOk = false;
  tierCount[p[9].rarity] = (tierCount[p[9].rarity] || 0) + 1;
}
t("slot layout: 5 C, 3 U, reverse holo, rare last, ids from the file, 500 seeds", layoutOk);
t("rare slot leans to lower tiers", tierCount["Rare"] > tierCount["Double Rare"] && tierCount["Double Rare"] > tierCount["Special Illustration Rare"]);
t("seeded pack is repeatable", JSON.stringify(buildPack(mpool, 99)) === JSON.stringify(buildPack(mpool, 99)) && JSON.stringify(buildPack(mpool, 1)) !== JSON.stringify(buildPack(mpool, 2)));
const rhCard = buildPack(mpool, 3)[8];
t("reverse slot uses the reverse printing price and date", rhCard.price === mixed.find((r) => r.id === rhCard.id).printings[1].price && rhCard.date === "2026-10-11");
const art = packArt(mdoc, { images: {} });
t("pack art is the booster pack by id, not the box", art.id === "tcgcsv-5" && art.src === "/api/card-img?pid=5");
t("note says layout, not odds", PRACTICE_NOTE === "Typical pack layout. Not real pull rates.");
t("promo sets are not packs", !practiceSets({ sets: [{ slug: "x-promos", name: "X Promos", single: 40 }] }, "2026-10-12").length);

const files = { "counts.json": { asOf: "2026-10-12" }, "sets.json": setsDoc, "sets/new-set.json": setDoc, "sets/old-set.json": { ...setDoc, name: "Old Set" }, "catalogue-images.json": { images: {} } };
const fetchImpl = async (u) => { const rel = String(u).split("/research/assets/public/")[1]; return rel in files ? new Response(JSON.stringify(files[rel])) : new Response("x", { status: 404 }); };
resetJsonCache();
const page = await (await renderPath("/practice", fetchImpl, { today: "2026-10-12" })).text();
t("page kind", pageKind("/practice") === "practice");
t("page says the practice note", page.includes(PRACTICE_NOTE) && page.includes("Open a pack"));
t("nav hides practice until the overhaul", !page.includes('href="/practice"'));
const data = JSON.parse(page.match(/<script type="application\/json" id="pp-data">([\s\S]*?)<\/script>/)[1]);
t("page pool is the default set file", data.slug === "new-set" && data.pool.length === 40 && data.pool.every((c) => ids.has(c.id)));
const visible = page.replace(/<script[\s\S]*?<\/script>/g, "").replace(/<style[\s\S]*?<\/style>/g, "").replace(/<[^>]+>/g, " ");
t("no em dash or banned words", !/\u2014/.test(visible.split("Not affiliated")[0]) && !banGuard("practice", /\b(supply)\b/i, PAGE).test(visible.split("Not affiliated")[0]));
const scripts = [...page.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
let parsed = true;
for (const s of scripts) { try { new vm.Script(s); } catch (e) { parsed = false; console.log(e.message); } }
t("page scripts parse", parsed);
resetJsonCache();
const other = await (await renderPath("/practice", fetchImpl, { today: "2026-10-12", set: "old-set" })).text();
t("set picker loads that set", other.includes('"slug":"old-set"'));
resetJsonCache();
if (fail) { console.log(`practice: ${fail} failed`); process.exitCode = 1; throw new Error(`practice: ${fail} failed`); }
console.log("practice ok");
