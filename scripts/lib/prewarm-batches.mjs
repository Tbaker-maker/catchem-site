// Resumable product-html prewarm. One GitHub job dies at 6 hours.
// A single polite pass is longer than that, so work is sliced into batches
// that finish well under the cap, then continue from the warm list.

export const GITHUB_JOB_LIMIT_MS = 6 * 60 * 60 * 1000;
export const JOB_TIMEOUT_MIN = 90;
export const BATCH_TIME_CAP_MS = 60 * 60 * 1000;
export const BATCH_BUDGET_MS = 50 * 60 * 1000;
export const MAX_JOBS = 240;
export const DEFAULT_SLEEP_MS = 1200;
export const REQUEST_TIMEOUT_MS = 20000;
export const MAX_GAP_MS = 15000;

export function politeSleepMs(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return DEFAULT_SLEEP_MS;
  return Math.min(MAX_GAP_MS, Math.max(250, Math.round(n)));
}

export function skipGapMs(sleepMs) {
  return Math.min(politeSleepMs(sleepMs), 400);
}

export function batchSizeFor(count, sleepMs = DEFAULT_SLEEP_MS) {
  const n = Math.max(0, Number(count) || 0);
  if (!n) return 1;
  const slow = REQUEST_TIMEOUT_MS + politeSleepMs(sleepMs);
  const maxByTime = Math.max(1, Math.floor(BATCH_TIME_CAP_MS / slow));
  const minToFit = Math.ceil(n / MAX_JOBS);
  if (minToFit > maxByTime) return maxByTime;
  return Math.min(maxByTime, n);
}

export function worstCaseMs(batchSize, sleepMs = DEFAULT_SLEEP_MS) {
  return batchSize * (REQUEST_TIMEOUT_MS + politeSleepMs(sleepMs));
}

export function selectIds(rows, { kind = "all", limit = Infinity } = {}) {
  if (!Array.isArray(rows)) throw new Error("search-lite shape");
  const want = kind === "sealed" || kind === "single" ? kind : "all";
  const cap = Number.isFinite(limit) ? limit : Infinity;
  const ids = [];
  const seen = new Set();
  for (const row of rows) {
    if (!Array.isArray(row) || typeof row[0] !== "string" || !row[0].startsWith("tcgcsv-")) continue;
    if (want !== "all" && row[5] !== want) continue;
    if (seen.has(row[0])) continue;
    seen.add(row[0]);
    ids.push(row[0]);
    if (ids.length >= cap) break;
  }
  return ids;
}

export function sliceFor(ids, batchIndex, batchSize) {
  const size = Math.max(1, Number(batchSize) || 1);
  const start = Math.max(0, Number(batchIndex) || 0) * size;
  return ids.slice(start, start + size);
}

export function pendingIds(ids, warm) {
  const known = warm instanceof Set ? warm : new Set(warm || []);
  return ids.filter((id) => !known.has(id));
}

export function workBatches(ids, warm, batchSize, maxJobs = MAX_JOBS) {
  const known = warm instanceof Set ? warm : new Set(warm || []);
  const size = Math.max(1, Number(batchSize) || 1);
  const all = [];
  const n = Math.ceil(ids.length / size);
  for (let i = 0; i < n; i += 1) {
    const slice = ids.slice(i * size, i * size + size);
    if (slice.some((id) => !known.has(id))) all.push(i);
  }
  const cap = Math.max(0, Number(maxJobs) || 0);
  return {
    indexes: all.slice(0, cap),
    remaining: Math.max(0, all.length - cap),
    total: all.length,
  };
}

export function nextGap(gap, sleepMs, code, header) {
  const base = politeSleepMs(sleepMs);
  const cur = Number.isFinite(Number(gap)) ? Number(gap) : base;
  if (code === 503 || code === 0) return Math.min(Math.max(cur, base) * 2, MAX_GAP_MS);
  if (header === "html-skip") return skipGapMs(base);
  return Math.max(base, Math.floor(cur * 0.9));
}

export function mergeWarm(prevIds, reports) {
  const set = new Set();
  for (const id of prevIds || []) if (typeof id === "string" && id) set.add(id);
  for (const report of reports || []) {
    for (const id of (report && report.warmIds) || []) {
      if (typeof id === "string" && id) set.add(id);
    }
  }
  return [...set];
}

export function formatBatchReport(report) {
  const r = report || {};
  return `BATCH ${r.index} runtime_ms=${r.runtimeMs} requested=${r.requested} skipped_warm=${r.skippedWarm} ok=${r.ok} skip_header=${r.skipHeader} err=${r.err}`;
}

export async function runBatch({
  ids,
  batchIndex = 0,
  warm,
  sleepMs = DEFAULT_SLEEP_MS,
  budgetMs = BATCH_BUDGET_MS,
  origin = "https://catchemtcg.com",
  fetchImpl = globalThis.fetch,
  sleepImpl = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  now = () => Date.now(),
} = {}) {
  const known = warm instanceof Set ? new Set(warm) : new Set(warm || []);
  const added = [];
  const base = String(origin || "https://catchemtcg.com").replace(/\/$/, "");
  const gap0 = politeSleepMs(sleepMs);
  const pending = pendingIds(ids || [], known);
  const skippedWarm = (ids || []).length - pending.length;
  const t0 = now();
  let gap = gap0;
  let requested = 0;
  let ok = 0;
  let skipHeader = 0;
  let err = 0;
  let n503 = 0;
  let stoppedEarly = false;

  for (let i = 0; i < pending.length; i += 1) {
    if (now() - t0 >= budgetMs) {
      stoppedEarly = true;
      break;
    }
    const id = pending[i];
    let code = 0;
    let header = "";
    try {
      const res = await fetchImpl(`${base}/p/${encodeURIComponent(id)}?prewarm=html`, {
        headers: { "user-agent": "catchem-prewarm-html/2" },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      code = Number(res.status) || 0;
      header = String((res.headers && res.headers.get("x-prewarm")) || "");
      if (res.arrayBuffer) await res.arrayBuffer();
      else if (res.text) await res.text();
      if (code === 200 && header === "html-skip") {
        skipHeader += 1;
        known.add(id);
        added.push(id);
      } else if (code === 200) {
        ok += 1;
        known.add(id);
        added.push(id);
      } else if (code === 503) {
        n503 += 1;
        err += 1;
      } else {
        err += 1;
      }
    } catch {
      code = 0;
      err += 1;
    }
    requested += 1;
    gap = nextGap(gap, gap0, code, header);
    if (requested === 1 || requested % 25 === 0) {
      console.log(formatBatchReport({
        index: batchIndex,
        runtimeMs: Math.max(0, now() - t0),
        requested,
        skippedWarm,
        ok,
        skipHeader,
        err,
      }));
    }
    if (now() - t0 < budgetMs) await sleepImpl(gap);
  }

  return {
    index: batchIndex,
    runtimeMs: Math.max(0, now() - t0),
    requested,
    skippedWarm,
    ok,
    skipHeader,
    err,
    n503,
    stoppedEarly,
    warmIds: added,
  };
}
