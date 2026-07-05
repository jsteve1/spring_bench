# Agent Handoff — Spring Bench (2026-07-05)

> **Read first:** `REQUIREMENTS.md` (Definition of Done) · `docs/11-backlog.md` (story IDs) · `docs/01-version-matrix.md` (pins)

This document captures what the previous agent built, what is stubbed, and the **recommended next task** for the agent that continues this work.

---

## Current state (summary)

| Layer | Status | Notes |
| :-- | :-- | :-- |
| Docs / version pins | **Done** | Boot **4.1.0** modern, **2.7.18** legacy; Java matrix LTS-only (8/11/17/21/25) |
| `service/` multi-module | **Done (MVP)** | Core + both shells compile; `/health` smoke-tested on modern JAR |
| `apps/` artifacts | **Local only** | JARs gitignored; run `service/build-all.ps1` after clone |
| `docker-compose.yml` | **Done (tags)** | 10 matrix services + orchestrator; **no digest pins yet** |
| `orchestrator/` | **Stub** | Express API skeleton; Docker socket **not** wired |
| `dashboard/` | **Stub** | React + Chart.js scaffold; needs `npm run build` for orchestrator static serve |
| `loadtests/` | **Stub** | `rest.js` / `sse.js` present; `bench/k6-sse` image not built in CI |
| Tests | **Missing** | No PERSIST-06 write-load test; no REST-assured; no OpenAPI diff |
| Observability / JFR | **Not started** | Actuator exposed; no JFR wiring, no Micrometer matrix tags |
| Standalone / auth | **Not started** | Profile exists; no security, no persistent DB docs verified |
| cloudflared | **Compose only** | `--profile tunnel`; needs `TUNNEL_TOKEN` in `.env` |

---

## Definition of Done checklist

| # | Item | Status |
| :--: | :-- | :--: |
| 1 | `build-all` → `./apps/` | ✅ (run locally; JARs not in git) |
| 2 | Identical contract / OpenAPI diff empty | ❌ not verified |
| 3 | `docker compose config` validates | ✅ (major tags; digests pending PIN-02) |
| 4 | Orchestrator + matrix start/stoppable | ❌ orchestrator stub only |
| 5 | k6 load test + live/historical metrics + JFR | ❌ |
| 6 | Zero `SQLITE_BUSY` under load | ❌ no test yet |
| 7 | cloudflared public hostname | ❌ |
| 8 | Standalone mode with auth | ❌ |

---

## Recommended next task (start here)

### **Epic: Service hardening + first matrix smoke test**

**Goal:** Prove the microservice is correct under concurrent writes and runs inside Docker.

**Stories (in order):**

1. **PERSIST-06** — Concurrent write integration test in `core-persistence`; assert zero `SQLITE_BUSY` (DoD #6).
2. **PERSIST-07 / CORE-03** — DAO + domain unit tests (optional but helps before shell tests).
3. **LEGACY-07 / MODERN-06** — REST-assured contract tests on both shells; happy path + 400/404/409.
4. **MODERN-02 / LEGACY-06** — Fetch `/v3/api-docs` from both shells; add CI script to diff (DoD #2).
5. **PIN-02** — Pin one Temurin image by digest (e.g. `21-jdk-alpine`); validate `docker compose config`.
6. **Smoke** — `docker compose up -d java21-virtual-low`; `curl http://localhost:8087/health`.

**Acceptance:** DoD #6 green; at least one matrix container healthy on host port; OpenAPI diff script exists (can fail until shells aligned).

**Do not start yet:** Orchestrator Docker control (ORCH-02/03) until a matrix target runs reliably in Docker.

---

## Build & run (for the next agent)

**Prerequisites:** JDK **17+**, Maven **3.9+** (or use repo-local `.tools/apache-maven-3.9.9` via `build-all.ps1` fallback).

```powershell
# Build (from repo root)
cd service
.\build-all.ps1

# Standalone smoke (host)
$env:SPRING_PROFILES_ACTIVE = "benchmark"
$env:DB_PATH = ".\data\test.db"
java -jar ..\apps\insurance-modern.jar --server.port=8080

# Docker matrix (after build)
docker compose config
docker compose up -d java21-virtual-low
```

**Linux host (authoritative):** use `service/build-all.sh`; matrix targets expect Linux paths (`DB_PATH=/tmp/insurance.db`).

---

## Architecture reminders

- **Two real JARs:** `insurance-legacy.jar` (Boot 2.7, Java 8 bytecode) · `insurance-modern.jar` (Boot 4.1, Java 17 bytecode).
- **Five matrix names** are copies of those two artifacts (`docs/02 §4`).
- **Shared core** must stay free of Spring / `javax` / `jakarta` (`core-domain`, `core-persistence`).
- **Virtual threads:** `SPRING_THREADS_VIRTUAL_ENABLED=true` only on Java **21+** rows in compose.
- **Spring 3.x intentionally skipped** — same modern era as 4.x; matrix compares legacy (2.7) vs modern (4.1).

---

## Known gaps / tech debt

| Issue | Location | Fix hint |
| :-- | :-- | :-- |
| Seed creates members only (no agreements/dependents fraction) | `SeedServiceImpl` | PERSIST-05 full spec |
| Dependent POST response mapping was simplified | shells `MemberController` | Match `docs/08 §1.3` |
| `GlobalExceptionHandler` maps `IllegalStateException` (seed disabled) to 500 | both shells | Return 403 or 404 |
| No `mvnw` wrapper committed | `service/` | Add Maven wrapper or document `.tools` Maven |
| Orchestrator uses mock stats WebSocket | `orchestrator/src/index.js` | ORCH-04 |
| Dashboard not built into orchestrator image | `orchestrator/Dockerfile` | Multi-stage or mount `dashboard/dist` |
| REQUIREMENTS.md §Versioning Note still says 2026-06-25 | `REQUIREMENTS.md` | Updated in this handoff pass |

---

## Key files

| Path | Purpose |
| :-- | :-- |
| `service/pom.xml` | Maven parent |
| `service/core-persistence/.../V1__init.sql` | Flyway schema |
| `service/app-modern/` | Boot 4.1 shell |
| `service/app-legacy/` | Boot 2.7 shell |
| `docker-compose.yml` | 10-service matrix |
| `docs/01-version-matrix.md` | Version source of truth |
| `docs/11-backlog.md` | Full story backlog |

---

## Suggested commit / PR scope already on branch

Follow-on work should be **separate PRs** per epic (tests → docker digest → orchestrator → observability).
