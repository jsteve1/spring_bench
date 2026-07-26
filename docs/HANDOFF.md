# Agent Handoff — Spring Bench (2026-07-26)

> **Read first:** `REQUIREMENTS.md` · `docs/11-backlog.md` · `docs/01-version-matrix.md`  
> **Truth for “what’s built”:** this file. Spec docs (`01`–`10`) describe the intended design; backlog IDs map work items.

**Repo:** `jsteve1/spring_bench` · **Default branch:** `main` @ `8340553` (PR **#8** merged)  
**CI on `main`:** green (unit / service+smoke / compose / OpenAPI) — run `30208251961`

---

## 1. Current build state (what exists)

| Layer | Status | What’s in tree |
| :-- | :-- | :-- |
| Spec + pins | **Done** | Boot **2.7.18** / **4.1.0**; Java LTS **8/11/17/21/25**; k6 **1.8.0** |
| `service/` dual-shell | **Done** | Shared core + legacy/modern shells; Flyway; WAL single-writer; contract tests; Micrometer tags; `JvmDeepSampler` (CS / blocked / waited rates) |
| Artifacts | **Done** | `service/build-all.sh` → `apps/insurance-{j8,j11,j17,j21,legacy,modern}.jar` |
| Compose matrix | **Done** | 10 rows, digests, JFR in `JAVA_OPTS`, `profiles: [tools]` for `k6-sse`, `profiles: [tunnel]` for cloudflared |
| Orchestrator (Node 24) | **Done (MVP)** | Targets start/stop/restart; live stats WS; k6 REST+SSE; JFR collect; run records + **peaks** + **`runs/{id}/stats-series.json`** |
| Dashboard (React) | **Done (MVP)** | Targets + load form; live CPU/mem/threads/heap/GC/**CS/lock** charts; historical **RunCompare** (+ demo fixtures) |
| Load scripts | **Done (MVP)** | `loadtests/rest.js`, `sse.js` + `Dockerfile.k6-sse` (`xk6-sse@v0.1.11`) |
| Standalone | **Done** | HTTP Basic on writes; `/seed` gated; `scripts/smoke-standalone.sh` |
| CI | **Done** | `.github/workflows/ci.yml` — CI-01..03 (+ standalone smoke) |
| Tunnel | **Wired, not proven** | Compose + `.env.example` + `infra/cloudflared/README.md` — needs real `TUNNEL_TOKEN` on a Docker host |

### Definition of Done

| # | Item | Status |
| :--: | :-- | :--: |
| 1 | `build-all` → `apps/` | ✅ |
| 2 | OpenAPI parity (legacy vs modern) | ✅ (+ CI) |
| 3 | `docker compose config` + digests | ✅ (+ CI) |
| 4 | Orchestrator start/stop + stack | ✅ (code); **desktop Docker E2E still required** |
| 5 | k6 + live metrics + JFR + history | ✅ MVP (+ stats series); **desktop E2E still required** |
| 6 | No `SQLITE_BUSY` under write load | ✅ (`ConcurrentWriteLoadTest`) |
| 7 | cloudflared public hostname | ⚠️ **code/docs only** — no live token verification in CI/cloud |
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

1. **SSE concurrency fidelity (high priority)**  
   Current `main` launches **one** `bench/k6-sse` container per SSE loadtest. `xk6-sse` historically does **not** multiplex concurrent held connections well inside a single process.  
   **Open PR #9** (`feat/k6-sse`) adds **1 container per VU fan-out** + merges `client.sse` metrics. That branch’s HANDOFF is **stale** (claims standalone/tunnel missing — those landed in PR #8). **Rebase #9 onto current `main` before merge**; do not take its HANDOFF wholesale.

2. **Desktop Docker E2E not proven in cloud agents**  
   Cloud Docker (cgroup/overlay) was flaky. Prefer a host with Docker Engine ≥ 27: build JARs → `docker compose --profile tools build k6-sse` → up orchestrator + one target → REST then SSE → confirm JFR + compare UI.

3. **Default admin password**  
   Docs/examples use `changeme`. Fine for local; never expose via tunnel without Cloudflare Access + a real secret.

4. **REST load mix is light**  
   `rest.js` does `/health`, list members, and creates a member on ~1/5 VUs — enough for WAL concurrency, not a full CRUD fuzz suite.

5. **Optional matrix rows** (`docs/01 §4.2`) are **documented only** — not in default compose (`INFRA-05`).

---

## 3. Recommended next work (ordered)

### P0 — Finish DoD / prove the product

1. **Desktop E2E validation pass** (DoD #4/#5 on real Docker)  
   - `cd service && ./build-all.sh`  
   - `docker compose --profile tools build k6-sse`  
   - `docker compose up -d orchestrator java21-virtual-low`  
   - Dashboard / `POST /api/loadtest` with `mode=rest` then `mode=sse`  
   - Confirm `runs/{id}.json`, `summary.json`, `stats-series.json`, `bench.jfr`, live charts, RunCompare  

2. **Land SSE fan-out** — rebase/merge **PR #9** (or re-implement fan-out on `main`) so high-VU SSE actually holds N connections. Update `docs/06` + this handoff after merge.

3. **DoD #7** — on a Docker host: set `TUNNEL_TOKEN`, `docker compose --profile tunnel up -d`, verify public hostname → orchestrator, enable Cloudflare Access.

### P1 — Cleaner science & polish

4. **INFRA-05** — add optional compose override for one-variable A/Bs: `java17-virtual-*`, `java21-platform-*`, `java25-virtual-amd64-*`.  
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
  -d '{"mode":"rest","targetName":"java21-virtual-low","vus":5,"duration":"20s","rampStages":"full:20s"}'
# then mode=sse with small VUs until fan-out lands
```

---

## 5. Key paths

| Path | Role |
| :-- | :-- |
| `service/` | Maven multi-module insurance service |
| `apps/` | Built JARs (gitignored; CI builds them) |
| `docker-compose.yml` | Matrix + orchestrator + k6-sse + tunnel |
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

- Merged platform MVP: **PR #8** (`cursor/cloud-agent-1785075987234-sxq3t`).  
- Open follow-up: **PR #9** (`feat/k6-sse`) — SSE fan-out; **rebase onto `main`** before merge.  
- Prefer one-variable PRs; keep shells free of business logic (core only).  
- Cloud agent Docker may fail — fall back to host JAR smoke + document desktop verification.
