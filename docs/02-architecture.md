# 02 — Architecture: Shared Core + Two Spring Shells

Versions referenced here are pinned in `docs/01-version-matrix.md`.

---

## 1. The Core Idea

To keep business logic **provably identical** across Java 8→25 while honoring the compatibility
wall (`docs/01 §3`), isolate the domain from the framework. The same business code is invoked by a
**legacy shell** (Spring Boot 2.7.18) and a **modern shell** (Spring Boot 4.1.x); only the
framework wrapper and the runtime/threading config differ.

```
              ┌─────────────────────────────────────────────┐
              │              shared core (Java 8)            │
              │   core-domain  +  core-persistence (JDBC)    │
              │   no Spring · no javax · no jakarta          │
              └───────────────┬───────────────┬─────────────┘
                              │               │
               depends on ▼  │               │  ▼ depends on
        ┌─────────────────────────┐   ┌─────────────────────────┐
        │ app-legacy              │   │ app-modern              │
        │ Spring Boot 2.7.18      │   │ Spring Boot 4.1.x       │
        │ Java 8 bytecode         │   │ Java 17 bytecode        │
        │ → insurance-legacy.jar  │   │ → insurance-modern.jar  │
        └─────────────────────────┘   └─────────────────────────┘
              runs on JREs 8, 11           runs on JREs 17, 21, 25
```

---

## 2. Why This Works

- **`core-domain` + `core-persistence` compile to Java 8 bytecode** and depend on nothing from
  Spring, `javax.*`, or `jakarta.*`. A Java 8 jar runs unchanged on every JRE 8 through 25.
- **Use plain JDBC, not JPA.** JPA forces the `javax.persistence` (Boot 2.7) vs `jakarta.persistence`
  (Boot 3) split into entity classes, which would break code sharing. Plain JDBC over
  `sqlite-jdbc` has no such dependency — and makes lock/contention behavior more transparent for
  benchmarking (a feature, not a compromise).
- **Thin shells.** Each shell contains only controllers + wiring and delegates 100% of behavior to
  the shared core. Standard Spring MVC annotations (`@RestController`, `@GetMapping`, …) are
  source-compatible between Boot 2.7 and 4.1 **as long as you never touch the servlet API
  directly** (`javax.servlet` vs `jakarta.servlet`). Use Spring's `SseEmitter` for SSE, never raw
  servlet streaming.

---

## 3. Module Layout (`service/`)

```
service/
├── pom.xml                 # parent / aggregator (Maven multi-module)
├── core-domain/            # POJOs, enums, audit logic, service interfaces. Java 8. No framework.
├── core-persistence/       # JDBC DAOs, SQLite WAL config, migrations. Java 8. No framework.
├── app-legacy/             # Spring Boot 2.7.18 shell  (release="8")  → insurance-legacy.jar
├── app-modern/             # Spring Boot 4.1.x shell   (release="17") → insurance-modern.jar
└── build-all.(sh|ps1)      # builds both shells, copies artifacts into ../apps/ under matrix names
```

- `core-domain` / `core-persistence`: set Maven compiler `<release>8</release>`.
- `app-legacy`: Boot 2.7.18 parent, `<release>8</release>`.
- `app-modern`: Boot 4.1.x parent, `<release>17</release>`.
- Keep dependency versions inherited from each Boot BOM; only `sqlite-jdbc` (3.53.2.0) is declared
  explicitly in the shared modules. Do not override HikariCP (`docs/01 §1`).

---

## 4. Artifacts: Two Builds → N Runtimes

Only **two real artifacts** exist. `build-all` copies/links them to the filenames each matrix
target expects (the runtime JRE and virtual-thread flag are what differ — exactly the variables
under test).

| Matrix filename (`./apps/`) | Built from | Spring Boot | Bytecode | Default runtime container |
| :-- | :-- | :-- | :-- | :-- |
| `insurance-j8.jar` | `app-legacy` | 2.7.18 | Java 8 | java8-* |
| `insurance-j11.jar` | `app-legacy` (same artifact) | 2.7.18 | Java 8 | java11-* |
| `insurance-j17.jar` | `app-modern` | 4.1.x | Java 17 | java17-* |
| `insurance-j21.jar` | `app-modern` (same artifact) | 4.1.x | Java 17 | java21-* (virtual ON) |
| `insurance-modern.jar` | `app-modern` (same artifact) | 4.1.x | Java 17 | java25-* (virtual ON) |

> If you prefer fewer files, ship just `insurance-legacy.jar` + `insurance-modern.jar` and update
> the compose `volumes:` accordingly. The five-name mapping exists only to match the original brief.

---

## 5. Whole-Repo Layout

```
spring_bench/
├── REQUIREMENTS.md            # master index
├── docs/                      # this folder (scoped specs)
├── README.md                  # quickstart + chosen-option rationale
├── docker-compose.yml         # the matrix (docs/05)
├── apps/                      # built JARs land here (gitignored)
├── service/                   # multi-module microservice (this doc)
├── orchestrator/              # control API (docs/05)
├── loadtests/                 # k6 scripts (docs/06)
│   ├── rest.js
│   └── sse.js
├── dashboard/                 # React + Chart.js frontend (docs/06)
└── infra/
    ├── cloudflared/           # tunnel config (docs/05)
    └── arm64-setup.md         # qemu/binfmt notes (docs/05)
```
