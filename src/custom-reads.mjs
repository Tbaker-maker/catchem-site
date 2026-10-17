// Custom reads picker. Behind CUSTOM_READS_ENABLED. Discord fallback until sign-in lands.
import { DISCORD_INVITE } from "./auth.mjs";

export const CUSTOM_READS_ENABLED = false; // flip when sign-in from extra chat is live

export function customReadsPage(stamp = "") {
  if (!CUSTOM_READS_ENABLED) {
    return `<!doctype html><html><head><title>Custom reads</title><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0;background:#12100e;color:#efe9de;font:16px/1.5 system-ui;padding:40px 20px;text-align:center}a{color:#d9b779;min-height:44px;display:inline-flex;align-items:center;padding:0 20px;border-radius:999px;background:#1a1815;border:1px solid #2f2b26;text-decoration:none}</style></head><body><h1>Custom reads</h1><p>Sign-in is not live yet. Join Discord to get on the list.</p><a href="${DISCORD_INVITE}">Join Discord</a><p class="muted">Build ${stamp}</p></body></html>`;
  }
  // Full picker when enabled: point-and-click sets, products, singles/sealed, frequency, preview, Save.
  return `<!doctype html><html><head><title>Custom reads</title><meta name="viewport" content="width=device-width,initial-scale=1"><style>
body{margin:0;background:#12100e;color:#efe9de;font:16px/1.5 system-ui;padding:20px}
.tile{display:inline-flex;align-items:center;min-height:44px;padding:0 16px;margin:6px;border-radius:999px;background:#1a1815;border:1px solid #2f2b26;cursor:pointer}
.tile.on{background:#d9b779;color:#1a1407}
.preview{margin:20px 0;padding:16px;border-radius:18px;background:#1a1815;border:1px solid #2f2b26}
button{min-height:44px;padding:0 24px;border-radius:999px;background:#d9b779;color:#1a1407;border:none;font-weight:600;cursor:pointer}
</style></head><body>
<h1>Custom reads</h1>
<p>Pick what to follow. Smart defaults already on.</p>
<div id="sets"><span class="tile on" data-set="sv10">Destined Rivals</span><span class="tile" data-set="swsh12">Lost Origin</span></div>
<div id="kind"><span class="tile on" data-kind="both">Singles and sealed</span><span class="tile" data-kind="single">Singles</span><span class="tile" data-kind="sealed">Sealed</span></div>
<div id="freq"><span class="tile on" data-freq="weekly">Weekly</span><span class="tile" data-freq="daily">Daily</span><span class="tile" data-freq="monthly">Monthly</span></div>
<div class="preview" id="preview"><b>Sample read</b><p>Destined Rivals singles: 30-day median -4.2% (Oct 17). 12 listings counted on the top chase.</p></div>
<button id="save">Save</button>
<script>
const tiles = document.querySelectorAll(".tile");
tiles.forEach(t => t.onclick = () => { t.classList.toggle("on"); update(); });
function update() {
  const sets = [...document.querySelectorAll("#sets .on")].map(t => t.dataset.set);
  const kind = document.querySelector("#kind .on")?.dataset.kind || "both";
  const freq = document.querySelector("#freq .on")?.dataset.freq || "weekly";
  document.getElementById("preview").innerHTML = "<b>Sample read</b><p>" + (sets.join(", ") || "your picks") + " " + kind + " " + freq + ". Quiet days skipped.</p>";
}
document.getElementById("save").onclick = () => alert("Saved. Discord DM when ready.");
</script>
</body></html>`;
}
