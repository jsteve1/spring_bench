/** Parse matrix target names like `java21-virtual-low` / `java25-virtual-arm-low`. */
export function parseTargetDims(target) {
  const name = String(target || "");
  const m = name.match(/^java(\d+)-(platform|virtual)(?:-(arm))?-(\w+)$/i);
  if (!m) {
    return { runtime: "?", threading: "?", footprint: "?", arch: "amd64", label: name || "?" };
  }
  return {
    runtime: m[1],
    threading: m[2].toLowerCase(),
    arch: m[3] ? "arm64" : "amd64",
    footprint: m[4].toLowerCase(),
    label: name,
  };
}

export function runLabel(run) {
  const dims = parseTargetDims(run.target || run.request?.targetName);
  const mode = run.config?.mode || run.request?.mode || "?";
  const short = String(run.runId || "").slice(0, 8);
  return `${dims.label} · ${mode} · ${short}`;
}

/** Flatten client/server metrics used by DASH-05 comparison charts. */
export function runMetrics(run) {
  const client = run.client || {};
  const server = run.server || {};
  const jfr = server.jfrAggregates || run.jfr?.aggregates || {};
  return {
    p50: num(client.latencyMs?.p50),
    p95: num(client.latencyMs?.p95),
    p99: num(client.latencyMs?.p99),
    rps: num(client.rps),
    errorRate: num(client.errorRate),
    dataReceivedMb: num(client.dataReceivedMb),
    sseEvents: num(client.sse?.events),
    memMbPeak: num(server.memMbPeak),
    threadsPeak: num(server.threadsPeak),
    cpuPctPeak: num(server.cpuPctPeak),
    contextSwitch: num(server.contextSwitchRate ?? jfr["jdk.ThreadContextSwitchRate"]),
    monitorEnter: num(server.monitorEnterCount ?? jfr["jdk.JavaMonitorEnter"]),
    threadPark: num(server.threadParkCount ?? jfr["jdk.ThreadPark"]),
    vthreadPinned: num(server.vthreadPinnedCount ?? jfr["jdk.VirtualThreadPinned"]),
    gcEvents: num(server.gcEventCount ?? jfr["jdk.GarbageCollection"]),
    blockedRatePeak: num(server.blockedRatePeak),
  };
}

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export function completedRuns(runs) {
  return (runs || []).filter((r) => r.status === "completed" && r.phase !== "warmup");
}
