# 04 — Microservice Specification

Implements the domain in `docs/03` using the architecture in `docs/02` and versions in `docs/01`.
The HTTP/SSE contract below MUST be byte-identical across the legacy and modern shells.

---

## 1. Behavior

- CRUD for `Member`, `Demographics`, `Dependent`, `LifeInsuranceAgreement`.
- **Every** create/update/delete/status-change writes one `Audit` row (in the same transaction as
  the mutation).
- Soft delete: `DELETE` sets `status = ARCHIVED`, it does not hard-delete.
- A seed endpoint bulk-creates N members (+ demographics, optional agreements/dependents) for load
  tests.
- Configurable listen port via `SERVER_PORT` env (default 8080 in-container).

---

## 2. HTTP + SSE Contract (identical across all runtimes)

| Method | Path | Purpose |
| :-- | :-- | :-- |
| GET | `/health` | Liveness/readiness + runtime introspection (see §2.1) |
| GET | `/members?page=&size=` | Paginated list |
| POST | `/members` | Create member (+ demographics body) |
| GET | `/members/{id}` | Fetch one (with demographics + dependents) |
| PUT | `/members/{id}` | Update / status change |
| DELETE | `/members/{id}` | Soft delete → `ARCHIVED` |
| POST | `/members/{id}/dependents` | Add a dependent |
| POST | `/agreements` | Create agreement |
| PUT | `/agreements/{id}` | Update / status change |
| POST | `/members/{id}/agreement` | Attach/detach an agreement |
| GET | `/audit?page=&size=` | Paginated audit log |
| POST | `/seed?count=N` | Bulk seed for benchmarks |
| GET | `/events` | **SSE stream** (see §2.2) |

### 2.1 `/health` (dashboard depends on this)
Return JSON including at minimum:
```json
{
  "status": "UP",
  "javaVersion": "25.0.1",
  "javaVendor": "Eclipse Adoptium",
  "springBoot": "3.5.x",
  "virtualThreadsEnabled": true,
  "activeThreadCount": 42,
  "availableProcessors": 4,
  "maxHeapMb": 3072
}
```
`virtualThreadsEnabled` must reflect the *actual* effective state (Java 21+ AND modern shell AND
flag set), not just the env var.

### 2.2 `/events` (SSE)
- Long-lived `text/event-stream` using Spring `SseEmitter`.
- On connect, register the emitter and stream periodic events (e.g. every 1–5s): recent
  member/audit activity + a heartbeat with server thread metrics.
- Purpose: hold many concurrent connections open to surface **memory footprint per parked
  connection** — the key differentiator between platform and virtual threads.
- Clean up emitters on completion/timeout/error; never leak.

---

## 3. SQLite Configuration & Write-Safety (critical)

SQLite serializes writers; under concurrent load this is the #1 correctness risk. Required setup:

- **Driver:** `org.xerial:sqlite-jdbc:3.53.2.0` (`docs/01`).
- **Mode:** file-based **WAL** (in-memory resets and disallows shared WAL). One DB file per
  container, on a fast local path (e.g. `/tmp/insurance.db` or a tmpfs mount).
- **PRAGMAs on every connection / at pool init:**
  ```
  PRAGMA journal_mode=WAL;
  PRAGMA synchronous=NORMAL;
  PRAGMA busy_timeout=5000;
  PRAGMA foreign_keys=ON;
  ```
- **Single-writer strategy.** Pick one and document it in code:
  1. A dedicated single-threaded write executor (all mutations funnel through it), OR
  2. A write `DataSource`/HikariCP pool sized to **1**, with a separate read pool (WAL allows
     concurrent readers).
- **Acceptance:** sustained concurrent writes (via `loadtests/`) produce **zero `SQLITE_BUSY`**
  errors in logs.

> Rationale: this keeps the benchmark measuring *JVM concurrency mechanics* (thread scheduling,
> parking, context switching) rather than DB contention — while still exercising realistic
> transactional writes + audit logging.

---

## 4. Build Artifacts

Per `docs/02 §4`, `service/build-all` produces two artifacts and maps them into `./apps/`:

- `app-legacy` (Boot 2.7.18, Java 8 bytecode) → `insurance-j8.jar`, `insurance-j11.jar`
- `app-modern` (Boot 3.5.x, Java 17 bytecode) → `insurance-j17.jar`, `insurance-j21.jar`,
  `insurance-modern.jar`

`build-all` must: build both modules, fail on test failure, then copy/link artifacts to the five
matrix names. Provide both `.sh` (Linux host, authoritative) and `.ps1` (Windows authoring).

---

## 5. Runtime Configuration (env)
| Env | Meaning | Default |
| :-- | :-- | :-- |
| `SERVER_PORT` | In-container HTTP port | 8080 |
| `JAVA_OPTS` | Heap/GC flags (e.g. `-Xmx3g`) | per matrix row |
| `SPRING_THREADS_VIRTUAL_ENABLED` | Maps to `spring.threads.virtual.enabled` | set `true` **only** on Java 21+ targets |
| `DB_PATH` | SQLite file path | `/tmp/insurance.db` |

> Do **not** set `SPRING_THREADS_VIRTUAL_ENABLED=true` on Java 17 or the legacy shell — it has no
> effect (legacy) or can fail startup (Java 17 lacks stable virtual threads).

---

## 6. Cross-References
- **Wire contract (JSON DTOs, errors, pagination, validation):** `docs/08-api-contracts.md`.
- **Observability, JFR, metrics, benchmark methodology:** `docs/09-observability-and-metrics.md`.
- **Running the app standalone (real-world use):** `docs/10-standalone-mode.md`.

---

## 7. Engineering Best Practices (apply on both shells)
- **API docs:** springdoc-openapi → OpenAPI 3 + Swagger UI; diff the two shells' `/v3/api-docs` in
  CI to prove contract parity (`docs/08 §7`).
- **Validation:** Bean Validation on shell DTOs (rules in `docs/08 §5`); never trust client input.
- **Error handling:** one `@ControllerAdvice` producing RFC 7807 Problem Details (`docs/08 §4`); no
  stack traces or SQL leaked to clients.
- **Transactions:** mutation + its `Audit` write occur in a single transaction (`docs/04 §1`).
- **Config:** 12-factor — all config via env/profiles (`benchmark` vs `standalone`, `docs/10`); no
  secrets in source.
- **Health & lifecycle:** Actuator health/liveness/readiness; `server.shutdown=graceful`; flush WAL
  on stop.
- **Logging:** structured JSON, propagate `X-Request-Id`, keep PII (emails/phones) out of logs.
- **Migrations:** manage schema with **Flyway** (`db/migration/V1__init.sql`) — versioned and
  repeatable on SQLite.
- **Testing:** JUnit 5 + Mockito unit tests in the core; a Testcontainers/REST-assured integration
  test per shell asserting the `docs/08` contract; the no-`SQLITE_BUSY` write-load check (`§3`).
- **CI:** GitHub Actions running `build-all`, tests, `docker compose config`, and the api-docs diff.
