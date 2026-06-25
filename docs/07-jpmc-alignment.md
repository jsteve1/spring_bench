# 07 — JPMorgan Chase CIB · Software Engineer II Alignment

This project is intentionally shaped to mirror the **JPMorgan Chase Commercial & Investment Bank,
Software Engineer II** stack so it doubles as interview-ready portfolio evidence.

> Sourced from JPMC CIB / Commercial Bank SWE II postings (2025–2026). Confirm specifics against
> the exact team's job description.

---

## 1. The JPMC CIB SWE II Stack (as advertised)

| Area | What postings ask for |
| :-- | :-- |
| Core language | **Java** (often "Java 17 or higher"), strong data structures / design patterns |
| Framework | **Spring Boot** + Spring modules (Core, Security, Batch, Integration), Hibernate/MyBatis |
| Architecture | **Microservices**, **RESTful APIs**, event-driven |
| Frontend | **React** (Angular acceptable), full-stack |
| Messaging | **Kafka** / MQ |
| Data | **Oracle / PostgreSQL**, performance tuning |
| Cloud | **AWS** (EKS/EC2, RDS, S3, Lambda, API Gateway), cloud-native microservices |
| Secondary lang | **Python** (data workflows, AI/ML) |
| Practices | CI/CD, unit/perf testing (JUnit, Mockito), production debugging |
| Observability | Grafana, Dynatrace, AppDynamics |

---

## 2. How This Project Maps

| JPMC skill | Where this project exercises it |
| :-- | :-- |
| Java 17+ | Modern shell on Java 17/21/25 (`docs/01`, `docs/02`) |
| Spring Boot + microservices + REST | The insurance microservice & contract (`docs/04`) |
| **Concurrency / performance tuning** | The entire matrix: platform vs virtual threads, heap/CPU footprints, lock contention (`docs/01 §4`, `docs/06`) |
| Legacy modernization (`javax`→`jakarta`, Boot 2.7→3.5) | Dual-shell architecture (`docs/02 §2`, `docs/01 §3`) — a real bank pain point |
| Databases + tuning | SQLite WAL, single-writer, transactional audit (`docs/04 §3`) |
| Performance testing | k6 REST + SSE load scripts (`docs/06`) |
| Observability | Live `docker stats` + Chart.js dashboards (`docs/05`, `docs/06`) |
| CI/CD & containerization | Multi-module build + Docker Compose matrix (`docs/02`, `docs/05`) |
| Frontend (React) | React 18.3 + Chart.js dashboard (`docs/06`) |

---

## 3. Recommended Choices to Maximize Alignment

These are optional upgrades to the defaults; adopt as time allows.

- **Frontend:** build the dashboard in **React 18.3** (not plain HTML) — directly matches the
  React requirement.
- **Orchestrator:** the spec allows Node/Python, but a **Spring Boot orchestrator** (using
  `docker-java` to talk to the socket) would make the control plane Java/Spring too — strongest
  JPMC signal. If you prefer faster iteration, FastAPI/Express is fine; note Python is JPMC's
  secondary language anyway.
- **Testing:** add **JUnit 5 + Mockito** unit tests and a small **Testcontainers** integration
  test in the shared core — explicitly listed JPMC skills.
- **Stretch — Kafka:** emit each `Audit` event to a Kafka topic and show consumer lag under load.
  Adds event-driven architecture + messaging (Kafka is on nearly every CIB posting).
- **Stretch — AWS framing:** document how the matrix maps to ECS/EKS task sizing and how the
  Cloudflare tunnel parallels API Gateway/PrivateLink exposure. Even as docs, this shows cloud
  fluency.
- **CI/CD:** add a GitHub Actions workflow that runs `build-all`, tests, and `docker compose
  config` validation.

---

## 4. Interview Talking Points This Project Earns You

- "Why can't you just upgrade Java 8 to Spring Boot 3?" → the Java 17 baseline + `javax`→`jakarta`
  namespace migration (`docs/01 §3`). You've *lived* it via the dual-shell design.
- "What do virtual threads actually buy you?" → your own empirical SSE memory/throughput curves:
  platform = one OS thread per parked connection vs virtual = cheap continuations (`docs/06`).
- "How do you keep a benchmark honest?" → identical business logic via a shared core, one variable
  per comparison, embedded DB to remove network I/O noise (`docs/02`, `docs/04 §3`).
- "How do you protect SQLite/a DB under concurrent writes?" → WAL + single-writer + busy_timeout,
  validated by zero `SQLITE_BUSY` under load (`docs/04 §3`).
- "How do you operate/observe a fleet?" → orchestrator over the Docker socket + live stats +
  historical dashboards, securely exposed via a tunnel behind access control (`docs/05`).
- "How would you plan a framework/runtime upgrade?" → the deliberate, low-risk upgrade roadmap in
  `docs/01 §5` (3.5→4.x, Java 21→25, k6 1→2), enabled by a framework-agnostic core so each step is
  small, isolated, and reversible. Shows you pin conservatively *and* plan to modernize.
