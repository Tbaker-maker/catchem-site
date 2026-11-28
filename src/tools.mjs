// Tools hub. Only pages the worker already answers. /explore is left out:
// TF_EXPLORE defaults off, and pageKind does not classify /explore, so that
// path 404s on this branch. No cards for tools that are not routed yet.

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => {
    if (c === "&") return "&" + "amp;";
    if (c === "<") return "&" + "lt;";
    if (c === ">") return "&" + "gt;";
    if (c === '"') return "&" + "quot;";
    return "&" + "#39;";
  });
}

export const TOOLS = [
  {
    href: "/heatmap",
    title: "Sealed Market Pulse",
    line: "Sealed month changes, dated.",
  },
  {
    href: "/reads",
    title: "Your reads",
    line: "Dated reads on cards, sets, and sealed you follow.",
  },
  {
    href: "/releases",
    title: "Release calendar",
    line: "Upcoming Pokémon TCG releases with a confirmed date and source.",
  },
];

const CSS = `
body{margin:0;background:#12100e;color:#efe9de;font:16px/1.45 "IBM Plex Sans",system-ui,sans-serif}
main{max-width:32rem;margin:0 auto;padding:24px 16px 48px;display:flex;flex-direction:column;gap:12px}
.mark{margin:0;font:600 26px/1 Fraunces,Georgia,serif;letter-spacing:-.03em}
.mark span{color:#d9b779}
h1{margin:0;font:600 34px/1.15 Fraunces,Georgia,serif}
.lead{margin:0 0 4px;color:#c4baab}
.tools{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:12px}
.tools a{display:flex;flex-direction:column;justify-content:center;gap:4px;min-height:44px;padding:14px 16px;border-radius:18px;background:#1a1815;border:1px solid #2f2b26;color:#efe9de;text-decoration:none}
.tools a:focus-visible{outline:2px solid #d9b779;outline-offset:3px}
.tools strong{color:#d9b779;font:600 18px/1.3 "IBM Plex Sans",system-ui,sans-serif}
.tools span{font:400 15px/1.4 "IBM Plex Sans",system-ui,sans-serif}
.affiliation{margin:0 0 8px;color:#c4baab;font-size:13px}
footer{max-width:32rem;margin:0 auto;padding:0 16px 32px}
@media (min-width:1280px){
  main{padding-top:48px}
  .tools{flex-direction:column}
}
`.trim();

export function renderToolsPage() {
  const items = TOOLS.map((row) => `<li><a class="tool" href="${esc(row.href)}"><strong>${esc(row.title)}</strong><span>${esc(row.line)}</span></a></li>`).join("");
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="description" content="A short list of Catch'em pages that already work."><title>Tools · Catch'em</title><style>${CSS}</style></head><body><main id="main"><p class="mark">Catch'em<span>.</span></p><h1>Tools</h1><p class="lead">Pages that already work.</p><ul class="tools">${items}</ul></main></body></html>`;
}
