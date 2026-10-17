// Copy Catchem-data rules/advice-phrases.json into src/advice-phrases.mjs.
// Usage: node scripts/sync-advice-phrases.mjs [path-or-url]
import { readFile, writeFile } from "node:fs/promises";

export const RULES_URL = "https://raw.githubusercontent.com/Tbaker-maker/Catchem-data/main/rules/advice-phrases.json";
export const HEADER = [
  "// Copy of Catchem-data rules/advice-phrases.json. Do not edit here.",
  "// Change it in Catchem-data, then run: node scripts/sync-advice-phrases.mjs",
  "// scripts/advice-rules.test.mjs fails when this drifts from Catchem-data main.",
].join("\n");

export const toModule = (json) => `${HEADER}\nexport default ${json.replace(/\n$/, "")};\n`;

if (process.argv[1] && process.argv[1].endsWith("sync-advice-phrases.mjs")) {
  const from = process.argv[2] || RULES_URL;
  const json = /^https?:/.test(from) ? await (await fetch(from)).text() : await readFile(from, "utf8");
  JSON.parse(json);
  await writeFile(new URL("../src/advice-phrases.mjs", import.meta.url), toModule(json));
  // The video studio runs in the browser from /video, so it carries its own copy of both files.
  await writeFile(new URL("../vendor/video/advice-phrases.mjs", import.meta.url), toModule(json));
  await writeFile(new URL("../vendor/video/advice-rules.mjs", import.meta.url), await readFile(new URL("../src/advice-rules.mjs", import.meta.url), "utf8"));
  console.log(`synced src/advice-phrases.mjs from ${from}`);
}
