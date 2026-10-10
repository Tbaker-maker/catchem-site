import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { neutralizeCopy, writePublicRoutes } from "./public-routes.mjs";
import { AFFILIATION, TCGPLAYER_ATTRIBUTION, ensureAffiliation } from "../src/affiliation.mjs";

let fail = 0;
const t = (name, cond) => {
  if (cond) console.log("  ok ", name);
  else { fail++; console.log("  FAIL", name); }
};

t("Demand replaces Buy Pressure", neutralizeCopy("Buy Pressure est.") === "Demand est.");
t("HEAT replaces BULLISH", neutralizeCopy("BULLISH·long") === "HEAT·long");
t("HEAT replaces bullish", neutralizeCopy("not bullish") == "not HEAT");
t("a page with no footer gets one", ensureAffiliation("<h1>Pulse</h1>").includes(AFFILIATION));
t("every page carries the TCGplayer attribution once", ensureAffiliation("<h1>Pulse</h1>").includes(TCGPLAYER_ATTRIBUTION) && ensureAffiliation(`<footer><p>${AFFILIATION}</p><p>${TCGPLAYER_ATTRIBUTION}</p></footer>`).split(TCGPLAYER_ATTRIBUTION).length === 2);
t("a page that already says it is not duplicated", ensureAffiliation(`<footer><p>${AFFILIATION}</p></footer>`).split(AFFILIATION).length === 2);

const dir = await mkdtemp(join(tmpdir(), "routes-"));
await writeFile(join(dir, "pulse.html"), "<h1>Pulse</h1><p>Buy Pressure</p><b>BULLISH</b>");
await writeFile(join(dir, "index.html"), "<h1>what to buy, and what to hold</h1>");
const written = await writePublicRoutes(dir);
t("writes the six route files", written.length === 6);
for (const rel of ["feed.html", "feed/index.html"]) {
  const html = await readFile(join(dir, rel), "utf8");
  t(`${rel} is the feed`, html.includes("Pulse") && !html.includes("Buy Pressure") && !html.includes("BULLISH"));
}
for (const rel of ["try.html", "try/index.html", "app.html", "app/index.html"]) {
  const html = await readFile(join(dir, rel), "utf8");
  t(`${rel} redirects to the feed`, html.includes('url=/feed') && !html.includes("Pulse") && !html.includes("BULLISH"));
}
const pulse = await readFile(join(dir, "pulse.html"), "utf8");
t("pulse itself is neutralized", pulse.includes("Demand") && pulse.includes("HEAT") && pulse.includes(AFFILIATION));
await rm(dir, { recursive: true, force: true });
if (fail) process.exit(1);
console.log("public routes ok");
