// Emit markdown tables from analyze-benchmarks medians for docs/12.
//   node scripts/analyze-benchmarks.mjs --json | node scripts/format-benchmark-md.mjs

import fs from "fs";

const stdin = fs.readFileSync(0, "utf8").replace(/^\uFEFF/, "");
const rows = JSON.parse(stdin);
const rest = rows.filter((r) => r.mode === "rest").sort((a, b) => a.target.localeCompare(b.target));
const sse = rows.filter((r) => r.mode === "sse").sort((a, b) => a.target.localeCompare(b.target));

function cell(v) {
  return v == null || Number.isNaN(v) ? "—" : String(v);
}

console.log("### REST (capacity, medians)\n");
console.log(
  "| Target | reps | java | virt | rps | p50 | p95 | err | memMb | threads | CPU% | ctx/s |",
);
console.log("| :-- | --: | :-- | :--: | --: | --: | --: | --: | --: | --: | --: | --: |");
for (const r of rest) {
  console.log(
    `| ${r.target} | ${r.reps} | ${cell(r.java)} | ${r.virtual} | ${cell(r.rps)} | ${cell(r.p50)} | ${cell(r.p95)} | ${cell(r.errorRate)} | ${cell(r.memMbPeak)} | ${cell(r.threadsPeak)} | ${cell(r.cpuPctPeak)} | ${cell(r.ctxSwitchPeak)} |`,
  );
}

console.log("\n### SSE (medians)\n");
console.log(
  "| Target | reps | java | virt | conns | events | memMb | threads | CPU% | ctx/s |",
);
console.log("| :-- | --: | :-- | :--: | --: | --: | --: | --: | --: | --: |");
for (const r of sse) {
  console.log(
    `| ${r.target} | ${r.reps} | ${cell(r.java)} | ${r.virtual} | ${cell(r.sseConnections)} | ${cell(r.sseEvents)} | ${cell(r.memMbPeak)} | ${cell(r.threadsPeak)} | ${cell(r.cpuPctPeak)} | ${cell(r.ctxSwitchPeak)} |`,
  );
}
