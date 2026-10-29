import { readFileSync } from "node:fs";
import { flagLine } from "../src/advice-rules.mjs";
import {
  parseCsv,
  mapCsvRow,
  matchCatalogue,
  previewImport,
  holdingsFromPreview,
  validSku,
} from "../src/collection-import.mjs";

let fail = 0;
const t = (name, ok) => { console.log((ok ? "ok   " : "FAIL ") + name); if (!ok) fail++; };

t("sku", validSku("tcgcsv-12") === "tcgcsv-12" && validSku("nope") === "");

const csv = `id,name,set,qty,condition,kind
tcgcsv-1,Alpha,Demo Set,2,LP,single
,Beta,Demo Set,1,,single
tcgcsv-9,Box NM,Demo Set,1,,sealed
bad,, ,1,,
`;
const parsed = parseCsv(csv);
t("parse headers", parsed.headers.includes("id") && parsed.headers.includes("name") && parsed.rows.length === 4);

const catalogue = [
  { sku: "tcgcsv-1", name: "Alpha", set: "Demo Set", setSlug: "demo-set", kind: "single", price: 10, asOf: "2026-10-28" },
  { sku: "tcgcsv-2", name: "Beta", set: "Demo Set", setSlug: "demo-set", kind: "single", price: 5, asOf: "2026-10-28" },
  { sku: "tcgcsv-9", name: "Box", set: "Demo Set", setSlug: "demo-set", kind: "sealed", price: 100, asOf: "2026-10-28", listings: 12, listingsAsOf: "2026-10-27" },
];

const mapped = mapCsvRow(parsed.headers, parsed.rows[0]);
t("map row", mapped.id === "tcgcsv-1" && mapped.qty === 2 && mapped.condition === "LP");

t("match by id", matchCatalogue({ id: "tcgcsv-1" }, catalogue)?.sku === "tcgcsv-1");
t("match by name+set fills slug", matchCatalogue({ name: "Beta", set: "Demo Set" }, catalogue)?.setSlug === "demo-set");

const preview = previewImport({ text: csv, catalogue });
t("preview accepts matches", preview.ok && preview.accepted === 3 && preview.rejected === 1);
t("sealed drops NM", preview.rows.some((r) => r.ok && r.holding.kind === "sealed" && r.holding.condition == null && !/\bNM\b/.test(r.holding.name)));
t("setSlug filled", preview.rows.filter((r) => r.ok).every((r) => r.holding.setSlug === "demo-set"));
t("preview note", /Preview only/i.test(preview.note));

const holdings = holdingsFromPreview(preview);
t("holdings from preview", holdings.length === 3 && holdings[0].id === "tcgcsv-1");

const src = readFileSync(new URL("../src/collection-import.mjs", import.meta.url), "utf8");
t("no em dash", !/[\u2013\u2014]/.test(src));
t("no sold claim", !/\bsold\b/i.test(src));
for (const line of [preview.note, "No catalogue match.", "Missing id or name."]) {
  t("advice clean: " + line, flagLine(line).length === 0);
}

if (fail) { console.error(fail + " failed"); process.exit(1); }
console.log("collection-import tests passed");
