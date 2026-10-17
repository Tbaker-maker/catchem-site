import { heroToday } from "../src/ui.mjs";
import { readFileSync } from "node:fs";
let fail = 0; const t = (n, ok) => { console.log((ok ? "ok   " : "FAIL ") + n); if (!ok) fail++; };
const h = heroToday({ asOf: "2026-10-16", lines: [{ slot: "mover", text: "Eevee went from $11.17 NM to $44.54 NM.", href: "/c/tcgcsv-180459" }] });
t("hero shows what you get and a live read", h.includes("What you get") && h.includes("Latest read, Oct 16") && h.includes("/c/tcgcsv-180459"));
t("hero hides when there is nothing", !heroToday({}).includes("class=\"hx-read\""));
t("home makes no raffle claim", !/raffle/i.test(readFileSync(new URL("../index.html", import.meta.url), "utf8")));
if (fail) process.exit(1);
