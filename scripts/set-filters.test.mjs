// Clicks every set-page filter and the search art / variant controls.
// A phone select often fires change and not input, so the test uses change.
import assert from "node:assert/strict";
import { renderSearch, renderSetShell } from "../src/ui.mjs";
import { artTypeSource } from "../src/art-type.mjs";

const src = artTypeSource();
assert.match(src, /function hasWord/);
assert.match(src, /function isLetter/);
assert.match(src, /function numOverSet/);
assert.match(src, /function startsCode/);
assert.match(src, /function artType/);
assert.doesNotMatch(src, /[\u2013\u2014]/);

const setHtml = renderSetShell("demo-set", "Nov 12");
assert.ok(setHtml.includes("function hasWord"), "set page copies the art helpers");
assert.ok(setHtml.includes("This chart is the whole set. The chips below filter the card list."));
assert.ok(setHtml.includes('id="filter-count"'));
assert.ok(setHtml.includes('el.addEventListener("change", go)'));
assert.ok(!setHtml.includes('r.kind==="sealed"||artType(r)'));
assert.doesNotMatch(setHtml.slice(setHtml.indexOf("This chart is the whole set"), setHtml.indexOf("This chart is the whole set") + 120), /[\u2013\u2014]/);

const searchHtml = renderSearch({});
assert.ok(searchHtml.includes("function hasWord"), "search page copies the art helpers");
assert.ok(searchHtml.includes('vtagEl.addEventListener("change", onVtag)'));

function el(tag, attrs = {}) {
  const node = {
    tagName: String(tag).toUpperCase(),
    attrs: {},
    children: [],
    parentNode: null,
    textContent: "",
    innerHTML: "",
    value: "",
    hidden: false,
    checked: false,
    options: [],
    _ls: {},
    setAttribute(k, v) { this.attrs[k] = String(v); },
    getAttribute(k) { return Object.prototype.hasOwnProperty.call(this.attrs, k) ? this.attrs[k] : null; },
    removeAttribute(k) { delete this.attrs[k]; },
    addEventListener(type, fn) { (this._ls[type] || (this._ls[type] = [])).push(fn); },
    dispatchEvent(ev) {
      const e = Object.assign({ target: this }, ev || {});
      for (const fn of this._ls[e.type] || []) fn.call(this, e);
    },
    closest(sel) {
      let n = this;
      const want = String(sel).toUpperCase();
      while (n) {
        if (n.tagName === want) return n;
        n = n.parentNode;
      }
      return null;
    },
    appendChild(child) {
      child.parentNode = this;
      this.children.push(child);
      if (this.tagName === "SELECT" && child.tagName === "OPTION") this.options.push(child);
      return child;
    },
  };
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  return node;
}

function documentFor(nodes) {
  const byId = {};
  for (const node of nodes) if (node.getAttribute("id")) byId[node.getAttribute("id")] = node;
  return {
    byId,
    getElementById(id) { return byId[id] || null; },
    querySelector(sel) {
      const m = String(sel).match(/^#([\w-]+) button\[aria-pressed="true"\]$/);
      if (!m) return null;
      const root = byId[m[1]];
      return root ? root.children.find((c) => c.getAttribute("aria-pressed") === "true") || null : null;
    },
    querySelectorAll(sel) {
      const m = String(sel).match(/^#([\w-]+) button$/);
      if (!m) return [];
      const root = byId[m[1]];
      return root ? root.children.filter((c) => c.tagName === "BUTTON") : [];
    },
    createElement(tag) { return el(tag); },
    addEventListener(type, fn) { (this._ls || (this._ls = {})); (this._ls[type] || (this._ls[type] = [])).push(fn); },
  };
}

function chipsFrom(html) {
  const block = html.match(/<div class="art-chips" id="art-chips"[\s\S]*?<\/div>/);
  assert.ok(block, "art chips markup");
  const root = el("div", { id: "art-chips" });
  const re = /<button\b([^>]*)>([\s\S]*?)<\/button>/g;
  let m;
  while ((m = re.exec(block[0]))) {
    const b = el("button");
    const ar = /([^\s=]+)="([^"]*)"/g;
    let a;
    while ((a = ar.exec(m[1]))) b.setAttribute(a[1], a[2]);
    b.textContent = m[2];
    root.appendChild(b);
  }
  return root;
}

function scriptOf(html, pred) {
  const re = /<script([^>]*)>([\s\S]*?)<\/script>/g;
  let m;
  while ((m = re.exec(html))) {
    if (/application\/(ld\+)?json/.test(m[1])) continue;
    if (pred(m[2])) return m[2];
  }
  throw new Error("script missing");
}

function titles(html) {
  return [...String(html || "").matchAll(/<b>([^<]*)<\/b>/g)].map((m) => m[1]).filter((t) => t && t[0] !== "$" && t !== "Price being checked");
}

async function flush() {
  for (let i = 0; i < 40; i++) await new Promise((r) => setTimeout(r, 0));
}

const SET = {
  name: "Demo Set",
  asOf: "2026-11-12",
  release: "2023-11-03",
  singleIndex: [{ d: "2026-11-01", v: 100, n: 8 }, { d: "2026-11-12", v: 110, n: 8 }],
  items: [
    { id: "sir", name: "Mew ex", kind: "single", rarity: "Special Illustration Rare", num: "232/182", price: 80, artist: "A", printing: "Holofoil" },
    { id: "ir", name: "Pikachu", kind: "single", rarity: "Illustration Rare", num: "173/182", price: 20, artist: "B", printing: "Holofoil" },
    { id: "fa", name: "Charizard ex", kind: "single", rarity: "Ultra Rare", num: "223/182", price: 40, artist: "C", printing: "Holofoil", tags: ["Full Art"] },
    { id: "alt", name: "Umbreon V", kind: "single", rarity: "Rare", num: "190/203", price: 30, artist: "D", printing: "Holofoil", tags: ["Alternate Art"] },
    { id: "tg", name: "Klara", kind: "single", rarity: "Rare", num: "TG01/TG30", price: 5, artist: "E", printing: "Holofoil" },
    { id: "etch", name: "Jirachi", kind: "single", rarity: "Amazing Rare", num: "10/182", price: 6, artist: "F", printing: "Holofoil" },
    { id: "holo", name: "Holo Mon", kind: "single", rarity: "Rare Holo", num: "12/182", price: 3, artist: "G", printing: "Holofoil" },
    { id: "rev", name: "Reverse Mon", kind: "single", rarity: "Common", num: "13/182", price: 1, artist: "H", printing: "Reverse Holofoil" },
    { id: "reg", name: "Rookidee", kind: "single", rarity: "Common", num: "14/182", price: 0.5, artist: "I", printing: "Normal" },
    { id: "pack", name: "Booster Pack", kind: "sealed", subtype: "booster-pack", price: 9 },
    { id: "zeb", name: "Zebstrika", kind: "single", rarity: "Common", num: "15/182", price: 2, artist: "J", printing: "Normal", tags: ["Reverse Holo"], printings: [{ name: "Normal", price: 2, id: "zeb" }, { name: "Reverse Holofoil", price: 4, id: "zeb-rh" }] },
  ],
};

function bootSet() {
  const chips = chipsFrom(setHtml);
  const ids = ["title", "completion", "lines", "seal-shelf", "charts", "filter-count", "mine-line", "list", "sections", "more", "meta"];
  const nodes = ids.map((id) => el(id === "meta" ? "script" : "div", { id }));
  const meta = nodes.find((n) => n.getAttribute("id") === "meta");
  meta.textContent = JSON.stringify({ slug: "demo-set" });
  const title = nodes.find((n) => n.getAttribute("id") === "title");
  title.textContent = "Set";
  const kind = el("select", { id: "kind" });
  const scope = el("select", { id: "scope" });
  const vtag = el("select", { id: "vtag" });
  const sort = el("select", { id: "sort" });
  const q = el("input", { id: "q" });
  const mine = el("button", { id: "mine-toggle" });
  mine.setAttribute("aria-pressed", "false");
  for (const [value, text] of [["", "All"], ["single", "Singles"], ["sealed", "Sealed"]]) {
    const o = el("option", { value }); o.textContent = text; o.value = value; kind.appendChild(o);
  }
  for (const value of ["", "master", "grand", "base"]) {
    const o = el("option", { value }); o.value = value; scope.appendChild(o);
  }
  const allVar = el("option", { value: "" }); allVar.value = ""; vtag.appendChild(allVar);
  for (const value of ["price", "name", "num"]) {
    const o = el("option", { value }); o.value = value; sort.appendChild(o);
  }
  sort.value = "price";
  const doc = documentFor([chips, ...nodes, kind, scope, vtag, sort, q, mine]);
  const store = {};
  const location = { hash: "", search: "", href: "/sets/demo-set" };
  const fetch = async (url) => {
    const u = String(url);
    if (u.includes("/data/sets/")) return { ok: true, json: async () => SET };
    return { ok: false, json: async () => ({}) };
  };
  const script = scriptOf(setHtml, (code) => code.includes("id=\"filter-count\"") || code.includes("filter-count"));
  const run = new Function("document", "fetch", "localStorage", "location", "window", script);
  run(doc, fetch, {
    getItem: (k) => (Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
  }, location, {});
  return { doc, chips, kind, scope, vtag, sort, q, mine };
}

const setPage = bootSet();
await flush();
const list = () => setPage.doc.getElementById("list").innerHTML;
const count = () => setPage.doc.getElementById("filter-count").textContent;
const charts = setPage.doc.getElementById("charts").innerHTML;
assert.ok(charts.includes("This chart is the whole set. The chips below filter the card list."), charts.slice(0, 240));
assert.ok(titles(list()).includes("Pikachu") && titles(list()).includes("Rookidee") && titles(list()).includes("Booster Pack"), titles(list()).join(","));
assert.equal(count(), "Showing 12 matches.");
const baseline = titles(list()).join("|");

function clickChip(art) {
  const btn = setPage.chips.children.find((b) => b.getAttribute("data-art") === art);
  assert.ok(btn, "chip " + art);
  setPage.chips.dispatchEvent({ type: "click", target: btn });
}

clickChip("Illustration Rare");
assert.deepEqual(titles(list()), ["Pikachu"]);
assert.equal(count(), "Showing 1 match. Illustration Rare.");
assert.ok(!titles(list()).includes("Rookidee"));

clickChip("Special Illustration Rare");
assert.deepEqual(titles(list()), ["Mew ex"]);
clickChip("Full Art");
assert.deepEqual(titles(list()), ["Charizard ex"]);
clickChip("Alt Art");
assert.deepEqual(titles(list()), ["Umbreon V"]);
clickChip("Trainer Gallery");
assert.deepEqual(titles(list()), ["Klara"]);
clickChip("Textured or Etched");
assert.deepEqual(titles(list()), ["Jirachi"]);
clickChip("Holo");
assert.deepEqual(titles(list()), ["Holo Mon"]);
clickChip("Reverse Holo");
assert.ok(titles(list()).includes("Reverse Mon") && titles(list()).includes("Zebstrika") && !titles(list()).includes("Rookidee"), titles(list()).join(","));
clickChip("Regular");
assert.ok(titles(list()).includes("Rookidee") && !titles(list()).includes("Pikachu") && !titles(list()).includes("Booster Pack"), titles(list()).join(","));
clickChip("");
assert.equal(titles(list()).join("|"), baseline);

setPage.kind.value = "sealed";
setPage.kind.dispatchEvent({ type: "change" });
assert.deepEqual(titles(list()), ["Booster Pack"]);
assert.notEqual(titles(list()).join("|"), baseline);
setPage.kind.value = "single";
setPage.kind.dispatchEvent({ type: "change" });
assert.ok(!titles(list()).includes("Booster Pack") && titles(list()).includes("Pikachu"));
setPage.kind.value = "";
setPage.kind.dispatchEvent({ type: "change" });
assert.equal(titles(list()).join("|"), baseline);

setPage.scope.value = "base";
setPage.scope.dispatchEvent({ type: "change" });
assert.equal(count(), "Showing 10 matches.");
assert.ok(!titles(list()).includes("Booster Pack"));
setPage.scope.value = "master";
setPage.scope.dispatchEvent({ type: "change" });
assert.equal(count(), "Showing 11 matches.");
setPage.scope.value = "";
setPage.scope.dispatchEvent({ type: "change" });
assert.equal(count(), "Showing 12 matches.");

setPage.vtag.value = "Full Art";
setPage.vtag.dispatchEvent({ type: "change" });
assert.deepEqual(titles(list()), ["Charizard ex"]);
setPage.vtag.value = "";
setPage.vtag.dispatchEvent({ type: "change" });
assert.equal(titles(list()).join("|"), baseline);

setPage.q.value = "Pikachu";
setPage.q.dispatchEvent({ type: "input" });
assert.deepEqual(titles(list()), ["Pikachu"]);
setPage.q.value = "";
setPage.q.dispatchEvent({ type: "input" });
assert.equal(titles(list()).join("|"), baseline);

assert.equal(titles(list())[0], "Mew ex");
setPage.sort.value = "name";
setPage.sort.dispatchEvent({ type: "change" });
assert.equal(titles(list())[0], "Booster Pack");
assert.notEqual(titles(list()).join("|"), baseline);
setPage.sort.value = "price";
setPage.sort.dispatchEvent({ type: "change" });
assert.equal(titles(list())[0], "Mew ex");

setPage.mine.dispatchEvent({ type: "click" });
assert.equal(setPage.mine.getAttribute("aria-pressed"), "true");
assert.ok(list().includes("Owned"), "my set adds owned boxes");
assert.match(setPage.doc.getElementById("mine-line").textContent, /Owned \d+ of \d+/);
setPage.mine.dispatchEvent({ type: "click" });
assert.equal(setPage.mine.getAttribute("aria-pressed"), "false");
assert.equal(setPage.doc.getElementById("mine-line").textContent, "");
assert.ok(!list().includes("Owned"));

const LITE = [
  ["tcgcsv-1", "Pikachu", "Demo", "173/182", "", "", 20, "demo", "Illustration Rare", []],
  ["tcgcsv-2", "Rookidee", "Demo", "14/182", "", "", 1, "demo", "Common", []],
  ["tcgcsv-3", "Charizard ex", "Demo", "223/182", "", "", 40, "demo", "Ultra Rare", ["Full Art"]],
];

function bootSearch() {
  const chips = chipsFrom(searchHtml);
  const q = el("input", { id: "q" });
  const vtag = el("select", { id: "vtag" });
  const blank = el("option", { value: "" }); blank.value = ""; vtag.appendChild(blank);
  const fa = el("option", { value: "Full Art" }); fa.value = "Full Art"; vtag.appendChild(fa);
  const meta = el("p", { id: "meta" });
  meta.textContent = "Type at least 2 letters.";
  const listEl = el("div", { id: "list" });
  const finder = el("div", { id: "finder" });
  const sugg = el("div", { id: "sugg" });
  const doc = documentFor([chips, q, vtag, meta, listEl, finder, sugg]);
  const store = {};
  const fetch = async (url) => {
    const u = String(url);
    if (u.includes("/data/search-lite.json")) return { ok: true, json: async () => LITE };
    return { ok: false, json: async () => ({}) };
  };
  const script = scriptOf(searchHtml, (code) => code.includes("function onVtag") || code.includes("hasArt"));
  const run = new Function("document", "fetch", "localStorage", "location", "window", script);
  run(doc, fetch, {
    getItem: (k) => (Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: (k) => { delete store[k]; },
  }, { hash: "", search: "", href: "/search" }, {});
  return { doc, chips, q, vtag };
}

const search = bootSearch();
await flush();
const sList = () => search.doc.getElementById("list").innerHTML;
const sMeta = () => search.doc.getElementById("meta").textContent;
const ir = search.chips.children.find((b) => b.getAttribute("data-art") === "Illustration Rare");
search.chips.dispatchEvent({ type: "click", target: ir });
await flush();
assert.match(sMeta(), /Illustration Rare/);
assert.ok(sList().includes("Pikachu") && !sList().includes("Rookidee"), sList().slice(0, 300));
const all = search.chips.children.find((b) => b.getAttribute("data-art") === "");
search.chips.dispatchEvent({ type: "click", target: all });
await flush();
search.vtag.value = "Full Art";
search.vtag.dispatchEvent({ type: "change" });
await flush();
assert.match(sMeta(), /Full Art/);
assert.ok(sList().includes("Charizard ex") && !sList().includes("Pikachu"), sMeta() + " " + sList().slice(0, 200));

console.log("set filters ok");
