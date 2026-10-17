// Live layout check: fails if any page scrolls sideways at 390px or a child
// spills past its card. Run: npm i playwright && node scripts/overflow-check.mjs [base]
import { chromium } from "playwright";
const base = process.argv[2] || "https://catchemtcg.com";
const routes = ["/", "/feed", "/sets", "/rip", "/artists", "/search", "/post-office", "/premium", "/indexes", "/rotation", "/methodology", "/c/tcgcsv-180459", "/c/tcgcsv-517045"];
const b = await chromium.launch(); let bad = 0;
for (const w of [390, 1280]) {
  const p = await b.newPage({ viewport: { width: w, height: 900 } });
  for (const r of routes) {
    try { await p.goto(base + r, { waitUntil: "networkidle", timeout: 45000 }); } catch {}
    await p.evaluate(() => document.querySelectorAll("details").forEach((d) => (d.open = true)));
    await p.waitForTimeout(600);
    const res = await p.evaluate(() => {
      const W = document.documentElement.clientWidth, out = [];
      for (const el of document.querySelectorAll("article *, section *, main *")) {
        const rc = el.getBoundingClientRect(); if (!rc.width || !rc.height) continue;
        const anc = el.parentElement.closest("article,section,li,.card,.feed-card"); if (!anc) continue;
        if (el.matches(".sb-era > h2")) continue; // intentional full bleed sticky header
        const ar = anc.getBoundingClientRect(); if (ar.left >= W || ar.right <= 0) continue;
        let a = el.parentElement, scroll = false;
        while (a && a !== anc) { const o = getComputedStyle(a).overflowX; if (o === "auto" || o === "scroll") { scroll = true; break; } a = a.parentElement; }
        if (!scroll && rc.right > ar.right + 2) out.push(el.tagName + "." + [...el.classList].join("."));
      }
      return { side: document.documentElement.scrollWidth > W, out: out.slice(0, 5) };
    });
    if (res.side || res.out.length) { bad++; console.log("FAIL", w, r, JSON.stringify(res)); }
  }
  await p.close();
}
await b.close();
if (bad) process.exit(1); console.log("overflow-check: no sideways scroll");

const shots = process.env.OVERFLOW_SHOTS || "";
const b2 = await chromium.launch();
const phone = await b2.newPage({ viewport: { width: 390, height: 844 } });
await phone.goto(base + "/feed", { waitUntil: "domcontentloaded", timeout: 45000 });
await phone.waitForTimeout(1200);
const opened = await phone.locator("a.open-data, a:has-text('Open the data')").count();
for (let i = 0; i < Math.min(3, opened); i++) {
  const link = phone.locator("a.open-data, a:has-text('Open the data')").nth(i);
  if (await link.count()) await link.click({ timeout: 5000 }).catch(() => {});
  await phone.waitForTimeout(400);
}
const feedSide = await phone.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
if (feedSide) { console.log("FAIL feed open-data sideways"); bad++; }
for (const q of ["Charizard", "Evolving Skies booster box", "Eevee"]) {
  await phone.goto(base + "/search?q=" + encodeURIComponent(q), { waitUntil: "domcontentloaded", timeout: 45000 });
  await phone.waitForTimeout(800);
  const side = await phone.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  if (side) { console.log("FAIL search", q); bad++; }
}
await phone.goto(base + "/premium", { waitUntil: "domcontentloaded", timeout: 45000 });
if (shots) await phone.screenshot({ path: shots + "/premium-390.png" });
const desk = await b2.newPage({ viewport: { width: 1280, height: 800 } });
await desk.goto(base + "/premium", { waitUntil: "domcontentloaded", timeout: 45000 });
if (shots) await desk.screenshot({ path: shots + "/premium-1280.png" });
for (const path of ["/p/tcgcsv-180459", "/feed"]) {
  await phone.goto(base + path, { waitUntil: "domcontentloaded", timeout: 45000 });
  await phone.waitForTimeout(600);
  const nm = await phone.evaluate(() => {
    const h = document.querySelector("h1");
    const price = document.querySelector(".sum-chip, .px, h1 + p");
    const blob = ((h && h.innerText) || "") + " " + ((price && price.innerText) || "");
    return /\bNM\b|Near Mint/.test(blob);
  });
  if (nm && path.startsWith("/p/")) { console.log("FAIL sealed page shows NM", path); bad++; }
}
await b2.close();
if (bad) process.exit(1);
console.log("overflow-check: open data, search, and premium ok");
