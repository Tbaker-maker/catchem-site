import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { neutralizeCopy, writePublicRoutes } from "./public-routes.mjs";

let fail = 0;
const t = (name, cond) => {
  if (cond) console.log("  ok ", name);
  else { fail++; console.log("  FAIL", name); }
};

t("Demand replaces Buy Pressure", neutralizeCopy("Buy Pressure est.") === "Demand est.");
t("HEAT replaces BULLISH", neutralizeCopy("BULLISH·long") === "HEAT·long");
t("heat replaces bullish", !neutralizeCopy("not bullish").includes("bullish"));

const dir = await mkdtemp(join(tmpdir(), "routes-"));
await writeFile(join(dir, "pulse.html"), "<h1>Pulse</h1><p>Buy Pressure</p><b>BULLISH</b>");
await writeFile(join(dir, "index.html"), "<h1>what to buy, and what to hold</h1>");
const written = await writePublicRoutes(dir);
t("writes the six route files", written.length === 6);
for (const rel of ["feed.html", "feed/index.html", "try.html", "try/index.html", "app.html", "app/index.html"]) {
  const html = await readFile(join(dir, rel), "utf8");
  t(`${rel} is the feed`, html.includes("Pulse") && !html.includes("Buy Pressure") && !html.includes("BULLISH"));
}
const pulse = await readFile(join(dir, "pulse.html"), "utf8");
t("pulse itself is neutralized", pulse.includes("Demand") && pulse.includes("HEAT"));
await rm(dir, { recursive: true, force: true });
if (fail) process.exit(1);
console.log("public routes ok");
