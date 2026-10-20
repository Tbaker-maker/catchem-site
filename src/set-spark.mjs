// Set-index sparkline. Points come from the set file's singleIndex or sealedIndex.
// The first and last real points are the same days the percent uses.

const iso = (s) => (/^\d{4}-\d{2}-\d{2}/.test(String(s || "")) ? String(s).slice(0, 10) : "");
const r1 = (x) => Math.round(Number(x) * 10) / 10;

export const SPARK_MIN = 8;

export function indexRows(series) {
  const out = [];
  for (const p of series || []) {
    const d = iso(p?.d ?? (Array.isArray(p) ? p[0] : ""));
    if (!d) continue;
    const raw = Array.isArray(p) ? p[1] : p?.v;
    const v = Number(raw);
    out.push({ d, v: v > 0 ? v : null });
  }
  out.sort((a, b) => (a.d < b.d ? -1 : a.d > b.d ? 1 : 0));
  const dedup = [];
  for (const row of out) {
    if (dedup.length && dedup[dedup.length - 1].d === row.d) dedup[dedup.length - 1] = row;
    else dedup.push(row);
  }
  return dedup;
}

// Window is inclusive. A null level stays a gap. Percent matches indexChange:
// (last real - first real) / first real, one decimal.
export function sparkMove(series, from, to) {
  const a = iso(from);
  const b = iso(to);
  if (!a || !b || a > b) return null;
  const rows = indexRows(series).filter((p) => p.d >= a && p.d <= b);
  const real = rows.filter((p) => p.v != null);
  if (real.length < 2) return null;
  const start = real[0];
  const end = real[real.length - 1];
  return {
    from: start.d,
    to: end.d,
    pct: r1(((end.v - start.v) / start.v) * 100),
    n: real.length,
    rows,
  };
}

function smooth(xy) {
  if (xy.length < 2) return "";
  let d = `M${xy[0][0].toFixed(1)},${xy[0][1].toFixed(1)}`;
  for (let i = 0; i < xy.length - 1; i += 1) {
    const p0 = xy[i - 1] || xy[i];
    const p1 = xy[i];
    const p2 = xy[i + 1];
    const p3 = xy[i + 2] || p2;
    const c1x = p1[0] + (p2[0] - p0[0]) / 6;
    let c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6;
    let c2y = p2[1] - (p3[1] - p1[1]) / 6;
    const lo = Math.min(p1[1], p2[1]);
    const hi = Math.max(p1[1], p2[1]);
    c1y = Math.max(lo, Math.min(hi, c1y));
    c2y = Math.max(lo, Math.min(hi, c2y));
    d += ` C${c1x.toFixed(1)},${c1y.toFixed(1)} ${c2x.toFixed(1)},${c2y.toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`;
  }
  return d;
}

export function sparkSvg(series, { from, to, pct } = {}) {
  const move = sparkMove(series, from, to);
  if (!move || move.n < SPARK_MIN) return "";
  if (pct != null && Number.isFinite(Number(pct)) && move.pct !== r1(pct)) return "";
  if (from && move.from !== iso(from)) return "";
  if (to && move.to !== iso(to)) return "";
  const rows = move.rows.filter((p) => p.d >= move.from && p.d <= move.to);
  const vals = rows.filter((p) => p.v != null).map((p) => p.v);
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const span = max - min || 1;
  const lo = min - span * 0.14;
  const hi = max + span * 0.14;
  const W = 320;
  const H = 72;
  const L = 6;
  const R = 10;
  const T = 8;
  const B = 8;
  const t0 = Date.parse(`${move.from}T00:00:00Z`);
  const t1 = Date.parse(`${move.to}T00:00:00Z`);
  const xOf = (d) => (t1 === t0 ? (L + W - R) / 2 : L + ((Date.parse(`${d}T00:00:00Z`) - t0) / (t1 - t0)) * (W - L - R));
  const yOf = (v) => T + (1 - (v - lo) / (hi - lo)) * (H - T - B);
  const plotted = [];
  let carry = null;
  for (const row of rows) {
    if (row.v != null) {
      plotted.push([xOf(row.d), yOf(row.v), false]);
      carry = row.v;
    } else if (carry != null) {
      plotted.push([xOf(row.d), yOf(carry), true]);
    }
  }
  if (plotted.length < 2) return "";
  const color = move.pct > 0 ? "#7fc79a" : move.pct < 0 ? "#e0675b" : "#d9b779";
  const gid = `ms${move.from.replace(/-/g, "")}${move.pct < 0 ? "d" : "u"}`;
  const segs = [];
  let run = null;
  for (const p of plotted) {
    const xy = [p[0], p[1]];
    if (!run || run.gap !== p[2]) {
      if (run && run.pts.length) run.pts.push(xy);
      run = { gap: p[2], pts: [xy] };
      segs.push(run);
    } else run.pts.push(xy);
  }
  let body = "";
  for (const seg of segs) {
    if (seg.pts.length < 2) continue;
    const d = smooth(seg.pts);
    const op = seg.gap ? "0.35" : "1";
    if (!seg.gap) {
      const a = seg.pts[0];
      const b = seg.pts[seg.pts.length - 1];
      body += `<path d="${d} L${b[0].toFixed(1)},${H - 2} L${a[0].toFixed(1)},${H - 2} Z" fill="url(#${gid})" stroke="none"/>`;
    }
    body += `<path d="${d}" fill="none" stroke="${color}" stroke-opacity="${op}" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>`;
  }
  const end = plotted[plotted.length - 1];
  const dot = `<circle cx="${end[0].toFixed(1)}" cy="${end[1].toFixed(1)}" r="3.2" fill="${color}" stroke="#141210" stroke-width="1.5"/>`;
  return `<svg class="rd-spark" data-from="${move.from}" data-to="${move.to}" data-pct="${move.pct}" data-n="${move.n}" width="100%" height="72" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="Set index ${move.from} to ${move.to}" style="display:block;width:100%;height:72px;min-height:72px;max-width:100%"><defs><linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${color}" stop-opacity=".28"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></linearGradient></defs>${body}${dot}</svg>`;
}

// Copy the set slug and the matching index onto the fact. The page draws from that copy.
export function applySetSpark(facts, slug, indexes) {
  if (!facts || typeof facts !== "object" || !facts.setMomentum) return facts;
  const clean = /^[a-z0-9-]+$/.test(String(slug || "")) ? String(slug) : "";
  const key = facts.setMomentum.kind === "sealed" ? "sealedIndex" : "singleIndex";
  const series = indexes && Array.isArray(indexes[key]) ? indexes[key] : null;
  return {
    ...facts,
    setMomentum: {
      ...facts.setMomentum,
      ...(clean ? { slug: clean } : {}),
      ...(series ? { series } : {}),
    },
  };
}
