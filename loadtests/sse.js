import { check } from "k6";
import { Counter } from "k6/metrics";
import sse from "k6/x/sse";

const target = __ENV.TARGET || "http://localhost:8080";
const vus = Number(__ENV.VUS || 50);
const dropRate = Number(__ENV.DROP_RATE || 0.1);
/** How long each VU holds an `/events` connection (headline memory test). */
const holdMs = parseDurationMs(__ENV.HOLD || __ENV.DURATION || "30s");

const sseEvents = new Counter("sse_events");
const sseConnections = new Counter("sse_connections");
const sseDrops = new Counter("sse_drops");

export const options = {
  stages: parseRampStages(__ENV.RAMP_STAGES || "0:15s,full:30s,0:15s", vus),
  thresholds: {
    checks: ["rate>0.95"],
  },
};

export default function () {
  // DROP_RATE: fraction of connections that close early (then VU may reopen).
  const earlyDrop = Math.random() < dropRate;
  const thisHoldMs = earlyDrop ? Math.max(500, Math.random() * holdMs) : holdMs;
  if (earlyDrop) {
    sseDrops.add(1);
  }

  const started = Date.now();
  let events = 0;
  // Timeout is a hard upper bound if heartbeats stall; event handler closes earlier.
  const timeoutSec = Math.max(1, Math.ceil(thisHoldMs / 1000) + 2);

  const res = sse.open(
    `${target}/events`,
    {
      method: "GET",
      headers: { Accept: "text/event-stream" },
      tags: { name: "sse" },
      timeout: `${timeoutSec}s`,
    },
    function (client) {
      client.on("open", function () {
        sseConnections.add(1);
      });

      client.on("event", function () {
        events += 1;
        sseEvents.add(1);
        if (Date.now() - started >= thisHoldMs) {
          client.close();
        }
      });

      client.on("error", function (e) {
        console.error(`sse error: ${e && e.error ? e.error() : e}`);
      });
    },
  );

  check(res, { "sse status 200": (r) => r && r.status === 200 });
  check(null, { "sse received events": () => events > 0 });
}

/** Spec format: `0:30s,full:2m,0:30s` → stages of {target, duration}. */
function parseRampStages(spec, peakVus) {
  return spec
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const idx = part.indexOf(":");
      if (idx < 0) {
        return { target: peakVus, duration: part };
      }
      const rawTarget = part.slice(0, idx);
      const durationPart = part.slice(idx + 1);
      return {
        target: rawTarget === "full" ? peakVus : Number(rawTarget),
        duration: durationPart,
      };
    });
}

function parseDurationMs(spec) {
  const m = String(spec)
    .trim()
    .match(/^(\d+(?:\.\d+)?)(ms|s|m|h)?$/i);
  if (!m) {
    return 30000;
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

function textSummary(data) {
  const events = data.metrics?.sse_events?.values?.count ?? data.metrics?.sse_events?.count;
  const conns =
    data.metrics?.sse_connections?.values?.count ?? data.metrics?.sse_connections?.count;
  return `k6 sse done events=${events ?? "n/a"} connections=${conns ?? "n/a"}\n`;
}
