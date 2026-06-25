# 01 — Version Matrix & Pinned Versions (Single Source of Truth)

> **Researched: 2026-06-25.** These are the authoritative versions for the whole project.
> Re-verify against upstream before building and pin container images by digest.
> Where a sub-document mentions a version, **this document wins.**

---

## 1. Pinned Toolchain (copy into build/config files)

| Layer | Component | Pinned Version | Notes |
| :-- | :-- | :-- | :-- |
| **Runtime (legacy)** | Eclipse Temurin JDK | **8** (`8-jdk-alpine`) | Java EE / `javax.*` era |
| | Eclipse Temurin JDK | **11** (`11-jdk-alpine`) | Last pre-17 LTS |
| **Runtime (modern)** | Eclipse Temurin JDK | **17** (`17-jdk-alpine`) | Spring Framework 6/7 baseline; JPMC minimum ("Java 17 or higher") |
| | Eclipse Temurin JDK | **21** (`21-jdk-alpine`) | **LTS; virtual threads stable — recommended default modern tier** |
| | Eclipse Temurin JDK | **25** (`25-jdk-alpine`) | LTS, GA 2025-09-16; current LTS, supported by Boot 3.5 |
| | Eclipse Temurin JDK | **26** (`26-jdk-alpine`) | Feature release (non-LTS); **not officially supported by Boot 3.5** — experimental only |
| **Web framework (legacy)** | Spring Boot | **2.7.18** | Last OSS 2.7; supports Java 8–19; `javax.*`; **no virtual threads** |
| | Spring Framework | 5.3.x (managed by Boot) | |
| **Web framework (modern)** | Spring Boot | **3.5.x** (pin latest 3.5 patch) | **Conservative choice:** last 3.x line; Java 17–25; `jakarta.*`; virtual-thread flag. (Boot 4.x exists but is newer than most banks run.) |
| | Spring Framework | **6.2.x** (managed by Boot) | |
| | Embedded Tomcat | 10.1.x (managed by Boot) | Servlet 6.0 |
| **Persistence** | `org.xerial:sqlite-jdbc` | **3.53.2.0** | Bundles SQLite 3.53.2 native libs |
| | HikariCP | **managed by each Boot** | Boot 2.7 → 4.0.3; Boot 3.5 → 6.x. Do **not** override |
| **Build** | Maven | **3.9.x** (≥ 3.9.9) | Boot 3.5 needs ≥ 3.6.3 |
| | Gradle (if used) | **8.x** (8.14+) | |
| **Load testing** | Grafana `k6` | **1.8.0** (stable 1.x line) | Image `grafana/k6:1.8.0`. **Conservative:** avoids k6 v2.0.0 breaking changes (removed executors, Go module path, `--address` requirement). |
| **Orchestrator (pick one)** | Node.js LTS | **24.x** ("Krypton", Active LTS) | Express 5 |
| | Python | **3.13** | FastAPI **0.138.0** |
| **Dashboard** | Chart.js | **4.5.1** | ESM-only |
| | React (recommended) | **18.3.x** | Battle-tested; aligns to JPMC React requirement; use `react-chartjs-2` |
| **Tunnel** | `cloudflared` | **2026.6.1** | Image `cloudflare/cloudflared:2026.6.1` |
| **Containers** | Docker Engine | current stable (≥ 27.x) | Compose v2 plugin |
| | Docker Compose | v2 plugin (`docker compose`) | Drop the legacy `version:` key (Compose v2 ignores it) |

> **Conservative posture:** prefer the last well-established minor of each tool over the newest
> release. Re-verify the latest **3.5.x** patch and **1.x** k6 patch before building.

> **Image pinning rule:** the Alpine major tags above are for readability. In committed compose
> files, pin to a specific patch + digest, e.g. `eclipse-temurin:21-jdk-alpine@sha256:...`.

---

## 2. Java LTS Landscape (reference)

| Java | Type | GA | Role in this project |
| :-- | :-- | :-- | :-- |
| 8 | LTS | 2014-03 | Legacy floor — `javax.*`, platform threads |
| 11 | LTS | 2018-09 | Legacy upper |
| 17 | LTS | 2021-09 | **Modern baseline** (Spring 6/7, JPMC minimum) |
| **21** | **LTS** | **2023-09** | **Recommended default modern tier** — virtual threads stable, maximally proven |
| 25 | LTS | 2025-09-16 | Current LTS (Compact Object Headers, Generational Shenandoah); supported by Boot 3.5 |
| 26 | feature (non-LTS) | 2026-03-17 | Experimental only; not officially supported by Boot 3.5 |

LTS line: **8 → 11 → 17 → 21 → 25**. Conservative posture favors **Java 21 LTS** as the headline
modern runtime (longest track record with stable Loom); Java 25 LTS is included as the current
release. Java 26 is a 6-month feature release — keep it out of default runs.

---

## 3. The Java ↔ Spring Boot Compatibility Wall

This constraint shapes the architecture (`docs/02`). It is also a core enterprise-modernization
talking point at JPMC.

| Spring Boot | Spring Framework | Min Java | Max Java | Namespace | Virtual threads |
| :-- | :-- | :-- | :-- | :-- | :-- |
| **2.7.x** | 5.3.x | **8** | 19 | `javax.*` | No |
| 3.0–3.1 | 6.0–6.1 | **17** | 21 | `jakarta.*` | No |
| 3.2–3.4 | 6.1–6.2 | 17 | 23 | `jakarta.*` | Yes (Java 21+) |
| **3.5.x** ← chosen | **6.2.x** | **17** | **25** | `jakarta.*` | Yes (Java 21+) |
| 4.0–4.1 | 7.0.x | 17 | 26 | `jakarta.*` | Yes (Java 21+) |

**Chosen (conservative): Spring Boot 3.5.x** for the modern shell — the last 3.x line, broadly
deployed in production, `jakarta.*`, virtual-thread support, Java 17–25. Boot 4.x is intentionally
avoided as too new for a bank-realistic stack.

Three walls to internalize:

1. **Java 17 baseline.** Spring Framework 6 and 7 (all of Boot 3 and 4) require Java 17 minimum.
   There is no modern Boot on Java 8/11 — that is why those stay on Boot **2.7.18**.
2. **`javax.*` → `jakarta.*`.** Boot 3+ moved from Java EE to Jakarta EE 9+. This breaks imports
   in entities/servlets/validation and is *the* dominant migration cost in real banks. We sidestep
   it by keeping the shared core free of both namespaces (`docs/02`).
3. **Loom timeline.** Virtual threads went stable in **Java 21**; Spring wired
   `spring.threads.virtual.enabled` in Boot **3.2**. You need *both*. Java 17 + modern Boot =
   platform threads only — so only set the virtual-thread env on Java 21+ targets.

---

## 4. The Concurrency Matrix as Configurable Dimensions

The original brief's "Java 8/11/17/21/25" services were **rules of thumb**. Model the matrix as a
product of independent, modifiable dimensions. Any service block is a point in this space.

| Dimension | Allowed values | Default(s) |
| :-- | :-- | :-- |
| **Runtime** | Java 8, 11, 17, 21, 25, 26 | 8, 11, 17, 21, 25 |
| **Spring shell** | `legacy` (Boot 2.7.18) for Java 8/11 · `modern` (Boot 3.5.x) for Java 17–25 | auto by runtime |
| **Threading model** | `platform` (any) · `virtual` (Java 21+ only) | platform ≤17, virtual ≥21 |
| **CPU footprint** | `cpus` limit (e.g. 0.5, 1, 2, 4, 8) | per tier below |
| **Memory footprint** | `mem_limit` + `-Xmx` | per tier below |
| **Architecture** | `amd64` (native) · `arm64/v8` (emulated) | amd64; arm64 for the 25 tier |

A target's identity = `{runtime}-{threading}-{footprint}[-{arch}]`.

### 4.1 Default Matrix Instantiation (10 services)

These defaults reproduce the original brief. They are the *starting* matrix, fully editable in
`docker-compose.yml` (`docs/05`).

| Service | Runtime | Shell | Threads | cpus | mem | -Xmx | Arch | Host port |
| :-- | :-- | :-- | :-- | :-- | :-- | :-- | :-- | :-- |
| java8-platform-low | 8 | legacy | platform | 0.5 | 256m | 192m | amd64 | 8081 |
| java8-platform-mid | 8 | legacy | platform | 2.0 | 1g | 768m | amd64 | 8082 |
| java11-platform-low | 11 | legacy | platform | 1.0 | 512m | 384m | amd64 | 8083 |
| java11-platform-high | 11 | legacy | platform | 4.0 | 4g | 3g | amd64 | 8084 |
| java17-platform-mid | 17 | modern | platform | 2.0 | 2g | 1500m | amd64 | 8085 |
| java17-platform-high | 17 | modern | platform | 8.0 | 8g | 6g | amd64 | 8086 |
| java21-virtual-low | 21 | modern | virtual | 0.5 | 256m | 192m | amd64 | 8087 |
| java21-virtual-high | 21 | modern | virtual | 4.0 | 4g | 3g | amd64 | 8088 |
| java25-virtual-arm-low | 25 | modern | virtual | 1.0 | 512m | 384m | arm64/v8 | 8089 |
| java25-virtual-arm-high | 25 | modern | virtual | 4.0 | 4g | 3g | arm64/v8 | 8090 |

**Ports 8081–8090 are fixed** (the orchestrator/dashboard reference them). Everything else in a
row is a tunable knob.

### 4.2 Suggested JPMC-aligned extensions (optional)

To stress the dimensions JPMC actually runs (Java 17+), add comparison rows such as:
`java17-virtual-*` (platform vs virtual on the *same* runtime), `java21-platform-*`
(isolate the Loom effect), and a `java25-virtual-amd64-*` (separate the ARM-emulation cost from
the runtime). These make the benchmark a clean A/B of *one variable at a time*.

---

## 5. Upgrade Path (deliberate roadmap)

The conservative pins above are a **starting point on a known curve**, not a dead end. Treat the
following as the planned migration so the project stays current and demonstrates upgrade fluency
(itself a JPMC talking point — see `docs/07`).

### 5.1 Why we are not on the newest today
- **Spring Boot 3.5.x** (not 4.x): 4.x requires Spring Framework 7 and is newer than most
  production banks run. 3.5 is the last 3.x line — broadly deployed, `jakarta.*`, virtual-thread
  capable. We pin it now and schedule the jump to 4.x.
- **Java 21 LTS** (default, with 25 available): longest track record with stable virtual threads.
- **k6 1.x**: avoids v2.0.0 breaking changes (removed executors, Go module path, `--address`).

### 5.2 Target end-state (when ready to modernize)
| Component | Conservative now | Upgrade target | Gate before upgrading |
| :-- | :-- | :-- | :-- |
| Modern Spring shell | Boot 3.5.x (Spring 6.2, Tomcat 10.1) | **Boot 4.x** (Spring 7, Tomcat 11) | Run the Boot 4 migration guide; confirm all transitive deps support Spring 7 |
| Modern runtime | Java 21 (default) | **Java 25 LTS** as default; 26 experimental | Boot version must support the JDK (Boot 3.5 ≤ 25; Boot 4.x ≤ 26) |
| Load tester | k6 1.8.0 | **k6 2.x** | Re-validate scripts vs the v2 migration guide; pass `--address` if using the HTTP API |
| Dashboard | React 18.3 | **React 19** | Standard React 18→19 codemods |
| Legacy shell | Boot 2.7.18 (Java 8/11) | **retire** | Decommission once Java 8/11 targets are no longer needed for the legacy benchmark |

### 5.3 Sequence (low-risk order)
1. **Bump within the line first.** Move to the latest 3.5.x patch and latest k6 1.x; confirm green.
2. **Raise the modern default runtime** 21 → 25 (Boot 3.5 already supports 25). Re-baseline benchmarks.
3. **Spring Boot 3.5 → 4.x** in `app-modern` only: change the parent BOM, run the official
   migration guide, fix any Spring 7 / Tomcat 11 deltas. The shared core needs **no change**
   (it is framework-agnostic — `docs/02`), which is the whole point of the architecture.
4. **k6 1.x → 2.x**: update `loadtests/` per the migration guide and the image tag.
5. **React 18 → 19** in `dashboard/`.
6. **Java 26 / Boot 4 + JDK 26**: optional, experimental tier only.
7. **Retire the legacy shell** if/when the Java 8/11 comparison is no longer needed.

### 5.4 What makes this cheap
The shared, framework-agnostic core (`core-domain` + `core-persistence`, plain JDBC, no
`javax`/`jakarta`) means every framework or runtime upgrade touches only the thin shells and config
— never the business logic. That is the design property that turns a scary "Spring Boot 2→4 +
Java 8→25" migration into a series of small, isolated, reversible steps.
