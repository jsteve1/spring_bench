# Agent Handoff — Spring Bench (2026-07-26)

> **Read first:** `REQUIREMENTS.md` · `docs/11-backlog.md` · `docs/01-version-matrix.md`

---

## Current state (summary)

| Layer | Status | Notes |
| :-- | :-- | :-- |
| Docs / version pins | **Done** | Boot **4.1.0** / **2.7.18**; Java LTS matrix |
| `service/` | **Done (MVP)** | Contract tests + Micrometer/Prometheus + matrix tags |
| `docker-compose.yml` | **Done** | Digest pins + `BENCH_*` env tags + `k6-sse` tools profile |
| `orchestrator/` | **ORCH-02..05** | Docker control, live stats+JVM scrape, **REST + SSE k6 launch** |
| `dashboard/` | **DASH-02/03** | Controls + load-test form + charts (CPU/mem/threads/heap/GC) |
| Load tests | **LOAD-01..03** | `rest.js` + `sse.js` (`k6/x/sse`) + `bench/k6-sse` image |
| Observability | **OBS-01..04** | Tags + Actuator scrape + **JFR dump/collect after k6** |
| Standalone / tunnel | **Not started** | DoD #7/#8 |

---

## Definition of Done

| # | Item | Status |
| :--: | :-- | :--: |
| 1 | build-all → apps/ | ✅ |
| 2 | OpenAPI contract parity | ✅ |
| 3 | compose config + digests | ✅ |
| 4 | orchestrator start/stop | ✅ |
| 5 | k6 + live metrics + JFR | ⚠️ REST+SSE+live+JFR ✅; historical compare UI ❌ |
| 6 | SQLITE_BUSY test | ✅ |
| 7 | cloudflared | ❌ |
| 8 | standalone auth | ❌ |

---

## Recommended next task

1. **DASH-05** — Historical run comparison UI (client + JFR aggregates already on run records).
2. Wire live context-switch / lock-contention into charts where feasible (DoD #5 charts).
3. DoD #7/#8 — tunnel + standalone auth.

---

## How to verify this slice (SSE)

```bash
docker compose --profile tools build k6-sse
# confirm extension:
docker run --rm bench/k6-sse version   # should list k6/x/sse

docker compose up -d --build orchestrator java21-virtual-low
curl -X POST http://localhost:3000/api/loadtest \
  -H 'Content-Type: application/json' \
  -d '{"mode":"sse","targetName":"java21-virtual-low","vus":5,"duration":"15s","rampStages":"0:3s,full:9s,0:3s","dropRate":0.1}'
# poll GET /api/runs/{runId} — expect client.sse.events > 0 and artifacts.jfr
```

Manual (no orchestrator):

```bash
docker run --rm --network matrix-net \
  -e TARGET=http://java21-virtual-low:8080 -e VUS=5 -e DURATION=15s \
  -e RAMP_STAGES='0:3s,full:9s,0:3s' -e DROP_RATE=0.1 \
  -v "$PWD/loadtests:/scripts:ro" bench/k6-sse run /scripts/sse.js
```

---

## Key new files

| Path | Purpose |
| :-- | :-- |
| `loadtests/Dockerfile.k6-sse` | Custom k6 1.8.0 + xk6-sse@v0.1.11 |
| `loadtests/sse.js` | Long-lived `/events` hold + DROP_RATE |
| `scripts/build-k6-sse.sh` | One-shot image build |
| `orchestrator/src/loadtest.js` | ORCH-05 k6 runner (REST + SSE summary fields) |
| `orchestrator/src/jfr.js` | Post-run JFR dump + aggregates |
