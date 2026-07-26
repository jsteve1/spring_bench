import { MATRIX_TARGETS } from "./matrix.js";
import { getDocker, inspectContainer } from "./dockerClient.js";
import { fetchTargetHealth } from "./targets.js";

const STATS_TIMEOUT_MS = Number(process.env.STATS_TIMEOUT_MS || 4000);

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

async function containerStatsSnapshot(name) {
  const info = await inspectContainer(name);
  if (!info) {
    return {
      name,
      state: "missing",
      cpuPct: 0,
      memMb: 0,
      memLimitMb: 0,
      netRxMb: 0,
      netTxMb: 0,
      pids: 0,
      threads: null,
      maxHeapMb: null,
      javaVersion: null,
      virtualThreadsEnabled: null,
    };
  }

  const state = info.State.Status;
  if (state !== "running") {
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
      maxHeapMb: null,
      javaVersion: null,
      virtualThreadsEnabled: null,
    };
  }

  const container = getDocker().getContainer(name);
  const [raw, health] = await Promise.all([
    withTimeout(container.stats({ stream: false }), STATS_TIMEOUT_MS),
    fetchTargetHealth(name),
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
    threads: health?.activeThreadCount ?? null,
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
          name,
          state: "error",
          error: err.message,
          cpuPct: 0,
          memMb: 0,
          memLimitMb: 0,
          netRxMb: 0,
          netTxMb: 0,
          pids: 0,
          threads: null,
          maxHeapMb: null,
          javaVersion: null,
          virtualThreadsEnabled: null,
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
