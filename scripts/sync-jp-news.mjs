// Copy Catchem-data rules/jp-news.json into src/jp-news-rules.mjs.
// Usage: node scripts/sync-jp-news.mjs [path-or-url]
import { readFile, writeFile } from "node:fs/promises";

export const RULES_URL = "https://raw.githubusercontent.com/Tbaker-maker/Catchem-data/main/rules/jp-news.json";
export const HEADER = [
  "// Copy of Catchem-data rules/jp-news.json. Do not edit here.",
  "// Change it in Catchem-data, then run: node scripts/sync-jp-news.mjs",
  "// scripts/jp-news.test.mjs fails when this drifts from Catchem-data main.",
].join("\n");

export const toModule = (json) => `${HEADER}\nexport default ${json.replace(/\n$/, "")};\n`;

if (process.argv[1] && process.argv[1].endsWith("sync-jp-news.mjs")) {
  const from = process.argv[2] || RULES_URL;
  const json = /^https?:/.test(from) ? await (await fetch(from)).text() : await readFile(from, "utf8");
  JSON.parse(json);
  await writeFile(new URL("../src/jp-news-rules.mjs", import.meta.url), toModule(json));
  console.log(`synced src/jp-news-rules.mjs from ${from}`);
}
