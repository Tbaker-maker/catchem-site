import { infoTap } from "../src/ui.mjs";
let fail = 0; const t = (n, ok) => { console.log((ok ? "ok   " : "FAIL ") + n); if (!ok) fail++; };
const h = infoTap("TCGplayer market price, Oct 16");
t("info tap shows source and date", h.includes("TCGplayer market price, Oct 16") && h.includes("tabindex=\"0\""));
t("info tap is not a block element inside text", !h.includes("<details") && !h.includes("<div"));
if (fail) process.exit(1);
