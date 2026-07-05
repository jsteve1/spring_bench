# 01 — Version Matrix & Pinned Versions (Single Source of Truth)

> **Researched: 2026-07-03** (revised from 2026-06-25 baseline). These are the authoritative
> versions for the whole project. Re-verify against upstream before building and pin container
> images by digest. Where a sub-document mentions a version, **this document wins.**

---

## 1. Pinned Toolchain (copy into build/config files)

| Layer | Component | Pinned Version | Notes |
| :-- | :-- | :-- | :-- |
| **Runtime (legacy)** | Eclipse Temurin JDK | **8** (`8-jdk-alpine`) | Java EE / `javax.*` era |
| | Eclipse Temurin JDK | **11** (`11-jdk-alpine`) | Last pre-17 LTS |
| **Runtime (modern)** | Eclipse Temurin JDK | **17** (`17-jdk-alpine`) | Spring Framework 6/7 baseline; JPMC minimum ("Java 17 or higher") |
| | Eclipse Temurin JDK | **21** (`21-jdk-alpine`) | **LTS; virtual-thread comparison tier** — longest production track record with stable Loom |
| | Eclipse Temurin JDK | **25** (`25-jdk-alpine`) | **Current LTS** (GA 2025-09-16); **recommended default for standalone and headline modern tier** |
| **Web framework (legacy)** | Spring Boot | **2.7.18** | Last OSS 2.7; supports Java 8–19; `javax.*`; **no virtual threads** |
| | Spring Framework | 5.3.x (managed by Boot) | |
| **Web framework (modern)** | Spring Boot | **4.1.x** (pin latest 4.1 patch, e.g. **4.1.0**) | **Actively supported OSS line** (Boot 3.5 reached OSS EOL 2026-06-30); Java 17–26; `jakarta.*`; virtual-thread flag |
| | Spring Framework | **7.0.x** (managed by Boot) | |
| | Embedded Tomcat | 11.x (managed by Boot) | Servlet 6.1 |
| **Persistence** | `org.xerial:sqlite-jdbc` | **3.53.2.0** | Bundles SQLite 3.53.2 native libs |
| | HikariCP | **managed by each Boot** | Boot 2.7 → 4.0.3; Boot 4.x → 6.x. Do **not** override |
| **Build** | Maven | **3.9.x** (≥ 3.9.9) | Boot 4.x needs ≥ 3.6.3 |
| | Gradle (if used) | **8.x** (8.14+) | |
| **Load testing** | Grafana `k6` | **1.8.0** (stable 1.x line) | Image `grafana/k6:1.8.0`. **Conservative:** avoids k6 v2.0.0 breaking changes (removed executors, Go module path, `--address` requirement). |
| **Orchestrator (pick one)** | Node.js LTS | **24.x** ("Krypton", Active LTS) | Express 5 |
| | Python | **3.13** | FastAPI **0.138.0** |
| **Dashboard** | Chart.js | **4.5.1** | ESM-only |
| | React (recommended) | **18.3.x** | Battle-tested; aligns to JPMC React requirement; use `react-chartjs-2` |
| **Tunnel** | `cloudflared` | **2026.6.1** | Image `cloudflare/cloudflared:2026.6.1` |
| **Containers** | Docker Engine | current stable (≥ 27.x) | Compose v2 plugin |
| | Docker Compose | v2 plugin (`docker compose`) | Drop the legacy `version:` key (Compose v2 ignores it) |

> **LTS posture:** matrix Java runtimes are **LTS only** (8, 11, 17, 21, 25). Spring Boot has no
> Java-style LTS — use the **currently supported OSS line** (4.1.x today). Re-verify the latest
> **4.1.x** patch and **1.x** k6 patch before building.

> **Image pinning rule:** the Alpine major tags above are for readability. In committed compose
> files, pin to a specific patch + digest, e.g. `eclipse-temurin:25-jdk-alpine@sha256:...`.

---

## 2. Java LTS Landscape (reference)

| Java | Type | GA | Role in this project |
| :-- | :-- | :-- | :-- |
| 8 | LTS | 2014-03 | Legacy floor — `javax.*`, platform threads |
| 11 | LTS | 2018-09 | Legacy upper |
| 17 | LTS | 2021-09 | **Modern baseline** (Spring 6/7, JPMC minimum) |
| **21** | **LTS** | **2023-09** | **Virtual-thread comparison tier** — longest track record with stable Loom |
| **25** | **LTS** | **2025-09-16** | **Current LTS; recommended default for standalone and headline modern tier** |
| 26 | feature (non-LTS) | 2026-03-17 | **Not in default matrix** — optional experimental row only if Boot officially supports it |

LTS line: **8 → 11 → 17 → 21 → 25**. Default matrix runtimes use **LTS only**. **Java 25** is the
headline modern runtime (longest support runway); **Java 21** stays in the matrix to isolate
virtual-thread maturity from runtime generation.

---

## 3. The Java ↔ Spring Boot Compatibility Wall

This constraint shapes the architecture (`docs/02`). It is also a core enterprise-modernization
talking point at JPMC.

| Spring Boot | Spring Framework | Min Java | Max Java | Namespace | Virtual threads |
| :-- | :-- | :-- | :-- | :-- | :-- |
| **2.7.x** | 5.3.x | **8** | 19 | `javax.*` | No |
| 3.0–3.1 | 6.0–6.1 | **17** | 21 | `jakarta.*` | No |
| 3.2–3.4 | 6.1–6.2 | 17 | 23 | `jakarta.*` | Yes (Java 21+) |
| 3.5.x | 6.2.x | 17 | 25 | `jakarta.*` | Yes (Java 21+) — **OSS EOL 2026-06-30** |
| **4.1.x** ← chosen | **7.0.x** | **17** | **26** | `jakarta.*` | Yes (Java 21+) |

**Chosen: Spring Boot 4.1.x** for the modern shell — actively supported OSS line, Spring Framework
7, `jakarta.*`, virtual-thread support, Java 17–26. The legacy shell stays on Boot **2.7.18** to
preserve the real bank migration story (`javax.*` → `jakarta.*`, Boot 2 → 4).

Three walls to internalize:

1. **Java 17 baseline.** Spring Framework 6 and 7 (Boot 3 and 4) require Java 17 minimum.
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
| **Runtime** | Java 8, 11, 17, 21, 25 (LTS only) | 8, 11, 17, 21, 25 |
| **Spring shell** | `legacy` (Boot 2.7.18) for Java 8/11 · `modern` (Boot 4.1.x) for Java 17–25 | auto by runtime |
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

The pins above are a **starting point on a known curve**, not a dead end. Treat the following as
the planned migration so the project stays current and demonstrates upgrade fluency (itself a JPMC
talking point — see `docs/07`).

### 5.1 Why we chose these pins (July 2026)
- **Spring Boot 4.1.x**: Boot 3.5 reached OSS end-of-life on **2026-06-30**; 4.x is the actively
  supported line for greenfield builds. The legacy shell (Boot 2.7.18) is kept intentionally to
  demonstrate the `javax`→`jakarta` / Boot 2→4 migration story.
- **Java 25 LTS** as standalone and headline modern default; **Java 21 LTS** retained in the matrix
  for virtual-thread comparison (longest Loom production track record).
- **Matrix runtimes are LTS-only** — Java 26 (non-LTS) is excluded from defaults.
- **k6 1.x**: avoids v2.0.0 breaking changes (removed executors, Go module path, `--address`).

### 5.2 Target end-state (when ready to modernize further)
| Component | Pinned now | Upgrade target | Gate before upgrading |
| :-- | :-- | :-- | :-- |
| Modern Spring shell | Boot 4.1.x (Spring 7, Tomcat 11) | **Boot 4.2+** (next minor) | Run release notes; confirm all transitive deps support the new minor |
| Modern runtime | Java 25 LTS (default) | **next Java LTS** (Java 29, planned 2027) | Boot version must officially support the JDK |
| Load tester | k6 1.8.0 | **k6 2.x** | Re-validate scripts vs the v2 migration guide; pass `--address` if using the HTTP API |
| Dashboard | React 18.3 | **React 19** | Standard React 18→19 codemods |
| Legacy shell | Boot 2.7.18 (Java 8/11) | **retire** | Decommission once Java 8/11 targets are no longer needed for the legacy benchmark |
| Experimental | — | **Java 26** matrix row | Only when Boot 4.x officially supports JDK 26 and you want a bleeding-edge comparison |

### 5.3 Sequence (low-risk order)
1. **Bump within the line first.** Move to the latest **4.1.x** patch and latest k6 1.x; confirm green.
2. **k6 1.x → 2.x**: update `loadtests/` per the migration guide and the image tag.
3. **React 18 → 19** in `dashboard/`.
4. **Boot 4.1 → 4.2+** when the next minor ships: change the parent BOM, run release notes, fix
   any Spring 7 / Tomcat deltas. The shared core needs **no change** (framework-agnostic — `docs/02`).
5. **Optional Java 26 row**: add only for experimental comparisons once officially supported.
6. **Retire the legacy shell** if/when the Java 8/11 comparison is no longer needed.

### 5.4 What makes this cheap
The shared, framework-agnostic core (`core-domain` + `core-persistence`, plain JDBC, no
`javax`/`jakarta`) means every framework or runtime upgrade touches only the thin shells and config
— never the business logic. That is the design property that turns a scary "Spring Boot 2→4 +
Java 8→25" migration into a series of small, isolated, reversible steps.
