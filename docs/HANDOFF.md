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
| `dashboard/` | **DASH-02/03/05** | Controls + load form + charts + **historical compare** |
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
| 5 | k6 + live metrics + JFR | ⚠️ REST+SSE+live+JFR+compare ✅; live CS/lock charts still thin |
| 6 | SQLITE_BUSY test | ✅ |
| 7 | cloudflared | ❌ |
| 8 | standalone auth | ❌ |

---

## Recommended next task

1. Wire live context-switch / lock-contention into real-time charts (DoD #5 charts).
2. DoD #7/#8 — tunnel + standalone auth.
3. Persist peak mem/threads onto run records from the stats stream (improves compare columns).

---

## How to verify this slice (DASH-05, no Docker)

```bash
cd dashboard && npm install && npm run test:unit && npm run build
npm run dev
# Open UI → Historical comparison → "Load demo runs" → select ≥2 runs
```

With orchestrator + completed runs: `GET /api/runs` feeds the same selector (warmup/`phase=warmup` excluded).

SSE image: `docker compose --profile tools build k6-sse`

---

## Key new files

| Path | Purpose |
| :-- | :-- |
| `dashboard/src/RunCompare.jsx` | DASH-05 multi-run compare (bars + table) |
| `dashboard/src/runMeta.js` | Target dim parse + metric flatten |
| `dashboard/src/fixtures/demoRuns.js` | Offline demo history |
| `loadtests/Dockerfile.k6-sse` | Custom k6 1.8.0 + xk6-sse |
| `loadtests/sse.js` | Long-lived `/events` hold + DROP_RATE |
| `orchestrator/src/jfr.js` | Post-run JFR dump + aggregates |
