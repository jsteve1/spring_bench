import assert from "node:assert/strict";
import {
  emptyPeaks,
  mapJfrToServerFields,
  mergePeaks,
  ratePerSec,
  trimSeriesSample,
} from "../../orchestrator/src/runPeaks.js";
import { parseExtraTargets } from "../../orchestrator/src/matrix.js";

const extra = parseExtraTargets("java21-platform-low:8091, java25-virtual-amd64-low:8093, ,bogus");
assert.deepEqual(extra.targets, ["java21-platform-low", "java25-virtual-amd64-low", "bogus"]);
assert.equal(extra.ports["java21-platform-low"], 8091);
assert.equal(extra.ports["java25-virtual-amd64-low"], 8093);
assert.equal(extra.ports.bogus, undefined);
assert.deepEqual(parseExtraTargets("").targets, []);

assert.equal(ratePerSec(100, 300, 2000), 100);
assert.equal(ratePerSec(null, 10, 1000), null);
assert.equal(ratePerSec(50, 40, 1000), null);

let peaks = emptyPeaks();
peaks = mergePeaks(peaks, { memMb: 10, threads: 5, cpuPct: 20, contextSwitchRate: 12 });
peaks = mergePeaks(peaks, { memMb: 40, threads: 3, cpuPct: 55, contextSwitchRate: 8 });
assert.equal(peaks.memMbPeak, 40);
assert.equal(peaks.threadsPeak, 5);
assert.equal(peaks.cpuPctPeak, 55);
assert.equal(peaks.contextSwitchRatePeak, 12);

const mapped = mapJfrToServerFields({
  "jdk.ThreadContextSwitchRate": 45,
  "jdk.JavaMonitorEnter": 9,
  "jdk.VirtualThreadPinned": 1,
});
assert.equal(mapped.contextSwitchRate, 45);
assert.equal(mapped.monitorEnterCount, 9);
assert.equal(mapped.vthreadPinnedCount, 1);

const point = trimSeriesSample(
  {
    cpuPct: 12.5,
    memMb: 100,
    threads: 40,
    contextSwitchRate: 9,
    blockedRate: 2,
    waitedRate: 1,
    pids: 40,
  },
  "2026-07-26T00:00:00.000Z",
);
assert.equal(point.ts, "2026-07-26T00:00:00.000Z");
assert.equal(point.memMb, 100);
assert.equal(point.contextSwitchRate, 9);
assert.equal(trimSeriesSample(null), null);

console.log("runPeaks ok");
