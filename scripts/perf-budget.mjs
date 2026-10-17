// Fails when a page's first load is over budget.
// Critical feed JSON is meta + browse only. Catalogue, the read library,
// set tiles, and pictures wait until after the first card.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const ui = readFileSync(join(root, "src/ui.mjs"), "utf8");
let fail = 0;
const t = (name, ok) => { if (!ok) { fail++; console.log("FAIL", name); } };

const pack = ui.slice(ui.indexOf("const feedPack=Promise.all(["), ui.indexOf("const imagePack=grabJson"));
t("feed blocks on meta and browse only", pack.includes("/data/feed/meta.json") && pack.includes("/data/feed/browse.json") && !pack.includes("catalogue.json") && !pack.includes("read-library.json") && !pack.includes("/data/sets.json"));
t("pictures are not fetched while the feed script parses", !ui.includes('const imagePack=grabJson("/data/catalogue-images.json")'));
t("fonts do not block first paint", ui.includes('rel="preload" as="style"') && ui.includes("display=optional") && !ui.includes("display=swap\" rel=\"stylesheet\""));
const home = readFileSync(join(root, "index.html"), "utf8");
t("home fonts do not block first paint", home.includes('rel="preload" as="style"') && home.includes("display=optional") && !home.includes("display=swap"));
t("chart script is not in the head", !ui.includes("<script>${CHART_JS}\\n${QUICK_JS}</script>"));
t("search index starts on focus, not on load", ui.includes('addEventListener("focus"') && ui.includes("/data/feed/search/manifest.json"));
t("hero data is preloaded", ui.includes('rel="preload" href="/data/feed/meta.json"') && ui.includes('rel="preload" href="/data/feed/browse.json"'));

const KB = 1024;
const budgets = { "src/ui.mjs": 520 * KB };
for (const [file, max] of Object.entries(budgets)) {
  const n = readFileSync(join(root, file)).length;
  t(`${file} under ${Math.round(max / KB)} KB (is ${Math.round(n / KB)} KB)`, n <= max);
}

if (fail) { console.log(`perf-budget: ${fail} failed`); process.exit(1); }
console.log("perf-budget ok");
