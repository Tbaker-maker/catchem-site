// Repeatable 5 second test, wander, and accessibility pass.
// node scripts/five-second-test.mjs
// Live site only. No signups, no paid buttons, no checkout.
// Writes qa/five-second-results.json and qa/shots/.
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire("/workspace/package.json");
const { chromium } = require("playwright");

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "qa");
const SHOTS = join(OUT, "shots");
const BASE = process.env.FIVE_SECOND_BASE || "https://catchemtcg.com";
const UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";
const WANDER_MS = Number(process.env.WANDER_MS || 180000);

mkdirSync(SHOTS, { recursive: true });

function phone(browser) {
  return browser.newContext({
    viewport: { width: 390, height: 844 },
    userAgent: UA,
    deviceScaleFactor: 1,
    hasTouch: true,
  });
}

async function fold(page) {
  return page.evaluate(() => {
    const dock = document.querySelector("nav.dock");
    const limit = dock ? dock.getBoundingClientRect().top : window.innerHeight;
    const lines = [];
    const nodes = document.querySelectorAll("h1,h2,h3,h4,p,a,button,li,span,label,small");
    for (const el of nodes) {
      const r = el.getBoundingClientRect();
      if (r.width < 8 || r.height < 8 || r.bottom < 0 || r.top > limit) continue;
      const style = getComputedStyle(el);
      if (style.visibility === "hidden" || style.display === "none") continue;
      const t = (el.innerText || "").trim().replace(/\s+/g, " ");
      if (!t || t.length > 180 || lines.includes(t)) continue;
      lines.push(t);
      if (lines.length >= 24) break;
    }
    const h1 = (document.querySelector("h1")?.innerText || "").trim().replace(/\s+/g, " ");
    return {
      url: location.href,
      title: document.title,
      h1,
      lines,
      overflow: document.documentElement.scrollWidth > window.innerWidth + 1,
      dock: [...document.querySelectorAll("nav.dock a")].map((a) => {
        const r = a.getBoundingClientRect();
        return { text: (a.innerText || "").replace(/\s+/g, " ").trim(), w: Math.round(r.width), h: Math.round(r.height), href: a.getAttribute("href") };
      }),
    };
  });
}

async function a11y(page) {
  return page.evaluate(() => {
    function parse(c) {
      const m = String(c).match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
      if (!m) return null;
      return [Number(m[1]), Number(m[2]), Number(m[3]), m[4] == null ? 1 : Number(m[4])];
    }
    function lum(r, g, b) {
      const f = (v) => {
        v /= 255;
        return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
      };
      return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
    }
    function ratio(a, b) {
      const L1 = lum(a[0], a[1], a[2]);
      const L2 = lum(b[0], b[1], b[2]);
      const hi = Math.max(L1, L2);
      const lo = Math.min(L1, L2);
      return (hi + 0.05) / (lo + 0.05);
    }
    function bgOf(el) {
      let n = el;
      while (n) {
        const p = parse(getComputedStyle(n).backgroundColor);
        if (p && p[3] > 0.85) return p;
        n = n.parentElement;
      }
      return [18, 16, 14, 1];
    }
    const dock = document.querySelector("nav.dock");
    const limit = dock ? dock.getBoundingClientRect().top : window.innerHeight;
    const inFold = (el) => {
      const r = el.getBoundingClientRect();
      return r.width > 2 && r.height > 2 && r.bottom > 0 && r.top < limit;
    };
    const contrast = [];
    const seen = new Set();
    for (const el of document.querySelectorAll("h1,h2,h3,h4,p,a,button,span,li,label,small")) {
      if (!inFold(el)) continue;
      const cs = getComputedStyle(el);
      if (cs.visibility === "hidden" || cs.display === "none" || Number(cs.opacity) === 0) continue;
      const fg = parse(cs.color);
      if (!fg || fg[3] < 0.9) continue;
      const bg = bgOf(el);
      const size = parseFloat(cs.fontSize);
      const bold = Number(cs.fontWeight) >= 600;
      const large = size >= 24 || (size >= 18.5 && bold);
      const need = large ? 3 : 4.5;
      const value = ratio(fg, bg);
      const key = cs.color + "|" + bg.slice(0, 3).join(",") + "|" + need;
      if (value < need - 0.05 && !seen.has(key)) {
        seen.add(key);
        contrast.push({
          text: (el.innerText || "").trim().replace(/\s+/g, " ").slice(0, 70),
          ratio: Math.round(value * 100) / 100,
          need,
          size: Math.round(size),
        });
      }
    }
    const taps = [];
    for (const el of document.querySelectorAll("a,button,input,summary,[role='button']")) {
      if (!inFold(el) && !(dock && dock.contains(el))) continue;
      const r = el.getBoundingClientRect();
      if (r.width < 2 || r.height < 2) continue;
      if (r.bottom < 0 || r.top > window.innerHeight) continue;
      const cs = getComputedStyle(el);
      if (cs.visibility === "hidden" || cs.display === "none") continue;
      if (r.width < 44 || r.height < 44) {
        taps.push({
          tag: el.tagName.toLowerCase(),
          text: ((el.getAttribute("aria-label") || el.innerText || el.getAttribute("placeholder") || "").trim().replace(/\s+/g, " ")).slice(0, 48),
          w: Math.round(r.width),
          h: Math.round(r.height),
        });
      }
    }
    const unnamed = [];
    for (const el of document.querySelectorAll("a,button,input,summary")) {
      if (!inFold(el) && !(dock && dock.contains(el))) continue;
      const r = el.getBoundingClientRect();
      if (r.width < 2 || r.height < 2 || r.bottom < 0 || r.top > window.innerHeight) continue;
      const name = (el.getAttribute("aria-label") || el.innerText || el.getAttribute("placeholder") || el.getAttribute("alt") || el.getAttribute("title") || "").trim();
      if (!name) unnamed.push(el.tagName.toLowerCase() + (el.id ? "#" + el.id : ""));
    }
    const images = [];
    for (const img of document.querySelectorAll("img")) {
      if (!inFold(img)) continue;
      const hidden = img.getAttribute("aria-hidden") === "true" || img.getAttribute("role") === "presentation";
      if (!hidden && !img.getAttribute("alt")) images.push((img.getAttribute("src") || "").slice(0, 90));
    }
    const colorOnly = [];
    for (const el of document.querySelectorAll("body *")) {
      if (!inFold(el)) continue;
      const t = (el.innerText || "").trim();
      if (!t || t.length > 40) continue;
      const fg = parse(getComputedStyle(el).color);
      if (!fg) continue;
      const greenish = fg[1] > fg[0] + 30 && fg[1] > fg[2];
      const reddish = fg[0] > fg[1] + 40 && fg[0] > fg[2];
      if (!greenish && !reddish) continue;
      const word = /up|down|flat|higher|lower|rose|fell|▲|▼|↑|↓/i.test(t);
      const move = /[%$]|▲|▼|↑|↓/.test(t);
      if (move && !word && el.children.length === 0) colorOnly.push(t.slice(0, 40));
    }
    return {
      contrast: contrast.slice(0, 12),
      taps: taps.slice(0, 20),
      unnamed: unnamed.slice(0, 12),
      images: images.slice(0, 8),
      colorOnly: [...new Set(colorOnly)].slice(0, 12),
    };
  });
}

const SCREENS = [
  { id: "home-v2", name: "Home v2", path: "/" },
  { id: "pulse", name: "Pulse", path: "/pulse" },
  { id: "tab-bar", name: "Tab bar", path: "/" },
  { id: "product-v2", name: "Product v2", path: "/c/tcgcsv-517045" },
  { id: "product-sealed", name: "Product v2 sealed example", path: "/p/tcgcsv-503313" },
  { id: "receipt-sheet", name: "Receipt sheet", path: "/p/tcgcsv-503313" },
  { id: "explorer", name: "Explorer", path: "/explore" },
];

function words(s) {
  return String(s || "").trim().split(/\s+/).filter(Boolean).length;
}

function screenScore(screen, snap, ax, status) {
  const blob = [snap.h1, ...snap.lines].join(" \n ");
  const notes = [];
  let pass = true;
  if (status >= 400) {
    pass = false;
    notes.push("HTTP " + status + ". The flagged screen is not a page a visitor can use.");
  }
  if (snap.overflow) {
    pass = false;
    notes.push("Horizontal overflow on a 390 phone.");
  }
  if (screen.id === "explorer") {
    pass = false;
    notes.push("No Explorer route. /explore is a 404. Tabs named Sets, Cards, Sealed, Reads, Calendar are not on this screen.");
  }
  if (screen.id === "pulse") {
    const named = /pulse/i.test(snap.h1) || /pulse/i.test(blob);
    if (!named) notes.push("The flag says Pulse. The screen title is The Feed. /pulse redirects to /feed.");
    const hasPrice = /\$\d/.test(blob);
    const hasDate = /Oct|202\d/.test(blob);
    if (!hasPrice || !hasDate) {
      pass = false;
      notes.push("A 5 second look does not show both a price and a date.");
    }
    if (words(snap.h1) > 7) {
      pass = false;
      notes.push("The title is longer than 7 words.");
    }
  }
  if (screen.id === "home-v2") {
    if (!/know what every card and pack is doing/i.test(snap.h1)) notes.push("H1 changed since this run's expected line.");
    if (!/\$\d/.test(blob) || !/tcgplayer market/i.test(blob)) {
      pass = false;
      notes.push("The first screen does not show a dated market read.");
    }
  }
  if (screen.id === "tab-bar") {
    const labels = snap.dock.map((d) => d.text);
    if (!labels.includes("Feed") || !labels.includes("Search") || !labels.includes("Sets")) {
      pass = false;
      notes.push("Tab bar is missing Feed, Sets, or Search.");
    }
    if (labels.includes("Indexes")) notes.push("Indexes is on the tab bar. A beginner cannot tell what it opens.");
    const small = snap.dock.filter((d) => d.w < 44 || d.h < 44);
    if (small.length) {
      pass = false;
      notes.push("A tab is under 44px.");
    }
  }
  if (screen.id === "product-v2") {
    if (/price being checked/i.test(blob)) {
      pass = false;
      notes.push("The named card says Price being checked. No market price is on the first screen.");
    }
    if (/buy on/i.test(blob)) notes.push("Store buttons sit above the price line. The first screen looks like a shop.");
  }
  if (screen.id === "product-sealed") {
    if (/PRICE 7D|DATA \d+ days/i.test(blob)) {
      pass = false;
      notes.push("The first screen leads with DATA and PRICE 7D, not a plain price sentence.");
    }
  }
  if (screen.id === "receipt-sheet") {
    const receipt = /listings counted/i.test(blob) && /\$\d/.test(blob) && /Oct|202\d/.test(blob);
    if (!receipt) {
      pass = false;
      notes.push("Price, date, and listings counted are not all in the first screen. There is no receipt sheet.");
    }
    if (!/the numbers/i.test(blob)) notes.push("The heading The numbers is not in the first screen.");
  }
  if (ax.contrast.length) {
    pass = false;
    notes.push("Contrast below the AA line on " + ax.contrast.length + " text colors.");
  }
  if (ax.taps.length) notes.push(ax.taps.length + " controls in the first screen are under 44px.");
  if (ax.unnamed.length) {
    pass = false;
    notes.push("Controls with no screen reader name: " + ax.unnamed.join(", "));
  }
  if (ax.images.length) notes.push("Images in the first screen with no alt text.");
  if (ax.colorOnly.length) {
    pass = false;
    notes.push("Up or down color with no word: " + ax.colorOnly.join(", "));
  }
  if (screen.id === "tab-bar" && notes.some((n) => n.startsWith("Indexes"))) {
    // Indexes is a comprehension miss. The screen fails the 5 second bar.
    pass = false;
  }
  if (screen.id === "product-v2" && notes.some((n) => n.includes("shop"))) pass = false;
  return { pass, notes };
}

async function shot(page, name) {
  const file = join(SHOTS, name + "-390.png");
  await page.screenshot({ path: file, fullPage: false });
  return "qa/shots/" + name + "-390.png";
}

const SKIP_HREF = /premium|terms|privacy|disclaimer|discord|mailto:|checkout|stripe|subscribe|waitlist|post-office|\/alerts|\/collection|\/me|\/account|buy|ebay|tcgplayer\.com/i;

function looksItem(href) {
  return /^\/(c|p|sets)\//.test(href);
}

async function wander(page, persona) {
  const started = Date.now();
  const opened = [];
  const dead = [];
  const confusion = [];
  const seenClick = new Set();
  const res = await page.goto(BASE + "/explore", { waitUntil: "domcontentloaded", timeout: 30000 });
  const status = res ? res.status() : 0;
  if (status >= 400 || /not here/i.test(await page.locator("h1").innerText().catch(() => ""))) {
    dead.push({ atSec: 0, url: page.url(), why: "Explorer is a 404. Heading: This page is not here." });
  }
  while (Date.now() - started < WANDER_MS) {
    const state = await page.evaluate((skip) => {
      const dock = document.querySelector("nav.dock");
      const limit = dock ? dock.getBoundingClientRect().top : innerHeight;
      const controls = [];
      for (const el of document.querySelectorAll("a[href], button")) {
        const r = el.getBoundingClientRect();
        if (r.width < 24 || r.height < 16 || r.bottom < 0 || r.top > limit) continue;
        const text = (el.innerText || el.getAttribute("aria-label") || "").trim().replace(/\s+/g, " ").slice(0, 80);
        const href = el.getAttribute("href") || "";
        if (!text && !href) continue;
        controls.push({ text, href, tag: el.tagName.toLowerCase() });
      }
      const blob = (document.querySelector("#content")?.innerText || document.body.innerText || "").slice(0, 1500);
      const flags = [];
      const rules = ["Indexes", "Fast mode", "Momentum", "7D", "Fear and Greed", "Price being checked", "Above its usual premium", "Buy on", "The numbers"];
      for (const word of rules) if (blob.toLowerCase().includes(word.toLowerCase())) flags.push(word);
      return { url: location.pathname + location.search, h1: (document.querySelector("h1")?.innerText || "").trim(), controls, flags };
    }, "");
    for (const flag of state.flags) {
      const key = state.url + "|" + flag;
      if (!confusion.includes(key)) confusion.push(key);
    }
    const rank = {
      beginner: ["search", "home", "charizard", "pikachu", "151 etb", "open the feed", "all sets", "sets", "feed"],
      regular: ["151 etb", "charizard", "evolving skies", "sets", "feed", "search", "elite trainer"],
      returning: ["feed", "sets", "search", "charizard", "151"],
    }[persona];
    const usable = state.controls.filter((c) => {
      const href = c.href || "";
      if (href.startsWith("http") || href.startsWith("mailto:")) return false;
      if (SKIP_HREF.test(href + " " + c.text)) return false;
      if (persona === "beginner" && /indexes/i.test(c.text + href)) return false;
      return true;
    });
    let pick = null;
    for (const word of rank) {
      pick = usable.find((c) => (c.text + " " + c.href).toLowerCase().includes(word) && !seenClick.has(c.href + "|" + c.text));
      if (pick) break;
    }
    if (!pick) pick = usable.find((c) => looksItem(c.href) && !seenClick.has(c.href + "|" + c.text));
    if (!pick) pick = usable.find((c) => c.href && !seenClick.has(c.href + "|" + c.text) && /^\/(search|feed|sets|releases)/.test(c.href));
    if (!pick) {
      const hubs = ["/feed", "/sets", "/search"];
      const next = hubs.find((href) => !state.url.startsWith(href));
      if (next) {
        await page.locator(`nav.dock a[href='${next}']`).first().click({ timeout: 4000 }).catch(async () => {
          await page.goto(BASE + next, { waitUntil: "domcontentloaded", timeout: 15000 }).catch(() => {});
        });
        await page.waitForTimeout(600);
      } else {
        await page.evaluate(() => window.scrollBy(0, 700));
        await page.waitForTimeout(350);
      }
      continue;
    }
    const hub = pick.href === "/" || /^\/(search|feed|sets|releases)\/?$/.test(pick.href);
    if (!hub) seenClick.add(pick.href + "|" + pick.text);
    const before = page.url();
    const beforeH1 = state.h1;
    const beforeHash = await page.locator("#content").innerText().catch(() => "");
    try {
      if (pick.href && pick.tag === "a") {
        const loc = page.locator(`a[href="${pick.href}"]`).filter({ visible: true }).first();
        await loc.click({ timeout: 5000 });
      } else {
        await page.getByRole("button", { name: pick.text, exact: false }).first().click({ timeout: 5000 });
      }
    } catch (err) {
      if (pick.href && pick.href.startsWith("/")) {
        await page.goto(BASE + pick.href, { waitUntil: "domcontentloaded", timeout: 15000 }).catch(() => {});
      } else {
        dead.push({ atSec: Math.round((Date.now() - started) / 1000), url: before, why: "Tap missed: " + pick.text });
        continue;
      }
    }
    await page.waitForTimeout(700);
    const after = page.url();
    const h1 = await page.locator("h1").innerText().catch(() => "");
    const afterHash = await page.locator("#content").innerText().catch(() => "");
    const statusNow = /not here/i.test(h1) ? 404 : 200;
    if (statusNow >= 400) dead.push({ atSec: Math.round((Date.now() - started) / 1000), url: after, why: "Landed on a missing page from " + pick.text });
    if (after === before && h1.trim() === beforeH1 && afterHash === beforeHash && !hub) {
      dead.push({ atSec: Math.round((Date.now() - started) / 1000), url: after, why: "Tap did nothing visible: " + pick.text });
    }
    const path = new URL(after).pathname;
    if (looksItem(path) && !opened.includes(path)) opened.push(path);
    if (Date.now() - started > WANDER_MS) break;
  }
  return {
    persona,
    seconds: Math.round((Date.now() - started) / 1000),
    opened: opened.length,
    items: opened,
    deadEnds: dead,
    confusion: confusion.map((row) => row.split("|")[1] + " on " + row.split("|")[0]),
  };
}

async function taskCatch(page, task) {
  const t0 = Date.now();
  let taps = 0;
  async function tap(locator) {
    await locator.click({ timeout: 10000 });
    taps += 1;
  }
  await page.goto(BASE + "/", { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(600);
  if (task === "market-read") {
    await tap(page.getByRole("link", { name: "Open the Feed" }).first());
    await page.waitForTimeout(1200);
    const text = await fold(page);
    const blob = text.lines.join(" ");
    const ok = /\$\d/.test(blob) && /Oct|202\d/.test(blob) && text.h1.length > 0;
    return { ok, taps, seconds: (Date.now() - t0) / 1000, note: ok ? "Feed card shows a price and a date." : "Feed fold: " + blob.slice(0, 180), url: page.url() };
  }
  if (task === "sealed-price") {
    await tap(page.locator("nav.dock a[href='/search']"));
    await page.waitForTimeout(500);
    await tap(page.getByRole("button", { name: "151 ETB", exact: true }));
    await page.waitForTimeout(800);
    await tap(page.locator("a[href^='/p/']").filter({ hasText: "151 Elite Trainer Box" }).first());
    await page.waitForTimeout(1200);
    const snap = await fold(page);
    const blob = snap.lines.join(" ");
    const money = blob.match(/\$[\d,.]+/);
    const ok = /151 Elite Trainer Box/i.test(snap.h1) && !!money;
    return { ok, taps, seconds: (Date.now() - t0) / 1000, note: ok ? "First screen shows " + money[0] + " on " + snap.h1 + "." : "Opened " + snap.h1 + " but no price in the first screen.", url: page.url() };
  }
  await tap(page.locator("#home-q"));
  await page.locator("#home-q").fill("Charizard ex 199");
  await page.waitForTimeout(1200);
  const opt = page.locator(".finder-opt").filter({ hasText: "199/165" }).first();
  if (!(await opt.count())) {
    return { ok: false, taps, seconds: (Date.now() - t0) / 1000, note: "Finder did not offer Charizard ex 199/165.", url: page.url() };
  }
  await tap(opt);
  await page.waitForTimeout(1500);
  const info = await page.evaluate(() => {
    const dock = document.querySelector("nav.dock");
    const limit = dock ? dock.getBoundingClientRect().top : innerHeight;
    const lines = [];
    for (const el of document.querySelectorAll("h1,p,a,button,span,div")) {
      const r = el.getBoundingClientRect();
      if (r.top < 0 || r.top > limit || r.height < 8) continue;
      const t = (el.innerText || "").trim().replace(/\s+/g, " ");
      if (t && t.length < 120 && !lines.includes(t)) lines.push(t);
    }
    return {
      h1: document.querySelector("h1")?.innerText || "",
      fold: lines.slice(0, 16).join(" | "),
      checked: /price being checked/i.test(document.body.innerText.slice(0, 2500)),
      listings: /listings counted/i.test(document.body.innerText),
      dollars: (document.body.innerText.match(/\$[\d,.]+/g) || []).slice(0, 6),
    };
  });
  const ownPrice = !info.checked && /\$\d/.test(info.fold);
  if (task === "card-price") {
    return { ok: ownPrice, taps, seconds: (Date.now() - t0) / 1000, note: info.checked ? "Page says Price being checked. Dollars elsewhere: " + info.dollars.join(", ") : info.fold.slice(0, 200), url: page.url() };
  }
  if (task === "price-date") {
    const dated = ownPrice && /Oct|202\d/.test(info.fold);
    return { ok: dated, taps, seconds: (Date.now() - t0) / 1000, note: dated ? "Date is in the first screen with the price." : "No dated market price in the first screen. " + info.fold.slice(0, 160), url: page.url() };
  }
  return { ok: info.listings, taps, seconds: (Date.now() - t0) / 1000, note: info.listings ? "listings counted is on the page." : "This card page does not say listings counted.", url: page.url() };
}

async function dismiss(page) {
  const close = page.getByRole("button", { name: /^close$/i }).first();
  if (await close.count()) await close.click({ timeout: 1500 }).catch(() => {});
  const labels = [/accept all/i, /accept cookies/i, /i agree/i, /got it/i];
  for (const name of labels) {
    const btn = page.getByRole("button", { name }).first();
    if (await btn.count()) await btn.click({ timeout: 1500 }).catch(() => {});
  }
}

async function blocked(page) {
  const t = await page.locator("body").innerText().catch(() => "");
  return /just a moment|verify you are human|cf-browser-verification|access denied|unusual traffic/i.test(t.slice(0, 500));
}

async function taskRival(page, site, task) {
  const t0 = Date.now();
  let taps = 0;
  async function tap(locator) {
    await locator.click({ timeout: 8000 });
    taps += 1;
  }
  try {
    await page.goto(site.home, { waitUntil: "domcontentloaded", timeout: 25000 });
    await page.waitForTimeout(800);
    await dismiss(page);
    if (await blocked(page)) return { ok: false, taps, seconds: (Date.now() - t0) / 1000, note: "Blocked before a search box. Not scored as a win.", url: page.url() };
    const early = (await page.locator("body").innerText()).slice(0, 1800);
    if (task === "market-read") {
      const prices = (early.match(/\$\s?\d/g) || []).length;
      const dated = /20\d\d|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec/i.test(early);
      if (prices >= 3 && dated) {
        return { ok: true, taps: 0, seconds: (Date.now() - t0) / 1000, note: "The first screen already lists prices and a date.", url: page.url() };
      }
      const link = page.getByRole("link", { name: site.readName }).first();
      if (!(await link.count())) return { ok: false, taps, seconds: (Date.now() - t0) / 1000, note: "No dated price list on the first screen.", url: page.url() };
      await tap(link);
      await page.waitForTimeout(1200);
      const text = (await page.locator("body").innerText()).slice(0, 1800);
      const ok = (text.match(/\$\s?\d/g) || []).length >= 3;
      return { ok, taps, seconds: (Date.now() - t0) / 1000, note: ok ? "A list with several prices opened." : "The list did not show three prices.", url: page.url() };
    }
    const input = page.locator(site.search).first();
    if (!(await input.count())) return { ok: false, taps, seconds: (Date.now() - t0) / 1000, note: "Search box not found.", url: page.url() };
    await tap(input);
    const query = task === "sealed-price" ? site.sealedQuery : site.cardQuery;
    const tag = await input.evaluate((el) => el.tagName).catch(() => "");
    if (tag === "INPUT" || tag === "TEXTAREA") await input.fill(query);
    else await page.keyboard.type(query, { delay: 15 });
    await page.keyboard.press("Enter");
    taps += 1;
    await page.waitForTimeout(1500);
    if (await blocked(page)) return { ok: false, taps, seconds: (Date.now() - t0) / 1000, note: "Blocked after search.", url: page.url() };
    let text = (await page.locator("body").innerText()).slice(0, 2500);
    const landed = task === "sealed-price"
      ? /elite trainer/i.test(text) && /\$\s?\d/.test(text)
      : /charizard/i.test(text) && /\$\s?\d/.test(text);
    if (!landed) {
      const result = page.locator(site.result).filter({ visible: true }).first();
      if (await result.count()) {
        await tap(result);
        await page.waitForTimeout(1200);
        text = (await page.locator("body").innerText()).slice(0, 2500);
      }
    }
    if (task === "sealed-price") {
      const ok = /elite trainer/i.test(text) && /\$\s?\d/.test(text);
      return { ok, taps, seconds: (Date.now() - t0) / 1000, note: ok ? "Sealed price visible." : "Sealed price not visible.", url: page.url() };
    }
    if (task === "listings") {
      const ok = /listing/i.test(text);
      return { ok, taps, seconds: (Date.now() - t0) / 1000, note: ok ? "A listing count word is on the page." : "No listing count on the page.", url: page.url() };
    }
    const okPrice = /charizard/i.test(text) && /\$\s?\d/.test(text);
    if (task === "card-price") return { ok: okPrice, taps, seconds: (Date.now() - t0) / 1000, note: okPrice ? "A Charizard price is visible." : "No Charizard price.", url: page.url() };
    const okDate = okPrice && /20\d\d|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec/i.test(text);
    return { ok: okDate, taps, seconds: (Date.now() - t0) / 1000, note: okDate ? "A date is on the page with the price." : "No date next to the price.", url: page.url() };
  } catch (err) {
    return { ok: false, taps, seconds: (Date.now() - t0) / 1000, note: String(err.message || err).slice(0, 180), url: page.url() };
  }
}

const TASKS = ["card-price", "price-date", "listings", "market-read", "sealed-price"];
const RIVALS = [
  {
    id: "tcgplayer",
    name: "TCGplayer",
    home: "https://www.tcgplayer.com/",
    search: "text=Find something awesome",
    cardQuery: "Charizard ex 199/165",
    sealedQuery: "151 Elite Trainer Box",
    result: "a[href*='/product/']",
    readName: /Pokémon|Pokemon/i,
  },
  {
    id: "pricecharting",
    name: "PriceCharting",
    home: "https://www.pricecharting.com/",
    search: "input[name='q'], input[type='search']",
    cardQuery: "pokemon charizard ex 199",
    sealedQuery: "pokemon 151 elite trainer box",
    result: "a[href*='/game/pokemon']",
    readName: /pokemon/i,
  },
  {
    id: "pokedata",
    name: "PokeData",
    home: "https://www.pokedata.io/",
    search: "input[aria-label='search cards'], input[placeholder*='Find a card' i]",
    cardQuery: "Charizard ex 199",
    sealedQuery: "151 Elite Trainer Box",
    result: "a[href*='/card/'], a[href*='/product/']",
    readName: /market|trending|movers/i,
  },
];

const browser = await chromium.launch({ headless: true });
const context = await phone(browser);
const page = await context.newPage();
page.setDefaultTimeout(15000);

const screens = [];
for (const screen of SCREENS) {
  const res = await page.goto(BASE + screen.path, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(screen.id === "pulse" ? 1600 : 1000);
  const status = res ? res.status() : 0;
  const snap = await fold(page);
  const ax = await a11y(page);
  const file = await shot(page, screen.id);
  const judged = screenScore(screen, snap, ax, status);
  screens.push({
    id: screen.id,
    name: screen.name,
    requested: screen.path,
    status,
    finalUrl: snap.url,
    title: snap.title,
    h1: snap.h1,
    fold: snap.lines,
    dock: snap.dock,
    overflow: snap.overflow,
    a11y: ax,
    pass: judged.pass,
    notes: judged.notes,
    shot: file,
  });
  console.log(screen.id, status, judged.pass ? "PASS" : "FAIL", snap.h1);
}

console.log("tasks catch");
const tasks = [];
for (const task of TASKS) {
  const row = await taskCatch(page, task);
  tasks.push({ site: "Catch'em", task, ...row, seconds: Math.round(row.seconds * 10) / 10 });
  console.log(" catch", task, row.ok, row.taps, row.seconds.toFixed(1));
}
for (const rival of RIVALS) {
  const ctx = await phone(browser);
  const rp = await ctx.newPage();
  rp.setDefaultTimeout(12000);
  for (const task of TASKS) {
    const row = await taskRival(rp, rival, task);
    tasks.push({ site: rival.name, task, ...row, seconds: Math.round(row.seconds * 10) / 10 });
    console.log(" ", rival.id, task, row.ok, row.taps, row.seconds.toFixed(1), row.note.slice(0, 80));
  }
  await ctx.close();
}

console.log("wander", WANDER_MS);
const wanders = await Promise.all(["beginner", "regular", "returning"].map(async (persona) => {
  const ctx = await phone(browser);
  const wp = await ctx.newPage();
  const row = await wander(wp, persona);
  console.log(" wander", persona, "opened", row.opened, "dead", row.deadEnds.length, "sec", row.seconds);
  await ctx.close();
  return row;
}));

await browser.close();

const openedAvg = wanders.reduce((s, w) => s + w.opened, 0) / wanders.length;
const deadTotal = wanders.reduce((s, w) => s + w.deadEnds.length, 0);
const result = {
  ranAt: new Date().toISOString(),
  base: BASE,
  viewport: "390x844",
  wanderSeconds: WANDER_MS / 1000,
  screens,
  tasks,
  wanders,
  summary: {
    screensPass: screens.filter((s) => s.pass).map((s) => s.id),
    screensFail: screens.filter((s) => !s.pass).map((s) => s.id),
    wanderOpenedAvg: Math.round(openedAvg * 10) / 10,
    wanderDeadEnds: deadTotal,
    ship: false,
  },
};
result.summary.ship = result.summary.screensFail.length === 0 && openedAvg >= 6 && deadTotal === 0;
writeFileSync(join(OUT, "five-second-results.json"), JSON.stringify(result, null, 2));
console.log("wrote qa/five-second-results.json");
console.log("ship", result.summary.ship, "openedAvg", result.summary.wanderOpenedAvg, "dead", deadTotal);
