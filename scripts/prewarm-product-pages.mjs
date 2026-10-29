#!/usr/bin/env node
// Pace GET /p/{id}?prewarm=html so FEED_KV product-html fills after publish.
// One GitHub job cannot finish the catalog under the 6 hour cap, so this
// plans batches, warms one batch, and records ids that are already warm.
//
//   node scripts/prewarm-product-pages.mjs --plan --out prewarm-state
//   node scripts/prewarm-product-pages.mjs --batch 0 --ids prewarm-state/ids.json --state prewarm-state/warm.json
//   node scripts/prewarm-product-pages.mjs --join prewarm-state
//
// Env: CATCHEM_ORIGIN (default https://catchemtcg.com)
import { mkdirSync, readFileSync, writeFileSync, readdirSync, appendFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";
import {
  BATCH_BUDGET_MS,
  DEFAULT_SLEEP_MS,
  MAX_JOBS,
  batchSizeFor,
  formatBatchReport,
  mergeWarm,
  politeSleepMs,
  runBatch,
  selectIds,
  sliceFor,
  workBatches,
} from "./lib/prewarm-batches.mjs";

const SEARCH_URL =
  "https://raw.githubusercontent.com/Tbaker-maker/Catchem-data/public-data/research/assets/public/search-lite.json";

const args = process.argv.slice(2);
function flag(name, def) {
  const i = args.indexOf(name);
  if (i < 0) return def;
  const v = args[i + 1];
  if (v == null || v.startsWith("--")) return true;
  return v;
}

function envOr(name, fallback) {
  const v = process.env[name];
  return v == null || v === "" ? fallback : v;
}

function kindOf() {
  const raw = String(flag("--kind", envOr("PREWARM_KIND", "all")) || "all");
  return raw === "sealed" || raw === "single" ? raw : "all";
}

function limitOf() {
  const raw = flag("--limit", envOr("PREWARM_LIMIT", "0"));
  if (raw === true || raw === "0" || raw === "" || args.includes("--all")) return Infinity;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : Infinity;
}

function freshOf() {
  const raw = String(flag("--fresh", envOr("PREWARM_FRESH", "false")) || "false").toLowerCase();
  return raw === "true" || raw === "1" || raw === "yes";
}

function maxBatchesOf() {
  const raw = flag("--max-batches", envOr("PREWARM_MAX_BATCHES", "0"));
  const n = Number(raw === true ? 0 : raw);
  if (!Number.isFinite(n) || n <= 0) return MAX_JOBS;
  return Math.min(MAX_JOBS, Math.floor(n));
}

function readJson(path, fallback) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return fallback;
  }
}

function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(value));
}

function githubOutput(name, value) {
  const file = process.env.GITHUB_OUTPUT;
  if (!file) return;
  appendFileSync(file, `${name}=${value}\n`);
}

function githubSummary(text) {
  const file = process.env.GITHUB_STEP_SUMMARY;
  if (!file) return;
  appendFileSync(file, text.endsWith("\n") ? text : `${text}\n`);
}

async function loadRows() {
  const res = await fetch(SEARCH_URL, { signal: AbortSignal.timeout(60000) });
  if (!res.ok) throw new Error(`search-lite ${res.status}`);
  return res.json();
}

async function loadIds(path) {
  if (path && path !== true) {
    const data = readJson(path, null);
    if (!Array.isArray(data)) throw new Error("ids file shape");
    return data.filter((id) => typeof id === "string");
  }
  return selectIds(await loadRows(), { kind: kindOf(), limit: limitOf() });
}

function loadWarmIds(path, fresh) {
  if (fresh || !path || path === true) return [];
  const data = readJson(path, []);
  const list = Array.isArray(data) ? data : (data && data.ids) || [];
  return list.filter((id) => typeof id === "string");
}

async function planMain() {
  const out = String(flag("--out", "prewarm-state"));
  const statePath = String(flag("--state", join(out, "warm.json")));
  const fresh = freshOf();
  const sleepMs = politeSleepMs(flag("--sleep-ms", envOr("PREWARM_SLEEP", DEFAULT_SLEEP_MS)));
  const ids = await loadIds(flag("--ids", ""));
  const warm = loadWarmIds(fresh ? "" : statePath, fresh);
  const batchSize = batchSizeFor(ids.length, sleepMs);
  const planned = workBatches(ids, new Set(warm), batchSize, maxBatchesOf());
  mkdirSync(out, { recursive: true });
  writeJson(join(out, "ids.json"), ids);
  writeJson(join(out, "warm.json"), warm);
  writeJson(join(out, "meta.json"), {
    batchSize,
    sleepMs,
    kind: kindOf(),
    indexes: planned.indexes,
    remaining: planned.remaining,
    total: planned.total,
    ids: ids.length,
    warm: warm.length,
  });
  githubOutput("batches", JSON.stringify(planned.indexes));
  githubOutput("batch_size", String(batchSize));
  githubOutput("sleep_ms", String(sleepMs));
  console.log(`plan ids=${ids.length} warm=${warm.length} batchSize=${batchSize} jobs=${planned.indexes.length} later=${planned.remaining} sleepMs=${sleepMs}`);
}

async function warmMain() {
  const batchIndex = Number(flag("--batch", "0"));
  const sleepMs = politeSleepMs(flag("--sleep-ms", envOr("PREWARM_SLEEP", DEFAULT_SLEEP_MS)));
  const ids = await loadIds(flag("--ids", ""));
  const batchSize = Number(flag("--batch-size", batchSizeFor(ids.length, sleepMs))) || batchSizeFor(ids.length, sleepMs);
  const fresh = freshOf();
  const statePath = flag("--state", "");
  const warm = loadWarmIds(statePath === true ? "" : statePath, fresh);
  const slice = sliceFor(ids, batchIndex, batchSize);
  const origin = process.env.CATCHEM_ORIGIN || "https://catchemtcg.com";
  const report = await runBatch({
    ids: slice,
    batchIndex,
    warm,
    sleepMs,
    budgetMs: Number(flag("--budget-ms", BATCH_BUDGET_MS)) || BATCH_BUDGET_MS,
    origin,
  });
  const line = formatBatchReport(report);
  console.log(line);
  if (report.stoppedEarly) console.log(`BATCH ${batchIndex} stopped inside the time budget; the rest stays for the next run`);
  const reportPath = flag("--report", "");
  if (reportPath && reportPath !== true) writeJson(String(reportPath), report);
  if (statePath && statePath !== true) {
    const prev = fresh ? [] : loadWarmIds(statePath, false);
    writeJson(String(statePath), mergeWarm(prev, [report]));
  }
  githubSummary(line);
  if (report.requested > 0 && report.n503 / report.requested > 0.2) process.exitCode = 1;
}

function joinMain() {
  const dir = String(flag("--join", "prewarm-state"));
  const prev = loadWarmIds(join(dir, "warm.json"), false);
  const reportsDir = flag("--reports", join(dir, "reports"));
  const reports = [];
  let names = [];
  try {
    names = readdirSync(String(reportsDir));
  } catch {
    names = [];
  }
  for (const name of names) {
    if (!name.endsWith(".json")) continue;
    const data = readJson(join(String(reportsDir), name), null);
    if (data && typeof data === "object") reports.push(data);
  }
  reports.sort((a, b) => Number(a.index) - Number(b.index));
  const lines = reports.map(formatBatchReport);
  for (const line of lines) console.log(line);
  const warm = mergeWarm(prev, reports);
  writeJson(join(dir, "warm.json"), warm);
  const totalMs = reports.reduce((sum, r) => sum + (Number(r.runtimeMs) || 0), 0);
  const summary = `join batches=${reports.length} runtime_ms=${totalMs} warm=${warm.length}`;
  console.log(summary);
  githubSummary(`${lines.join("\n")}\n${summary}\n`);
}

async function main() {
  if (args.includes("--plan")) return planMain();
  if (args.includes("--join") || args.includes("--reports")) return joinMain();
  if (args.includes("--batch")) return warmMain();
  const out = String(flag("--out", "prewarm-state"));
  const statePath = String(flag("--state", join(out, "warm.json")));
  await planMain();
  const meta = readJson(join(out, "meta.json"), { indexes: [], batchSize: 1, sleepMs: DEFAULT_SLEEP_MS });
  for (const index of meta.indexes || []) {
    const report = await runBatch({
      ids: sliceFor(readJson(join(out, "ids.json"), []), index, meta.batchSize),
      batchIndex: index,
      warm: loadWarmIds(statePath, false),
      sleepMs: meta.sleepMs,
      origin: process.env.CATCHEM_ORIGIN || "https://catchemtcg.com",
    });
    console.log(formatBatchReport(report));
    const warm = mergeWarm(loadWarmIds(statePath, false), [report]);
    writeJson(statePath, warm);
    if (report.requested > 0 && report.n503 / report.requested > 0.2) {
      process.exitCode = 1;
      break;
    }
  }
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  main().catch((err) => {
    console.error(err && err.stack ? err.stack : String(err));
    process.exitCode = 1;
  });
}
