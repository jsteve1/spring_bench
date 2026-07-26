# Agent Handoff — Spring Bench (2026-07-26)

> **Read first:** `REQUIREMENTS.md` · `docs/11-backlog.md` · `docs/01-version-matrix.md`

---

## Current state (summary)

| Layer | Status | Notes |
| :-- | :-- | :-- |
| Docs / version pins | **Done** | Boot **4.1.0** / **2.7.18**; Java LTS matrix |
| `service/` | **Done (MVP + standalone auth)** | Contract tests + Micrometer + **HTTP Basic in `standalone`** |
| `docker-compose.yml` | **Done** | Digest pins + `BENCH_*` + `k6-sse` + `cloudflared` tunnel profile |
| `orchestrator/` | **ORCH-02..05** | Docker control, live stats+JVM scrape, REST + SSE k6 |
| `dashboard/` | **DASH-02/03/05** | Controls + load form + charts + historical compare |
| Load tests | **LOAD-01..03** | `rest.js` + `sse.js` + `bench/k6-sse` |
| Observability | **OBS-01..04** | Tags + Actuator scrape + JFR dump/collect |
| Tunnel | **TUNNEL-01/02 docs** | Compose profile + `.env.example` (needs real `TUNNEL_TOKEN`) |
| Standalone | **STAND-01..03/05** | Persistent DB path, seed off, Basic auth, CORS origins |

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
| 7 | cloudflared | ⚠️ wired; needs token on a Docker host |
| 8 | standalone auth | ✅ smoke via `scripts/smoke-standalone.sh` |

---

## Recommended next task

1. Wire live context-switch / lock-contention into real-time charts (DASH-04 remainder).
2. Persist peak mem/threads onto run records from the stats stream.
3. Run tunnel end-to-end with a real Cloudflare token when Docker is available.

---

## How to verify standalone (no Docker)

```bash
cd service && ./build-all.sh   # or mvn -pl app-modern -am package -DskipTests
./scripts/smoke-standalone.sh
```

Expect: `/health` open, unauthenticated write → `401`, Basic auth write → `201` with `updatedBy=admin`, `/seed` → `403`.

---

## Key new files

| Path | Purpose |
| :-- | :-- |
| `service/app-*/config/SecurityConfig.java` | HTTP Basic when `app.security.enabled` |
| `scripts/smoke-standalone.sh` | DoD #8 offline check |
| `dashboard/src/RunCompare.jsx` | DASH-05 compare UI |
| `loadtests/Dockerfile.k6-sse` | Custom k6 + xk6-sse |
