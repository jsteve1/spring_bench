# 06 — Load Testing & Dashboard

Versions pinned in `docs/01`. The orchestrator triggers k6 and serves results (`docs/05 §3`).

---

## 1. Load Injector — `k6` 1.8.0 (`loadtests/`)

Two scripts, both fully parameterized via env (orchestrator passes `-e KEY=VALUE`):

| Param (env) | Meaning |
| :-- | :-- |
| `TARGET` | Base URL of the matrix service under test (e.g. `http://java21-virtual-low:8080`) |
| `VUS` | Total virtual users (peak) |
| `RAMP_STAGES` | Ramp-up steps, e.g. `0:30s,full:2m,0:30s` → translated to k6 `stages` |
| `DURATION` | Total test duration |
| `DROP_RATE` | Connection drop probability (0.0–1.0) to simulate flaky clients |

### 1.1 `rest.js`
- Exercises the CRUD contract (`docs/04 §2`) with a configurable read/write mix.
- Use `ramping-vus` executor built from `RAMP_STAGES`.
- Thresholds on `http_req_duration` (p95/p99) and `http_req_failed`.

### 1.2 `sse.js` — requires the `xk6-sse` extension (important)
**k6 core has no native SSE/`EventSource` client.** Do not assume `http.get` will hold a stream.
Use the **`xk6-sse`** extension and build a custom k6 binary:

```dockerfile
# loadtests/Dockerfile.k6-sse — custom k6 with SSE support
FROM grafana/xk6:latest AS build
RUN xk6 build v0.58.0 \           # pin a k6 1.x core version compatible with xk6-sse
    --with github.com/phymbert/xk6-sse
FROM grafana/k6:1.8.0
COPY --from=build /xk6 /usr/bin/k6
```
- `sse.js` imports `sse` from `k6/x/sse`, opens and **holds** `/events` connections for the full
  `DURATION`, and counts received events — this is what surfaces parked-connection memory footprint.
- Randomly drops/reopens a fraction of connections per `DROP_RATE`.
- This is the headline test: platform threads (one OS thread per held connection) vs virtual
  threads (cheap parked continuations) diverge sharply here.
- **Fallback if extensions are undesirable:** model SSE as a long-lived raw TCP/HTTP read using a
  k6 scenario with a high `gracefulStop` and per-VU `sleep` to keep iterations open. Document
  whichever approach is chosen; the extension path is preferred for fidelity.
- Build the image once: `docker build -f loadtests/Dockerfile.k6-sse -t bench/k6-sse .` and use
  `bench/k6-sse` instead of `grafana/k6:1.8.0` for SSE runs.

### 1.3 Output
- Emit a machine-readable summary (`handleSummary` → JSON) the orchestrator ingests: p50/p95/p99
  latency, RPS/iterations, error rate, data received, VU counts.
- Use the stable **k6 1.x** line (image `grafana/k6:1.8.0`). Conservative choice: avoids the k6
  v2.0.0 breaking changes (removed executors, Go module path change, mandatory `--address` for the
  HTTP API). If you later upgrade to v2, re-validate scripts against its migration guide.

### 1.4 Running
The orchestrator runs k6 in a container sharing `matrix-net` so it can reach targets by service
name, e.g.:
```bash
docker run --rm --network matrix-net \
  -e TARGET=http://java21-virtual-low:8080 -e VUS=500 -e DURATION=3m \
  -e RAMP_STAGES="0:30s,full:2m,0:30s" -e DROP_RATE=0.1 \
  -v $PWD/loadtests:/scripts grafana/k6:1.8.0 run /scripts/sse.js
```

---

## 2. Dashboard (`dashboard/`)

**Recommended stack: React 18.3 + Chart.js 4.5.1** (via `react-chartjs-2`). React aligns with the
JPMC frontend requirement (`docs/07`); a plain static HTML+Chart.js page is an acceptable simpler
fallback. Served by the orchestrator or any static host, behind the same cloudflared tunnel.

Required views:
- **Targets panel:** list matrix services with start/stop controls, running state, and `/health`
  badges (Java version, Spring Boot, platform/virtual, heap).
- **Load-test form:** the five params (`TARGET`, `VUS`, `RAMP_STAGES`, `DURATION`, `DROP_RATE`)
  plus REST/SSE mode → `POST /api/loadtest`.
- **Real-time charts:** CPU saturation %, memory, plus JVM-internal metrics (thread count, GC
  pauses, context-switch rate, monitor/lock contention) per target — see `docs/09` for how these
  are captured. Fed by `GET /api/stats/stream` (WS/SSE). Line charts, rolling window.
- **Historical comparison:** select past runs (`GET /api/runs`) and compare latency
  (p50/p95/p99), RPS, error rate, and peak memory **across Java versions / threading models /
  footprints** — the core deliverable of the matrix.

Design for clarity: one variable per comparison (e.g. platform vs virtual on identical runtime +
footprint) so charts tell a clean story. Benchmark methodology (warmup, repetitions, fairness
across JVMs) is defined in `docs/09`.
