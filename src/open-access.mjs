// One reversible switch for paid features. Default on: every visitor gets
// the full experience (factor bars, full watchlists, deep and daily reads,
// and the 25-follow cap). Stripe checkout code stays in the repo and is
// unused while this is on. Set OPEN_ACCESS=false, 0, or off to restore the
// old gates. (Tyler, Nov 11 2026: nothing gated, all plan prices removed.)

export const FOLLOW_CAP = 25;

export function openAccess(env) {
  const raw = String(env?.OPEN_ACCESS ?? "true").trim().toLowerCase();
  return raw !== "false" && raw !== "0" && raw !== "off";
}

// True when this visitor should get paid features.
// Default (no env, no explicit flag) is open.
export function entitled(opts = {}) {
  const premium = opts.premium === true || opts.user?.premium === true;
  if (opts.openAccess === false) return premium;
  if (opts.openAccess === true) return true;
  if (opts.env && Object.prototype.hasOwnProperty.call(opts.env, "OPEN_ACCESS")) {
    return openAccess(opts.env) || premium;
  }
  return true;
}

// Product names and the "usual premium" ratio are not plan copy.
const ALLOW_PREMIUM = /ultra-?premium|premium collection|usual premium|collection file premium|premium ratio/i;

export function visibleText(html) {
  return String(html || "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function withoutAllowedPremium(text) {
  return String(text || "").replace(ALLOW_PREMIUM, " ");
}

// Returns the first plan-price or Premium-membership hit in visible copy, or "".
export function paywallHit(html) {
  const text = withoutAllowedPremium(visibleText(html));
  const raw = String(html || "");
  if (/\$14\.99/.test(text) || /\$14\.99/.test(raw)) return "$14.99";
  if (/\$9(?:\.00)?\s*(?:\/\s*mo(?:nth)?|a month|per month)/i.test(text) || /\$9(?:\.00)?\s*(?:\/\s*mo(?:nth)?|a month|per month)/i.test(raw)) return "$9";
  if (/\bGet Premium\b/i.test(text)) return "Get Premium";
  if (/\bSee Premium\b/i.test(text)) return "See Premium";
  if (/\bJoin the Premium waitlist\b/i.test(text)) return "Join the Premium waitlist";
  if (/\bSee it with Premium\b/i.test(text)) return "See it with Premium";
  if (/\bare in Premium\b/i.test(text)) return "are in Premium";
  if (/\buntil Premium\b/i.test(text)) return "until Premium";
  if (/\bDiscord Premium\b/i.test(text)) return "Discord Premium";
  if (/\bCatch'em Premium\b/i.test(text)) return "Catch'em Premium";
  if (/\bPremium waitlist\b/i.test(text)) return "Premium waitlist";
  if (/\bPremium shows all\b/i.test(text)) return "Premium shows all";
  if (/\bPremium gets\b/i.test(text)) return "Premium gets";
  if (/\bin Premium\b/i.test(text)) return "in Premium";
  if (/\bwith Premium\b/i.test(text)) return "with Premium";
  // A standalone membership "Premium" label (nav, kicker, dock).
  if (/(^| )Premium( |$)/.test(text) || /(^| )Premium ·/.test(text)) return "Premium";
  if (/href="\/premium"/i.test(raw) && !/class="hp"/.test(raw)) {
    // Links to the old plan page should not appear in chrome or CTAs.
    if (/href="\/premium"[^>]*>\s*(<[^>]+>\s*)*Premium/i.test(raw)) return "href=/premium Premium";
    if (/href="\/premium"/i.test(raw) && /Join the|See it|See Premium|Get Premium|waitlist/i.test(text)) {
      return "href=/premium";
    }
  }
  return "";
}

// Strip plan CTAs from the baked homepage and any other public HTML.
export function paintOpenAccessHtml(html) {
  let out = String(html || "");
  out = out.replace(/<section class="club"[\s\S]*?<\/section>\s*/g, "");
  out = out.replace(/>\s*Discord Premium\s*</g, ">Discord<");
  // Dock or nav tab labeled Premium (discord invite or /premium).
  out = out.replace(/<a href="https:\/\/discord\.gg\/fUSjxDX4Hy"[^>]*>\s*<svg[\s\S]*?<\/svg>\s*<span>Premium<\/span>\s*<\/a>/g, "");
  out = out.replace(/<a href="\/premium"[^>]*>\s*(?:<svg[\s\S]*?<\/svg>\s*)?<span>Premium<\/span>\s*<\/a>/g, "");
  out = out.replace(/<a href="\/premium"[^>]*>\s*Premium\s*<\/a>/g, "");
  out = out.replace(/<a class="btn btn-primary" href="\/premium">[^<]*<\/a>\s*/g, "");
  return out;
}
