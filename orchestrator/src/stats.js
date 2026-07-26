import { MATRIX_TARGETS } from "./matrix.js";
import { getDocker, inspectContainer } from "./dockerClient.js";
import { fetchTargetHealth } from "./targets.js";
import { ratePerSec } from "./runPeaks.js";

const STATS_TIMEOUT_MS = Number(process.env.STATS_TIMEOUT_MS || 4000);

/** @type {Map<string, { ts: number, contextSwitches: number|null, blocked: number|null, waited: number|null }>} */
const prevDeep = new Map();

function round(n, digits = 1) {
  if (!Number.isFinite(n)) {
    return 0;
  }
  const f = 10 ** digits;
  return Math.round(n * f) / f;
}

function cpuPercent(stats) {
  const cpuDelta =
    (stats.cpu_stats?.cpu_usage?.total_usage ?? 0) -
    (stats.precpu_stats?.cpu_usage?.total_usage ?? 0);
  const systemDelta =
    (stats.cpu_stats?.system_cpu_usage ?? 0) - (stats.precpu_stats?.system_cpu_usage ?? 0);
  if (cpuDelta <= 0 || systemDelta <= 0) {
    return 0;
  }
  const online =
    stats.cpu_stats?.online_cpus ||
    stats.cpu_stats?.cpu_usage?.percpu_usage?.length ||
    1;
  return round((cpuDelta / systemDelta) * online * 100, 2);
}

function memoryMb(stats) {
  const usage = stats.memory_stats?.usage ?? 0;
  const cache =
    stats.memory_stats?.stats?.inactive_file ??
    stats.memory_stats?.stats?.cache ??
    0;
  const used = Math.max(0, usage - cache);
  const limit = stats.memory_stats?.limit ?? 0;
  return {
    memMb: round(used / (1024 * 1024), 1),
    memLimitMb: round(limit / (1024 * 1024), 1),
  };
}

function netMb(stats) {
  const networks = stats.networks || {};
  let rx = 0;
  let tx = 0;
  for (const iface of Object.values(networks)) {
    rx += iface.rx_bytes || 0;
    tx += iface.tx_bytes || 0;
  }
  return {
    netRxMb: round(rx / (1024 * 1024), 2),
    netTxMb: round(tx / (1024 * 1024), 2),
  };
}

async function withTimeout(promise, ms) {
  let timer;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error("stats timeout")), ms);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

async function metricValue(name, metricPath) {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), STATS_TIMEOUT_MS);
    const res = await fetch(`http://${name}:8080/actuator/metrics/${metricPath}`, {
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) {
      return null;
    }
    const body = await res.json();
    const measurement = body.measurements?.[0];
    const value = measurement?.value;
    return Number.isFinite(value) ? value : null;
  } catch {
    return null;
  }
}

async function fetchJvmMetrics(name) {
  const [threads, heapUsed, contextSwitches, blocked, waited] = await Promise.all([
    metricValue(name, "jvm.threads.live"),
    metricValue(name, "jvm.memory.used?tag=area%3Aheap"),
    metricValue(name, "bench.context.switches.total"),
    metricValue(name, "bench.threads.blocked.total"),
    metricValue(name, "bench.threads.waited.total"),
  ]);

  let gcCount = null;
  let gcTotalMs = null;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), STATS_TIMEOUT_MS);
    const res = await fetch(`http://${name}:8080/actuator/metrics/jvm.gc.pause`, {
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (res.ok) {
      const body = await res.json();
      for (const m of body.measurements || []) {
        if (m.statistic === "COUNT") {
          gcCount = m.value;
        }
        if (m.statistic === "TOTAL_TIME") {
          gcTotalMs = round((m.value || 0) * 1000, 2);
        }
      }
    }
  } catch {
    // ignore
  }

  const now = Date.now();
  const prev = prevDeep.get(name);
  let contextSwitchRate = null;
  let blockedRate = null;
  let waitedRate = null;
  if (prev) {
    const elapsed = now - prev.ts;
    contextSwitchRate = ratePerSec(prev.contextSwitches, contextSwitches, elapsed);
    blockedRate = ratePerSec(prev.blocked, blocked, elapsed);
    waitedRate = ratePerSec(prev.waited, waited, elapsed);
  }
  prevDeep.set(name, {
    ts: now,
    contextSwitches,
    blocked,
    waited,
  });

  return {
    threads: threads != null ? round(threads, 0) : null,
    heapUsedMb: heapUsed != null ? round(heapUsed / (1024 * 1024), 1) : null,
    gcPauseCount: gcCount,
    gcPauseTotalMs: gcTotalMs,
    contextSwitches: contextSwitches != null ? round(contextSwitches, 0) : null,
    blockedTotal: blocked != null ? round(blocked, 0) : null,
    waitedTotal: waited != null ? round(waited, 0) : null,
    contextSwitchRate,
    blockedRate,
    waitedRate,
  };
}

function idleTarget(name, state = "missing") {
  return {
    name,
    state,
    cpuPct: 0,
    memMb: 0,
    memLimitMb: 0,
    netRxMb: 0,
    netTxMb: 0,
    pids: 0,
    threads: null,
    heapUsedMb: null,
    gcPauseCount: null,
    gcPauseTotalMs: null,
    contextSwitchRate: null,
    blockedRate: null,
    waitedRate: null,
    contextSwitches: null,
    blockedTotal: null,
    waitedTotal: null,
    maxHeapMb: null,
    javaVersion: null,
    virtualThreadsEnabled: null,
  };
}

export async function containerStatsSnapshot(name) {
  const info = await inspectContainer(name);
  if (!info) {
    return idleTarget(name, "missing");
  }

  const state = info.State.Status;
  if (state !== "running") {
    return idleTarget(name, state);
  }

  const container = getDocker().getContainer(name);
  const [raw, health, jvm] = await Promise.all([
    withTimeout(container.stats({ stream: false }), STATS_TIMEOUT_MS),
    fetchTargetHealth(name),
    fetchJvmMetrics(name),
  ]);

  const mem = memoryMb(raw);
  const net = netMb(raw);

  return {
    name,
    state,
    cpuPct: cpuPercent(raw),
    memMb: mem.memMb,
    memLimitMb: mem.memLimitMb,
    netRxMb: net.netRxMb,
    netTxMb: net.netTxMb,
    pids: raw.pids_stats?.current ?? 0,
    threads: jvm.threads ?? health?.activeThreadCount ?? null,
    heapUsedMb: jvm.heapUsedMb,
    gcPauseCount: jvm.gcPauseCount,
    gcPauseTotalMs: jvm.gcPauseTotalMs,
    contextSwitchRate: jvm.contextSwitchRate,
    blockedRate: jvm.blockedRate,
    waitedRate: jvm.waitedRate,
    contextSwitches: jvm.contextSwitches,
    blockedTotal: jvm.blockedTotal,
    waitedTotal: jvm.waitedTotal,
    maxHeapMb: health?.maxHeapMb ?? null,
    javaVersion: health?.javaVersion ?? null,
    virtualThreadsEnabled: health?.virtualThreadsEnabled ?? null,
  };
}

/** Poll Docker API stats for all matrix targets (one-shot, for WS broadcast). */
export async function collectMatrixStats() {
  const targets = await Promise.all(
    MATRIX_TARGETS.map(async (name) => {
      try {
        return await containerStatsSnapshot(name);
      } catch (err) {
        return {
          ...idleTarget(name, "error"),
          error: err.message,
        };
      }
    }),
  );

  return {
    ts: new Date().toISOString(),
    source: "docker",
    targets,
  };
}
