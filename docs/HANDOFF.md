# Agent Handoff — Spring Bench (2026-07-25)

> **Read first:** `REQUIREMENTS.md` · `docs/11-backlog.md` · `docs/01-version-matrix.md`

---

## Current state (summary)

| Layer | Status | Notes |
| :-- | :-- | :-- |
| Docs / version pins | **Done** | Boot **4.1.0** / **2.7.18**; Java LTS matrix |
| `service/` | **Done (MVP)** | Contract tests + Micrometer/Prometheus + matrix tags |
| `docker-compose.yml` | **Done** | Digest pins + `BENCH_*` env tags per row |
| `orchestrator/` | **ORCH-02..05** | Docker control, live stats+JVM scrape, **k6 launch** |
| `dashboard/` | **DASH-02/03** | Controls + load-test form + charts (CPU/mem/threads/heap/GC) |
| Observability | **OBS-01 + partial OBS-04** | Tags + Actuator scrape; **JFR still TODO (OBS-02)** |
| Standalone / tunnel | **Not started** | DoD #7/#8 |

---

## Definition of Done

| # | Item | Status |
| :--: | :-- | :--: |
| 1 | build-all → apps/ | ✅ |
| 2 | OpenAPI contract parity | ✅ |
| 3 | compose config + digests | ✅ |
| 4 | orchestrator start/stop | ✅ |
| 5 | k6 + live metrics + JFR | ⚠️ k6 REST + live docker/JVM ✅; JFR/SSE image ❌ |
| 6 | SQLITE_BUSY test | ✅ |
| 7 | cloudflared | ❌ |
| 8 | standalone auth | ❌ |

---

## Recommended next task

1. **OBS-02** — Append JFR flags to each matrix `JAVA_OPTS`; dump `/tmp/bench.jfr`.
2. **OBS-03** — After k6 run, `docker cp` JFR into `runs/{id}/`.
3. **LOAD-02/03** — Build `bench/k6-sse` and wire SSE mode (already coded; needs image).
4. **DASH-05** — Historical run comparison UI.
5. DoD #7/#8 — tunnel + standalone auth.

---

## How to verify this slice

```powershell
cd service; .\build-all.ps1   # rebuild JARs with prometheus registry
docker compose up -d --build orchestrator java21-virtual-low
curl http://localhost:8087/actuator/prometheus | Select-String "runtime="
curl http://localhost:3000/api/stats
curl -Method POST http://localhost:3000/api/loadtest -ContentType "application/json" -Body '{"mode":"rest","targetName":"java21-virtual-low","vus":5,"duration":"20s","rampStages":"0:5s,full:10s,0:5s"}'
curl http://localhost:3000/api/runs
```

Dashboard: `cd dashboard; npm install; npm run dev`

SSE mode needs: `docker build -f loadtests/Dockerfile.k6-sse -t bench/k6-sse .`

---

## Key new files

| Path | Purpose |
| :-- | :-- |
| `orchestrator/src/loadtest.js` | ORCH-05 k6 container runner |
| `orchestrator/src/stats.js` | Docker stats + Actuator JVM metrics |
| `management.metrics.tags` in both `application.yml` | OBS-01 |
| `BENCH_*` in compose | Tag values per matrix row |
