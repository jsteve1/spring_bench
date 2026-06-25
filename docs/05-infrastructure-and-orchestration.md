# 05 — Infrastructure & Orchestration

Versions pinned in `docs/01`. The matrix dimensions/defaults are in `docs/01 §4`.

---

## 1. Host

- **Ubuntu Server** (LTS) running the **standard Docker Engine** (≥ 27.x) with the Compose v2
  plugin (`docker compose`, not `docker-compose`).
- Authoring on Windows is fine, but all executed scripts target Linux.

---

## 2. Docker Compose Matrix

`docker-compose.yml` instantiates the default 10-service matrix from `docs/01 §4.1`. Rules:

- **Pin images** to a patch + digest (`docs/01 §1`); use `eclipse-temurin:<ver>-jdk-alpine`.
- **Drop the legacy `version:` key** — Compose v2 ignores it.
- Apply CPU/memory limits so they actually bind. With the Compose plugin, either run
  `docker compose --compatibility up` to honor top-level `cpus`/`mem_limit`, or use
  `deploy.resources.limits` (`cpus`, `memory`). Pick one and be consistent.
- Mount the matching artifact read-only: `./apps/insurance-<x>.jar:/app.jar:ro`.
- Command: `sh -c "java $JAVA_OPTS -jar /app.jar"`.
- Set `SPRING_THREADS_VIRTUAL_ENABLED=true` **only** on Java 21+ rows (default: 21 and 25) (`docs/04 §5`).
- Matrix targets stay on an **internal** Docker network — only the orchestrator/dashboard and
  cloudflared are exposed.
- Host ports **8081–8090** are fixed (`docs/01 §4.1`); container port is `SERVER_PORT` (8080).

Per-service template (values from the matrix table):
```yaml
services:
  java25-virtual-arm-low:
    image: eclipse-temurin:25-jdk-alpine@sha256:<pin>
    platform: linux/arm64/v8        # only on arm64 rows
    container_name: java25-virtual-arm-low
    networks: [matrix-net]
    environment:
      - SERVER_PORT=8080
      - SPRING_THREADS_VIRTUAL_ENABLED=true   # only on Java 21+ rows
      - JAVA_OPTS=-Xmx384m
      - DB_PATH=/tmp/insurance.db
    deploy:
      resources:
        limits:
          cpus: "1.0"
          memory: 512m
    volumes:
      - ./apps/insurance-modern.jar:/app.jar:ro
    command: sh -c "java $JAVA_OPTS -jar /app.jar"
    ports:
      - "8089:8080"
```

### 2.1 ARM64 Emulation (`infra/arm64-setup.md`)
ARM64 rows on an x86 host need binfmt/QEMU:
```bash
docker run --privileged --rm tonistiigi/binfmt --install arm64
```
Document the expected throughput penalty (emulation is for *capability*, not raw speed) so ARM
numbers are interpreted correctly. Optionally add a native-amd64 twin (`docs/01 §4.2`) to separate
the emulation cost from the runtime effect.

---

## 3. Orchestrator Control API (`orchestrator/`)

Pick **Node.js 24 + Express 5** *or* **Python 3.13 + FastAPI 0.138.0** (`docs/01`). Document the
choice and why in the README. (A Spring Boot orchestrator is a JPMC-aligned alternative — see
`docs/07`.)

Responsibilities:
- Mount `/var/run/docker.sock` and start/stop/restart any matrix target by name.
- Poll `docker stats` (or the Docker API) and parse CPU %, mem usage/limit, net I/O per container
  into structured JSON time series.
- Trigger `k6` runs (`docs/06`) with user-supplied params; capture the JSON summary.
- Persist run history (SQLite or JSON file) and expose it.
- Stream live stats to the dashboard via WebSocket or SSE.

Endpoints:
| Method | Path | Purpose |
| :-- | :-- | :-- |
| GET | `/api/targets` | List matrix services + running state + `/health` introspection |
| POST | `/api/targets/{name}/start` | Start container |
| POST | `/api/targets/{name}/stop` | Stop container |
| POST | `/api/targets/{name}/restart` | Restart container |
| GET | `/api/stats/stream` | Live `docker stats` (WS or SSE) |
| POST | `/api/loadtest` | Launch k6 with params (VUs, ramp stages, duration, drop rate, REST/SSE) |
| GET | `/api/runs` | Historical run list |
| GET | `/api/runs/{id}` | Single run detail (latency p50/p95/p99, RPS, errors, data) |

> **Security:** the orchestrator can control Docker via the socket. When exposed through
> cloudflared, put it behind Cloudflare Access (auth) — do not leave control endpoints open.

---

## 4. Cloudflare Tunnel (`infra/cloudflared/`)

Expose only the orchestrator/dashboard to the public web with no inbound router ports.

- Image `cloudflare/cloudflared:2026.6.1` (`docs/01`).
- Run as a compose service on the same network as the orchestrator/dashboard:
```yaml
  cloudflared:
    image: cloudflare/cloudflared:2026.6.1
    container_name: cloudflared
    restart: unless-stopped
    command: tunnel --no-autoupdate run
    environment:
      - TUNNEL_TOKEN=${TUNNEL_TOKEN}
    networks: [matrix-net]
    depends_on: [orchestrator]
```
- Route the public hostname to the internal service name (e.g. `bench.example.com → http://orchestrator:PORT`).
- Keep `TUNNEL_TOKEN` in an untracked `.env`. Recommend layering Cloudflare Access on top.
