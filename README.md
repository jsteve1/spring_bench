# Spring Bench — Java Concurrency Matrix

Benchmark platform for running an identical insurance microservice across Java runtimes, threading
models, and hardware footprints. See [REQUIREMENTS.md](REQUIREMENTS.md) and [docs/](docs/) for the
full spec.

## Stack (pinned in `docs/01-version-matrix.md`)

| Layer | Version |
| :-- | :-- |
| Legacy shell | Spring Boot **2.7.18**, Java **8** bytecode |
| Modern shell | Spring Boot **4.1.0**, Java **17** bytecode |
| Matrix runtimes | Temurin **8 / 11 / 17 / 21 / 25** (LTS only) |
| Load testing | k6 **1.8.0** |
| Orchestrator | Node.js **24** + Express **5** |
| Dashboard | React **18.3** + Chart.js **4.5.1** |

## Quick start

### 1. Build service artifacts

Requires **JDK 17+** and **Maven 3.9+** on the host (Boot 4.1 builds the modern shell).

```powershell
cd service
.\build-all.ps1
```

Linux:

```bash
cd service
./build-all.sh
```

JARs land in `./apps/` (`insurance-j8.jar` … `insurance-modern.jar`).

### 2. Run standalone (no Docker)

```powershell
$env:SPRING_PROFILES_ACTIVE = "standalone"
$env:DB_PATH = ".\data\office.db"
java -jar apps\insurance-modern.jar
```

Open `http://localhost:8080/health` and `http://localhost:8080/swagger-ui.html`.

### 3. Run the benchmark matrix

```bash
docker compose config   # validate
docker compose up -d orchestrator
docker compose up -d java21-virtual-low   # example target
```

Matrix services listen on host ports **8081–8090**. Orchestrator dashboard API: `http://localhost:3000`.

### 4. Dashboard (dev)

```bash
cd orchestrator && npm install && npm start
cd dashboard && npm install && npm run dev
```

Build static dashboard for the orchestrator container:

```bash
cd dashboard && npm run build
```

## Repo layout

```
spring_bench/
├── service/          # Maven multi-module microservice
├── apps/             # built JARs (gitignored)
├── orchestrator/     # Docker control API
├── dashboard/        # React + Chart.js UI
├── loadtests/        # k6 REST + SSE scripts
├── infra/            # cloudflared + ARM64 notes
└── docs/             # scoped specifications
```

## Design notes

- **Shared core** (`core-domain`, `core-persistence`) compiles to Java 8, no Spring/javax/jakarta.
- **Two thin shells** wrap the core: legacy (Boot 2.7) vs modern (Boot 4.1).
- **SQLite WAL** with a single-writer pool isolates JVM concurrency from network DB noise.
- Versions are authoritative in `docs/01-version-matrix.md`; re-verify upstream before release.
Implementation status and next steps: **`docs/HANDOFF.md`**.

## Orchestrator choice

Node.js + Express was chosen for fast iteration on Docker/k6 wiring. A Spring Boot orchestrator
(`docker-java`) is a JPMC-aligned alternative — see `docs/07-jpmc-alignment.md`.
