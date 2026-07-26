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
| `THINK_TIME` | REST only: seconds to sleep after each iteration. **`0` = capacity mode** (default). `0.2` reproduces the paced first sweep (~42 rps). |

### 1.1 `rest.js`
- Exercises the CRUD contract (`docs/04 §2`) with a **light** read/write mix (as shipped: `/health`,
  paginated `GET /members`, and member create on ~1/5 VUs). Enough to stress SQLite WAL concurrency;
  not a full CRUD fuzz suite.
- Use `ramping-vus` executor built from `RAMP_STAGES`.
- Thresholds on `http_req_duration` (p95/p99) and `http_req_failed`.

### 1.2 `sse.js` — requires the `xk6-sse` extension (important)
**k6 core has no native SSE/`EventSource` client.** Do not assume `http.get` will hold a stream.
Use the **`xk6-sse`** extension and build a custom k6 binary:

```dockerfile
# loadtests/Dockerfile.k6-sse — custom k6 with SSE support
# k6 v1.8.0 needs Go >= 1.25 → use grafana/xk6:1.4.7
FROM grafana/xk6:1.4.7 AS build
RUN xk6 build v1.8.0 --with github.com/phymbert/xk6-sse@v0.1.11 -o /tmp/k6
FROM grafana/k6:1.8.0
USER root
COPY --from=build /tmp/k6 /usr/bin/k6
USER k6
```
- `sse.js` imports `sse` from `k6/x/sse`, opens and **holds** `/events` for `HOLD`/`DURATION`,
  and counts received events — this is what surfaces parked-connection memory footprint.
- Randomly closes a fraction of connections early per `DROP_RATE` (flaky-client simulation).
- This is the headline test: platform threads (one OS thread per held connection) vs virtual
  threads (cheap parked continuations) diverge sharply here.
- **Fan-out (implemented):** `xk6-sse` is synchronous and does not multiplex concurrent holds in one
  process, so the orchestrator runs **one `VUS=1` container per requested VU** and merges the
  per-worker summaries into `runs/{id}/summary.json` (`sse_events` / `sse_connections` / `sse_drops`).
  Per-worker files stay as `summary-{n}.json` for debugging. Batch size:
  `SSE_FANOUT_CONCURRENCY` (default 20).
- Build the image first: `docker compose --profile tools build k6-sse` (or
  `docker build -f loadtests/Dockerfile.k6-sse -t bench/k6-sse .`). REST mode uses stock
  `grafana/k6:1.8.0` and is auto-pulled.
- **Verified 2026-07-26** on Docker Engine 29.6.1: 15 VUs → 15 concurrent containers, 15 held
  connections, 102 events, exit 0.

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
  -v $PWD/loadtests:/scripts bench/k6-sse run /scripts/sse.js
```
Build the SSE image first: `docker compose --profile tools build k6-sse`.

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
