# Agent Handoff — Spring Bench (2026-07-26)

> **Read first:** `REQUIREMENTS.md` · `docs/11-backlog.md` · `docs/01-version-matrix.md`

---

## Current state (summary)

| Layer | Status | Notes |
| :-- | :-- | :-- |
| Docs / version pins | **Done** | Boot **4.1.0** / **2.7.18**; Java LTS matrix |
| `service/` | **Done (MVP)** | Contract tests + Micrometer/Prometheus + matrix tags |
| `docker-compose.yml` | **Done** | Digest pins + `BENCH_*` + JFR `JAVA_OPTS` + `k6-sse` build profile |
| `orchestrator/` | **ORCH-02..05** | Docker control, live stats, k6 REST + **SSE fan-out**, JFR collect |
| `dashboard/` | **DASH-02/03** | Controls + load-test form (REST/SSE) + charts |
| Observability | **OBS-01..04** | Tags + Actuator scrape + JFR dump/collect |
| Standalone / tunnel | **Not started** | DoD #7/#8 |

---

## Definition of Done

| # | Item | Status |
| :--: | :-- | :--: |
| 1 | build-all → apps/ | ✅ |
| 2 | OpenAPI contract parity | ✅ |
| 3 | compose config + digests | ✅ |
| 4 | orchestrator start/stop | ✅ |
| 5 | k6 + live metrics + JFR | ✅ REST + SSE + live + JFR |
| 6 | SQLITE_BUSY test | ✅ |
| 7 | cloudflared | ❌ |
| 8 | standalone auth | ❌ |

---

## Recommended next task

1. **DASH-05** — Historical run comparison UI (client + JFR aggregates on run records).
2. DoD #7/#8 — tunnel + standalone auth.

---

## How to verify this slice

```powershell
docker compose --profile tools build k6-sse
docker compose up -d --build orchestrator java21-virtual-low
# wait for GET http://localhost:8087/health
Invoke-RestMethod -Method POST -Uri http://localhost:3000/api/loadtest -ContentType application/json -Body '{"mode":"sse","targetName":"java21-virtual-low","vus":5,"duration":"12s","rampStages":"full:12s","dropRate":0}'
# expect completed run with client.sse.events > 0, client.sse.connections == 5, artifacts.jfr
```

---

## Key notes

- SSE: `bench/k6-sse` = k6 1.8.0 + xk6-sse v0.1.12. Orchestrator fans out **1 container per VU** (`SSE_FANOUT_CONCURRENCY`, default 20) because xk6-sse does not multiplex concurrent holds in one process.
- REST still uses a single `grafana/k6:1.8.0` container.
