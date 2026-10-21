import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { freshLabel, newestStamp } from "../src/ui.mjs";

// Root cause (Oct 21): updatedAt came from the eBay sealed file, stuck at Oct 19 while asOf was Oct 21.
assert.equal(freshLabel("2026-10-19T10:25:33.157Z", "2026-10-21"), "Updated Oct 21");
assert.equal(freshLabel("2026-10-21T15:00:00Z", "2026-10-21"), "Updated Oct 21, 8:00 AM PT");
assert.equal(freshLabel("", "2026-10-21"), "Updated Oct 21");
assert.equal(freshLabel(null, undefined), "");
assert.equal(newestStamp("2026-10-19T10:00:00Z", "2026-10-21", "2026-10-20").raw, "2026-10-21");
// Gate: label day is never older than the newest published asOf.
for (const d of ["2026-10-20", "2026-10-21", "2026-12-31"]) {
  const lab = freshLabel("2026-10-01T00:00:00Z", d);
  const want = new Intl.DateTimeFormat("en-US", { timeZone: "America/Los_Angeles", month: "short", day: "numeric" }).format(new Date(`${d}T08:00:00Z`));
  assert.ok(lab.startsWith(`Updated ${want}`), lab);
  assert.ok(!/[\u2013\u2014]/.test(lab), "no dashes");
}
// Static home page must not use updatedAt alone.
const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
assert.ok(/ta>tu/.test(html), "index.html compares asOf with updatedAt");
console.log("home-updated ok");
