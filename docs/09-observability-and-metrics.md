# 09 — Observability, Metrics & Benchmark Methodology

Closes the gap between the project's stated objectives (CPU saturation, **thread context-switching**,
memory, **lock contention**) and what the infrastructure can actually capture. `docker stats` alone
is **not** sufficient — it only gives CPU %, memory, and net/block I/O. The deeper metrics come from
inside the JVM via JFR + Micrometer.

---

## 1. Metric Sources (three layers)

| Layer | Source | Metrics | How collected |
| :-- | :-- | :-- | :-- |
| **Container** | `docker stats` / Docker API | CPU %, mem usage/limit, net I/O, block I/O, PIDs | Orchestrator polls (`docs/05 §3`) |
| **JVM (live)** | Spring Boot Actuator + Micrometer | heap/non-heap, GC pause count/time, live thread count, CPU, uptime | `GET /actuator/metrics`, `GET /actuator/prometheus` |
| **JVM (deep)** | Java Flight Recorder (JFR) | **context-switch rate**, **monitor/lock contention**, allocation, thread parks, safepoints | Continuous recording → `.jfr` file collected per run |

These layers are complementary: container layer shows the *system* view, Actuator the *live* view
the dashboard polls, JFR the *forensic* view for the metrics `docker stats` cannot see.

---

## 2. JFR Configuration (the key to the deep metrics)

Enable continuous JFR in `JAVA_OPTS` for every matrix target (all images are `-jdk-alpine`, so JFR
is present):
```
-XX:StartFlightRecording=name=bench,settings=profile,disk=true,maxsize=256m,dumponexit=true,filename=/tmp/bench.jfr
-XX:FlightRecorderOptions=stackdepth=128
```
Relevant JFR event types to parse (via `jfr print --events <type> /tmp/bench.jfr` or the JMC
automated analysis):
| Objective metric | JFR event |
| :-- | :-- |
| Thread context-switching | `jdk.ThreadContextSwitchRate` |
| Lock contention | `jdk.JavaMonitorEnter`, `jdk.JavaMonitorWait`, `jdk.ThreadPark` |
| GC pressure / pauses | `jdk.GCPhasePause`, `jdk.GarbageCollection` |
| Allocation pressure | `jdk.ObjectAllocationSample` |
| Thread lifecycle | `jdk.ThreadStart`, `jdk.VirtualThreadStart`, `jdk.VirtualThreadPinned` |

> `jdk.VirtualThreadPinned` is gold for the Loom story: it shows when a virtual thread was pinned to
> its carrier (e.g. inside `synchronized`/native), which is exactly the kind of regression this
> matrix should reveal.

### 2.1 Collection
After each run the orchestrator:
1. Triggers a dump (`jcmd <pid> JFR.dump filename=...` via `docker exec`, or relies on `dumponexit`).
2. Copies the `.jfr` out (`docker cp`).
3. Runs a JFR-to-JSON reducer (`jfr print --json` or a small parser) into per-run aggregates.
4. Stores aggregates with the run record (`docs/05 §3`, schema in §5 below).

---

## 3. Micrometer / Actuator (live dashboard feed)

- Add Spring Boot Actuator + Micrometer to **both** shells (available in Boot 2.7 and 4.1).
- Expose only safe endpoints: `health`, `info`, `metrics`, `prometheus`.
- Tag every metric with `runtime`, `threading`, `footprint` so the dashboard can group by matrix
  dimension.
- The orchestrator scrapes `/actuator/prometheus` (or `/actuator/metrics/<name>`) on the same
  interval as `docker stats` and merges both into the live stats stream (`docs/06 §2`).

---

## 4. Benchmark Methodology (best practices — make the numbers trustworthy)

A benchmark is only useful if it is **fair, repeatable, and isolates one variable.**

1. **One variable at a time.** Compare rows that differ in exactly one dimension (e.g.
   `java21-platform` vs `java21-virtual` at identical CPU/mem). See `docs/01 §4.2`.
2. **Warm up the JVM.** The JIT compiles hot paths over time. Run a warmup phase (e.g. 60s at
   target load) and **discard** it; measure only steady state. Record warmup separately.
3. **Repeat and report variance.** ≥ 3 repetitions per configuration. Report median + p95/p99
   **and** spread (stdev or IQR), never a single number.
4. **Fixed, identical dataset.** Seed the same `count` into every target before measuring
   (`POST /seed`), so DB size is constant.
5. **Isolate the host.** One matrix target under test at a time for headline numbers (others
   stopped), to avoid CPU/cache/noisy-neighbor cross-talk. Pin CPU sets if possible.
6. **Account for GC fairly.** Different JDKs default to different collectors (e.g. G1 vs
   Generational Shenandoah on 25). Either keep GC flags identical where supported, or explicitly
   record the collector per run — GC differences are a legitimate part of "how the era performs,"
   so document, don't hide.
7. **Measure both ends.** Client-side latency/RPS from k6 **and** server-side CPU/mem/JFR. A gap
   between them reveals client or network bottlenecks.
8. **Record full environment metadata** with every run (§5) so results are reproducible months
   later.
9. **Separate emulation cost.** ARM64 rows run under QEMU (`docs/05 §2.1`); never compare emulated
   ARM throughput directly to native amd64 without a native-amd64 control row.
10. **Steady clocks.** Use the same wall-clock duration and ramp profile across compared runs.

---

## 5. Run Record Schema (what the orchestrator persists)

```json
{
  "runId": "uuid",
  "startedAt": "2026-06-25T20:14:00Z",
  "target": "java21-virtual-low",
  "config": { "runtime": "21", "threading": "virtual", "cpus": 0.5, "memLimit": "256m", "xmx": "192m", "arch": "amd64" },
  "load": { "mode": "sse", "vus": 500, "rampStages": "0:30s,full:2m,0:30s", "duration": "3m", "dropRate": 0.1 },
  "env": { "jdk": "Temurin 21.0.x", "springBoot": "4.1.x", "gc": "G1", "host": "ubuntu-22.04", "dockerEngine": "27.x" },
  "client": { "rps": 4200, "latencyMs": { "p50": 8, "p95": 31, "p99": 95 }, "errorRate": 0.001, "dataReceivedMb": 512 },
  "server": { "cpuPctPeak": 96, "memMbPeak": 240, "threadsPeak": 512, "gcPauseMsTotal": 180,
              "contextSwitchRate": 12000, "monitorContendedMs": 5, "vthreadPinnedCount": 0 },
  "artifacts": { "jfr": "runs/uuid/bench.jfr", "k6Summary": "runs/uuid/summary.json" }
}
```
Persist as SQLite or JSON files under `orchestrator/runs/`. Warmup runs are flagged
`"phase": "warmup"` and excluded from comparison charts.

---

## 6. Acceptance
- Every completed run has: k6 client summary, container stats series, Actuator series, a `.jfr`
  artifact, and reduced server-side aggregates — all tied to one `runId`.
- The dashboard can render context-switch rate and lock-contention alongside CPU/mem (`docs/06 §2`).
- Re-running an identical config reproduces results within the reported variance.
