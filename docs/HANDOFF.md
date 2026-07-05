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
| `docker-compose.yml` | **Partial (PIN-02)** | Java 21 rows digest-pinned; other matrix images still tag-only |
| `orchestrator/` | **Stub** | Express API skeleton; Docker socket **not** wired |
| `dashboard/` | **Stub** | React + Chart.js scaffold; needs `npm run build` for orchestrator static serve |
| `loadtests/` | **Stub** | `rest.js` / `sse.js` present; `bench/k6-sse` image not built in CI |
| Tests | **Partial** | PERSIST-06 concurrent write test green; REST-assured / OpenAPI parity not yet verified |
| Observability / JFR | **Not started** | Actuator exposed; no JFR wiring, no Micrometer matrix tags |
| Standalone / auth | **Not started** | Profile exists; no security, no persistent DB docs verified |
| cloudflared | **Compose only** | `--profile tunnel`; needs `TUNNEL_TOKEN` in `.env` |

---

## Definition of Done checklist

| # | Item | Status |
| :--: | :-- | :--: |
| 1 | `build-all` → `./apps/` | ✅ (run locally; JARs not in git) |
| 2 | Identical contract / OpenAPI diff empty | ⚠️ script at `scripts/openapi-diff.mjs`; parity not verified |
| 3 | `docker compose config` validates | ✅ (Java 21 digest-pinned; remaining tags pending PIN-02) |
| 4 | Orchestrator + matrix start/stoppable | ❌ orchestrator stub only |
| 5 | k6 load test + live/historical metrics + JFR | ❌ |
| 6 | Zero `SQLITE_BUSY` under load | ✅ `ConcurrentWriteLoadTest` (32×25 writes) |
| 7 | cloudflared public hostname | ❌ |
| 8 | Standalone mode with auth | ❌ |

---

## Recommended next task (start here)

### **Epic: Contract tests + Docker matrix smoke**

**Goal:** Verify HTTP contract parity and run at least one matrix container end-to-end.

**Stories (in order):**

1. **LEGACY-07 / MODERN-06** — REST-assured integration tests on both shells; happy path + 400/404/409.
2. **MODERN-02** — Run `scripts/openapi-diff.mjs` with both shells up; fix any contract drift until diff is empty (DoD #2).
3. **PIN-02 (remainder)** — Digest-pin remaining Temurin / k6 / cloudflared images in compose.
4. **Smoke** — `docker compose up -d java21-virtual-low`; `curl http://localhost:8087/health`.
5. **PERSIST-07 / CORE-03** — DAO + domain unit tests (optional hardening).

**Acceptance:** OpenAPI diff empty; `java21-virtual-low` healthy on port 8087; REST-assured suites green.

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
| `scripts/openapi-diff.mjs` | Legacy vs modern OpenAPI diff (DoD #2) |
| `service/core-persistence/.../ConcurrentWriteLoadTest.java` | PERSIST-06 write-load test |
| `docs/11-backlog.md` | Full story backlog |

---

## Completed this session (2026-07-05)

- Merged PR #1 (initial scaffold) into `main`.
- **PERSIST-06:** `ConcurrentWriteLoadTest` — 32 threads × 25 member creates, zero `SQLITE_BUSY`.
- **PIN-02 (partial):** `java21-virtual-low` / `java21-virtual-high` pinned to Temurin 21 alpine manifest digest.
- **OpenAPI diff:** `scripts/openapi-diff.{mjs,ps1,sh}` added.
- `build-all` now runs tests (no `-DskipTests`).
- Host smoke: modern JAR `/health` UP on port 8099. Docker matrix smoke blocked — Docker Desktop not running on build host.

---

## Suggested commit / PR scope already on branch

Follow-on work should be **separate PRs** per epic (tests → docker digest → orchestrator → observability).
