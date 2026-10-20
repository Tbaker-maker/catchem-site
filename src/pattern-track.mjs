// Pattern track record. The case-count minimum matches the proven-signal
// study (catchem-data-private year-patterns summary, Catchem-data tracker).
// It is not a new cutoff. A row under it, or with no lift, stays hidden.
export const PROVEN_MIN_N = 20;

const MOVE = {
  down: "fall and finish under the usual move",
  flat: "land near the earlier price",
  up: "rise and finish above the usual move",
};

export function patternShows(p) {
  if (!p || typeof p !== "object") return false;
  const rate = Number(p.rate);
  const base = Number(p.base);
  const n = Number(p.n);
  const days = Number(p.horizon);
  if (!(rate > 0) || !(base > 0) || !(n > 0) || !(days > 0)) return false;
  if (!(rate > base)) return false;
  if (p.pass === false) return false;
  if (n < PROVEN_MIN_N) return false;
  return true;
}

export function liftMultiple(rate, base) {
  const x = Number(rate) / Number(base);
  if (!(x > 0) || !Number.isFinite(x)) return "";
  return (Math.round(x * 10) / 10).toFixed(1);
}

export function patternCopy(p) {
  if (!patternShows(p)) return null;
  const rate = Number(p.rate);
  const base = Number(p.base);
  const n = Math.round(Number(p.n));
  const days = Math.round(Number(p.horizon));
  const mult = liftMultiple(rate, base);
  const dir = String(p.dir || "up").toLowerCase();
  const move = MOVE[dir] || MOVE.up;
  const lead = `${mult}x more likely than usual to ${move} within ${days} days`;
  const cases = n.toLocaleString("en-US");
  const small = `${rate}% of ${cases} past cases vs ${base}% for all items.`;
  return { lead, small, mult, rate, base, n, days };
}

export function patternFromGate(gate) {
  if (!gate || typeof gate !== "object") return null;
  const asPct = (n) => {
    const v = Number(n);
    if (!Number.isFinite(v)) return null;
    return Math.abs(v) <= 1 && v !== 0 ? Math.round(v * 1000) / 10 : v;
  };
  return patternCopy({
    rate: asPct(gate.rate),
    base: asPct(gate.baseRate ?? gate.base),
    n: gate.n,
    horizon: gate.horizon,
    dir: gate.dir,
    pass: gate.pass,
  });
}

// Email bar. Tables only. Gmail and Outlook drop SVG, so this is not a sparkline.
export function patternBarsEmail(copy, { dim = "#636366", up = "#1f8a3b", usual = "#8e8e93", font = "Arial,Helvetica,sans-serif" } = {}) {
  if (!copy) return "";
  const top = Math.max(copy.rate, copy.base) || 1;
  const row = (label, rate, color) => {
    const w = Math.max(4, Math.round((rate / top) * 100));
    return `<tr><td width="92" class="ce-dim" style="font:400 12px/1.4 ${font};color:${dim};padding:3px 8px 3px 0">${label}</td><td style="padding:3px 0"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td width="${w}%" bgcolor="${color}" style="background:${color};height:8px;border-radius:999px;font-size:0;line-height:0">&nbsp;</td><td style="font-size:0;line-height:0">&nbsp;</td></tr></table></td></tr>`;
  };
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:10px 0 0">${row("This pattern", copy.rate, up)}${row("Usual", copy.base, usual)}</table>`;
}
