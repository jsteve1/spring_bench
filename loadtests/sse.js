import { check, sleep } from "k6";
import { Counter } from "k6/metrics";
import sse from "k6/x/sse";

/**
 * One long-lived /events connection per process.
 * xk6-sse is synchronous — orchestrator fans out one container per VU.
 */
const target = __ENV.TARGET || "http://localhost:8080";
const dropRate = Number(__ENV.DROP_RATE || 0.1);
const duration = __ENV.DURATION || "30s";
const durationMs = parseDurationMs(duration) || 30000;
const holdMs = Math.min(
  parseDurationMs(__ENV.HOLD) || Math.floor(durationMs * 0.7),
  Math.max(1000, durationMs - 2000),
);
const holdSec = Math.max(1, Math.ceil(holdMs / 1000));

const sseEvents = new Counter("sse_events");
const sseConnections = new Counter("sse_connections");
const sseDrops = new Counter("sse_drops");

export const options = {
  scenarios: {
    sse: {
      executor: "constant-vus",
      vus: 1,
      duration,
      gracefulStop: "3s",
    },
  },
};

export default function () {
  const earlyDrop = Math.random() < dropRate;
  const thisHoldSec = earlyDrop ? Math.max(1, Math.ceil(Math.random() * holdSec)) : holdSec;
  if (earlyDrop) {
    sseDrops.add(1);
  }

  let events = 0;
  let opened = false;
  const res = sse.open(
    `${target}/events`,
    {
      headers: { Accept: "text/event-stream" },
      timeout: `${thisHoldSec}s`,
    },
    function (client) {
      client.on("open", function () {
        opened = true;
      });
      client.on("event", function () {
        events += 1;
      });
      client.on("error", function () {});
    },
  );

  if (opened) {
    sseConnections.add(1);
  }
  if (events > 0) {
    sseEvents.add(events);
  }

  const ok = check(res, {
    "sse connected": (r) => r && (r.status === 200 || r.status === 0),
  });
  check(null, { "sse received events": () => events > 0 });

  if (!ok || events === 0) {
    sleep(1);
  }
}

function parseDurationMs(spec) {
  if (!spec) {
    return null;
  }
  const m = String(spec)
    .trim()
    .match(/^(\d+(?:\.\d+)?)(ms|s|m|h)?$/i);
  if (!m) {
    return null;
  }
  const n = Number(m[1]);
  const unit = (m[2] || "s").toLowerCase();
  if (unit === "ms") return n;
  if (unit === "s") return n * 1000;
  if (unit === "m") return n * 60 * 1000;
  if (unit === "h") return n * 3600 * 1000;
  return n * 1000;
}

export function handleSummary(data) {
  return {
    stdout: textSummary(data),
    "summary.json": JSON.stringify(data),
  };
}

function metricCount(data, name) {
  const m = data.metrics?.[name];
  return m?.values?.count ?? m?.count ?? null;
}

function textSummary(data) {
  const events =
    metricCount(data, "sse_events") ?? metricCount(data, "sse_event") ?? "n/a";
  const conns = metricCount(data, "sse_connections") ?? "n/a";
  return `k6 sse done events=${events} connections=${conns}\n`;
}
