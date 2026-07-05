# Agent Handoff — Spring Bench (2026-07-05)

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
| `orchestrator/` | **Stub** | Express API skeleton; Docker socket **not** wired |
| `dashboard/` | **Stub** | React + Chart.js scaffold; needs `npm run build` for orchestrator static serve |
| `loadtests/` | **Stub** | `rest.js` / `sse.js` present; `bench/k6-sse` image not built in CI |
| Tests | **Partial** | PERSIST-06 + LEGACY-07/MODERN-06 contract tests; OpenAPI signature diff green |
| Observability / JFR | **Not started** | Actuator exposed; no JFR wiring, no Micrometer matrix tags |
| Standalone / auth | **Not started** | Profile exists; no security, no persistent DB docs verified |
| cloudflared | **Compose only** | `--profile tunnel`; needs `TUNNEL_TOKEN` in `.env` |

---

## Definition of Done checklist

| # | Item | Status |
| :--: | :-- | :--: |
| 1 | `build-all` → `./apps/` | ✅ (run locally; JARs not in git) |
| 2 | Identical contract / OpenAPI diff empty | ✅ `scripts/openapi-diff.mjs` (contract signature compare) |
| 3 | `docker compose config` validates | ✅ all matrix images digest-pinned |
| 4 | Orchestrator + matrix start/stoppable | ⚠️ matrix smoke OK; orchestrator stub only |
| 5 | k6 load test + live/historical metrics + JFR | ❌ |
| 6 | Zero `SQLITE_BUSY` under load | ✅ `ConcurrentWriteLoadTest` |
| 7 | cloudflared public hostname | ❌ |
| 8 | Standalone mode with auth | ❌ |

---

## Recommended next task (start here)

### **Epic: Orchestrator + observability**

**Goal:** Wire Docker control plane and begin JVM metrics collection.

**Stories (in order):**

1. **ORCH-02 / ORCH-03** — Docker socket: `GET /api/targets`, start/stop/restart per matrix service.
2. **OBS-01** — Micrometer matrix tags on both shells; scrape from orchestrator.
3. **OBS-02** — JFR flags merged into compose `JAVA_OPTS`.
4. **LOAD-01 / ORCH-05** — k6 REST load test triggered from orchestrator.
5. **PERSIST-07 / CORE-03** — Optional DAO + domain unit tests.

**Acceptance:** Orchestrator lists matrix fleet; one target start/stop works; Actuator metrics visible in orchestrator stream.

---

## Build & run (for the next agent)

**Prerequisites:** JDK **17+**, Maven **3.9+** (or use repo-local `.tools/apache-maven-3.9.9` via `build-all.ps1` fallback).

```powershell
# Build (from repo root)
cd service
.\build-all.ps1

# Contract + OpenAPI verification
cd ..
$env:LEGACY_URL = "http://localhost:8091"
$env:MODERN_URL = "http://localhost:8090"
# start both JARs on those ports, then:
.\scripts\openapi-diff.ps1

# Docker matrix (after build)
docker compose config
docker compose up -d java21-virtual-low
curl http://localhost:8087/health
```

**Linux host (authoritative):** use `service/build-all.sh`; matrix targets expect Linux paths (`DB_PATH=/tmp/insurance.db`).

---

## Architecture reminders

- **Two real JARs:** `insurance-legacy.jar` (Boot 2.7, Java 8 bytecode) · `insurance-modern.jar` (Boot 4.1, Java 17 bytecode).
- **Five matrix names** are copies of those two artifacts (`docs/02 §4`).
- **Shared core** must stay free of Spring / `javax` / `jakarta` (`core-domain`, `core-persistence`).
- **Virtual threads:** `SPRING_THREADS_VIRTUAL_ENABLED=true` only on Java **21+** rows in compose.
- **Spring Boot 4 Flyway:** modern shell requires `spring-boot-starter-flyway` (not `flyway-core` alone).
- **Modern integration tests:** use `RestTestClient` + `@AutoConfigureRestTestClient` (Boot 4); legacy uses REST-assured.

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
| OpenAPI raw JSON differs (3.0 vs 3.1 springdoc) | both shells | Contract signature diff is authoritative |

---

## Key files

| Path | Purpose |
| :-- | :-- |
| `service/app-legacy/.../ContractIntegrationTest.java` | LEGACY-07 REST-assured tests |
| `service/app-modern/.../ContractIntegrationTest.java` | MODERN-06 RestTestClient tests |
| `scripts/openapi-diff.mjs` | DoD #2 contract signature diff |
| `docker-compose.yml` | Digest-pinned 10-service matrix |
| `docs/11-backlog.md` | Full story backlog |

---

## Completed this session (2026-07-05, contract epic)

- **LEGACY-07:** REST-assured contract tests (happy path, 400/404/409, pagination, OpenAPI).
- **MODERN-06:** RestTestClient contract tests (parallel coverage; Boot 4 test client).
- **MODERN-02 / OpenAPI:** `scripts/openapi-diff.mjs` compares contract signatures — green.
- **Flyway fix:** modern shell uses `spring-boot-starter-flyway`; `spring.flyway.mixed=true` for SQLite PRAGMA migration.
- **PIN-02 complete:** all Temurin rows + cloudflared digest-pinned in compose.
- Docker smoke: `java21-virtual-low` healthy on port 8087.

---

## Suggested commit / PR scope

Follow-on work should be **separate PRs** per epic (orchestrator → observability → load tests).
