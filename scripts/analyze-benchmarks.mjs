// Aggregate benchmark runs into per-cell medians for reporting.
//
//   node scripts/analyze-benchmarks.mjs                 # table
//   node scripts/analyze-benchmarks.mjs --json          # machine-readable
//
// Reads scripts/bench-manifest.json (written by run-benchmarks.ps1) and pulls
// each run record from orchestrator/runs/. Medians, not means: with 3 reps a
// single slow run (background OS work) would drag a mean noticeably.

import fs from "fs";
import path from "path";

const root = path.resolve(import.meta.dirname, "..");
const manifestPath = path.join(root, "scripts", "bench-manifest.json");
const runsDir = path.join(root, "orchestrator", "runs");

if (!fs.existsSync(manifestPath)) {
  console.error(`No manifest at ${manifestPath}. Run scripts/run-benchmarks.ps1 first.`);
  process.exit(1);
}

// Windows PowerShell's Set-Content -Encoding utf8 prepends a BOM, which JSON.parse rejects.
const readJson = (file) => JSON.parse(fs.readFileSync(file, "utf8").replace(/^\uFEFF/, ""));

const manifest = readJson(manifestPath);

function median(values) {
  const xs = values.filter((v) => Number.isFinite(v)).sort((a, b) => a - b);
  if (xs.length === 0) return null;
  const mid = Math.floor(xs.length / 2);
  return xs.length % 2 ? xs[mid] : (xs[mid - 1] + xs[mid]) / 2;
}

function round(v, d = 1) {
  if (!Number.isFinite(v)) return null;
  const f = 10 ** d;
  return Math.round(v * f) / f;
}

function loadRun(runId) {
  const file = path.join(runsDir, `${runId}.json`);
  if (!fs.existsSync(file)) return null;
  try {
    return readJson(file);
  } catch {
    return null;
  }
}

// group by target+mode
const cells = new Map();
for (const entry of manifest) {
  const run = loadRun(entry.runId);
  if (!run || run.status !== "completed") continue;
  const key = `${entry.target}|${entry.mode}`;
  if (!cells.has(key)) {
    cells.set(key, { target: entry.target, mode: entry.mode, health: entry.health, runs: [] });
  }
  cells.get(key).runs.push(run);
}

const rows = [];
for (const cell of cells.values()) {
  const pick = (fn) => cell.runs.map(fn);
  const server = pick((r) => r.server || {});
  const client = pick((r) => r.client || {});
  rows.push({
    target: cell.target,
    mode: cell.mode,
    reps: cell.runs.length,
    java: cell.health?.javaVersion ?? null,
    boot: cell.health?.springBoot ?? null,
    virtual: cell.health?.virtualThreadsEnabled ?? null,
    maxHeapMb: cell.health?.maxHeapMb ?? null,
    rps: round(median(client.map((c) => c.rps))),
    p50: round(median(client.map((c) => c.latencyMs?.p50)), 2),
    p95: round(median(client.map((c) => c.latencyMs?.p95)), 2),
    p99: round(median(client.map((c) => c.latencyMs?.p99)), 2),
    errorRate: round(median(client.map((c) => c.errorRate)), 4),
    iterations: round(median(client.map((c) => c.iterations))),
    sseEvents: round(median(client.map((c) => c.sse?.events))),
    sseConnections: round(median(client.map((c) => c.sse?.connections))),
    memMbPeak: round(median(server.map((s) => s.memMbPeak))),
    heapUsedMbPeak: round(median(server.map((s) => s.heapUsedMbPeak))),
    threadsPeak: round(median(server.map((s) => s.threadsPeak))),
    cpuPctPeak: round(median(server.map((s) => s.cpuPctPeak))),
    ctxSwitchPeak: round(median(server.map((s) => s.contextSwitchRatePeak))),
    waitedRatePeak: round(median(server.map((s) => s.waitedRatePeak))),
    threadPark: round(median(server.map((s) => s.threadParkCount))),
    monitorEnter: round(median(server.map((s) => s.monitorEnterCount))),
    vtPinned: round(median(server.map((s) => s.vthreadPinnedCount))),
    gcEvents: round(median(server.map((s) => s.gcEventCount))),
  });
}

rows.sort((a, b) => a.mode.localeCompare(b.mode) || a.target.localeCompare(b.target));

if (process.argv.includes("--json")) {
  console.log(JSON.stringify(rows, null, 2));
  process.exit(0);
}

const skipped = manifest.length - [...cells.values()].reduce((n, c) => n + c.runs.length, 0);
console.log(`manifest runs: ${manifest.length}   used: ${manifest.length - skipped}   skipped: ${skipped}\n`);

for (const mode of ["rest", "sse"]) {
  const modeRows = rows.filter((r) => r.mode === mode);
  if (!modeRows.length) continue;
  console.log(`### ${mode.toUpperCase()}`);
  const cols =
    mode === "rest"
      ? ["target", "reps", "java", "virtual", "rps", "p50", "p95", "errorRate", "memMbPeak", "threadsPeak", "cpuPctPeak", "ctxSwitchPeak", "threadPark", "vtPinned"]
      : ["target", "reps", "java", "virtual", "sseConnections", "sseEvents", "memMbPeak", "threadsPeak", "cpuPctPeak", "ctxSwitchPeak", "threadPark", "vtPinned"];
  const widths = cols.map((c) => Math.max(c.length, ...modeRows.map((r) => String(r[c] ?? "-").length)));
  console.log(cols.map((c, i) => c.padEnd(widths[i])).join("  "));
  for (const r of modeRows) {
    console.log(cols.map((c, i) => String(r[c] ?? "-").padEnd(widths[i])).join("  "));
  }
  console.log("");
}
