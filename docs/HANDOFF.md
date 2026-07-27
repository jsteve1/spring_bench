# Agent Handoff — Spring Bench (2026-07-26)

> **Read first:** `REQUIREMENTS.md` · `docs/11-backlog.md` · `docs/01-version-matrix.md`  
> **Truth for “what’s built”:** this file. Spec docs (`01`–`10`) describe the intended design; backlog IDs map work items.

**Repo:** `jsteve1/spring_bench` · **Default branch:** `main` @ `ebd4f64` (PRs **#8**, **#10** merged)  
**CI on `main`:** green (unit / service+smoke / compose / OpenAPI)  
**In flight:** PR **#9** (`feat/k6-sse`) — SSE fan-out, merged with `main` and **verified end-to-end
on desktop Docker 29.6.1 (2026-07-26)**; ready to merge.

---

## 1. Current build state (what exists)

| Layer | Status | What’s in tree |
| :-- | :-- | :-- |
| Spec + pins | **Done** | Boot **2.7.18** / **4.1.0**; Java LTS **8/11/17/21/25**; k6 **1.8.0** |
| `service/` dual-shell | **Done** | Shared core + legacy/modern shells; Flyway; WAL single-writer; contract tests; Micrometer tags; `JvmDeepSampler` (CS / blocked / waited rates) |
| Artifacts | **Done** | `service/build-all.sh` → `apps/insurance-{j8,j11,j17,j21,legacy,modern}.jar` |
| Compose matrix | **Done** | 10 rows, digests, JFR in `JAVA_OPTS`, `profiles: [tools]` for `k6-sse`, `profiles: [tunnel]` for cloudflared; `docker-compose.extra.yml` adds 3 opt-in one-variable rows (INFRA-05) |
| Orchestrator (Node 24) | **Done (MVP)** | Targets start/stop/restart; live stats WS; k6 REST+SSE; JFR collect; run records + **peaks** + **`runs/{id}/stats-series.json`** |
| Dashboard (React) | **Done (MVP)** | Targets + load form; live CPU/mem/threads/heap/GC/**CS/lock** charts; historical **RunCompare** (+ demo fixtures); **built into the orchestrator image** and served at `:3000` |
| Load scripts | **Done (MVP)** | `loadtests/rest.js`, `sse.js` + `Dockerfile.k6-sse` (`xk6-sse@v0.1.11`); SSE runs **one container per VU** and merges summaries |
| Standalone | **Done** | HTTP Basic on writes; `/seed` gated; `scripts/smoke-standalone.sh` |
| CI | **Done** | `.github/workflows/ci.yml` — CI-01..03 (+ standalone smoke) |
| Tunnel | **Done** | `scripts/setup-tunnel.ps1` provisions tunnel + ingress + CNAME (+ Access when the token allows). Route target is `http://orchestrator:3000` (container DNS on `matrix-net`, **not** `localhost`). Hostname is guarded by orchestrator Basic auth (`ORCH_BASIC_USER`/`ORCH_BASIC_PASS`), which also covers the WebSocket upgrade. |

### Definition of Done

| # | Item | Status |
| :--: | :-- | :--: |
| 1 | `build-all` → `apps/` | ✅ |
| 2 | OpenAPI parity (legacy vs modern) | ✅ (+ CI) |
| 3 | `docker compose config` + digests | ✅ (+ CI) |
| 4 | Orchestrator start/stop + stack | ✅ verified on desktop Docker 29.6.1 |
| 5 | k6 + live metrics + JFR + history | ✅ verified — REST + SSE fan-out, JFR, peaks, stats series |
| 6 | No `SQLITE_BUSY` under write load | ✅ (`ConcurrentWriteLoadTest`) |
| 7 | cloudflared public hostname | ✅ live on `bench.gaspartech.com`, Basic-auth protected |
| 8 | Standalone auth | ✅ (+ CI smoke) |

### Backlog epic rollup (see `docs/11-backlog.md`)

| Epic | Status |
| :-- | :-- |
| FOUND, PIN-01/02, CORE, PERSIST, LEGACY, MODERN, BUILD, INFRA-01..04 | **Done** |
| ORCH-01..07, OBS-01..05, LOAD-01..05, DASH-01..05, STAND-01..03/05/06, CI-01..03 | **Done (MVP)** |
| TUNNEL-01..03 | **Docs/wiring done; live DoD #7 open** |
| INFRA-05 (one-variable extension rows), OBS-06 (warmup metadata), RUNTIME-01 (JSON logs), STAND-04 (backup runbook polish), DASH-06, CI-04 checklist polish, STRETCH-* | **Open / P1–P3** |

---

## 2. Important known gaps (read before coding)

1. **SSE fan-out cost**  
   Each VU is a separate `bench/k6-sse` container, so a 200-VU SSE run spawns 200 containers in batches of `SSE_FANOUT_CONCURRENCY` (default 20). That is heavy on the load generator host and is the load generator's limit, not the target's. Raise VUs gradually and watch host memory.

2. **Context-switch counters can dip**  
   `JvmDeepSampler` sums `voluntary/nonvoluntary_ctxt_switches` across `/proc/self/task/*/status` (the process-wide value; `/proc/self/status` alone reports only the idle main thread and reads as a flat 0). Because it sums live OS threads, the total can decrease when threads exit; `ratePerSec` returns `null` on a negative delta, which renders as a chart gap. Expected, not a bug.

3. **Cloud agents cannot run the matrix**  
   Cloud Docker (cgroup/overlay) is unreliable here. Do matrix work on a host with Docker Engine ≥ 27; cloud agents can still do JAR builds, standalone smoke, unit tests, and `docker compose config`.

4. **Default admin password**  
   Docs/examples use `changeme`. Fine for local; never expose via tunnel without Cloudflare Access + a real secret.

5. **REST load mix is light**  
   `rest.js` does `/health`, list members, and creates a member on ~1/5 VUs — enough for WAL concurrency, not a full CRUD fuzz suite.

6. **Extension rows are opt-in** — `docker-compose.extra.yml` (INFRA-05) must be passed with `-f`,
   and the orchestrator must be **rebuilt** (`--build`) for `EXTRA_MATRIX_TARGETS` to take effect,
   since `src/` is baked into the image.

7. **Full-matrix capacity is filled** (`docs/12` §6): all 13 targets × REST+SSE at 50 VUs,
   `THINK_TIME=0`. ARM rows run under QEMU — useful for emulation-cost vs amd64, not native ARM
   quotes. See `infra/arm64-setup.md`; ARM images pin the arm64 platform digest in compose.

---

## 3. Recommended next work (ordered)

### P0 — Prove capacity (not just cost)

1. ~~**Full-matrix capacity (13 targets)**~~ — done (`docs/12` §6). Headline one-variable:
   virtual-low **422 rps / 22 threads** vs platform-low **273 rps / 74 threads**. ARM low under
   QEMU: **41 rps** vs amd64 Java 25 low **1223 rps**.
2. **SSE scale** — push held connections toward 200–1000 on the Java 21 pair (RSS divergence).
3. **Higher VU capacity** — 100–200 VUs on the Java 21 pair (and optionally `-high` footprints).
4. **Optional: Cloudflare Access** — rerun `setup-tunnel.ps1 -AccessEmail …` when the API token
   has `Access: Apps and Policies: Edit`.

### P1 — Cleaner science & polish

4. **INFRA-05** — optional compose override rows already exist (`docker-compose.extra.yml`); keep measuring them.  
5. **DASH** — sparkline / series view from `runs/{id}/stats-series.json` in RunCompare.  
6. **OBS-06** — warmup flag + host/JDK metadata on run records (`docs/09 §4`).  
7. **RUNTIME-01** — structured JSON logging (request id already exists).  
8. **STAND-04** — concrete backup/restore commands in README / `docs/10`.  
9. **CI-04** — keep README DoD table as the living checklist (already started).

### P2 / stretch

10. Richer `rest.js` CRUD mix (update/delete/dependents/agreements + intentional 400s).  
11. Bundled standalone CRUD UI (`DASH-06`).  
12. Retire legacy shell when Java 8/11 rows are no longer needed (`docs/01 §5`).

**Do not prioritize:** more non-LTS JDKs (e.g. 26) until Boot officially supports them; Boot 4.2 / k6 2 / React 19 upgrades per `docs/01 §5` gates.

---

## 4. How to verify (no full matrix required)

```bash
# JS
cd orchestrator && npm install --ignore-scripts && npm run test:unit
cd dashboard && npm install && npm run test:unit && npm run build
./scripts/check-stats-series.sh

# Service + standalone (needs JDK 17+)
cd service && ./build-all.sh
./scripts/smoke-standalone.sh
./scripts/openapi-diff.sh   # or npm path used in CI

# Compose parse (needs Docker CLI)
docker compose config
```

### Desktop load-test smoke

```bash
docker compose --profile tools build k6-sse
docker compose up -d --build orchestrator java21-virtual-low
# wait for http://localhost:8087/health
curl -s -X POST http://localhost:3000/api/loadtest \
  -H 'Content-Type: application/json' \
  -d '{"mode":"rest","targetName":"java21-virtual-low","vus":10,"duration":"30s","rampStages":"0:5s,full:20s,0:5s"}'
curl -s -X POST http://localhost:3000/api/loadtest \
  -H 'Content-Type: application/json' \
  -d '{"mode":"sse","targetName":"java21-virtual-low","vus":15,"duration":"20s","dropRate":0.1}'
# poll GET /api/runs/{runId} until status=completed
```

### E2E evidence (2026-07-26, Docker Engine 29.6.1, `java21-virtual-low`)

| Check | Result |
| :-- | :-- |
| Target health | `UP`, Java 21.0.11, Boot 4.1.0, `virtualThreadsEnabled=true`, maxHeap 185 MB |
| REST, 10 VUs / 30s | 577 iterations, 41.6 rps, p50 2.2 ms, p95 30 ms, 0 errors |
| SSE, 15 VUs / 20s | 15 concurrent containers, 15 connections, 102 events, 1 drop, exit 0 |
| Server peaks | mem 240 MB, threads 22, CPU 36%, heap 41 MB |
| Live deep metrics | context-switch rate 200–680/s, waited rate peak 227/s |
| JFR | `bench.jfr` 6.0 MB (REST) / 7.2 MB (SSE); `VirtualThreadPinned=0`, `ThreadPark≈17k` |
| Artifacts | `summary.json`, `summary-{n}.json` (SSE), `stats-series.json` (7 samples), `bench.jfr` |
| Maven build | `BUILD SUCCESS`, 15 tests green (write-load + both contract suites) |

---

## 5. Key paths

| Path | Role |
| :-- | :-- |
| `service/` | Maven multi-module insurance service |
| `apps/` | Built JARs (gitignored; CI builds them) |
| `docker-compose.yml` | Matrix + orchestrator + k6-sse + tunnel |
| `docker-compose.extra.yml` | Opt-in one-variable A/B rows (INFRA-05) |
| `orchestrator/src/` | Control plane (`loadtest.js`, `stats.js`, `jfr.js`, `runPeaks.js`) |
| `dashboard/src/` | `App.jsx`, `RunCompare.jsx` |
| `loadtests/` | `rest.js`, `sse.js`, `Dockerfile.k6-sse` |
| `runs/` | Persisted run artifacts (local/orchestrator volume) |
| `.github/workflows/ci.yml` | Unit, build/smoke, compose, OpenAPI |
| `scripts/smoke-standalone.sh` | DoD #8 |
| `infra/cloudflared/README.md` | DoD #7 operator steps |

### Run artifacts (after a successful loadtest)

| Path | Purpose |
| :-- | :-- |
| `runs/{id}.json` | Run record (client summary, server peaks, JFR aggregates) |
| `runs/{id}/summary.json` | Raw k6 `handleSummary` |
| `runs/{id}/stats-series.json` | Sampled live stats during the test |
| `runs/{id}/bench.jfr` | Flight recording dump |

---

## 6. Matrix reminder (same app, different engine)

| Service | Runtime | Shell | Threads | cpus | mem | Arch | Port |
| :-- | :-- | :-- | :-- | :-- | :-- | :-- | :-- |
| java8-platform-low | 8 | legacy | platform | 0.5 | 256m | amd64 | 8081 |
| java8-platform-mid | 8 | legacy | platform | 2.0 | 1g | amd64 | 8082 |
| java11-platform-low | 11 | legacy | platform | 1.0 | 512m | amd64 | 8083 |
| java11-platform-high | 11 | legacy | platform | 4.0 | 4g | amd64 | 8084 |
| java17-platform-mid | 17 | modern | platform | 2.0 | 2g | amd64 | 8085 |
| java17-platform-high | 17 | modern | platform | 8.0 | 8g | amd64 | 8086 |
| java21-virtual-low | 21 | modern | virtual | 0.5 | 256m | amd64 | 8087 |
| java21-virtual-high | 21 | modern | virtual | 4.0 | 4g | amd64 | 8088 |
| java25-virtual-arm-low | 25 | modern | virtual | 1.0 | 512m | arm64 | 8089 |
| java25-virtual-arm-high | 25 | modern | virtual | 4.0 | 4g | arm64 | 8090 |

Full `-Xmx` / footprint table: `docs/01-version-matrix.md` §4.1.

---

## 7. PR / branch notes for the next agent

- Merged platform MVP: **PR #8**; docs sync: **PR #10**.  
- Open: **PR #9** (`feat/k6-sse`) — SSE fan-out, merged with `main`, conflicts resolved, E2E verified.  
- Prefer one-variable PRs; keep shells free of business logic (core only).  
- On Windows, `service/build-all.ps1` gates on Maven's exit code — do not reintroduce a bare
  `& $Mvn` under `$ErrorActionPreference = "Stop"`, since Maven's SLF4J warning goes to stderr and
  aborts the script before the JARs are copied.  
- After changing service code, rebuild JARs **and** restart the matrix container; the JAR is a
  read-only bind mount, so a running container keeps the old bytes.
