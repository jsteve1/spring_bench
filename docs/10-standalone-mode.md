# 10 — Standalone Mode (run the app outside the benchmark)

The microservice is a **normal, self-contained Spring Boot application**. The benchmark matrix
(Docker, orchestrator, k6, cloudflared) is *optional scaffolding around it*. This doc defines how to
run it on its own as a small, real CRUD app — e.g. a member/records dashboard for a small office —
with sensible production hygiene.

> Design guarantee: because all business logic lives in the framework-agnostic core (`docs/02`),
> the app has **no dependency on the benchmark harness**. You can `java -jar` it anywhere.

---

## 1. Two Run Modes (same code, different profile)

| | `benchmark` profile | `standalone` profile |
| :-- | :-- | :-- |
| DB | fast local file / tmpfs, disposable | **persistent** file with backups |
| Seeding (`/seed`) | enabled | disabled by default |
| Security | open (no auth) | **auth on** (see §4) |
| JFR / heavy metrics | on | off (lightweight Actuator only) |
| CORS | permissive | locked to the dashboard origin |
| Sample data | none | optional one-time bootstrap |

Select with `SPRING_PROFILES_ACTIVE=standalone`. Profiles only change configuration/wiring in the
**shells**, never the core.

---

## 2. Run It (no Docker required)

```bash
# from source (dev)
cd service
./mvnw -pl app-modern -am spring-boot:run -Dspring-boot.run.profiles=standalone

# or the built jar (any host with a JRE 17+)
SPRING_PROFILES_ACTIVE=standalone \
DB_PATH=./data/office.db \
SERVER_PORT=8080 \
java -jar apps/insurance-modern.jar
```
- Single process, single SQLite file (`DB_PATH`). No external services.
- Visit `http://localhost:8080/swagger-ui.html` for the API and `/health` for status.
- For very old hardware, the legacy jar (`insurance-j8.jar`) runs the same app on a Java 8 JRE.

---

## 3. Configuration (12-factor)
All config via env or `application-standalone.yml`. Minimum:
| Key | Purpose | Example |
| :-- | :-- | :-- |
| `SERVER_PORT` | HTTP port | `8080` |
| `DB_PATH` | SQLite file path | `./data/office.db` |
| `APP_SECURITY_ENABLED` | toggle auth | `true` |
| `APP_ADMIN_USER` / `APP_ADMIN_PASSWORD` | bootstrap admin | from a secret, never hard-coded |
| `APP_CORS_ORIGINS` | allowed UI origins | `https://office.example.com` |

Never commit secrets; use an untracked `.env` or the host's secret store.

---

## 4. Production Hygiene for Real Use
- **Auth:** enable Spring Security (HTTP Basic or form login for a tiny office; JWT/OIDC if it
  grows). All write endpoints require an authenticated user; `updatedBy` is taken from the
  principal (`docs/08 §2`).
- **Backups:** the whole DB is one file — schedule a copy of `DB_PATH` (SQLite Online Backup API or
  a simple `VACUUM INTO` on a timer). Document restore.
- **Migrations:** manage schema with **Flyway** (`db/migration/V1__init.sql`, …) so upgrades are
  versioned and repeatable — works fine with SQLite and plain JDBC.
- **Logging:** structured JSON logs, request ids, no PII in logs (emails/phones are PII).
- **Graceful shutdown:** `server.shutdown=graceful`; flush WAL on stop.
- **Health/readiness:** reuse `/health` + Actuator liveness/readiness for any process manager
  (systemd, Docker, etc.).
- **HTTPS:** terminate TLS at a reverse proxy (or the same cloudflared tunnel from `docs/05`, which
  works equally well for a single standalone instance).

---

## 5. Optional Bundled UI (the "small office dashboard")
For non-technical users, ship a minimal CRUD UI served by the app itself:
- Reuse the React app from `dashboard/` (or a trimmed static page) under `src/main/resources/static/`
  so a single jar serves both API and UI.
- Screens: list/search members, view a member with dependents + agreement, create/edit/archive,
  and a read-only audit timeline (the audit trail is a genuinely useful feature for an office).
- Keep it behind the same auth as the API.

---

## 6. Adapting the Domain to Another Use Case
The schema is a generic **"primary record + dependents + agreement + full audit trail"** template.
To repurpose (e.g. a different small-office system):
- Rename entities/columns in `core-domain` + the Flyway migration; the DAO/controller structure is
  unchanged.
- The `Audit` table and the "every mutation is logged" rule (`docs/03`) are domain-agnostic — keep
  them; an immutable change log is valuable in almost any record-keeping app.
- Swapping SQLite for Postgres later is a `core-persistence` DAO/driver change only (the core stays
  framework- and DB-agnostic) — a clean upgrade path if the app outgrows a single file.
