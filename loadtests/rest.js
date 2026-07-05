import http from "k6/http";
import { check, sleep } from "k6";

const target = __ENV.TARGET || "http://localhost:8080";
const duration = __ENV.DURATION || "1m";
const vus = Number(__ENV.VUS || 10);

export const options = {
  stages: parseRampStages(__ENV.RAMP_STAGES || "0:30s,full:1m,0:30s", vus),
  thresholds: {
    http_req_failed: ["rate<0.05"],
    http_req_duration: ["p(95)<500"],
  },
};

export default function () {
  const list = http.get(`${target}/members?page=0&size=10`);
  check(list, { "list members": (r) => r.status === 200 });

  const health = http.get(`${target}/health`);
  check(health, { "health up": (r) => r.status === 200 && r.json("status") === "UP" });

  sleep(0.2);
}

function parseRampStages(spec, peakVus) {
  const parts = spec.split(",");
  const stages = [];
  for (let i = 0; i < parts.length; i += 2) {
    const target = parts[i] === "full" ? peakVus : Number(parts[i]);
    const durationPart = parts[i + 1] || "30s";
    stages.push({ target, duration: durationPart });
  }
  return stages.length ? stages : [{ target: peakVus, duration }];
}

export function handleSummary(data) {
  return {
    stdout: JSON.stringify(data, null, 2),
    "summary.json": JSON.stringify(data),
  };
}
