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
