# Agent Handoff — Spring Bench (2026-07-26)

> **Read first:** `REQUIREMENTS.md` · `docs/11-backlog.md` · `docs/01-version-matrix.md`

---

## Current state (summary)

| Layer | Status | Notes |
| :-- | :-- | :-- |
| Docs / version pins | **Done** | Boot **4.1.0** / **2.7.18**; Java LTS matrix |
| `service/` | **Done** | Micrometer + **bench.context.switches / bench.threads.blocked** gauges |
| `docker-compose.yml` | **Done** | Digest pins + `k6-sse` + tunnel profile |
| `orchestrator/` | **ORCH-02..05 + peaks** | Live CS/lock rates + peak mem/threads on run records |
| `dashboard/` | **DASH-02..05** | Live charts include CS + lock rates; historical compare |
| Load tests | **LOAD-01..03** | REST + SSE |
| Tunnel | **Docs ready** | Needs real `TUNNEL_TOKEN` on Docker host |
| Standalone | **Auth ready** | `scripts/smoke-standalone.sh` |

---

## Definition of Done

| # | Item | Status |
| :--: | :-- | :--: |
| 1 | build-all → apps/ | ✅ |
| 2 | OpenAPI contract parity | ✅ |
| 3 | compose config + digests | ✅ |
| 4 | orchestrator start/stop | ✅ |
| 5 | k6 + live metrics + JFR | ✅ REST+SSE+live(CS/lock)+JFR+compare+peaks |
| 6 | SQLITE_BUSY test | ✅ |
| 7 | cloudflared | ⚠️ wired; needs token on Docker host |
| 8 | standalone auth | ✅ |

---

## Recommended next task

1. End-to-end tunnel with a real Cloudflare token (DoD #7).
2. Persist full stats time-series JSON under `runs/{id}/` (OBS-05 polish).
3. CI workflow for `smoke-standalone` + dashboard/orchestrator unit checks.

---

## How to verify this slice (no Docker)

```bash
cd service && mvn -pl app-modern -am package -DskipTests
# optional: confirm gauges on a local jar
SPRING_PROFILES_ACTIVE=standalone SERVER_PORT=18081 java -jar apps/insurance-modern.jar &
curl -s localhost:18081/actuator/metrics/bench.context.switches.total
curl -s localhost:18081/actuator/metrics/bench.threads.blocked.total

cd orchestrator && npm run test:unit
cd dashboard && npm run test:unit && npm run build
```

---

## Key new files

| Path | Purpose |
| :-- | :-- |
| `core-domain/.../JvmDeepSampler.java` | `/proc` CS + ThreadMXBean blocked/waited |
| `orchestrator/src/runPeaks.js` | Peak merge + JFR field mapping |
| `dashboard` CS/lock charts | Live DASH-04 remainder |
