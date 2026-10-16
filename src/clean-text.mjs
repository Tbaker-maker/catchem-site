// Fail-closed pass over every rendered page. It only touches visible text
// (never tags, attributes, <script>, <style> or <textarea>).
// 1. One money format: "$540.3" becomes "$540.30".
// 2. A text piece holding a broken value ("$-19", NaN, undefined,
//    query_error, Infinity) is hidden, never shown.
// 3. Internal names come out: data file paths, ebay-browse-api, tcgcsv.
// 4. ISO dates read like "Oct 15" (year added when it is not this year).

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function money(n) {
  const x = Number(n);
  if (!Number.isFinite(x) || x <= 0) return "";
  return "$" + x.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const BROKEN = /\$\s?-\s?\d|\$\s?(?:NaN|undefined|null|Infinity)\b|\bNaN\b|\bundefined\b|\bquery_error\b|\bInfinity\b/;

export function niceDay(iso, nowYear = new Date().getUTCFullYear()) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return iso;
  const mo = Number(m[2]), d = Number(m[3]);
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return iso;
  return `${MONTHS[mo - 1]} ${d}` + (Number(m[1]) === nowYear ? "" : `, ${m[1]}`);
}

export function cleanText(t, nowYear) {
  let s = String(t);
  if (!s.trim()) return s;
  if (BROKEN.test(s)) return "";
  // money with one decimal
  s = s.replace(/\$(\d{1,3}(?:,\d{3})*|\d+)\.(\d)(?!\d)/g, "$$$1.$20");
  // data file paths like data/enrichment-distilled.json, research/x.json
  s = s.replace(/(?:^|[\s(,])(?:[\w.-]+\/)*[\w.-]+\.json\b,?\s*/g, (m) => (/^[\s(,]/.test(m) ? m[0] : ""));
  s = s.replace(/[.,]?\s*\bebay-browse-api\b\.?/gi, (m) => (m.trim().startsWith(".") ? "." : ""));
  s = s.replace(/\s+via\s+TCGCSV\b/gi, "");
  s = s.replace(/\bTCGCSV\b/gi, "TCGplayer");
  // ISO date (not inside a longer token)
  s = s.replace(/(?<![\w/-])(\d{4}-\d{2}-\d{2})(?![\w/-])/g, (iso) => niceDay(iso, nowYear));
  s = s.replace(/TCGplayer(?:\s+TCGplayer)+/g, "TCGplayer").replace(/\s{2,}/g, " ");
  return s;
}

const SKIP = /<(script|style|textarea|pre|code)\b[^>]*>[\s\S]*?<\/\1\s*>/gi;

export function cleanPage(html, nowYear) {
  const src = String(html ?? "");
  if (!src || !/<[a-z!]/i.test(src)) return src;
  let out = "";
  let last = 0;
  const textPass = (chunk) => chunk.replace(/>([^<]+)</g, (m, txt) => ">" + cleanText(txt, nowYear) + "<");
  for (const m of src.matchAll(SKIP)) {
    out += textPass(src.slice(last, m.index)) + m[0];
    last = m.index + m[0].length;
  }
  return out + textPass(src.slice(last));
}
