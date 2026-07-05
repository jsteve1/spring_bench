import http from "k6/http";
import { check, sleep } from "k6";

const target = __ENV.TARGET || "http://localhost:8080";
const duration = __ENV.DURATION || "2m";
const vus = Number(__ENV.VUS || 50);
const dropRate = Number(__ENV.DROP_RATE || 0.1);

export const options = {
  vus,
  duration,
};

export default function () {
  const res = http.get(`${target}/events`, {
    headers: { Accept: "text/event-stream" },
    timeout: "120s",
  });
  check(res, { "sse connected": (r) => r.status === 200 });
  if (Math.random() < dropRate) {
    return;
  }
  sleep(5);
}

export function handleSummary(data) {
  return {
    stdout: JSON.stringify(data, null, 2),
    "summary.json": JSON.stringify(data),
  };
}
