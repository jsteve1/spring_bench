import assert from "node:assert/strict";
import { completedRuns, parseTargetDims, runMetrics } from "../../dashboard/src/runMeta.js";
import { DEMO_RUNS } from "../../dashboard/src/fixtures/demoRuns.js";

const d1 = parseTargetDims("java21-virtual-low");
assert.equal(d1.runtime, "21");
assert.equal(d1.threading, "virtual");
assert.equal(d1.footprint, "low");
assert.equal(d1.arch, "amd64");

const d2 = parseTargetDims("java25-virtual-arm-low");
assert.equal(d2.runtime, "25");
assert.equal(d2.arch, "arm64");
assert.equal(d2.footprint, "low");

const done = completedRuns(DEMO_RUNS);
assert.equal(done.length, DEMO_RUNS.length);

const m = runMetrics(DEMO_RUNS[0]);
assert.equal(m.p95, 42);
assert.equal(m.vthreadPinned, 0);

console.log("runMeta ok");
