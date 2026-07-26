# Agent Handoff — Spring Bench (2026-07-25)

> **Read first:** `REQUIREMENTS.md` (Definition of Done) · `docs/11-backlog.md` (story IDs) · `docs/01-version-matrix.md` (pins)

This document captures what the previous agent built, what is stubbed, and the **recommended next task** for the agent that continues this work.

---

## Current state (summary)

| Layer | Status | Notes |
| :-- | :-- | :-- |
| Docs / version pins | **Done** | Boot **4.1.0** modern, **2.7.18** legacy; Java matrix LTS-only (8/11/17/21/25) |
| `service/` multi-module | **Done (MVP)** | Core + both shells; contract integration tests green |
| `apps/` artifacts | **Local only** | JARs gitignored; run `service/build-all.ps1` after clone |
| `docker-compose.yml` | **Done (PIN-02)** | All Temurin + cloudflared images digest-pinned |
| `orchestrator/` | **ORCH-02/03/04** | Docker control + **real** `/api/stats` + WS `/api/stats/stream` |
| `dashboard/` | **Partial (DASH-02)** | Start/stop/restart + live CPU/mem/thread charts |
| `loadtests/` | **Stub** | `rest.js` / `sse.js` present; `bench/k6-sse` image not built in CI |
| Tests | **Partial** | PERSIST-06 + LEGACY-07/MODERN-06 contract tests; OpenAPI signature diff green |
| Observability / JFR | **Partial** | Thread count from `/health` in stats; Micrometer tags + JFR not done |
| Standalone / auth | **Not started** | Profile exists; no security, no persistent DB docs verified |
| cloudflared | **Compose only** | `--profile tunnel`; needs `TUNNEL_TOKEN` in `.env` |

---

## Definition of Done checklist

| # | Item | Status |
| :--: | :-- | :--: |
| 1 | `build-all` → `./apps/` | ✅ (run locally; JARs not in git) |
| 2 | Identical contract / OpenAPI diff empty | ✅ `scripts/openapi-diff.mjs` (contract signature compare) |
| 3 | `docker compose config` validates | ✅ all matrix images digest-pinned |
| 4 | Orchestrator + matrix start/stoppable | ✅ ORCH-02/03 via `/api/targets` + start/stop/restart |
| 5 | k6 load test + live/historical metrics + JFR | ❌ partial (live docker stats ✅; k6/JFR ❌) |
| 6 | Zero `SQLITE_BUSY` under load | ✅ `ConcurrentWriteLoadTest` |
| 7 | cloudflared public hostname | ❌ |
| 8 | Standalone mode with auth | ❌ |

---

## Recommended next task (start here)

### **Epic: Observability + load testing (continued)**

**Goal:** JVM-depth metrics and k6 integration.

**Stories (in order):**

1. **OBS-01** — Micrometer matrix tags on both shells; scrape `/actuator/prometheus` or metrics from orchestrator.
2. **OBS-02** — JFR flags merged into compose `JAVA_OPTS`; persist `.jfr` on runs.
3. **LOAD-01 / ORCH-05** — k6 REST load test triggered from orchestrator (`POST /api/loadtest` still queues only).
4. **DASH-04** — Charts for GC / context-switch / lock contention once OBS is wired.
5. Build dashboard into orchestrator image (multi-stage Dockerfile).

**Acceptance:** One k6 REST run launchable from orchestrator; run record persisted with client summary.

---

## Build & run (for the next agent)

**Prerequisites:** JDK **17+**, Maven **3.9+** (or use repo-local `.tools/apache-maven-3.9.9` via `build-all.ps1` fallback).

```powershell
# Build (from repo root)
cd service
.\build-all.ps1

# Docker matrix + orchestrator (after build)
docker compose config
docker compose up -d --build orchestrator java21-virtual-low

# Real stats snapshot
curl http://localhost:3000/api/stats

# Targets + control
curl http://localhost:3000/api/targets
curl -X POST http://localhost:3000/api/targets/java21-virtual-low/restart
```

Dashboard (dev): `cd dashboard && npm install && npm run dev` (proxies `/api` to `:3000`).

**Linux host (authoritative):** use `service/build-all.sh`; matrix targets expect Linux paths (`DB_PATH=/tmp/insurance.db`).

---

## Architecture reminders

- **Two real JARs:** `insurance-legacy.jar` (Boot 2.7, Java 8 bytecode) · `insurance-modern.jar` (Boot 4.1, Java 17 bytecode).
- **Five matrix names** are copies of those two artifacts (`docs/02 §4`).
- **Shared core** must stay free of Spring / `javax` / `jakarta` (`core-domain`, `core-persistence`).
- **Virtual threads:** `SPRING_THREADS_VIRTUAL_ENABLED=true` only on Java **21+** rows in compose.
- **Spring Boot 4 Flyway:** modern shell requires `spring-boot-starter-flyway` (not `flyway-core` alone).
- **Modern integration tests:** use `RestTestClient` + `@AutoConfigureRestTestClient` (Boot 4); legacy uses REST-assured.
- **Stats:** `orchestrator/src/stats.js` polls Docker API one-shot stats + merges `/health` thread/heap fields.

---

## Known gaps / tech debt

| Issue | Location | Fix hint |
| :-- | :-- | :-- |
| Seed creates members only (no agreements/dependents fraction) | `SeedServiceImpl` | PERSIST-05 full spec |
| `POST /api/loadtest` only writes a queued JSON file | `orchestrator/src/index.js` | ORCH-05 / LOAD-01 |
| No Micrometer matrix dimension tags | both shells | OBS-01 |
| No JFR in JAVA_OPTS | `docker-compose.yml` | OBS-02 |
| Dashboard not built into orchestrator image | `orchestrator/Dockerfile` | Multi-stage or mount `dashboard/dist` |
| OpenAPI raw JSON differs (3.0 vs 3.1 springdoc) | both shells | Contract signature diff is authoritative |

---

## Key files

| Path | Purpose |
| :-- | :-- |
| `orchestrator/src/stats.js` | ORCH-04 Docker stats collector |
| `orchestrator/src/targets.js` | ORCH-02/03 target list + start/stop/restart |
| `dashboard/src/App.jsx` | Live charts + control buttons |
| `scripts/openapi-diff.mjs` | DoD #2 contract signature diff |
| `docker-compose.yml` | Digest-pinned 10-service matrix |
| `docs/11-backlog.md` | Full story backlog |

---

## Completed this session (2026-07-25)

- Merged PR #4 (ORCH-02/03).
- **ORCH-04:** real Docker stats via `GET /api/stats` and WS `/api/stats/stream`.
- **DASH-02:** dashboard start/stop/restart + CPU / memory / thread charts.
- Stats frames include `cpuPct`, `memMb`, `memLimitMb`, net I/O, PIDs, plus `/health` threads/heap when running.

---

## Suggested commit / PR scope

Follow-on work: **OBS-01 → ORCH-05/k6 → JFR** as separate PRs.
