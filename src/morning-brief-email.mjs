// Opt-in Morning Brief email. Sending stays OFF until MORNING_BRIEF_EMAIL=on
// and a mail key is present. Do not sign up for a paid provider from this code.
// Reuses the same Resend HTTP shape as reads-email when armed. Never logs keys.

import { validEmail, maskEmail, EMAIL_FROM, EMAIL_KEY, emailSendAllowed } from "./reads-email.mjs";
import { morningBrief, normalizeGoal, defaultGoal, goalLabel } from "./smart-collection.mjs";
import { isClean } from "./advice-rules.mjs";

export const BRIEF_EMAIL_FLAG = "MORNING_BRIEF_EMAIL";
export const BRIEF_EMAIL_KV_PREFIX = "morning-brief-email:";

export function morningBriefEmailArmed(env) {
  const flag = String(env?.[BRIEF_EMAIL_FLAG] || "").trim().toLowerCase();
  if (flag !== "on" && flag !== "1" && flag !== "true") return false;
  return emailSendAllowed(env);
}

export function briefEmailKey(discordId) {
  const id = String(discordId || "").replace(/^d:/, "");
  return /^\d{5,25}$/.test(id) ? `${BRIEF_EMAIL_KV_PREFIX}${id}` : "";
}

export function normalizeBriefEmailPrefs(raw) {
  const email = validEmail(raw?.email);
  return {
    optIn: raw?.optIn === true && !!email,
    email,
    goal: normalizeGoal(raw?.goal) || "",
    updatedAt: String(raw?.updatedAt || ""),
  };
}

export function buildMorningBriefEmail({ day, brief, origin = "https://catchemtcg.com" }) {
  const label = brief?.label || goalLabel(brief?.goal) || "Collecting";
  const sections = Array.isArray(brief?.sections) ? brief.sections : [];
  const lines = [];
  for (const sec of sections.slice(0, 6)) {
    if (!sec) continue;
    let bit = String(sec.title || "").trim();
    if (sec.id === "moved" && sec.rows?.[0]) {
      const r = sec.rows[0];
      bit += `: ${r.name || r.id} ${(r.pct > 0 ? "+" : "")}${r.pct}%`;
    } else if ((sec.id === "gaps" || sec.id === "cost") && sec.closest) {
      const c = sec.closest;
      bit += `: ${c.name} ${c.have}/${c.total}`;
      if (sec.id === "cost" && c.cost > 0) bit += `, cost to finish $${Number(c.cost).toFixed(2)}`;
    } else if ((sec.id === "cheapest" || sec.id === "rarest") && sec.rows?.[0]) {
      bit += `: ${sec.rows[0].name}`;
    } else if (sec.id === "cashout" && sec.cashout?.gross > 0) {
      bit += `: modeled net $${Number(sec.cashout.net).toFixed(2)}`;
    } else if (sec.id === "liquidity" && sec.rows?.[0]) {
      const r = sec.rows[0];
      bit += `: ${r.name}${r.listings != null ? `, listings counted ${r.listings}` : ""}`;
    } else if (sec.id === "reads" && sec.rows?.[0]) {
      bit += `: ${sec.rows[0].headline || sec.rows[0].name || ""}`;
    } else if (sec.empty) {
      bit += `: ${sec.empty}`;
    }
    bit = bit.replace(/[\u2013\u2014]/g, "-").trim();
    if (bit && isClean(bit)) lines.push(bit);
  }
  const subjectDay = String(day || "").trim();
  const subject = subjectDay ? `Your Catch'em Morning Brief, ${subjectDay}` : "Your Catch'em Morning Brief";
  const open = `${origin}/collection`;
  const text = [
    `Morning Brief · ${label}`,
    "",
    ...lines,
    "",
    `Open your collection: ${open}`,
    "",
    "You opted in to this email. Turn it off on My collection.",
  ].join("\n");
  const htmlLines = lines.map((l) => `<li>${escapeHtml(l)}</li>`).join("");
  const html = `<!doctype html><html><body style="font-family:IBM Plex Sans,Helvetica,Arial,sans-serif;background:#12100e;color:#f5f0e8;padding:24px">
<h1 style="font-family:Fraunces,Georgia,serif;font-weight:600">Morning Brief</h1>
<p style="opacity:.8">${escapeHtml(label)}</p>
<ul>${htmlLines || "<li>Add items to fill this brief.</li>"}</ul>
<p><a href="${escapeHtml(open)}" style="color:#d4a017">Open My collection</a></p>
<p style="opacity:.7;font-size:13px">You opted in to this email. Turn it off on My collection.</p>
</body></html>`;
  return { subject, text, html, lines };
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (ch) => {
    if (ch === "&") return "&" + "amp;";
    if (ch === "<") return "&" + "lt;";
    if (ch === ">") return "&" + "gt;";
    if (ch === '"') return "&" + "quot;";
    return "&#39;";
  });
}

export async function saveBriefEmailPrefs(store, discordId, prefs) {
  const key = briefEmailKey(discordId);
  if (!store || !key) return { ok: false, error: "no-store" };
  const next = normalizeBriefEmailPrefs(prefs);
  next.updatedAt = new Date().toISOString();
  await store.put(key, JSON.stringify(next));
  return { ok: true, prefs: { ...next, email: maskEmail(next.email) } };
}

export async function readBriefEmailPrefs(store, discordId) {
  const key = briefEmailKey(discordId);
  if (!store || !key) return normalizeBriefEmailPrefs({});
  const raw = await store.get(key, "json");
  return normalizeBriefEmailPrefs(raw || {});
}

/** Send one brief. No-ops unless morningBriefEmailArmed(env). Never throws the key. */
export async function sendMorningBriefEmail({ env, to, brief, day, fetchImpl = fetch }) {
  if (!morningBriefEmailArmed(env)) {
    return { ok: false, skipped: true, reason: "flag-off" };
  }
  const email = validEmail(to);
  if (!email) return { ok: false, skipped: true, reason: "bad-email" };
  const built = buildMorningBriefEmail({ day, brief });
  const key = String(env?.[EMAIL_KEY] || "").trim();
  if (!key) return { ok: false, skipped: true, reason: "no-key" };
  const res = await fetchImpl("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      authorization: `Bearer ${key}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      from: EMAIL_FROM,
      to: [email],
      subject: built.subject,
      text: built.text,
      html: built.html,
    }),
  });
  if (!res.ok) return { ok: false, skipped: false, reason: "provider", status: res.status };
  return { ok: true, skipped: false, subject: built.subject };
}

export function goLiveChecklist() {
  return [
    "Reuse the existing Custom Reads mail key on the worker. Do not open a new paid mail plan without approval.",
    "Set MORNING_BRIEF_EMAIL=on on the catchem-site Worker. Default stays off.",
    "Confirm the Catch'em From address is verified on the mail provider.",
    "Add a daily job that reads opt-in KV rows and calls sendMorningBriefEmail for each one.",
    "Keep the opt-in toggle on My collection. Sending stays skipped while the flag is off.",
  ];
}

export async function handleBriefEmailStatus(request, env) {
  const headers = { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" };
  const armed = morningBriefEmailArmed(env);
  // Prefs for signed-in users are loaded via /api/me brief-email; this route reports flag state.
  // Optional: if Authorization cookie present, caller can pass ? via member. Keep this public flag-only.
  return new Response(JSON.stringify({ ok: true, armed, flag: BRIEF_EMAIL_FLAG, goLive: goLiveChecklist() }), { status: 200, headers });
}
