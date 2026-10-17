// The shared copy checker from Catchem-data (rules/advice-phrases.json and
// scripts/lib/advice-intent.mjs, copied here by scripts/sync-advice-phrases.mjs).
// Flagged: lines that tell the reader to buy, sell, hold or flip, promises of a result,
// crypto or investment framing, and dashes. Market facts, questions, past tense, quoted
// product names and button labels (Buy on TCGplayer, Buy on eBay, Shop, Sell your cards) pass.
// A flag names the line, the rule, the span, the phrase and the reason. Nothing is rewritten.
import ADVICE from "./advice-phrases.mjs";
import { makeChecker } from "./advice-intent.mjs";

export { ADVICE };
const CHECKER = makeChecker(ADVICE);
export const ALLOWED = CHECKER.ALLOWED;

// Every rule a line breaks: { line, rule, kind, span, phrase, reason }.
// skipKinds leaves out rule kinds, for example ["house"] when a check scans
// whole pages with code in them and dashes are checked on their own.
export const flagLine = (input, { skipKinds = [] } = {}) => CHECKER.flagLine(input, { skipKinds });

const clip = (s) => (s.length > 160 ? `${s.slice(0, 157)}...` : s);
export const formatFlag = (f) => `flagged "${clip(f.line)}": rule ${f.rule} matched "${f.phrase}". ${f.reason}`;
export const isClean = (s) => flagLine(s).length === 0;
export const hasAdvice = (s) => !isClean(s);

// Drop-in for an old BANNED regex. extra is an optional regex for a surface's own
// house rules (for example "sold" in post text). Flags are logged with the reason.
export function banGuard(label = "copy", extra = null, opts = {}) {
  return Object.freeze({
    test(s) {
      const flags = flagLine(s, opts);
      const m = extra ? String(s ?? "").match(extra) : null;
      if (m) flags.push({ line: String(s), rule: "house", kind: "house", span: [m.index, m.index + m[0].length], phrase: m[0], reason: `${label} house rule.` });
      for (const f of flags) console.log(`[copy-rules] ${label}: ${formatFlag(f)}`);
      return flags.length > 0;
    },
  });
}
