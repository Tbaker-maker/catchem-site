// Build newsletter/out/preview.html from a week file (default: newsletter/sample-week.json).
//   node newsletter/build.mjs [week.json]
// Node builtins only. Incomplete rows are dropped, never filled in.
//
// Sample vs real: a week file with "sample": true must mark every price SAMPLE and
// may leave the CASL mailing address empty (a loud placeholder is rendered).
// Any other week file is a real send: prices must NOT say SAMPLE, and
// newsletter/config.json "mailingAddress" must be filled in or the build fails.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));

const BANNED = /\b(crypto|nft|nfts|token|tokens|protocol|buyback|investment)\b/i;
// "mint" is a card condition word (Near Mint, Gem Mint, Mint condition, PSA 10 Gem Mint).
// Those phrases are allowed; any other "mint"/"minting"/"minted" is treated as crypto usage.
const MINT_OK = /\b(?:near[\s-]+mint|gem[\s-]+mint|mint[\s-]+condition|mint\/near[\s-]+mint)\b/gi;
const MINT_BAD = /\bmint(?:s|ed|ing)?\b/i;
export const ADDRESS_PLACEHOLDER = "[CASL MAILING ADDRESS REQUIRED BEFORE ANY REAL SEND: set mailingAddress in newsletter/config.json]";

export function isBanned(s) {
  const t = String(s ?? "");
  if (BANNED.test(t)) return true;
  return MINT_BAD.test(t.replace(MINT_OK, " "));
}

function esc(s) {
  return String(s)
    .replace(/&/g, "&" + "amp;")
    .replace(/</g, "&" + "lt;")
    .replace(/>/g, "&" + "gt;")
    .replace(/"/g, "&" + "quot;");
}

function clean(s) {
  const t = String(s ?? "").trim();
  if (!t || isBanned(t)) return "";
  return t;
}

let SAMPLE_MODE = true;

function priceLine(item) {
  const price = clean(item?.price);
  const asOf = clean(item?.asOf);
  if (!price || !asOf) return "";
  // Sample weeks must say SAMPLE on every price; real weeks must never carry sample prices.
  if (SAMPLE_MODE !== /SAMPLE/i.test(price)) return "";
  return `${esc(price)} · as of ${esc(asOf)}`;
}

function playBlock(play) {
  const name = clean(play?.name);
  const call = clean(play?.call);
  const image = clean(play?.image);
  const confidence = clean(play?.confidence);
  const price = priceLine(play);
  if (!name || !call || !image || !confidence || !price) return "";
  if (name === call || name === confidence || call === confidence) return "";
  return `
        <tr>
          <td style="padding:0 28px 8px;font-family:Georgia,'Times New Roman',serif;font-size:22px;line-height:1.2;color:#efe9de;">The Play</td>
        </tr>
        <tr>
          <td style="padding:0 28px 22px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td width="92" valign="top" style="width:92px;padding-right:16px;">
                  <img src="${esc(image)}" width="76" alt="" style="display:block;width:76px;height:auto;border:0;border-radius:6px;">
                </td>
                <td valign="top" style="font-family:Arial,Helvetica,sans-serif;">
                  <div style="font-family:Georgia,'Times New Roman',serif;font-size:20px;line-height:1.25;color:#efe9de;">${esc(name)}</div>
                  <div style="padding-top:6px;font-size:16px;line-height:1.4;color:#D8B878;">${esc(call)}</div>
                  <div style="padding-top:8px;font-size:15px;line-height:1.4;color:#efe9de;">${price}</div>
                  <div style="padding-top:4px;font-size:14px;line-height:1.4;color:#b3aa9c;">${esc(confidence)}</div>
                </td>
              </tr>
            </table>
          </td>
        </tr>`;
}

function cardBlock(card) {
  const headline = clean(card?.headline);
  const why = clean(card?.why);
  const image = clean(card?.image);
  const price = priceLine(card);
  if (!headline || !why || !image || !price) return "";
  if (headline === why) return "";
  return `
        <tr>
          <td style="padding:0 28px 16px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#1a1815;border:1px solid #2f2b26;border-radius:10px;">
              <tr>
                <td width="84" valign="top" style="width:84px;padding:14px 0 14px 14px;">
                  <img src="${esc(image)}" width="64" alt="" style="display:block;width:64px;height:auto;border:0;border-radius:4px;">
                </td>
                <td valign="top" style="padding:14px 14px 14px 12px;font-family:Arial,Helvetica,sans-serif;">
                  <div style="font-family:Georgia,'Times New Roman',serif;font-size:18px;line-height:1.25;color:#efe9de;">${esc(headline)}</div>
                  <div style="padding-top:4px;font-size:14px;line-height:1.45;color:#b3aa9c;">${esc(why)}</div>
                  <div style="padding-top:8px;font-size:14px;line-height:1.4;color:#D8B878;">${price}</div>
                </td>
              </tr>
            </table>
          </td>
        </tr>`;
}

function giveawayBlock(g) {
  const headline = clean(g?.headline);
  const line = clean(g?.line);
  if (!headline || !line || headline === line) return "";
  return `
        <tr>
          <td style="padding:8px 28px 24px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-top:1px solid #2f2b26;">
              <tr>
                <td style="padding-top:20px;font-family:Georgia,'Times New Roman',serif;font-size:22px;line-height:1.2;color:#efe9de;">${esc(headline)}</td>
              </tr>
              <tr>
                <td style="padding-top:8px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.5;color:#b3aa9c;">${esc(line)}</td>
              </tr>
            </table>
          </td>
        </tr>`;
}

export function render(week, tpl, config = {}) {
  SAMPLE_MODE = week?.sample === true;
  const address = String(config?.mailingAddress ?? "").trim();
  if (!SAMPLE_MODE && !address) {
    throw new Error("mailingAddress is empty in newsletter/config.json. CASL requires a mailing address in every real send.");
  }
  const cards = (Array.isArray(week.cards) ? week.cards : [])
    .map(cardBlock)
    .filter(Boolean)
    .slice(0, 7);
  if (cards.length < 5) {
    throw new Error(`need 5 to 7 feed cards, got ${cards.length}`);
  }

  const play = playBlock(week.play);
  if (!play) throw new Error("The Play is missing a field");
  const giveaway = giveawayBlock(week.giveaway);
  if (!giveaway) throw new Error("giveaway is missing a field");
  const weekOf = clean(week.weekOf);
  if (!weekOf) throw new Error("weekOf is missing");

  const html = tpl
    .replace("{{WEEK_OF}}", esc(weekOf))
    .replace("{{PLAY}}", play)
    .replace("{{CARDS}}", cards.join("\n"))
    .replace("{{GIVEAWAY}}", giveaway)
    .replace("{{MAILING_ADDRESS}}", esc(address || ADDRESS_PLACEHOLDER));

  if (html.includes("{{")) {
    const left = html.match(/\{\{[A-Z_]+\}\}/g) || [];
    const allowed = left.filter((t) => t !== "{{unsubscribe_url}}");
    if (allowed.length) throw new Error("unfilled placeholders: " + allowed.join(", "));
  }
  if (!html.includes("{{unsubscribe_url}}")) throw new Error("unsubscribe token was removed");
  if (!html.includes("https://discord.gg/fUSjxDX4Hy")) throw new Error("discord link missing");
  if (isBanned(html.replace(/\{\{unsubscribe_url\}\}/g, ""))) throw new Error("banned wording in the email");
  return { html, cards: cards.length, sample: SAMPLE_MODE };
}

function main() {
  const weekPath = resolve(process.argv[2] || join(root, "sample-week.json"));
  const week = JSON.parse(readFileSync(weekPath, "utf8"));
  const tpl = readFileSync(join(root, "template.html"), "utf8");
  const config = JSON.parse(readFileSync(join(root, "config.json"), "utf8"));
  const { html, cards, sample } = render(week, tpl, config);
  const outDir = join(root, "out");
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, "preview.html"), html);
  console.log(`wrote ${cards} cards${sample ? " (SAMPLE)" : ""}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) main();
