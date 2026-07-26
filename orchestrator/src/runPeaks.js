/** Rate helpers for cumulative Micrometer gauges (testable without Docker). */

export function ratePerSec(prev, next, elapsedMs) {
  if (prev == null || next == null || !Number.isFinite(prev) || !Number.isFinite(next)) {
    return null;
  }
  if (!Number.isFinite(elapsedMs) || elapsedMs <= 0) {
    return null;
  }
  const delta = next - prev;
  if (delta < 0) {
    // counter reset
    return null;
  }
  return Math.round((delta / (elapsedMs / 1000)) * 100) / 100;
}

export function mergePeaks(peaks, sample) {
  const out = { ...peaks };
  const bump = (key, value) => {
    if (value == null || !Number.isFinite(value)) {
      return;
    }
    out[key] = Math.max(out[key] ?? 0, value);
  };
  bump("memMbPeak", sample.memMb);
  bump("threadsPeak", sample.threads);
  bump("cpuPctPeak", sample.cpuPct);
  bump("heapUsedMbPeak", sample.heapUsedMb);
  bump("contextSwitchRatePeak", sample.contextSwitchRate);
  bump("blockedRatePeak", sample.blockedRate);
  bump("waitedRatePeak", sample.waitedRate);
  return out;
}

export function emptyPeaks() {
  return {
    memMbPeak: 0,
    threadsPeak: 0,
    cpuPctPeak: 0,
    heapUsedMbPeak: 0,
    contextSwitchRatePeak: 0,
    blockedRatePeak: 0,
    waitedRatePeak: 0,
  };
}

/** Compact one stats frame for persistence (OBS-05). */
export function trimSeriesSample(sample, ts = new Date().toISOString()) {
  if (!sample) {
    return null;
  }
  return {
    ts,
    cpuPct: sample.cpuPct ?? null,
    memMb: sample.memMb ?? null,
    threads: sample.threads ?? null,
    heapUsedMb: sample.heapUsedMb ?? null,
    gcPauseCount: sample.gcPauseCount ?? null,
    gcPauseTotalMs: sample.gcPauseTotalMs ?? null,
    contextSwitchRate: sample.contextSwitchRate ?? null,
    blockedRate: sample.blockedRate ?? null,
    waitedRate: sample.waitedRate ?? null,
    pids: sample.pids ?? null,
  };
}

export function mapJfrToServerFields(aggregates) {
  if (!aggregates) {
    return {};
  }
  return {
    contextSwitchRate: aggregates["jdk.ThreadContextSwitchRate"] ?? null,
    monitorEnterCount: aggregates["jdk.JavaMonitorEnter"] ?? null,
    monitorWaitCount: aggregates["jdk.JavaMonitorWait"] ?? null,
    threadParkCount: aggregates["jdk.ThreadPark"] ?? null,
    vthreadPinnedCount: aggregates["jdk.VirtualThreadPinned"] ?? null,
    gcEventCount: aggregates["jdk.GarbageCollection"] ?? null,
  };
}
