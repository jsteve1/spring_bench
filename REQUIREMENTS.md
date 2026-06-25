# Build Spec: The Java Concurrency Matrix

> **Audience:** An autonomous LLM coding agent with shell, file, and Docker tools.
> **Goal:** Build a benchmarking platform that runs one identical insurance microservice across
> a configurable matrix of Java runtimes, threading models, and hardware footprints; drives load
> with `k6`; and visualizes concurrency behavior (CPU saturation, context-switching, memory,
> lock contention) on a live dashboard with historical aggregation.
> **Secondary goal:** Serve as a portfolio/learning artifact aligned to the **JPMorgan Chase
> Commercial & Investment Bank, Software Engineer II** stack (see `docs/07-jpmc-alignment.md`).

This is the master index. Detailed, scoped requirements live in `docs/`. Read them in order.

> **The microservice stands alone.** The benchmark harness (Docker matrix, orchestrator, k6,
> cloudflared) is optional scaffolding *around* a normal Spring Boot CRUD app. The same code runs
> as a self-contained records/dashboard application with no harness — see `docs/10-standalone-mode.md`.
> Two profiles: **`benchmark`** (the matrix) and **`standalone`** (real-world use).

---

## Document Map

| Doc | Scope |
| :-- | :-- |
| **`docs/01-version-matrix.md`** | **Single source of truth for every pinned version.** Java/Spring compatibility wall + the configurable runtime matrix that replaces the "Java 8/11/17…" rules of thumb. |
| `docs/02-architecture.md` | Shared framework-agnostic core + two Spring shells; module & repo layout; artifact mapping. |
| `docs/03-data-model.md` | Insurance domain schema (5 tables, relationships, enums, audit rule). |
| `docs/04-microservice-spec.md` | HTTP + SSE contract, behavior, SQLite WAL write-safety, build artifacts. |
| `docs/05-infrastructure-and-orchestration.md` | Docker Compose matrix, orchestrator control API, `docker stats`, ARM64 emulation, cloudflared. |
| `docs/06-load-testing-and-dashboard.md` | `k6` REST + SSE scripts (tunable, `xk6-sse`), Chart.js dashboard. |
| `docs/07-jpmc-alignment.md` | How each component maps to JPMC CIB SWE II skills + interview talking points. |
| `docs/08-api-contracts.md` | JSON DTOs, error envelope (RFC 7807), pagination, validation, status codes, OpenAPI. |
| `docs/09-observability-and-metrics.md` | JFR + Actuator/Micrometer for context-switch & lock contention; benchmark methodology; run-record schema. |
| `docs/10-standalone-mode.md` | Run the service on its own (no harness) as a real small-office CRUD app; profiles, security, backups, migrations. |

---

## Definition of Done

1. `service/build-all` produces all runtime artifacts into `./apps/`.
2. Both shells expose an **identical contract** (`docs/08`): their `/v3/api-docs` diff is empty.
3. `docker compose config` validates; every matrix service parses with pinned images.
4. Bring up the stack: orchestrator + dashboard reachable; any matrix target start/stoppable.
5. A user can launch a tunable REST **or** long-lived SSE (`xk6-sse`) load test and watch real-time
   charts (CPU/memory **and** JVM-internal: threads, GC, context-switch, lock contention per
   `docs/09`); the run + its `.jfr` artifact are persisted and appear in historical comparison.
6. No `SQLITE_BUSY` errors under sustained concurrent write load.
7. cloudflared tunnel exposes the orchestrator/dashboard via a public hostname.
8. **Standalone mode works:** `SPRING_PROFILES_ACTIVE=standalone java -jar apps/insurance-modern.jar`
   runs the app with a persistent DB and auth, no harness required (`docs/10`).

---

## Build Order

1. **Repo scaffold** — `docs/02-architecture.md` layout.
2. **Pin versions** — copy `docs/01-version-matrix.md` values into build files; verify each is current.
3. **Shared core** (`core-domain`, `core-persistence`) — `docs/02` + `docs/03` + `docs/04`.
4. **Two Spring shells** (`app-legacy`, `app-modern`) — `docs/04`.
5. **Build artifacts** into `./apps/` via `build-all`.
6. **Docker Compose matrix** — `docs/05`.
7. **Orchestrator** — `docs/05`.
8. **Observability** — Actuator/Micrometer + JFR wiring — `docs/09`.
9. **k6 scripts** (incl. `xk6-sse` custom image) — `docs/06`.
10. **Dashboard** — `docs/06`.
11. **cloudflared + run docs** — `docs/05`.
12. **Standalone profile** — verify `docs/10` run path works.
13. **Validation pass** — satisfy every Definition-of-Done item.

Use a todo list; do not skip validation.

---

## Global Non-Negotiable Constraints

- **One business logic, many engines.** Only the *engine configuration* (Java version, thread
  model, CPU/mem footprint, architecture, Spring shell) varies. Enforced via a shared core
  (`docs/02`), never copy-paste.
- **Embedded SQLite per instance**, file-based WAL. No external/shared DB — benchmarks must
  reflect JVM concurrency mechanics, not network DB I/O. Write-safety rules in `docs/04`.
- **All versions are pinned and modifiable from one place** (`docs/01`). The Java versions in the
  original brief (8, 11, 17, 21, 25/26) are *defaults of a configurable matrix*, not hard-coded.
- **Identical REST/SSE contract** across every runtime — specced to the field in `docs/08`.
- **Deep metrics need the JVM, not just `docker stats`.** Context-switching and lock contention are
  captured via JFR + Actuator/Micrometer (`docs/09`); `docker stats` alone cannot see them.
- **The core stays framework- and harness-agnostic** so the app also runs standalone (`docs/10`).
- **Virtual threads** require **Java 21+ and the modern Boot 3.5.x shell** — see the compatibility
  wall in `docs/01`. Lower runtimes use platform threads.
- **Host target:** Ubuntu Server + Docker Engine. All runtime scripts must be Linux-compatible
  even though authoring happens on Windows.

---

## Versioning Note

`docs/01-version-matrix.md` records versions **as researched on 2026-06-25**. Software moves fast;
before building, the agent must re-verify each pinned version against its upstream source and pin
container images by digest. Treat `docs/01` as authoritative over any version mentioned elsewhere.
