import http from "k6/http";
import { check, sleep } from "k6";

const target = __ENV.TARGET || "http://localhost:8080";
const duration = __ENV.DURATION || "1m";
const vus = Number(__ENV.VUS || 10);

export const options = {
  stages: parseRampStages(__ENV.RAMP_STAGES || "0:15s,full:30s,0:15s", vus),
  thresholds: {
    http_req_failed: ["rate<0.05"],
    http_req_duration: ["p(95)<2000", "p(99)<5000"],
  },
};

export default function () {
  const health = http.get(`${target}/health`);
  check(health, { "health up": (r) => r.status === 200 });

  const list = http.get(`${target}/members?page=0&size=10`);
  check(list, { "list members": (r) => r.status === 200 });

  // Light write mix so SQLite WAL path is exercised under concurrency.
  if (__VU % 5 === 0) {
    const payload = JSON.stringify({
      demographics: {
        fname: `Load${__VU}`,
        lname: `User${__ITER}`,
        email: `load${__VU}.${__ITER}@example.com`,
        phoneNumber: "+1-555-0199",
        status: "ALIVE",
      },
    });
    const created = http.post(`${target}/members`, payload, {
      headers: { "Content-Type": "application/json", "X-User": "k6" },
    });
    check(created, { "create member": (r) => r.status === 201 || r.status === 200 });
  }

  // Optional think time between iterations. Default 0 = capacity mode (no pacing).
  // Prior sweeps used 0.2s and capped every runtime near ~42 rps.
  const thinkTime = Number(__ENV.THINK_TIME ?? 0);
  if (thinkTime > 0) {
    sleep(thinkTime);
  }
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

export function handleSummary(data) {
  return {
    stdout: textSummary(data),
    "summary.json": JSON.stringify(data),
  };
}

function textSummary(data) {
  const failed = data.metrics?.http_req_failed?.values?.rate;
  const p95 = data.metrics?.http_req_duration?.values?.["p(95)"];
  return `k6 done p95=${p95 ?? "n/a"} failed=${failed ?? "n/a"}\n`;
}
