#!/usr/bin/env bash
# Offline check that stats-series shape matches OBS-05 expectations.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
node --input-type=module <<'EOF'
import assert from "node:assert/strict";
import { trimSeriesSample } from "../orchestrator/src/runPeaks.js";

const samples = [
  trimSeriesSample({ cpuPct: 1, memMb: 10, threads: 2, contextSwitchRate: 3, blockedRate: 0, waitedRate: 0 }),
  trimSeriesSample({ cpuPct: 5, memMb: 20, threads: 4, contextSwitchRate: 8, blockedRate: 1, waitedRate: 2 }),
];
const payload = {
  runId: "demo",
  target: "java21-virtual-low",
  intervalMs: 2000,
  samples,
};
assert.equal(payload.samples.length, 2);
assert.ok(payload.samples[0].ts);
assert.equal(payload.samples[1].memMb, 20);
console.log("stats-series shape ok");
EOF
