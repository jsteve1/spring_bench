# Agent Handoff — Spring Bench (2026-07-26)

> **Read first:** `REQUIREMENTS.md` · `docs/11-backlog.md` · `docs/01-version-matrix.md`

---

## Current state (summary)

| Layer | Status | Notes |
| :-- | :-- | :-- |
| Docs / version pins | **Done** | Boot **4.1.0** / **2.7.18**; Java LTS matrix |
| `service/` | **Done** | Micrometer + deep gauges + standalone auth |
| `docker-compose.yml` | **Done** | Digests + `k6-sse` + tunnel profile |
| `orchestrator/` | **Done (MVP)** | Control, stats, k6, JFR, **peaks + stats-series.json** |
| `dashboard/` | **Done (MVP)** | Controls, live CS/lock charts, historical compare |
| CI | **CI-01..03** | `.github/workflows/ci.yml` (unit, build/smoke, compose, OpenAPI) |
| Tunnel | **Docs ready** | Needs real `TUNNEL_TOKEN` on Docker host |
| Standalone | **Auth ready** | `scripts/smoke-standalone.sh` |

---

## Definition of Done

| # | Item | Status |
| :--: | :-- | :--: |
| 1 | build-all → apps/ | ✅ |
| 2 | OpenAPI contract parity | ✅ (+ CI) |
| 3 | compose config + digests | ✅ (+ CI) |
| 4 | orchestrator start/stop | ✅ |
| 5 | k6 + live metrics + JFR | ✅ (+ stats series artifact) |
| 6 | SQLITE_BUSY test | ✅ |
| 7 | cloudflared | ⚠️ wired; needs token on Docker host |
| 8 | standalone auth | ✅ (+ CI smoke) |

---

## Recommended next task

1. Run tunnel end-to-end with a real Cloudflare token (DoD #7).
2. Optional: surface `stats-series.json` as a sparkline in the compare UI.
3. Optional: Cloudflare Access notes polish / ARM64 QEMU runbook pass.

---

## How to verify this slice (no Docker)

```bash
cd orchestrator && npm run test:unit
cd dashboard && npm run test:unit && npm run build
chmod +x scripts/check-stats-series.sh && ./scripts/check-stats-series.sh
# if jars present:
./scripts/smoke-standalone.sh
```

---

## Key artifacts on a completed run

| Path | Purpose |
| :-- | :-- |
| `runs/{id}.json` | Run record (client + server peaks + JFR aggregates) |
| `runs/{id}/summary.json` | k6 summary export |
| `runs/{id}/stats-series.json` | Sampled live stats during the load test |
| `runs/{id}/bench.jfr` | Flight recording dump |
