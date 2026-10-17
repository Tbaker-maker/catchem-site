// The shared copy rules from Catchem-data rules/advice-phrases.json.
// Blocked: phrases that tell people what to do with money, crypto words, dashes.
// Always allowed: Buy, Shop, Sell your cards, price target, "Buy on TCGplayer", "Buy on eBay".
// A match flags the line with its reason. Nothing is rewritten.
import ADVICE from "./advice-phrases.mjs";

export { ADVICE };
export const ALLOWED = Object.freeze([...ADVICE.allowed]);
const COMPILED = ADVICE.rules.map((r) => ({ ...r, re: new RegExp(r.pattern, "i") }));
const escRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const LABELS = ALLOWED.filter((a) => /\s/.test(a)).sort((a, b) => b.length - a.length);
const LABEL_RE = LABELS.length ? new RegExp(LABELS.map(escRe).join("|"), "gi") : null;

// Every rule a line breaks: { line, phrase, rule, kind, reason }.
// skipKinds leaves out rule kinds, for example ["house"] when a check scans
// whole pages with code in them and dashes are checked on their own.
export function flagLine(input, { skipKinds = [] } = {}) {
  const line = String(input ?? "");
  if (!line.trim()) return [];
  const text = LABEL_RE ? line.replace(LABEL_RE, " ") : line;
  const flags = [];
  for (const r of COMPILED) {
    if (skipKinds.includes(r.kind)) continue;
    const m = text.match(r.re);
    if (m) flags.push({ line, phrase: m[0], rule: r.id, kind: r.kind, reason: r.reason });
  }
  return flags;
}

const clip = (s) => (s.length > 160 ? `${s.slice(0, 157)}...` : s);
export const formatFlag = (f) => `flagged "${clip(f.line)}": "${f.phrase}". ${f.reason}`;
export const isClean = (s) => flagLine(s).length === 0;
export const hasAdvice = (s) => !isClean(s);

// Drop-in for an old BANNED regex. extra is an optional regex for a surface's own
// house rules (for example "sold" in post text). Flags are logged with the reason.
export function banGuard(label = "copy", extra = null, opts = {}) {
  return Object.freeze({
    test(s) {
      const flags = flagLine(s, opts);
      const m = extra ? String(s ?? "").match(extra) : null;
      if (m) flags.push({ line: String(s), phrase: m[0], rule: "house", kind: "house", reason: `${label} house rule.` });
      for (const f of flags) console.log(`[copy-rules] ${label}: ${formatFlag(f)}`);
      return flags.length > 0;
    },
  });
}
