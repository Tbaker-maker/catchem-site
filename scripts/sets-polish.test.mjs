// /sets tiles without official logos, and display-only name split on set lists.
import { splitName } from "../src/display-name.mjs";
import { renderSets, renderSetShell } from "../src/ui.mjs";
let fail = 0;
const t = (n, c) => { console.log(`${c ? "  ok " : "  FAIL"} ${n}`); if (!c) fail++; };
const a = splitName("Paradise Resort - 092 (World Championships 2026)", "");
t("strip number suffix and variant", a.title === "Paradise Resort" && a.num === "092" && a.variants.join() === "World Championships 2026");
t("Ace Trainer goes to the subline", splitName("Dragonite (Ace Trainer)", "149/165").title === "Dragonite" && splitName("Dragonite (Ace Trainer)", "149/165").variants[0] === "Ace Trainer");
t("30th Celebration goes to the subline", splitName("Pikachu - 001/030 (30th Celebration)").variants[0] === "30th Celebration");
t("row number wins over the name suffix", splitName("Misty's Psyduck - 193/182", "193/182").num === "193/182" && splitName("Misty's Psyduck - 193/182", "193/182").title === "Misty's Psyduck");
t("plain names untouched", splitName("Charizard ex", "").title === "Charizard ex" && !splitName("Charizard ex", "").variants.length);
t("hyphen inside a name is kept", splitName("Ho-Oh ex", "").title === "Ho-Oh ex");
const sets = renderSets({ sets: [
  { slug: "mee-mega-evolution-energies", name: "MEE: Mega Evolution Energies", era: "Mega Evolution", logo: "/img/mee/logo.png", single: 16, sealed: 0 },
  { slug: "jumbo-cards", name: "Jumbo Cards", era: "Promos", logo: "/img/jumbocards/logo.png", single: 1, sealed: 0 },
  { slug: "me03-perfect-order", name: "ME03: Perfect Order", era: "Mega Evolution", logo: "/img/me3/logo.png", single: 1, sealed: 0 },
] }, "s", {});
t("MEE shows the Mega Evolution logo with an Energies pill", sets.includes('src="/img/me1/logo.png"') && sets.includes('<span class="set-pill">Energies</span>') && !sets.includes('src="/img/mee/logo.png"'));
t("no-parent set gets a gradient name tile", sets.includes('<span class="set-tile-name">Jumbo Cards</span>') && !sets.includes("/img/jumbocards/logo.png"));
t("official logos stay", sets.includes('src="/img/me3/logo.png"'));
t("no micro brand label in tiles", !/set-tile[^]*?Catch'em<\/span>/.test(sets.split("</main>")[0].split("<h1>Sets</h1>")[1] || ""));
t("set list script carries the split", renderSetShell("x", "s", {}).includes("function splitName"));
if (fail) process.exit(1);
