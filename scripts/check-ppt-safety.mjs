// Equivalent of Catchem-data scripts/check-ppt-safety.mjs for this repo.
// The data-repo check looks for a private PPT push and raw PPT price keys in
// tracked JSON. This tree has no PPT dump. It fails closed if one is committed,
// and if the public copy brings back the lines this pass removed.
import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { promisify } from "node:util";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const exec = promisify(execFile);
const KEYS = ["pptSold", "pptPrice", "backcalcPrice", "rawPpt", "sellerKeeps", "buyerPays"];
const COPY = ["Know what to rip", "sells for", "about 0", "paper-rows.json"];

const { stdout } = await exec("git", ["ls-files"], { cwd: ROOT });
const tracked = stdout.split("\n").filter(Boolean);
const reasons = [];
for (const rel of tracked) {
  if (rel.includes("node_modules")) continue;
  let body = "";
  try { body = await readFile(join(ROOT, rel), "utf8"); } catch { continue; }
  if (rel.endsWith(".json")) {
    for (const key of KEYS) if (body.includes('"' + key + '"')) reasons.push(rel + " has " + key);
  }
  if ((rel === "index.html" || rel.startsWith("src/")) && /\.(html|mjs|js|css)$/.test(rel)) {
    for (const line of COPY) if (body.includes(line)) reasons.push(rel + " has " + JSON.stringify(line));
  }
}
if (reasons.length) {
  console.error(reasons.join("\n"));
  process.exit(1);
}
console.log("ppt safety ok");
