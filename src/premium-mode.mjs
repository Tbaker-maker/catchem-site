// One switch for Premium. Only the exact word "live" opens checkout.
// Anything else, including unset, is the waitlist.

export function premiumMode(env) {
  const raw = String(env?.PREMIUM_MODE ?? "").trim().toLowerCase();
  return raw === "live" ? "live" : "waitlist";
}

export function isWaitlist(env) {
  return premiumMode(env) !== "live";
}

// A waitlist response must not render a checkout. "Join the Premium waitlist"
// is the signup button and is not the "Join Premium" checkout label.
export function checkoutLeak(html) {
  const s = String(html || "");
  if (/checkout\.stripe\.com/i.test(s)) return "checkout.stripe.com";
  if (/buy\.stripe\.com/i.test(s)) return "buy.stripe.com";
  if (/>\s*Get Premium\s*</i.test(s)) return "Get Premium";
  if (/>\s*Checkout\s*</i.test(s)) return "Checkout";
  if (/>\s*Join Premium\s*</i.test(s)) return "Join Premium";
  return "";
}

const PRICE = "$14.99/month when we open";

export function rewriteHomeClub(html) {
  const block = `<section class="club" aria-label="Catch'em Club">
  <h2>Join the Catch'em Club</h2>
  <p class="club-line">${PRICE}.</p>
  <ul class="perks">
    <li><span>Premium reads in Discord</span></li>
    <li><span>Watchlist pings, up to 25</span></li>
    <li><span>Members-only Discord channels</span></li>
  </ul>
  <p class="club-free">All site tools stay free.</p>
  <div class="club-actions">
    <a class="btn btn-primary" href="/premium">Join the Premium waitlist</a>
    <a class="btn btn-ghost" href="https://discord.gg/fUSjxDX4Hy" rel="noopener">Join Discord</a>
  </div>
</section>`;
  return String(html || "").replace(/<section class="club"[\s\S]*?<\/section>/, block);
}

// Point the Premium tab at /premium. Leave "Join Discord" and other invites alone.
export function pointPremiumTab(html) {
  let out = String(html || "");
  out = out.replace(/href="https:\/\/discord\.gg\/fUSjxDX4Hy"([^>]*)>\s*Discord Premium/g, 'href="/premium"$1>Discord Premium');
  out = out.replace(/href="https:\/\/discord\.gg\/fUSjxDX4Hy"([^>]*)>(\s*<svg[\s\S]*?<\/svg>\s*<span>Premium<\/span>)/g, 'href="/premium"$1>$2');
  return out;
}

export function paintPublicHtml(html, pathname, env) {
  if (!isWaitlist(env)) return String(html || "");
  const path = String(pathname || "");
  const home = path === "/" || path === "";
  const next = home ? rewriteHomeClub(html) : html;
  return pointPremiumTab(next);
}

export function premiumPlainLine(mode = "waitlist") {
  if (mode === "live") {
    return "Premium reads in Discord, watchlist pings, and members-only channels. $14.99 USD a month. All site tools stay free. https://catchemtcg.com/premium";
  }
  return `Premium reads in Discord, watchlist pings, and members-only channels. ${PRICE}. All site tools stay free. https://catchemtcg.com/premium`;
}

export function premiumEmailBlock(mode = "waitlist") {
  const live = mode === "live";
  const label = live ? "See Premium" : "Join the Premium waitlist";
  const price = live ? "$14.99 USD a month." : `${PRICE}.`;
  const copy = `Premium reads in Discord, watchlist pings, and members-only channels. ${price} All site tools stay free.`;
  return `<tr><td style="padding:8px 0"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="ce-card" bgcolor="#ffffff" style="background:#ffffff;border-radius:16px"><tr><td style="padding:16px 16px 18px">
<p class="ce-ink" style="margin:0 0 12px;font:600 16px/1.4 -apple-system,BlinkMacSystemFont,sans-serif;color:#1c1c1e">${copy}</p>
<a href="https://catchemtcg.com/premium" class="ce-btn-dark" style="display:inline-block;min-height:44px;line-height:44px;padding:0 18px;border-radius:999px;background:#1c1c1e;color:#ffffff;font:600 15px/44px -apple-system,BlinkMacSystemFont,sans-serif;text-decoration:none">${label}</a>
</td></tr></table></td></tr>`;
}
