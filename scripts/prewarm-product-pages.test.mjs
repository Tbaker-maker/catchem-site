import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  BATCH_BUDGET_MS,
  GITHUB_JOB_LIMIT_MS,
  JOB_TIMEOUT_MIN,
  MAX_JOBS,
  batchSizeFor,
  formatBatchReport,
  mergeWarm,
  nextGap,
  pendingIds,
  runBatch,
  selectIds,
  sliceFor,
  workBatches,
  worstCaseMs,
} from "./lib/prewarm-batches.mjs";

export async function runPrewarmBatchTests() {
  const rows = [
    ["tcgcsv-1", "A", "Set", "1", "", "single"],
    ["tcgcsv-1", "A dup", "Set", "1", "", "single"],
    ["tcgcsv-2", "Box", "Set", "2", "", "sealed"],
    ["other-1", "nope", "Set", "3", "", "single"],
    ["tcgcsv-3", "ETB", "Set", "4", "", "sealed"],
  ];
  assert.deepEqual(selectIds(rows, { kind: "all" }), ["tcgcsv-1", "tcgcsv-2", "tcgcsv-3"]);
  assert.deepEqual(selectIds(rows, { kind: "sealed" }), ["tcgcsv-2", "tcgcsv-3"]);
  assert.deepEqual(selectIds(rows, { kind: "single", limit: 1 }), ["tcgcsv-1"]);
  assert.throws(() => selectIds({}), /search-lite shape/);

  const catalog = 31021;
  const size = batchSizeFor(catalog);
  const batches = Math.ceil(catalog / size);
  const slow = worstCaseMs(size);
  assert.ok(catalog * 1200 > GITHUB_JOB_LIMIT_MS, "one polite pass is over 6 hours");
  assert.ok(batches <= MAX_JOBS, "one run stays inside the matrix cap");
  assert.ok(slow <= 60 * 60 * 1000, "slow batch fits in 60 minutes");
  assert.ok(slow < GITHUB_JOB_LIMIT_MS / 4, "each batch is well under the 6 hour cap");
  assert.ok(JOB_TIMEOUT_MIN * 60 * 1000 < GITHUB_JOB_LIMIT_MS / 3);
  assert.ok(BATCH_BUDGET_MS < JOB_TIMEOUT_MIN * 60 * 1000);

  const ids = Array.from({ length: 10 }, (_, i) => `tcgcsv-${i}`);
  assert.deepEqual(sliceFor(ids, 1, 4), ["tcgcsv-4", "tcgcsv-5", "tcgcsv-6", "tcgcsv-7"]);
  const covered = [];
  for (let i = 0; i < Math.ceil(ids.length / 4); i += 1) covered.push(...sliceFor(ids, i, 4));
  assert.deepEqual(covered, ids);

  const warm = new Set(["tcgcsv-1", "tcgcsv-2"]);
  assert.deepEqual(pendingIds(["tcgcsv-1", "tcgcsv-2", "tcgcsv-3"], warm), ["tcgcsv-3"]);
  const planned = workBatches(ids, warm, 4, 10);
  assert.deepEqual(planned.indexes, [0, 1, 2]);
  assert.equal(planned.remaining, 0);
  const capped = workBatches(ids, new Set(), 1, 3);
  assert.deepEqual(capped.indexes, [0, 1, 2]);
  assert.equal(capped.remaining, 7);

  assert.equal(nextGap(1200, 1200, 200, ""), 1200);
  assert.equal(nextGap(1200, 1200, 503, ""), 2400);
  assert.equal(nextGap(10000, 1200, 0, ""), 15000);
  assert.equal(nextGap(2400, 1200, 200, "html-skip"), 400);
  assert.equal(nextGap(400, 1200, 200, "html"), 1200);

  let clock = 1000;
  const calls = [];
  const slept = [];
  const report = await runBatch({
    ids: ["tcgcsv-1", "tcgcsv-2", "tcgcsv-3"],
    batchIndex: 4,
    warm: ["tcgcsv-2"],
    sleepMs: 1200,
    budgetMs: 10000,
    now: () => clock,
    sleepImpl: async (ms) => {
      slept.push(ms);
      clock += ms;
    },
    fetchImpl: async (url) => {
      calls.push(url);
      clock += 100;
      const skip = url.includes("tcgcsv-3");
      return {
        status: 200,
        headers: { get: () => (skip ? "html-skip" : "html") },
        arrayBuffer: async () => new ArrayBuffer(0),
      };
    },
  });
  assert.deepEqual(calls.map((url) => url.match(/tcgcsv-\d+/)[0]), ["tcgcsv-1", "tcgcsv-3"]);
  assert.equal(report.skippedWarm, 1);
  assert.equal(report.requested, 2);
  assert.equal(report.ok, 1);
  assert.equal(report.skipHeader, 1);
  assert.deepEqual(report.warmIds, ["tcgcsv-1", "tcgcsv-3"]);
  assert.deepEqual(slept, [1200, 400]);
  assert.equal(report.runtimeMs, 100 + 1200 + 100 + 400);
  assert.match(formatBatchReport(report), /BATCH 4 runtime_ms=1800 requested=2 skipped_warm=1 ok=1 skip_header=1 err=0/);
  assert.deepEqual(mergeWarm(["tcgcsv-2"], [report]), ["tcgcsv-2", "tcgcsv-1", "tcgcsv-3"]);

  clock = 0;
  const stopped = await runBatch({
    ids: ["tcgcsv-a", "tcgcsv-b", "tcgcsv-c"],
    warm: [],
    sleepMs: 1200,
    budgetMs: 1000,
    now: () => clock,
    sleepImpl: async (ms) => { clock += ms; },
    fetchImpl: async () => {
      clock += 100;
      return { status: 200, headers: { get: () => "html" }, arrayBuffer: async () => new ArrayBuffer(0) };
    },
  });
  assert.equal(stopped.stoppedEarly, true);
  assert.equal(stopped.requested, 1);
  assert.deepEqual(stopped.warmIds, ["tcgcsv-a"]);

  const workflow = readFileSync(new URL("../.github/workflows/prewarm-product-html.yml", import.meta.url), "utf8");
  assert.equal(workflow.includes("timeout-minutes: 360"), false);
  assert.match(workflow, /timeout-minutes: 90/);
  assert.match(workflow, /max-parallel: 1/);
  assert.match(workflow, /html-skip|skipped_warm|warm\.json/);
  assert.doesNotMatch(workflow, /\u2014|\u2013/);

  console.log("prewarm batches ok");
}

const isMain = process.argv[1] && process.argv[1].endsWith("prewarm-product-pages.test.mjs");
if (isMain) {
  await runPrewarmBatchTests();
}
