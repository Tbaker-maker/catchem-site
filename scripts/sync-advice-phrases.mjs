// Copy the shared copy checker from Catchem-data into this repo.
//   rules/advice-phrases.json     -> src/advice-phrases.mjs and vendor/video/advice-phrases.mjs
//   scripts/lib/advice-intent.mjs -> src/advice-intent.mjs and vendor/video/advice-intent.mjs (byte for byte)
//   rules/advice-cases.json       -> scripts/advice-cases.json (the labelled test set)
// Usage: node scripts/sync-advice-phrases.mjs [Catchem-data folder or raw base url]
import { readFile, writeFile } from "node:fs/promises";

export const BASE_URL = "https://raw.githubusercontent.com/Tbaker-maker/Catchem-data/main/";
export const RULES_URL = `${BASE_URL}rules/advice-phrases.json`;
export const ENGINE_URL = `${BASE_URL}scripts/lib/advice-intent.mjs`;
export const CASES_URL = `${BASE_URL}rules/advice-cases.json`;
export const HEADER = [
  "// Copy of Catchem-data rules/advice-phrases.json. Do not edit here.",
  "// Change it in Catchem-data, then run: node scripts/sync-advice-phrases.mjs",
  "// scripts/advice-rules.test.mjs fails when this drifts from Catchem-data main.",
].join("\n");

export const toModule = (json) => `${HEADER}\nexport default ${json.replace(/\n$/, "")};\n`;

if (process.argv[1] && process.argv[1].endsWith("sync-advice-phrases.mjs")) {
  const from = (process.argv[2] || BASE_URL).replace(/\/?$/, "/");
  const get = async (p) => (/^https?:/.test(from) ? (await fetch(from + p)).text() : readFile(from + p, "utf8"));
  const json = await get("rules/advice-phrases.json");
  const engine = await get("scripts/lib/advice-intent.mjs");
  const cases = await get("rules/advice-cases.json");
  JSON.parse(json);
  JSON.parse(cases);
  const out = (p, s) => writeFile(new URL(p, import.meta.url), s);
  await out("../src/advice-phrases.mjs", toModule(json));
  await out("../src/advice-intent.mjs", engine);
  await out("./advice-cases.json", cases);
  // The video studio runs in the browser from /video, so it carries its own copy of each file.
  await out("../vendor/video/advice-phrases.mjs", toModule(json));
  await out("../vendor/video/advice-intent.mjs", engine);
  await out("../vendor/video/advice-rules.mjs", await readFile(new URL("../src/advice-rules.mjs", import.meta.url), "utf8"));
  console.log(`synced the copy checker from ${from}`);
}
