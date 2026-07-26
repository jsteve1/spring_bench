import fs from "fs";
import path from "path";
import { assertMatrixTarget, MATRIX_TARGETS } from "./matrix.js";
import { getDocker } from "./dockerClient.js";
import { demuxDockerStream } from "./dockerStream.js";
import { collectJfr } from "./jfr.js";

const RUNS_DIR = process.env.RUNS_DIR || path.join(process.cwd(), "runs");
const ORCHESTRATOR_NAME = process.env.ORCHESTRATOR_CONTAINER || "orchestrator";
const DOCKER_NETWORK = process.env.DOCKER_NETWORK || "matrix-net";
const K6_REST_IMAGE = process.env.K6_REST_IMAGE || "grafana/k6:1.8.0";
const K6_SSE_IMAGE = process.env.K6_SSE_IMAGE || "bench/k6-sse";
const LOADTESTS_IN_ORCH = process.env.LOADTESTS_PATH || "/loadtests";

function writeRecord(runId, record) {
  fs.mkdirSync(RUNS_DIR, { recursive: true });
  fs.writeFileSync(path.join(RUNS_DIR, `${runId}.json`), JSON.stringify(record, null, 2));
}

function readRecord(runId) {
  const file = path.join(RUNS_DIR, `${runId}.json`);
  if (!fs.existsSync(file)) {
    return null;
  }
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

async function hostBindFor(containerPath) {
  if (process.env.LOADTESTS_HOST_PATH && containerPath === LOADTESTS_IN_ORCH) {
    return process.env.LOADTESTS_HOST_PATH;
  }
  if (process.env.RUNS_HOST_PATH && containerPath.startsWith("/app/runs")) {
    return process.env.RUNS_HOST_PATH;
  }
  try {
    const info = await getDocker().getContainer(ORCHESTRATOR_NAME).inspect();
    const mount = (info.Mounts || []).find((m) => m.Destination === containerPath);
    if (mount?.Source) {
      return mount.Source;
    }
  } catch {
    // fall through
  }
  return containerPath;
}

function normalizeRequest(body = {}) {
  const mode = (body.mode || "rest").toLowerCase();
  const targetName = body.targetName || body.target || "java21-virtual-low";
  assertMatrixTarget(targetName);
  const targetUrl =
    body.targetUrl || `http://${targetName}:${process.env.MATRIX_INTERNAL_PORT || "8080"}`;
  return {
    mode: mode === "sse" ? "sse" : "rest",
    targetName,
    targetUrl,
    vus: Number(body.vus || body.VUS || 10),
    duration: body.duration || body.DURATION || "1m",
    rampStages: body.rampStages || body.RAMP_STAGES || "0:15s,full:30s,0:15s",
    dropRate: Number(body.dropRate || body.DROP_RATE || 0.1),
  };
}

function summarizeK6(summary) {
  if (!summary?.metrics) {
    return { raw: summary };
  }
  const m = summary.metrics;
  // k6 --summary-export: older builds nest under .values; 1.x flattens.
  const pick = (metric) => metric?.values || metric || {};
  const lat = pick(m.http_req_duration);
  const reqs = pick(m.http_reqs);
  const iters = pick(m.iterations);
  const failed = pick(m.http_req_failed);
  const received = pick(m.data_received);
  const sseEvents = pick(m.sse_events);
  const sseConnections = pick(m.sse_connections);
  const sseDrops = pick(m.sse_drops);
  return {
    rps: reqs.rate ?? null,
    iterations: iters.count ?? null,
    errorRate: failed.rate ?? failed.value ?? null,
    latencyMs: {
      p50: lat["p(50)"] ?? lat.med ?? null,
      p95: lat["p(95)"] ?? null,
      p99: lat["p(99)"] ?? null,
    },
    dataReceivedMb: received.count
      ? Math.round((received.count / (1024 * 1024)) * 100) / 100
      : null,
    sse: {
      events: sseEvents.count ?? null,
      connections: sseConnections.count ?? null,
      drops: sseDrops.count ?? null,
    },
  };
}

async function waitContainer(container, timeoutMs = 15 * 60 * 1000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const info = await container.inspect();
    if (!info.State.Running) {
      return info.State.ExitCode ?? 0;
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  try {
    await container.stop({ t: 5 });
  } catch {
    // ignore
  }
  throw new Error("k6 run timed out");
}

async function imageExists(name) {
  try {
    await getDocker().getImage(name).inspect();
    return true;
  } catch {
    return false;
  }
}

async function ensureImage(name) {
  if (await imageExists(name)) {
    return;
  }
  await new Promise((resolve, reject) => {
    getDocker().pull(name, (err, stream) => {
      if (err) {
        reject(err);
        return;
      }
      getDocker().modem.followProgress(stream, (err2) => (err2 ? reject(err2) : resolve()));
    });
  });
}

async function runK6(runId, request) {
  const docker = getDocker();
  const script = request.mode === "sse" ? "sse.js" : "rest.js";
  const image = request.mode === "sse" ? K6_SSE_IMAGE : K6_REST_IMAGE;

  if (request.mode === "sse") {
    if (!(await imageExists(image))) {
      throw new Error(
        `SSE image '${image}' not found. Build with: docker compose --profile tools build k6-sse`,
      );
    }
  } else {
    await ensureImage(image);
  }

  const loadtestsHost = await hostBindFor(LOADTESTS_IN_ORCH);
  const runsHost = await hostBindFor("/app/runs");
  const outHost = path.join(runsHost, runId);
  const outDir = path.join(RUNS_DIR, runId);
  fs.mkdirSync(outDir, { recursive: true });
  // k6 image runs as non-root; ensure summary export can write.
  try {
    fs.chmodSync(outDir, 0o777);
  } catch {
    // ignore (Windows host bind may not honor chmod)
  }

  const Env = [
    `TARGET=${request.targetUrl}`,
    `VUS=${request.vus}`,
    `DURATION=${request.duration}`,
    `RAMP_STAGES=${request.rampStages}`,
    `DROP_RATE=${request.dropRate}`,
  ];

  const container = await docker.createContainer({
    Image: image,
    name: `k6-${runId.slice(0, 8)}`,
    User: "0:0",
    Env,
    Cmd: ["run", "--summary-export=/out/summary.json", `/scripts/${script}`],
    HostConfig: {
      AutoRemove: false,
      NetworkMode: DOCKER_NETWORK,
      Binds: [`${loadtestsHost}:/scripts:ro`, `${outHost}:/out`],
    },
  });

  await container.start();
  const exitCode = await waitContainer(container);
  let logs = "";
  try {
    const buf = await container.logs({ stdout: true, stderr: true, follow: false });
    logs = demuxDockerStream(buf).slice(-8000);
  } catch {
    // ignore
  }
  try {
    await container.remove({ force: true });
  } catch {
    // ignore
  }

  const summaryPath = path.join(RUNS_DIR, runId, "summary.json");
  let summary = null;
  if (fs.existsSync(summaryPath)) {
    summary = JSON.parse(fs.readFileSync(summaryPath, "utf8"));
  }

  return {
    exitCode,
    logs,
    client: summarizeK6(summary),
    artifacts: {
      k6Summary: `runs/${runId}/summary.json`,
    },
  };
}

export function queueLoadTest(body) {
  const request = normalizeRequest(body);
  const runId = crypto.randomUUID();
  const record = {
    runId,
    startedAt: new Date().toISOString(),
    status: "running",
    target: request.targetName,
    config: {
      mode: request.mode,
      targetUrl: request.targetUrl,
      vus: request.vus,
      duration: request.duration,
      rampStages: request.rampStages,
      dropRate: request.dropRate,
    },
    request,
  };
  writeRecord(runId, record);

  setImmediate(async () => {
    try {
      const result = await runK6(runId, request);
      let jfr = null;
      try {
        jfr = await collectJfr(request.targetName, runId);
      } catch (err) {
        jfr = { ok: false, error: err.message };
      }
      const updated = {
        ...readRecord(runId),
        finishedAt: new Date().toISOString(),
        status: result.exitCode === 0 ? "completed" : "failed",
        exitCode: result.exitCode,
        client: result.client,
        server: {
          jfrAggregates: jfr?.aggregates || null,
        },
        artifacts: {
          ...result.artifacts,
          jfr: jfr?.path || null,
        },
        jfr,
        logsTail: result.logs,
      };
      writeRecord(runId, updated);
    } catch (err) {
      writeRecord(runId, {
        ...readRecord(runId),
        finishedAt: new Date().toISOString(),
        status: "failed",
        error: err.message,
      });
    }
  });

  return record;
}

export { MATRIX_TARGETS, readRecord, writeRecord };
