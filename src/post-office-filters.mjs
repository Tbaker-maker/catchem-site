// Post Office filter logic. Pure helpers are unit-tested; rewriteOfficeFilters
// patches the play.html editor so those helpers actually run in the desk.
import { DEX_EN, DEX_JA } from "./dex-names.mjs";

export const GOLD_STAR_LANE = "goldstar";

export const CONNECTING_30TH_BIRDS = ["me55-130", "me55-132", "me55-133"];
export const CONNECTING_STUB_IDS = ["c30-ir-moltres", "c30-ir-articuno", "c30-ir-zapdos"];

// Official Japanese set ids on api.tcgdex.net/v2/ja, mapped to the desk's English pin names.
export const JP_SET_PINS = [
  { pin: "Storm Emeralda", id: "M6" },
  { pin: "MEGA Dream ex", id: "M2a" },
  { pin: "JP Mega Promos", id: "M-P" },
  { pin: "Terastal Fest", id: "SV8a" },
  { pin: "JP 151", id: "SV2a" },
  { pin: "JP SV Promos", id: "SV-P" },
  { pin: "VSTAR Universe", id: "S12a" },
  { pin: "VMAX Climax", id: "S8b" },
  { pin: "Eevee Heroes", id: "S6a" },
  { pin: "Dark Phantasma", id: "S10a" },
  { pin: "Skyscraping Perfection", id: "S7D" },
  { pin: "GX Ultra Shiny", id: "SM8b" },
  { pin: "Tag All Stars", id: "SM12a" },
];

// Wikimedia covers already used the same way movie posters do. UTM query stripped.
export const MANGA_ROWS = [
  { id: "manga-adventures-1", name: "Pokémon Adventures Vol. 1", species: "Pikachu", set: "Pokémon Adventures", year: "1997", artist: "Hidenori Kusaka, Mato", lock: "1", rarity: "Cover", rank: 90, tags: "manga adventures special", src: "https://upload.wikimedia.org/wikipedia/en/1/1b/Wikipokespe_poster.jpg", kind: "manga", fact: "Manga cover. A real book, not a Pokédex still." },
  { id: "manga-electric-1", name: "The Electric Tale of Pikachu Vol. 1", species: "Pikachu", set: "Electric Tale", year: "1997", artist: "Toshihiro Ono", lock: "1", rarity: "Cover", rank: 88, tags: "manga electric tale", src: "https://upload.wikimedia.org/wikipedia/en/0/0c/Pokemon_The_Electric_Tale_of_Pikachu.jpg", kind: "manga", fact: "Manga cover. A real book, not a Pokédex still." },
  { id: "manga-pocket-1", name: "Pocket Monsters Vol. 1", species: "Pikachu", set: "Pocket Monsters", year: "1996", artist: "Kosaku Anakubo", lock: "1", rarity: "Cover", rank: 80, tags: "manga pocket monsters", src: "https://upload.wikimedia.org/wikipedia/en/7/78/Pocket_Monsters_volume_1_cover.png", kind: "manga", fact: "Manga cover. A real book, not a Pokédex still." },
  { id: "manga-magical-5", name: "Magical Pokémon Journey Vol. 5", species: "Pikachu", set: "Magical Journey", year: "1998", artist: "Yumi Tsukirino", lock: "5", rarity: "Cover", rank: 78, tags: "manga magical journey", src: "https://upload.wikimedia.org/wikipedia/en/b/bc/Magical_Pokemon_Adventure_Vol._5.jpg", kind: "manga", fact: "Manga cover. A real book, not a Pokédex still." },
];

export const CUTOUT_DEX_MAX = 386;
const ART_BASE = "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon";

export function dexEnglish(n) {
  const i = Number(n) - 1;
  return i >= 0 && i < DEX_EN.length ? DEX_EN[i] : "";
}

export function dexJapanese(n) {
  const i = Number(n) - 1;
  return i >= 0 && i < DEX_JA.length ? DEX_JA[i] : "";
}

export function speciesFromJaName(name) {
  let n = String(name || "").trim();
  if (!n) return "";
  n = n.replace(/[　\s]+/g, "");
  n = n.replace(/[exEX]+$/g, "");
  n = n.replace(/^(メガ|Mega)/i, "");
  n = n.replace(/[XY]$/i, "");
  const i = DEX_JA.indexOf(n);
  return i >= 0 ? DEX_EN[i] : "";
}

export function isGoldStarCard(c) {
  if (!c) return false;
  const n = String(c.name || "");
  const r = String(c.rarity || "").toLowerCase();
  const tags = String(c.tags || "").toLowerCase();
  if (/vstar/i.test(n) || /vstar/.test(r)) return false;
  if (/prism star/.test(r) || /◇/.test(n)) return false;
  if (/holo star|gold star/.test(r)) return true;
  if (/★|☆/.test(n)) return true;
  if (tags.includes("gold-star") || tags.includes("gold star")) return true;
  return false;
}

export function is30thCard(c) {
  if (!c) return false;
  const id = String(c.id || "");
  if (CONNECTING_STUB_IDS.includes(id)) return false;
  const set = String(c.set || "").toLowerCase();
  const setId = String(c.setId || "").toLowerCase();
  const tags = String(c.tags || "").toLowerCase();
  if (set.includes("30th")) return true;
  if (setId === "me55" || setId === "me55c" || setId === "30th" || setId === "30th-c") return true;
  if (id.startsWith("me55-") || id.startsWith("me55c-")) return true;
  if (tags.includes("30th")) return true;
  return false;
}

export function isConnectingCard(c) {
  if (!c) return false;
  const id = String(c.id || "");
  if (CONNECTING_STUB_IDS.includes(id)) return false;
  if (CONNECTING_30TH_BIRDS.includes(id)) return true;
  const tags = String(c.tags || "").toLowerCase();
  if (tags.includes("connecting")) return true;
  return false;
}

export function isJapanesePrint(c) {
  if (!c) return false;
  if (c.lang === "jp") return true;
  if (String(c.id || "").startsWith("jp-") || String(c.id || "").startsWith("JP-")) return true;
  const tags = String(c.tags || "");
  if (/(^| )jp( |$)/i.test(tags) || tags.includes(" jp")) return true;
  return false;
}

export function deskAllows(c) {
  if (!c) return false;
  const id = String(c.id || "");
  if (id.startsWith("stub-")) return false;
  if (id === "xy6-11" || id === "sm1-79") return false;
  if (String(c.tags || "").includes("mismatch")) return false;
  return true;
}

export function nextShowPrompt(current, clicked) {
  const v = String(clicked || "");
  if (v === "all") return "all";
  return String(current || "") === v ? "all" : v;
}

export function goldStarLaneValue() {
  return GOLD_STAR_LANE;
}

export function matchesShowPrompt(card, prompt) {
  const p = String(prompt || "all");
  if (p === "all") return true;
  if (p === "30th") return is30thCard(card);
  if (p === "connect") return isConnectingCard(card);
  if (p === GOLD_STAR_LANE) return isGoldStarCard(card);
  if (p === "star") return false; // pair story, not the Gold Star lane
  if (p === "sir") return /special illustration rare/i.test(String(card && card.rarity || ""));
  if (p === "future") return /futuristic/i.test(String(card && card.rarity || ""));
  if (p === "bwr") return /black white rare/i.test(String(card && card.rarity || ""));
  return true;
}

function paperLike(c) {
  return c && c.kind !== "pocket" && c.kind !== "game" && c.kind !== "poster" && c.kind !== "manga" && c.kind !== "cutout";
}

function isIrSirCard(c) {
  const r = String((c && c.rarity) || "").toLowerCase();
  if (!r) return false;
  if (c.kind === "pocket") return /^(im|sar|ssr|ur|sr|ar)$/i.test(c.rarity || "");
  return r.includes("special illustration rare") || r.includes("illustration rare");
}

export function compareDesk(cards, mon, opts = {}) {
  const list = Array.isArray(cards) ? cards : [];
  const wantJp = !!opts.jp;
  const isJp = opts.isJp || isJapanesePrint;
  function okPaper(c) {
    return paperLike(c) && (wantJp ? isJp(c) : !isJp(c));
  }
  function score(c) {
    return (c && c.rank) || 0;
  }
  function ofMon(c, who) {
    if (!who) return true;
    const w = String(who).toLowerCase();
    return String(c.species || "").toLowerCase() === w || String(c.name || "").toLowerCase().includes(w);
  }
  if (mon) {
    const paper = list.filter((c) => okPaper(c) && ofMon(c, mon) && isIrSirCard(c)).sort((a, b) => score(b) - score(a));
    const pk = list.filter((c) => c.kind === "pocket" && ofMon(c, mon) && isIrSirCard(c)).sort((a, b) => score(b) - score(a));
    const out = [];
    const seen = {};
    const n = Math.max(paper.length, pk.length);
    for (let i = 0; i < n; i++) {
      if (paper[i] && !seen[paper[i].id]) { seen[paper[i].id] = 1; out.push(paper[i]); }
      if (pk[i] && !seen[pk[i].id]) { seen[pk[i].id] = 1; out.push(pk[i]); }
    }
    return out;
  }
  // No Pokémon picked: show species that exist on both desks, IR/SIR first, then any print.
  const paperBy = new Map();
  const pkBy = new Map();
  for (const c of list) {
    const sp = String(c.species || c.name || "").trim();
    if (!sp) continue;
    const key = sp.toLowerCase();
    if (okPaper(c)) {
      const arr = paperBy.get(key) || [];
      arr.push(c);
      paperBy.set(key, arr);
    } else if (c.kind === "pocket") {
      const arr = pkBy.get(key) || [];
      arr.push(c);
      pkBy.set(key, arr);
    }
  }
  function best(arr, preferIr) {
    const pool = preferIr ? arr.filter(isIrSirCard) : arr;
    const use = pool.length ? pool : arr;
    return use.slice().sort((a, b) => score(b) - score(a))[0];
  }
  const species = [];
  for (const key of paperBy.keys()) {
    if (!pkBy.has(key)) continue;
    const paperArr = paperBy.get(key);
    const pkArr = pkBy.get(key);
    const paper = best(paperArr, true);
    const pk = best(pkArr, true);
    if (!paper || !pk) continue;
    species.push({ key, paper, pk, score: score(paper) + score(pk) });
  }
  species.sort((a, b) => b.score - a.score);
  const out = [];
  for (const row of species) {
    out.push(row.paper, row.pk);
  }
  return out;
}

export function cutoutRows(maxDex = CUTOUT_DEX_MAX) {
  const n = Math.max(0, Math.min(Number(maxDex) || 0, DEX_EN.length));
  const out = [];
  for (let dex = 1; dex <= n; dex++) {
    const name = DEX_EN[dex - 1];
    if (!name) continue;
    out.push({
      id: "cut-art-" + dex,
      name,
      species: name,
      set: "Official artwork",
      year: "1996",
      artist: "unlisted",
      lock: String(dex),
      rarity: "Artwork",
      rank: 60,
      tags: "cutout artwork official",
      src: ART_BASE + "/other/official-artwork/" + dex + ".png",
      kind: "cutout",
      dex,
    });
    out.push({
      id: "cut-home-" + dex,
      name,
      species: name,
      set: "Pokémon HOME",
      year: "2020",
      artist: "unlisted",
      lock: String(dex),
      rarity: "HOME",
      rank: 70,
      tags: "cutout home",
      src: ART_BASE + "/other/home/" + dex + ".png",
      kind: "cutout",
      dex,
    });
    out.push({
      id: "cut-dex-" + dex,
      name,
      species: name,
      set: "Pokédex still",
      year: "1996",
      artist: "unlisted",
      lock: String(dex),
      rarity: "Still",
      rank: 40,
      tags: "cutout pokedex still sprite",
      src: ART_BASE + "/" + dex + ".png",
      kind: "cutout",
      dex,
    });
  }
  return out;
}

export function mangaRows() {
  return MANGA_ROWS.map((r) => ({ ...r }));
}

export function rowsFromTcgdexSet(set, pinName) {
  const out = [];
  const cards = (set && set.cards) || [];
  const setId = (set && set.id) || "";
  const serie = ((set && set.serie) || {}).id || "";
  const official = ((set && set.cardCount) || {}).official || 0;
  const year = String((set && set.releaseDate) || "").slice(0, 4);
  for (const brief of cards) {
    if (!brief || !brief.name || !brief.localId) continue;
    const lid = String(brief.localId);
    const id = String(brief.id || (setId + "-" + lid));
    const image = String(brief.image || "").trim();
    const src = image ? (image + "/high.webp") : "";
    const num = parseInt(String(lid).replace(/\D/g, ""), 10) || 0;
    let species = speciesFromJaName(brief.name);
    if (!species && pinName === "JP 151" && num >= 1 && num <= 151) species = dexEnglish(num);
    if (!species && brief.dexId && brief.dexId[0]) species = dexEnglish(brief.dexId[0]);
    out.push({
      id,
      name: species ? String(brief.name).replace(/[ァ-ヶー一-龯]+/g, species).replace(species + species, species) : brief.name,
      species: species || brief.name,
      set: pinName || (set && set.name) || setId,
      setId,
      year,
      artist: brief.illustrator || "unlisted",
      lock: official ? ((lid.replace(/^0+/, "") || lid) + "/" + official) : lid,
      rarity: brief.rarity || "",
      rank: /futuristic/i.test(brief.rarity || "") ? 100 : /special illustration/i.test(brief.rarity || "") ? 98 : /illustration rare/i.test(brief.rarity || "") ? 92 : 55,
      src,
      tags: "jp " + (pinName || ""),
      lang: "jp",
      kind: "",
      fact: src ? "Japanese print. Not the English set." : "The picture is missing.",
    });
  }
  // Prefer a clean English display name when we resolved the species and the printed name was Japanese-only.
  for (const row of out) {
    if (row.species && /[ァ-ヶー]/.test(row.name) && row.species !== row.name) {
      const suffix = String(row.name).replace(/[ァ-ヶー一-龯\s]+/g, "").trim();
      row.name = suffix ? (row.species + " " + suffix).replace(/\s+/g, " ").trim() : row.species;
    }
  }
  return out;
}

function replaceOnce(html, oldStr, nextStr, label) {
  if (!html.includes(oldStr)) return { html, ok: false, label };
  return { html: html.split(oldStr).join(nextStr), ok: true, label };
}

export function editorBootSource() {
  return [
    "    var CE_DEX_EN = " + JSON.stringify(DEX_EN) + ";",
    "    var CE_DEX_JA = " + JSON.stringify(DEX_JA) + ";",
    "    var CE_JP_SET_PINS = " + JSON.stringify(JP_SET_PINS) + ";",
    "    var CE_CONNECT_BIRDS = " + JSON.stringify(CONNECTING_30TH_BIRDS) + ";",
    "    var CE_CONNECT_STUBS = " + JSON.stringify(CONNECTING_STUB_IDS) + ";",
    "    var CE_MANGA_ROWS = " + JSON.stringify(MANGA_ROWS) + ";",
    "    function ceDexEn(n) { var i = Number(n) - 1; return i >= 0 && i < CE_DEX_EN.length ? CE_DEX_EN[i] : \"\"; }",
    "    function ceSpeciesFromJa(name) {",
    "      var n = String(name || \"\").trim().replace(/[　\\s]+/g, \"\");",
    "      n = n.replace(/[exEX]+$/g, \"\").replace(/^(メガ|Mega)/i, \"\").replace(/[XY]$/i, \"\");",
    "      var i = CE_DEX_JA.indexOf(n);",
    "      return i >= 0 ? CE_DEX_EN[i] : \"\";",
    "    }",
    "    function is30thCard(c) {",
    "      if (!c) return false;",
    "      var id = String(c.id || \"\");",
    "      if (CE_CONNECT_STUBS.indexOf(id) !== -1) return false;",
    "      var set = String(c.set || \"\").toLowerCase();",
    "      var setId = String(c.setId || \"\").toLowerCase();",
    "      var tags = String(c.tags || \"\").toLowerCase();",
    "      if (set.indexOf(\"30th\") !== -1) return true;",
    "      if (setId === \"me55\" || setId === \"me55c\" || setId === \"30th\" || setId === \"30th-c\") return true;",
    "      if (id.indexOf(\"me55-\") === 0 || id.indexOf(\"me55c-\") === 0) return true;",
    "      if (tags.indexOf(\"30th\") !== -1) return true;",
    "      return false;",
    "    }",
    "    function isConnectingCard(c) {",
    "      if (!c) return false;",
    "      var id = String(c.id || \"\");",
    "      if (CE_CONNECT_STUBS.indexOf(id) !== -1) return false;",
    "      if (CE_CONNECT_BIRDS.indexOf(id) !== -1) return true;",
    "      return String(c.tags || \"\").toLowerCase().indexOf(\"connecting\") !== -1;",
    "    }",
    "    function rowsFromCutouts() {",
    "      var out = [];",
    "      var base = \"https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon\";",
    "      var max = 386;",
    "      for (var dex = 1; dex <= max; dex++) {",
    "        var name = ceDexEn(dex);",
    "        if (!name) continue;",
    "        out.push({ id: \"cut-art-\" + dex, name: name, species: name, set: \"Official artwork\", year: \"1996\", artist: \"unlisted\", lock: String(dex), rarity: \"Artwork\", rank: 60, tags: \"cutout artwork official\", src: base + \"/other/official-artwork/\" + dex + \".png\", kind: \"cutout\", dex: dex });",
    "        out.push({ id: \"cut-home-\" + dex, name: name, species: name, set: \"Pokémon HOME\", year: \"2020\", artist: \"unlisted\", lock: String(dex), rarity: \"HOME\", rank: 70, tags: \"cutout home\", src: base + \"/other/home/\" + dex + \".png\", kind: \"cutout\", dex: dex });",
    "        out.push({ id: \"cut-dex-\" + dex, name: name, species: name, set: \"Pokédex still\", year: \"1996\", artist: \"unlisted\", lock: String(dex), rarity: \"Still\", rank: 40, tags: \"cutout pokedex still sprite\", src: base + \"/\" + dex + \".png\", kind: \"cutout\", dex: dex });",
    "      }",
    "      return out;",
    "    }",
    "    function rowsFromTcgdexJa(set, pinName) {",
    "      var out = [];",
    "      var cards = (set && set.cards) || [];",
    "      var setId = (set && set.id) || \"\";",
    "      var official = ((set && set.cardCount) || {}).official || 0;",
    "      var year = String((set && set.releaseDate) || \"\").slice(0, 4);",
    "      for (var i = 0; i < cards.length; i++) {",
    "        var brief = cards[i];",
    "        if (!brief || !brief.name || !brief.localId) continue;",
    "        var lid = String(brief.localId);",
    "        var id = String(brief.id || (setId + \"-\" + lid));",
    "        var image = String(brief.image || \"\").trim();",
    "        var src = image ? (image + \"/high.webp\") : \"\";",
    "        var num = parseInt(String(lid).replace(/\\D/g, \"\"), 10) || 0;",
    "        var species = ceSpeciesFromJa(brief.name);",
    "        if (!species && pinName === \"JP 151\" && num >= 1 && num <= 151) species = ceDexEn(num);",
    "        var display = brief.name;",
    "        if (species && /[ァ-ヶー]/.test(display)) {",
    "          var suffix = String(display).replace(/[ァ-ヶー一-龯\\s]+/g, \"\").trim();",
    "          display = suffix ? (species + \" \" + suffix) : species;",
    "        }",
    "        out.push({ id: id, name: display, species: species || brief.name, set: pinName || (set && set.name) || setId, setId: setId, year: year, artist: brief.illustrator || \"unlisted\", lock: official ? ((lid.replace(/^0+/, \"\") || lid) + \"/\" + official) : lid, rarity: brief.rarity || \"\", rank: /special illustration/i.test(brief.rarity || \"\") ? 98 : /illustration rare/i.test(brief.rarity || \"\") ? 92 : 55, src: src, tags: \"jp \" + (pinName || \"\"), lang: \"jp\", fact: src ? \"Japanese print. Not the English set.\" : \"The picture is missing.\" });",
    "      }",
    "      return out;",
    "    }",
    "    function loadVisualCatalogs() {",
    "      var cuts = rowsFromCutouts();",
    "      if (cuts.length) { merge(cuts, \"\"); CATALOG.cutouts = true; }",
    "      if (CE_MANGA_ROWS.length) { merge(CE_MANGA_ROWS, \"\"); CATALOG.manga = true; }",
    "    }",
    "    var jpLoad = null;",
    "    function loadJpCatalog() {",
    "      if (CATALOG.jp) return Promise.resolve(true);",
    "      if (jpLoad) return jpLoad;",
    "      jpLoad = fetchJson(assetUrl(\"cards/jp/index.json?v=11sep-vis2\")).then(function (d) {",
    "        if (d && d.length) {",
    "          (d || []).forEach(function (r) { if (r && !r.lang) r.lang = \"jp\"; });",
    "          merge(d, \" jp\");",
    "          CATALOG.jp = true;",
    "          return true;",
    "        }",
    "        return Promise.all(CE_JP_SET_PINS.map(function (pin) {",
    "          return fetchJson(\"https://api.tcgdex.net/v2/ja/sets/\" + encodeURIComponent(pin.id)).then(function (set) {",
    "            var rows = rowsFromTcgdexJa(set, pin.pin);",
    "            if (rows.length) { merge(rows, \" jp\"); CATALOG.jp = true; }",
    "          }).catch(function () {});",
    "        })).then(function () { return !!CATALOG.jp; });",
    "      }).catch(function () { return !!CATALOG.jp; });",
    "      return jpLoad;",
    "    }",
  ].join("\n");
}

export function rewriteOfficeFilters(html) {
  let out = String(html || "");
  if (!out.includes("Pin two cards. We make a picture.")) return out;
  const hits = [];
  function apply(oldStr, nextStr, label) {
    const r = replaceOnce(out, oldStr, nextStr, label);
    hits.push({ label, ok: r.ok });
    if (r.ok) out = r.html;
  }

  apply('star: "Gold Star"', 'goldstar: "Gold Star"', "lane-label");
  apply('var LANE_ORDER = ["star","sir","future","bwr"', 'var LANE_ORDER = ["goldstar","sir","future","bwr"', "lane-order");
  apply('if (isGoldStar(c)) return "star";', 'if (isGoldStar(c)) return "goldstar";', "lane-goldstar");
  apply('if (/holo star|gold star/.test(r)) return "star";', 'if (/holo star|gold star/.test(r)) return "goldstar";', "lane-holostar");
  apply("crystal: 93, star: 112, shining: 90", "crystal: 93, goldstar: 112, shining: 90", "chase-tier");
  apply('return l === "star" || l === "shining";', 'return l === "goldstar" || l === "shining";', "pair-role-star");
  apply('return (l === "star" || l === "shining") ? "star" : "modern";', 'return (l === "goldstar" || l === "shining") ? "star" : "modern";', "pair-stamp-star");
  apply('return rarityLane(c) === "star" || rarityLane(c) === "shining";', 'return rarityLane(c) === "goldstar" || rarityLane(c) === "shining";', "pair-pool-star");
  apply('{ t: "Gold Star", v: "star" }, { t: "Gold Stars", v: "star" },', '{ t: "Gold Star", v: "goldstar" }, { t: "Gold Stars", v: "goldstar" },', "search-goldstar");
  apply('if (lane === "star") extra += " gold star gold stars";', 'if (lane === "goldstar") extra += " gold star gold stars";', "search-hay-goldstar");

  apply(
    '        if (prompt === "30th") return (c.tags || "").indexOf("30th") !== -1;\n        if (prompt === "connect") return (c.tags || "").indexOf("connecting") !== -1;',
    '        if (prompt === "30th") return is30thCard(c);\n        if (prompt === "connect") return isConnectingCard(c);',
    "list-30th-connect",
  );
  apply(
    '      if (prompt === "connect") {\n        var order = ["c30-ir-moltres", "c30-ir-articuno", "c30-ir-zapdos"];\n        return order.map(function (id) {\n          return CARDS.filter(function (c) { return c.id === id; })[0];\n        }).filter(Boolean);\n      }',
    '      if (prompt === "connect") {\n        var order = CE_CONNECT_BIRDS.slice();\n        var tagged = rows.filter(isConnectingCard);\n        var first = order.map(function (id) {\n          return tagged.filter(function (c) { return c.id === id; })[0] || CARDS.filter(function (c) { return c.id === id; })[0];\n        }).filter(Boolean);\n        var rest = tagged.filter(function (c) { return order.indexOf(c.id) === -1; });\n        return first.concat(rest);\n      }',
    "connect-order",
  );
  apply(
    '      if (medium === "compare") {\n        if (!mon) return [];',
    '      if (medium === "compare") {\n        if (!mon) {\n          var paperBy = {};\n          var pkBy = {};\n          CARDS.forEach(function (c) {\n            if (!onDesk(c) || isVisual(c)) return;\n            var sp = String(c.species || c.name || "").trim();\n            if (!sp) return;\n            var key = sp.toLowerCase();\n            if (c.kind === "pocket") {\n              (pkBy[key] = pkBy[key] || []).push(c);\n            } else if (c.kind !== "pocket" && (paperLang === "jp" ? isJp(c) : !isJp(c))) {\n              (paperBy[key] = paperBy[key] || []).push(c);\n            }\n          });\n          function bestOf(arr) {\n            var ir = (arr || []).filter(isIrSir);\n            var use = ir.length ? ir : arr;\n            return (use || []).slice().sort(function (a, b) { return ((b.rank || 0) - (a.rank || 0)); })[0];\n          }\n          var pairs = [];\n          Object.keys(paperBy).forEach(function (key) {\n            if (!pkBy[key]) return;\n            var paperCard = bestOf(paperBy[key]);\n            var pkCard = bestOf(pkBy[key]);\n            if (paperCard && pkCard) pairs.push({ paper: paperCard, pk: pkCard, score: (paperCard.rank || 0) + (pkCard.rank || 0) });\n          });\n          pairs.sort(function (a, b) { return b.score - a.score; });\n          var mixed = [];\n          pairs.forEach(function (row) { mixed.push(row.paper, row.pk); });\n          return mixed;\n        }',
    "compare-no-mon",
  );
  apply(
    "      prompt = prompt === v ? \"all\" : v;",
    "      if (v === \"all\") prompt = \"all\";\n      else prompt = prompt === v ? \"all\" : v;",
    "apply-all",
  );
  apply(
    '      if (prompt === "connect") {\n        mon = "";\n        pins = ["c30-ir-moltres", "c30-ir-articuno", "c30-ir-zapdos"];\n      }',
    '      if (prompt === "connect") {\n        mon = "";\n        pins = CE_CONNECT_BIRDS.filter(function (id) { return CARDS.some(function (c) { return c.id === id; }); });\n      }',
    "connect-pins",
  );
  apply(
    '      if (prompt === "connect" && isConnectQuery(nq) && !mon) {\n        pins = ["c30-ir-moltres", "c30-ir-articuno", "c30-ir-zapdos"];',
    '      if (prompt === "connect" && isConnectQuery(nq) && !mon) {\n        pins = CE_CONNECT_BIRDS.filter(function (id) { return CARDS.some(function (c) { return c.id === id; }); });',
    "connect-query-pins",
  );
  apply(
    '      if (nq === "birds" || nq === "the birds") {\n        pins = ["c30-ir-moltres", "c30-ir-articuno", "c30-ir-zapdos"];',
    '      if (nq === "birds" || nq === "the birds") {\n        pins = CE_CONNECT_BIRDS.filter(function (id) { return CARDS.some(function (c) { return c.id === id; }); });',
    "birds-query-pins",
  );
  apply(
    '    function pinTonightBirds() {\n      medium = "paper";\n      prompt = "connect";\n      pins = ["c30-ir-moltres", "c30-ir-articuno", "c30-ir-zapdos"];',
    '    function pinTonightBirds() {\n      medium = "paper";\n      prompt = "connect";\n      pins = CE_CONNECT_BIRDS.filter(function (id) { return CARDS.some(function (c) { return c.id === id; }); });',
    "tonight-pins",
  );
  apply(
    '    function isJp(c) { return c && c.lang === "jp"; }',
    '    function isJp(c) { return !!(c && (c.lang === "jp" || String(c.id || "").indexOf("jp-") === 0 || String(c.id || "").indexOf("JP-") === 0 || /(^| )jp( |$)/i.test(String(c.tags || "")) || String(c.tags || "").indexOf(" jp") !== -1)); }',
    "isJp",
  );
  apply(
    '      if (next === "jp" && !CATALOG.jp) {\n        catalogNote();\n        return false;\n      }',
    '      if (next === "jp" && !CATALOG.jp) {\n        if ($("count")) $("count").textContent = "Loading Japanese prints…";\n        loadJpCatalog().then(function (ok) {\n          if (!ok) { catalogNote(); return; }\n          switchLang("jp", opts);\n        });\n        return false;\n      }',
    "switch-lang-jp",
  );

  apply(
    '    function onDesk(c) {\n      if (!c) return false;\n      if (!c.src && c.fact !== "The picture is missing.") return false;',
    '    function onDesk(c) {\n      if (!c) return false;',
    "on-desk-empty-src",
  );
  apply(
    '        if (setFilter !== "30th Celebration" && pool.some(function (c) { return (c.tags || "").indexOf("30th") !== -1; })) {\n          modes.push({ v: "30th", l: "30th Celebration" });\n        }\n        if (pool.some(function (c) { return (c.tags || "").indexOf("connecting") !== -1; })) {\n          modes.push({ v: "connect", l: "Connecting art" });\n        }',
    '        if (setFilter !== "30th Celebration" && pool.some(is30thCard)) {\n          modes.push({ v: "30th", l: "30th Celebration" });\n        }\n        if (pool.some(isConnectingCard)) {\n          modes.push({ v: "connect", l: "Connecting art" });\n        }',
    "prompt-buttons",
  );
  apply(
    '      if (medium === "compare" && !mon) return "Pick a Pokémon first. Paper vs Pocket needs a name.";',
    '      if (medium === "compare" && !mon) return "No Paper vs Pocket pairs on this desk yet. Pick a Pokémon to compare one name.";',
    "compare-empty",
  );
  apply(
    '      if (!catalogReady(next)) {\n        catalogNote();\n        return false;\n      }',
    '      if (!catalogReady(next)) {\n        if (next === "cutouts" || next === "manga") loadVisualCatalogs();\n        if (!catalogReady(next)) {\n          catalogNote();\n          return false;\n        }\n      }',
    "apply-medium-load",
  );

    if (out.includes("function is30thCard(") === false) {
    const hook = "    var CATALOG = { pocket: false, jp: false, games: false, posters: false, cutouts: false, manga: false };";
    if (out.includes(hook)) {
      out = out.split(hook).join(hook + "\n" + editorBootSource());
      hits.push({ label: "boot-helpers", ok: true });
    } else {
      hits.push({ label: "boot-helpers", ok: false });
    }
  }

  const bootTailOld = [
    "      .then(function (d) {",
    "        applyRowPrices(d);",
    '        bootPaint("Closed beta");',
    "        finishBoot();",
    "        return syncLiveSets();",
    "      })",
  ].join("\n");
  const bootTailNew = [
    "      .then(function (d) {",
    "        applyRowPrices(d);",
    "        loadVisualCatalogs();",
    '        bootPaint("Closed beta");',
    "        finishBoot();",
    "        loadJpCatalog().then(function () { if (CATALOG.jp) bootPaint(\"Japanese\"); });",
    "        return syncLiveSets();",
    "      })",
  ].join("\n");
  apply(bootTailOld, bootTailNew, "boot-load");

  rewriteOfficeFilters.lastHits = hits;
  return out;
}

export function filterPatchHits() {
  return rewriteOfficeFilters.lastHits || [];
}
