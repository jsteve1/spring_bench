import assert from "node:assert/strict";
import {
  emptyPeaks,
  mapJfrToServerFields,
  mergePeaks,
  ratePerSec,
} from "../../orchestrator/src/runPeaks.js";

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

console.log("runPeaks ok");
