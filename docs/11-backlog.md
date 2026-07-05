# 11 — Product Backlog: Java Concurrency Matrix

> **Purpose:** Actionable user stories to build the platform described in `REQUIREMENTS.md` and
> `docs/01`–`docs/10`. Ordered for dependency-safe delivery; each epic maps to the build order in
> `REQUIREMENTS.md §Build Order`.
>
> **Progress snapshot (2026-07-05):** See `docs/HANDOFF.md` for DoD status. Epics **FOUND**, **PIN-01**,
> **CORE/PERSIST/MODERN/LEGACY** (MVP), **BUILD**, and **INFRA-01** are largely scaffolded; **PERSIST-06** done;
> **PIN-02** partial (Java 21 digest); **ORCH**, **OBS**, REST-assured, and OpenAPI parity verification remain open.

**Story ID format:** `EPIC-STORY` (e.g. `CORE-03`).  
**Priority:** P0 = blocking / DoD · P1 = core feature · P2 = polish · P3 = stretch (JPMC extras).

---

## Epic 0 — Foundation & Repo Scaffold `FOUND`

| ID | Priority | Story | Acceptance criteria | Depends on |
| :-- | :-- | :-- | :-- | :-- |
| FOUND-01 | P0 | **As a** developer, **I want** the whole-repo layout from `docs/02 §5`, **so that** every component has a home before code lands. | Directories exist: `service/`, `orchestrator/`, `loadtests/`, `dashboard/`, `infra/cloudflared/`, `apps/` (gitignored). Root `README.md` stub points to `REQUIREMENTS.md`. | — |
| FOUND-02 | P0 | **As a** developer, **I want** a Maven multi-module parent under `service/`, **so that** `core-domain`, `core-persistence`, `app-legacy`, and `app-modern` build together. | Parent `pom.xml` aggregates four modules; `mvn -q validate` succeeds. Compiler release settings match `docs/02 §3`. | FOUND-01 |
| FOUND-03 | P1 | **As a** developer on Windows, **I want** Linux-authoritative scripts with Windows equivalents, **so that** authoring works locally but CI/host targets Ubuntu. | `build-all.sh` and `build-all.ps1` stubs exist; README notes Linux is authoritative. | FOUND-02 |

---

## Epic 1 — Version Pinning & Toolchain `PIN`

| ID | Priority | Story | Acceptance criteria | Depends on |
| :-- | :-- | :-- | :-- | :-- |
| PIN-01 | P0 | **As a** maintainer, **I want** all versions from `docs/01` copied into build/config files, **so that** there is one enforceable source of truth. | Boot 2.7.18 / 4.1.x, sqlite-jdbc 3.53.2.0, k6 1.8.0, cloudflared 2026.6.1 reflected in POMs, Dockerfiles, compose image tags (readable patch tags, digest added in PIN-02). | FOUND-02 |
| PIN-02 | P0 | **As a** maintainer, **I want** container images pinned by digest, **so that** builds are reproducible. | Every image in compose uses `@sha256:…`; `docker compose config` validates. Runs **after** INFRA-01 defines the service list with readable tags. | PIN-01, INFRA-01 |
| PIN-03 | P1 | **As a** maintainer, **I want** a version re-verify checklist, **so that** pins stay current before release. | README or `docs/01` note documents upstream URLs and re-verify steps (researched 2026-07-03 baseline). | PIN-01 |

---

## Epic 2 — Shared Core: Domain `CORE`

| ID | Priority | Story | Acceptance criteria | Depends on |
| :-- | :-- | :-- | :-- | :-- |
| CORE-01 | P0 | **As a** benchmark operator, **I want** domain POJOs and enums for all five entities, **so that** business logic is identical on every runtime. | `core-domain` has types for Demographics, Member, Dependent, LifeInsuranceAgreement, Audit; enums match `docs/03 §4`; Java 8 bytecode; zero Spring/javax/jakarta imports. | FOUND-02 |
| CORE-02 | P0 | **As a** service owner, **I want** service interfaces for CRUD + audit, **so that** shells delegate 100% of behavior to the core. | Interfaces cover all mutations in `docs/04 §1`; audit-on-every-mutation is specified in interface contracts; **allowed status transitions** are documented per entity (illegal transition → domain exception for shells to map to **409**). | CORE-01 |
| CORE-03 | P1 | **As a** developer, **I want** unit tests for domain/audit rules, **so that** regressions are caught without spinning up Spring. | JUnit 5 + Mockito tests for enum validation, **disallowed status transitions (409 path)**, audit message generation, soft-delete semantics. | CORE-02 |

---

## Epic 3 — Shared Core: Persistence `PERSIST`

| ID | Priority | Story | Acceptance criteria | Depends on |
| :-- | :-- | :-- | :-- | :-- |
| PERSIST-01 | P0 | **As a** developer, **I want** Flyway migration `V1__init.sql` creating all five tables, **so that** schema is versioned and identical everywhere. | Tables, FKs, CHECK constraints, UUID text PKs per `docs/03`; `PRAGMA foreign_keys=ON` in migration or init; SQL lives in `core-persistence/src/main/resources/db/migration/`; **both shells enable Flyway on startup** against `DB_PATH` (SQLite-compatible config). | CORE-01 |
| PERSIST-02 | P0 | **As a** benchmark operator, **I want** SQLite WAL + write-safety configuration, **so that** concurrent load produces zero `SQLITE_BUSY`. | PRAGMAs from `docs/04 §3` applied at pool init; **ownership documented:** core exposes connection/PRAGMA helpers + single-writer contract; **each shell owns the `DataSource` `@Bean`** (HikariCP managed by Boot BOM — do not override version); write pool **max size = 1** (or dedicated single-thread write executor); optional read pool for WAL readers. Hikari auto-config excluded or overridden so only one write pool exists. | PERSIST-01 |
| PERSIST-03 | P0 | **As a** service owner, **I want** JDBC DAOs for all entities, **so that** persistence stays framework-agnostic. | CRUD + paginated list + audit insert; plain JDBC only; compiles Java 8; list endpoints support `page`, `size`, `sort=field,asc\|desc` per `docs/08 §3` (defaults: `page=0`, `size=20`, `sort=created,desc`; `size` capped at 200). | PERSIST-02, CORE-02 |
| PERSIST-04 | P0 | **As a** service owner, **I want** transactional mutations with audit in the same transaction, **so that** the audit trail is always consistent. | Create/update/delete/status-change + one Audit row atomic; rollback on failure; illegal status transitions propagate as domain errors (409 at HTTP layer). | PERSIST-03 |
| PERSIST-05 | P0 | **As a** load tester, **I want** a seed implementation backing `POST /seed`, **so that** every matrix target starts from a known dataset. | Bulk creates N members (+ demographics, fraction with agreements/dependents); returns `{ created, elapsedMs }`. | PERSIST-04 |
| PERSIST-06 | P0 | **As a** benchmark operator, **I want** a write-load integration test proving no `SQLITE_BUSY`, **so that** DoD item 6 is enforceable. | Concurrent write test (threads or executor) asserts zero busy errors under sustained load. | PERSIST-02, PERSIST-04 |
| PERSIST-07 | P1 | **As a** developer, **I want** DAO unit/integration tests with an in-memory or temp-file SQLite, **so that** persistence logic is verified without shells. | Tests cover CRUD, pagination (incl. sort), soft delete, audit side-effect, status-transition rejection. | PERSIST-04 |

---

## Epic 4 — Spring Legacy Shell `LEGACY`

| ID | Priority | Story | Acceptance criteria | Depends on |
| :-- | :-- | :-- | :-- | :-- |
| LEGACY-01 | P0 | **As a** matrix operator, **I want** Boot 2.7.18 shell wiring core services, **so that** `insurance-legacy.jar` runs on Java 8/11. | `app-legacy` depends on core modules; starts on Java 8; `<release>8</release>`; wires `DataSource` per PERSIST-02; **Flyway runs on startup** (PERSIST-01). | PERSIST-03 |
| LEGACY-02 | P0 | **As an** API consumer, **I want** all REST endpoints from `docs/04 §2` on the legacy shell, **so that** the contract is complete. | Endpoints implemented; DTO mapping in shell only; delegates to core; in **benchmark** profile, `updatedBy` from `X-User` header when present, else `"system"` (`docs/08 §2`). | LEGACY-01 |
| LEGACY-03 | P0 | **As a** dashboard consumer, **I want** `/health` with runtime introspection, **so that** targets panel can show Java/Spring/thread state. | Response matches `docs/04 §2.1`; `virtualThreadsEnabled` is false on legacy. | LEGACY-01 |
| LEGACY-04 | P0 | **As a** load tester, **I want** `/events` SSE via `SseEmitter`, **so that** platform-thread connection cost is measurable. | `text/event-stream`; heartbeat + audit events per `docs/08 §6`; emitters cleaned up on close/error. | LEGACY-02 |
| LEGACY-05 | P0 | **As an** API consumer, **I want** RFC 7807 errors and Bean Validation on shell DTOs, **so that** both shells behave identically on bad input. | `@ControllerAdvice` + `javax.validation`; rules from `docs/08 §4–5`; `X-Request-Id` on all responses; 409 for disallowed status transitions. | LEGACY-02 |
| LEGACY-06 | P1 | **As a** developer, **I want** springdoc OpenAPI + Swagger UI on legacy, **so that** contract parity is machine-checkable. | `/v3/api-docs` and Swagger UI reachable. | LEGACY-02 |
| LEGACY-07 | P1 | **As a** developer, **I want** REST-assured integration tests on legacy, **so that** the HTTP contract is regression-tested. | Tests cover happy paths, 400/404/409, pagination envelope (incl. sort). | LEGACY-05 |

---

## Epic 5 — Spring Modern Shell `MODERN`

| ID | Priority | Story | Acceptance criteria | Depends on |
| :-- | :-- | :-- | :-- | :-- |
| MODERN-01 | P0 | **As a** matrix operator, **I want** Boot 4.1.x shell wiring core services, **so that** `insurance-modern.jar` runs on Java 17–25. | `app-modern` depends on core; `<release>17</release>`; jakarta namespace in shell only; wires `DataSource` per PERSIST-02; **Flyway runs on startup** (PERSIST-01). | PERSIST-03 |
| MODERN-02 | P0 | **As an** API consumer, **I want** identical REST/SSE contract to legacy, **so that** benchmarks isolate runtime variables only. | Same paths, status codes, bodies as legacy; verified by OpenAPI diff (empty); benchmark `updatedBy` from `X-User` when present. | MODERN-01, LEGACY-02 |
| MODERN-03 | P0 | **As a** matrix operator, **I want** virtual-thread config via `SPRING_THREADS_VIRTUAL_ENABLED`, **so that** Java 21+ targets can enable Loom. | Maps to `spring.threads.virtual.enabled`; `/health` reflects *actual* effective state (Java 21+ AND flag set). | MODERN-01 |
| MODERN-04 | P0 | **As an** API consumer, **I want** RFC 7807 + Jakarta validation mirroring legacy rules, **so that** error shapes are byte-identical. | Same Problem Details structure; field-level `errors[]` on 400; 409 for disallowed status transitions. | MODERN-02 |
| MODERN-05 | P1 | **As a** developer, **I want** springdoc OpenAPI on modern, **so that** CI can diff against legacy. | `/v3/api-docs` available. | MODERN-02 |
| MODERN-06 | P1 | **As a** developer, **I want** REST-assured integration tests on modern, **so that** both shells stay in sync. | Parallel test suite to legacy; shared contract assertions. | MODERN-04 |

---

## Epic 6 — Build Pipeline & Artifacts `BUILD`

| ID | Priority | Story | Acceptance criteria | Depends on |
| :-- | :-- | :-- | :-- | :-- |
| BUILD-01 | P0 | **As a** matrix operator, **I want** `service/build-all` producing both JARs, **so that** DoD item 1 is satisfied. | Builds both modules; fails on test failure; outputs to `apps/`. | LEGACY-01, MODERN-01 |
| BUILD-02 | P0 | **As a** matrix operator, **I want** five matrix filenames mapped from two artifacts, **so that** compose mounts match `docs/02 §4`. | `insurance-j8.jar`, `j11`, `j17`, `j21`, `insurance-modern.jar` in `./apps/`. | BUILD-01 |
| BUILD-03 | P1 | **As a** Windows developer, **I want** `build-all.ps1` equivalent, **so that** local builds work without WSL. | PS1 mirrors sh behavior; documented as non-authoritative. | BUILD-01 |

---

## Epic 7 — Docker Compose Matrix `INFRA`

| ID | Priority | Story | Acceptance criteria | Depends on |
| :-- | :-- | :-- | :-- | :-- |
| INFRA-01 | P0 | **As a** benchmark operator, **I want** `docker-compose.yml` with the default 10-service matrix, **so that** every runtime tier is runnable. | All rows from `docs/01 §4.1`; ports 8081–8090; internal `matrix-net`; **`SPRING_PROFILES_ACTIVE=benchmark`** on every matrix row; image tags from PIN-01 (digest pinning follows in PIN-02). | BUILD-02, PIN-01 |
| INFRA-02 | P0 | **As a** benchmark operator, **I want** CPU/memory limits and `JAVA_OPTS` per row, **so that** footprint dimensions are enforced. | `deploy.resources.limits` or `--compatibility`; per-row `JAVA_OPTS` includes **`-Xmx` only** (JFR flags merged in OBS-02); documented pattern for composing a single `JAVA_OPTS` env var. | INFRA-01 |
| INFRA-03 | P0 | **As a** benchmark operator, **I want** virtual-thread env only on Java 21+ rows, **so that** invalid configs cannot start. | `SPRING_THREADS_VIRTUAL_ENABLED=true` only where specified; Java 17 rows omit it; all rows retain `SPRING_PROFILES_ACTIVE=benchmark`. | INFRA-01 |
| INFRA-04 | P1 | **As a** benchmark operator, **I want** ARM64 rows with platform emulation, **so that** Java 25 arm64 tier is testable on amd64 hosts. | `platform: linux/arm64/v8` on arm rows; `infra/arm64-setup.md` documents binfmt/QEMU. | INFRA-01 |
| INFRA-05 | P2 | **As a** benchmark analyst, **I want** optional JPMC extension rows (`java17-virtual`, `java21-platform`, `java25-amd64`), **so that** one-variable comparisons are easy. | Documented optional services in compose or override file per `docs/01 §4.2`. | INFRA-01 |

---

## Epic 8 — Orchestrator Control API `ORCH`

| ID | Priority | Story | Acceptance criteria | Depends on |
| :-- | :-- | :-- | :-- | :-- |
| ORCH-01 | P0 | **As a** tech lead, **I want** orchestrator stack choice documented (Node 24 + Express 5 *or* Python 3.13 + FastAPI), **so that** the control plane has a clear foundation. | README states choice + rationale (`docs/07` alignment noted). | FOUND-01 |
| ORCH-02 | P0 | **As a** dashboard user, **I want** `GET /api/targets` listing matrix services with state and `/health`, **so that** I can see the fleet at a glance. | Docker socket access; merges container state + health JSON from each target. | ORCH-01, INFRA-01 |
| ORCH-03 | P0 | **As a** dashboard user, **I want** start/stop/restart endpoints per target, **so that** I can isolate one variable under test. | `POST /api/targets/{name}/start\|stop\|restart` work for all matrix names. | ORCH-02 |
| ORCH-04 | P0 | **As a** dashboard user, **I want** live stats stream (`GET /api/stats/stream`), **so that** charts update in real time. | WS or SSE; polls `docker stats` / Docker API on interval; structured JSON time series. | ORCH-02 |
| ORCH-05 | P0 | **As a** benchmark operator, **I want** `POST /api/loadtest` triggering k6 with tunable params, **so that** REST and SSE tests launch from the UI. | Accepts TARGET, VUS, RAMP_STAGES, DURATION, DROP_RATE, mode; runs k6 container on `matrix-net`; REST mode uses `grafana/k6:1.8.0`, SSE mode uses `bench/k6-sse`. | ORCH-03, LOAD-01, LOAD-03 |
| ORCH-06 | P0 | **As a** benchmark analyst, **I want** run history persisted and queryable, **so that** I can compare runs over time. | `GET /api/runs`, `GET /api/runs/{id}`; schema per `docs/09 §5`; storage SQLite or JSON under `orchestrator/runs/`. | ORCH-05 |
| ORCH-07 | P1 | **As a** security-conscious operator, **I want** orchestrator Docker-socket exposure documented with Cloudflare Access guidance, **so that** public tunnel use is safe. | README warns; `.env.example` for secrets. | ORCH-03 |
| ORCH-08 | P2 | **As a** JPMC-aligned candidate, **I want** optional Spring Boot orchestrator using docker-java, **so that** the control plane is also Java/Spring. | Stretch; same API surface as Node/Python choice. | ORCH-06 |

---

## Epic 9 — Observability `OBS`

| ID | Priority | Story | Acceptance criteria | Depends on |
| :-- | :-- | :-- | :-- | :-- |
| OBS-01 | P0 | **As a** dashboard user, **I want** Actuator + Micrometer on both shells, **so that** live JVM metrics feed the charts. | Endpoints: health, info, metrics, prometheus; tagged with runtime/threading/footprint. | LEGACY-01, MODERN-01 |
| OBS-02 | P0 | **As a** benchmark operator, **I want** JFR continuous recording on matrix targets, **so that** context-switch and lock contention are captured. | JFR flags from `docs/09 §2` **appended to each row's `JAVA_OPTS`** (merge with INFRA-02 `-Xmx`); `.jfr` written to `/tmp/bench.jfr`; compose documents the concatenation pattern. | INFRA-02 |
| OBS-03 | P0 | **As a** benchmark analyst, **I want** the orchestrator to collect JFR after each run, **so that** deep metrics join the run record. | Dump via `jcmd` or `dumponexit`; `docker cp` artifact; reducer to JSON aggregates. | ORCH-06, OBS-02 |
| OBS-04 | P0 | **As a** dashboard user, **I want** orchestrator scraping Actuator alongside docker stats, **so that** one stream merges container + JVM metrics. | Live stream includes threads, GC, heap; merged in `/api/stats/stream`. | ORCH-04, OBS-01 |
| OBS-05 | P1 | **As a** benchmark analyst, **I want** run records to include client + server + artifact paths, **so that** DoD item 5 is fully satisfied. | Completed run has k6 summary, stats series, Actuator series, `.jfr`, aggregates — one `runId`. | OBS-03, ORCH-06 |
| OBS-06 | P1 | **As a** maintainer, **I want** benchmark methodology documented in run metadata, **so that** comparisons follow `docs/09 §4`. | Warmup flag, env metadata (JDK, GC, host), repetition support. | ORCH-06 |

---

## Epic 10 — Load Testing `LOAD`

| ID | Priority | Story | Acceptance criteria | Depends on |
| :-- | :-- | :-- | :-- | :-- |
| LOAD-01 | P0 | **As a** benchmark operator, **I want** `loadtests/rest.js` exercising the CRUD contract, **so that** write-heavy concurrency is stress-tested. | Parameterized via env; ramping-vus from `RAMP_STAGES`; thresholds on p95/p99 and error rate. | MODERN-02 |
| LOAD-02 | P0 | **As a** benchmark operator, **I want** custom `bench/k6-sse` image with xk6-sse, **so that** long-lived `/events` connections are tested faithfully. | `Dockerfile.k6-sse` per `docs/06 §1.2`; image builds and runs `sse.js`. | LOAD-01 |
| LOAD-03 | P0 | **As a** benchmark operator, **I want** `loadtests/sse.js` holding SSE connections with drop/reopen, **so that** platform vs virtual thread memory divergence is visible. | Uses `k6/x/sse`; respects `DROP_RATE` and `DURATION`; event counters in summary. | LOAD-02 |
| LOAD-04 | P0 | **As a** orchestrator integrator, **I want** k6 `handleSummary` JSON output, **so that** run records ingest client-side latency/RPS automatically. | Summary includes p50/p95/p99, RPS, errors, data received. | LOAD-01 |
| LOAD-05 | P1 | **As a** benchmark operator, **I want** documented k6 run commands for manual invocation, **so that** tests work outside the orchestrator too. | README examples for both REST (`grafana/k6:1.8.0`) and SSE (`bench/k6-sse`) match `docs/06 §1.4`. | LOAD-01, LOAD-03 |

---

## Epic 11 — Dashboard `DASH`

| ID | Priority | Story | Acceptance criteria | Depends on |
| :-- | :-- | :-- | :-- | :-- |
| DASH-01 | P0 | **As a** benchmark operator, **I want** a React 18.3 + Chart.js dashboard, **so that** concurrency behavior is visible live. | App scaffolded in `dashboard/`; served by orchestrator or static host. | ORCH-04 |
| DASH-02 | P0 | **As a** benchmark operator, **I want** a targets panel with start/stop and health badges, **so that** I control the matrix from one UI. | Lists targets; shows Java version, Boot, platform/virtual, heap from `/health`. | DASH-01, ORCH-03 |
| DASH-03 | P0 | **As a** benchmark operator, **I want** a load-test form (REST/SSE + five params), **so that** I can launch tests without CLI. | Form posts to `POST /api/loadtest`; shows run status. | DASH-01, ORCH-05 |
| DASH-04 | P0 | **As a** benchmark analyst, **I want** real-time line charts for CPU, memory, threads, GC, context-switch, lock contention, **so that** DoD item 5 charts are complete. | Fed by `/api/stats/stream`; rolling window; per-target series. | DASH-01, OBS-04 |
| DASH-05 | P0 | **As a** benchmark analyst, **I want** historical run comparison across matrix dimensions, **so that** the core deliverable — one-variable analysis — is obvious. | Select runs from `GET /api/runs`; compare p50/p95/p99, RPS, errors, peak memory across configs. | DASH-01, ORCH-06 |
| DASH-06 | P2 | **As a** small-office user, **I want** optional trimmed CRUD UI bundled in standalone jar, **so that** non-technical users can manage records. | Static assets in `app-modern` resources; auth-gated; per `docs/10 §5`. | STAND-03, DASH-01 |

---

## Epic 12 — Cloudflare Tunnel & Host Ops `TUNNEL`

| ID | Priority | Story | Acceptance criteria | Depends on |
| :-- | :-- | :-- | :-- | :-- |
| TUNNEL-01 | P0 | **As a** remote viewer, **I want** cloudflared exposing orchestrator/dashboard publicly, **so that** DoD item 7 is met without opening router ports. | Compose service `cloudflared`; `TUNNEL_TOKEN` from `.env`; routes to orchestrator. | ORCH-06, DASH-01 |
| TUNNEL-02 | P1 | **As a** operator, **I want** `.env.example` and run docs for tunnel setup, **so that** onboarding is repeatable. | Untracked `.env`; Cloudflare Access recommendation documented. | TUNNEL-01 |
| TUNNEL-03 | P1 | **As a** host admin, **I want** Linux-focused runbook (Ubuntu + Docker ≥ 27), **so that** production host matches spec. | README quickstart: build → compose up → tunnel → first load test. | TUNNEL-01 |

---

## Epic 13 — Standalone Mode `STAND`

| ID | Priority | Story | Acceptance criteria | Depends on |
| :-- | :-- | :-- | :-- | :-- |
| STAND-01 | P0 | **As a** small-office admin, **I want** `benchmark` and `standalone` Spring profiles, **so that** the same JAR runs with or without the harness. | Profile-specific `application-*.yml` in shells only; core unchanged; matrix compose uses `benchmark`; standalone activated via `SPRING_PROFILES_ACTIVE=standalone`. | MODERN-02 |
| STAND-02 | P0 | **As a** small-office admin, **I want** standalone using a persistent DB path and disabled `/seed` by default, **so that** real data is safe. | `DB_PATH` persistent; seed gated; JFR off in standalone. | STAND-01 |
| STAND-03 | P0 | **As a** small-office admin, **I want** Spring Security auth on write endpoints in standalone, **so that** the app is usable in production. | HTTP Basic or form login; `updatedBy` from principal; `APP_ADMIN_*` from env. | STAND-01 |
| STAND-04 | P1 | **As a** small-office admin, **I want** backup/restore documentation for the SQLite file, **so that** data loss risk is mitigated. | VACUUM INTO or file copy procedure in README. | STAND-02 |
| STAND-05 | P0 | **As a** developer, **I want** verified standalone run path, **so that** DoD item 8 passes. | `SPRING_PROFILES_ACTIVE=standalone java -jar apps/insurance-modern.jar` works with auth + persistent DB. | STAND-03 |
| STAND-06 | P1 | **As a** standalone operator, **I want** CORS locked to configured origins, **so that** browser access is controlled. | `APP_CORS_ORIGINS` respected in standalone profile. | STAND-03 |

---

## Epic 14 — Shell Runtime Hygiene `RUNTIME`

> Cross-cutting shell concerns (logging, lifecycle). Lives outside CI because these ship with the
> service, not the pipeline.

| ID | Priority | Story | Acceptance criteria | Depends on |
| :-- | :-- | :-- | :-- | :-- |
| RUNTIME-01 | P1 | **As a** developer, **I want** structured JSON logging + `X-Request-Id` propagation in both shells, **so that** production debugging is tractable. | Per `docs/04 §7`; no PII in logs; request id echoed on responses. | LEGACY-05, MODERN-04 |
| RUNTIME-02 | P1 | **As a** operator, **I want** graceful shutdown + WAL flush on stop, **so that** SQLite integrity is preserved. | `server.shutdown=graceful` in both shells; verified on SIGTERM; WAL checkpoint on exit. | PERSIST-02, LEGACY-01, MODERN-01 |

---

## Epic 15 — CI/CD & Validation `CI`

| ID | Priority | Story | Acceptance criteria | Depends on |
| :-- | :-- | :-- | :-- | :-- |
| CI-01 | P0 | **As a** maintainer, **I want** GitHub Actions running `build-all` and tests, **so that** every push is verified. | Workflow on Ubuntu; fails on test failure. | BUILD-01 |
| CI-02 | P0 | **As a** maintainer, **I want** CI validating `docker compose config`, **so that** DoD item 3 is enforced. | Compose parse job in workflow (runs after PIN-02 digest pins land). | PIN-02 |
| CI-03 | P0 | **As a** maintainer, **I want** CI diffing legacy vs modern `/v3/api-docs`, **so that** DoD item 2 is enforced. | Empty diff required to merge; both shells started in test job. | LEGACY-06, MODERN-05 |
| CI-04 | P0 | **As a** release owner, **I want** a validation pass checklist mapping to all DoD items, **so that** nothing ships incomplete. | Checklist in README or this doc; all 8 DoD bullets traceable to stories. | All P0 epics |

---

## Epic 16 — Stretch / JPMC Extras `STRETCH`

| ID | Priority | Story | Acceptance criteria | Depends on |
| :-- | :-- | :-- | :-- | :-- |
| STRETCH-01 | P3 | **As a** JPMC-aligned candidate, **I want** Audit events published to Kafka, **so that** event-driven architecture is demonstrated. | Producer on audit write; consumer lag metric under load. | PERSIST-04 |
| STRETCH-02 | P3 | **As a** cloud-ready architect, **I want** docs mapping matrix to AWS ECS/EKS sizing, **so that** portfolio shows cloud fluency. | Section in README or `docs/07` extension. | INFRA-01 |
| STRETCH-03 | P3 | **As a** maintainer, **I want** upgrade path stories scheduled (Boot 4, k6 2, React 19), **so that** `docs/01 §5` roadmap is executable. | Tracking issues or future epics defined. | CI-04 |

---

## Suggested Sprints (vertical slices)

| Sprint | Goal | Stories |
| :-- | :-- | :-- |
| **S1 — Walking skeleton** | Compilable repo + schema + Flyway + health on both shells | FOUND-01–03, PIN-01, CORE-01–02, PERSIST-01–03, LEGACY-01, LEGACY-03, MODERN-01, MODERN-03, BUILD-01 |
| **S2 — Complete API** | Full CRUD + SSE + errors + contract tests on both shells | PERSIST-04–07, CORE-03, LEGACY-02, LEGACY-04–07, MODERN-02, MODERN-04–06 |
| **S3 — Matrix runtime** | Artifacts + Docker + full k6 (REST + SSE) + digest pins | BUILD-02–03, INFRA-01–04, PIN-02, LOAD-01–05 |
| **S4 — Control plane** | Orchestrator + live stats + Actuator/JFR wiring | ORCH-01–06, OBS-01–02, OBS-04 |
| **S5 — Benchmark loop** | JFR collection + run persistence + dashboard | OBS-03, OBS-05–06, DASH-01–05 |
| **S6 — Ship it** | Tunnel + standalone + CI + DoD validation + runtime hygiene | STAND-01–06, TUNNEL-01–03, CI-01–04, RUNTIME-01–02 |
| **S7 — Polish** | Extensions + office UI + stretch | INFRA-05, DASH-06, STRETCH-* |

> **S3 ordering note:** `INFRA-01` lands with readable image tags (PIN-01); run `PIN-03` re-verify,
> then `PIN-02` digest-pins before treating compose as release-ready. `CI-02` enforces digest-pinned
> compose on merge.

---

## Definition of Done Traceability

| DoD # (`REQUIREMENTS.md`) | Stories |
| :-- | :-- |
| 1. `build-all` → `./apps/` | BUILD-01, BUILD-02 |
| 2. Identical `/v3/api-docs` | MODERN-02, LEGACY-06, MODERN-05, CI-03 |
| 3. `docker compose config` valid | PIN-02, INFRA-01, CI-02 |
| 4. Stack up; targets start/stop | INFRA-01, ORCH-02–03, DASH-02 |
| 5. Load test + live/historical charts + JFR | LOAD-*, OBS-*, ORCH-05–06, DASH-03–05 |
| 6. No `SQLITE_BUSY` | PERSIST-02, PERSIST-06 |
| 7. cloudflared public hostname | TUNNEL-01 |
| 8. Standalone mode | STAND-01–05 |

---

## Backlog Conventions for Agents

1. **Never duplicate business logic in shells** — if a story touches behavior, it belongs in `CORE` or `PERSIST`.
2. **One story = one reviewable PR** where possible; split if estimate > 1 day.
3. **Mark blocked** when upstream API or artifact is missing (e.g. dashboard before orchestrator stream).
4. **Pin sequence:** PIN-01 (tags in POMs/compose) → INFRA-01 (service list) → PIN-03 re-verify → PIN-02 (digest pins). Never require digest pins before compose structure exists.
5. **DataSource ownership:** core = PRAGMA helpers + write-safety contract; shell = HikariCP `@Bean` (Boot-managed version).
6. **Profile defaults:** matrix containers always set `SPRING_PROFILES_ACTIVE=benchmark`; standalone is explicit at launch.
7. **Done means tested** — every P0 story includes an objective acceptance check, not just "implemented."
