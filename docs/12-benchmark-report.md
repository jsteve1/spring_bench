# 12 — Benchmark Report (2026-07-26)

First full **paced** sweep (§1–5, 23 runs), then a **full amd64 capacity** sweep (§6, 55 measured
runs across 11 targets). Produced by `scripts/run-benchmarks.ps1` /
`scripts/analyze-benchmarks.mjs`.

> Read §5 before quoting anything from here. Two of the four headline numbers are solid; one is
> high-variance noise, and one earlier claim in `docs/01 §4.2` turned out to be wrong.

---

## 1. Method

- **One target at a time.** Each row is started, benchmarked, then stopped before the next begins, so
  the JVM under test never competes with another JVM for host CPU.
- **Warmup discarded.** Every REST cell runs an unmeasured pass first (JIT compilation, page cache).
- **3 reps per REST cell, 2 per SSE cell**, reported as **medians**. With 3 reps a single slow run
  from background OS work would drag a mean noticeably.
- **Fresh container per target**, so memory figures are not inflated by hours of prior accumulation.
- Host: 8 logical CPUs, 31.7 GB RAM, Docker Engine 29.6.1 (8 CPU / 16.6 GB allocated).
- REST: 10 VUs, 30s, ramp `0:5s,full:20s,0:5s`. SSE: 12 held connections, 20s, `DROP_RATE=0.1`.

```mermaid
flowchart LR
    subgraph host["Desktop host · 8 CPU / 31.7 GB"]
        k6["k6 container<br/>rest.js or sse.js"]
        target["matrix target<br/>cgroup CPU + mem limits"]
        orch["orchestrator<br/>Node 24"]
    end

    k6 -->|"HTTP / SSE on matrix-net"| target
    orch -->|"docker stats API"| target
    orch -->|"/actuator/metrics"| target
    orch -->|"jcmd JFR.dump"| target
    orch --> artifacts["runs/{id}/<br/>summary.json<br/>stats-series.json<br/>bench.jfr"]
    artifacts --> analyze["analyze-benchmarks.mjs<br/>medians per cell"]
```

### Configurations measured

| Target | Runtime | Shell | Threads | cpus | mem | -Xmx | Measured |
| :-- | :-- | :-- | :-- | :--: | :--: | :--: | :-- |
| java8-platform-low | 1.8.0_492 | Boot 2.7.18 | platform | 0.5 | 256m | 192m | REST + SSE |
| java11-platform-low | 11.0.31 | Boot 2.7.18 | platform | 1.0 | 512m | 384m | REST + SSE |
| java17-platform-mid | 17.0.19 | Boot 4.1.0 | platform | 2.0 | 2g | 1500m | REST |
| java21-platform-low | 21.0.11 | Boot 4.1.0 | platform | 0.5 | 256m | 192m | REST + SSE |
| java21-virtual-low | 21.0.11 | Boot 4.1.0 | **virtual** | 0.5 | 256m | 192m | REST + SSE |

**Only one pair varies exactly one thing:** `java21-platform-low` vs `java21-virtual-low` — same
runtime, same shell, same cgroup, same heap, threading model only. Every other comparison is
confounded, and §5 says by what.

---

## 2. REST results (medians of 3)

| Target | rps | p50 ms | p95 ms | errors | peak mem MB | peak heap MB | OS threads | peak CPU % | ctx-sw /s |
| :-- | --: | --: | --: | --: | --: | --: | --: | --: | --: |
| java8-platform-low | 41.6 | 2.37 | **17.81** | 0 | 154.3 | 35.9 | 32 | 49.2 | 2855 |
| java11-platform-low | 44.0 | 1.44 | 3.03 | 0 | 229.3 | 36.3 | 28 | 48.1 | 594 |
| java17-platform-mid | 44.1 | 1.56 | 2.93 | 0 | 274.2 | 55.9 | 29 | 48.6 | 602 |
| java21-platform-low | 42.9 | 1.44 | 5.86 | 0 | 162.6 | 49.4 | 31 | 17.6 | 1261 |
| java21-virtual-low | 42.4 | 1.46 | 5.16 | 0 | 178.1 | 42.2 | **22** | 30.7 | 894 |

Zero errors in every run, every runtime.

## 3. SSE results (medians of 2, 12 held connections)

| Target | connections | events | peak mem MB | OS threads | peak CPU % | ctx-sw /s |
| :-- | --: | --: | --: | --: | --: | --: |
| java8-platform-low | 12 | 83.0 | 141.1 | 33 | 37.2 | 5512 |
| java11-platform-low | 12 | 81.5 | 239.0 | 27 | 12.9 | 661 |
| java21-platform-low | 12 | 82.5 | 153.0 | 31 | 30.4 | 117698 ⚠ |
| java21-virtual-low | 12 | 74.5 | 168.4 | **21** | 25.4 | 730 |

All four runtimes held 12 concurrent SSE connections without dropping any. ⚠ see §5.2.

---

## 4. Findings

### 4.1 Java 8's tail latency is 3–6× worse, and it is reproducible

Same 0.5 CPU / 256 MB box, same platform threads, same business logic. Per-rep p95: **64.6, 17.8,
17.7 ms** — even Java 8's *best* rep is 2.6× the *worst* Java 21 rep (6.8 ms). Median p50 is also
~60% higher (2.37 vs 1.44 ms), and Java 8 context-switches ~4.7× more than Java 11 on the same
legacy Boot 2.7 shell.

```mermaid
xychart-beta
    title "REST p95 latency, median of 3 reps (lower is better)"
    x-axis ["Java 8", "Java 11", "Java 17", "J21 platform", "J21 virtual"]
    y-axis "p95 ms" 0 --> 20
    bar [17.81, 3.03, 2.93, 5.86, 5.16]
```

This is the strongest single argument in the whole project for migrating off Java 8: the throughput
looks fine, so a capacity dashboard would show nothing, while the p95 a user actually feels is
several times worse.

### 4.2 Virtual threads reliably cut OS thread count — with zero variance

Platform threads used **31** OS threads in all three reps; virtual used **22** in all three. Same on
the SSE side: 31 vs 21. Not one rep deviated.

```mermaid
xychart-beta
    title "Peak OS threads under REST load (identical 0.5 CPU / 256 MB cgroup)"
    x-axis ["Java 8", "Java 11", "Java 17", "J21 platform", "J21 virtual"]
    y-axis "OS threads" 0 --> 36
    bar [32, 28, 29, 31, 22]
```

Context switching moved the same direction — 894/s virtual vs 1261/s platform, roughly 30% fewer —
though that metric is noisy (§5.2).

### 4.3 Virtual threads did **not** save memory here — correcting an earlier claim

`docs/01 §4.2` previously recorded, from a single ad-hoc run, that virtual threads cost "~55 MB less
peak memory". **Three reps say the opposite:**

| | rep 1 | rep 2 | rep 3 | median |
| :-- | --: | --: | --: | --: |
| java21-platform-low | 161.8 | 166.7 | 162.6 | **162.6** |
| java21-virtual-low | 182.9 | 168.5 | 178.1 | **178.1** |

Virtual threads used **~15 MB more** container RSS, consistently. The earlier figure came from a
container that had been running for hours against a freshly started one — a measurement artifact,
which is exactly why the reps exist. `docs/01 §4.2` has been corrected.

Interestingly the direction flips inside the JVM: virtual used **less Java heap** (42.2 vs 49.4 MB
peak). Lower heap, higher RSS, in a workload with only 10 concurrent requests — the carrier pool and
continuation bookkeeping cost more than 10 platform-thread stacks save. Loom's memory win should
appear at high connection counts, which this load does not reach.

### 4.4 Throughput was not the constraint — this measured cost, not capacity

Every runtime landed in **39.7–44.8 rps**, including Java 8. That is not five runtimes performing
identically; it is `rest.js` pacing itself with `sleep(0.2)` at 10 VUs. The server was never
saturated, so **none of these numbers are capacity figures.** What they legitimately show is
latency and resource cost *at a fixed modest load*.

---

## 5. What this does not show

### 5.1 Confounded comparisons

Only the Java 21 pair varies one thing. Specifically:

- **Java 8 vs Java 21** also changes the Spring shell (2.7.18 → 4.1.0), so the latency gap cannot be
  attributed to the JDK alone. It is the "legacy stack vs modern stack" delta, which is the honest
  framing for a migration argument anyway.
- **Java 11 and Java 17** run larger cgroups (1 CPU/512 MB and 2 CPU/2 GB). Their higher RSS is
  mostly GC having more headroom, not the runtime being hungrier.

### 5.2 The context-switch peak is high-variance

`java21-platform-low` SSE reps were **1,895/s and 233,500/s**. With n=2 the median *is* the mean, so
the table's 117,698 is an artifact of one wild sample, not a finding. Do not read a
"platform threads thrash on SSE" story into it. The metric is a peak of a 2-second delta summed over
live OS threads, so a burst of thread churn inflates it. It needs 5+ reps, or a mean over the run
window instead of a peak.

### 5.3 JFR aggregates are proxies, not event counts

`jdk.ThreadPark` and friends are recorded as **line counts of `jfr print` output**, not parsed event
counts. They are comparable between runs of the same shape and meaningless in absolute terms. The
large platform-vs-virtual park difference (1.6 M vs 46 K lines) is also partly an instrumentation
difference: a virtual thread unmounting is a continuation yield, which JFR does not record as a
`ThreadPark` the way a blocked platform thread does.

### 5.4 Other limits

- **Load generator shares the host.** Footprints were kept small so k6 had headroom, but it is not an
  isolated rig.
- **Single host, single session.** No cross-machine reproduction.
- **SSE is async on the server.** Spring MVC's `SseEmitter` releases the container thread, so the
  "one OS thread per connection" penalty this design was built to expose is largely absent. A
  blocking-IO endpoint would show a much sharper split.
- **12 SSE connections is small.** The interesting Loom territory is hundreds to thousands.
- **ARM rows** (`java25-virtual-arm-*`) were attempted in the capacity sweep but `docker compose up`
  failed on this host; only `java25-virtual-amd64-low` is measured for Java 25.

---

## 6. Full-matrix capacity sweep (2026-07-26)

**All amd64 matrix rows** (compose + `docker-compose.extra.yml`), one target at a time,
`THINK_TIME=0`, **50 VUs**, 30s REST (`0:5s,full:20s,0:5s`), SSE 12 connections / 20s,
REST medians of 3 + SSE medians of 2, warmup discarded. ~70 minutes wall clock.
ARM rows skipped (compose start failed).

```powershell
.\scripts\run-benchmarks.ps1 -Vus 50 -ThinkTime 0 -Reps 3 -SseReps 2
```

### 6.1 REST (capacity, medians)

| Target | reps | java | virt | rps | p50 | p95 | err | memMb | threads | CPU% | ctx/s |
| :-- | --: | :-- | :--: | --: | --: | --: | --: | --: | --: | --: | --: |
| java8-platform-low | 3 | 1.8.0_492 | false | 114.9 | 14.87 | 692.5 | 0 | 172.9 | 70 | 52.3 | 4813.5 |
| java8-platform-mid | 3 | 1.8.0_492 | false | 752.3 | 3.52 | 107.13 | 0 | 286.6 | 71 | 207 | 11303.5 |
| java11-platform-low | 3 | 11.0.31 | false | 431.9 | 2.6 | 185.87 | 0 | 276.9 | 73 | 104.9 | 2710.1 |
| java11-platform-high | 3 | 11.0.31 | false | 1428.8 | 1.96 | 51.74 | 0 | 375.7 | 72 | 266.5 | 8569.3 |
| java17-platform-mid | 3 | 17.0.19 | false | 1433.1 | 1.5 | 60.6 | 0 | 363.4 | 72 | 210.6 | 7192.2 |
| java17-platform-high | 3 | 17.0.19 | false | 1790.6 | 1.56 | 44.89 | 0 | 419.9 | 71 | 300.2 | 9245.7 |
| java21-platform-low | 3 | 21.0.11 | false | 273.2 | 3.95 | 289.48 | 0 | 242.4 | 74 | 52.4 | 2352.6 |
| java21-platform-high | 3 | 21.0.11 | false | 1854.3 | 1.38 | 39.37 | 0 | 385.8 | 72 | 270 | 9718.9 |
| java21-virtual-low | 3 | 21.0.11 | true | 421.5 | 10.7 | 170.43 | 0 | 211.8 | **22** | 51.1 | 2514.1 |
| java21-virtual-high | 3 | 21.0.11 | true | **1923** | 1.32 | 37.81 | 0 | 343.9 | **23** | 234.8 | 10155.4 |
| java25-virtual-amd64-low | 3 | 25.0.3 | true | 1222.8 | 14.36 | 44.98 | 0 | 326.8 | **20** | 101.7 | 3693 |

Zero errors. Footprint still dominates absolute RPS (low vs high); within a footprint class,
newer JDKs and virtual threads pull ahead.

### 6.2 SSE (12 held connections, medians of 2)

| Target | reps | java | virt | conns | events | memMb | threads | CPU% | ctx/s |
| :-- | --: | :-- | :--: | --: | --: | --: | --: | --: | --: |
| java8-platform-low | 2 | 1.8.0_492 | false | 12 | 73.5 | 140.8 | 71 | 44.1 | 18443.3 |
| java8-platform-mid | 2 | 1.8.0_492 | false | 12 | 79.5 | 372.7 | 70 | 20 | 894.9 |
| java11-platform-low | 2 | 11.0.31 | false | 12 | 78.5 | 300.4 | 72 | 11 | 588.4 |
| java11-platform-high | 2 | 11.0.31 | false | 12 | 82 | 406.7 | 71 | 14.5 | 541.7 |
| java17-platform-mid | 2 | 17.0.19 | false | 12 | 79 | 388.5 | 71 | 28.3 | 1029.6 |
| java17-platform-high | 2 | 17.0.19 | false | 12 | 81.5 | 434.5 | 70 | 38 | 1029.2 |
| java21-platform-low | 2 | 21.0.11 | false | 12 | 77.5 | 177.5 | 73 | 32.8 | 3529.3 |
| java21-platform-high | 2 | 21.0.11 | false | 12 | 83 | 412.7 | 71 | 31.7 | 455.2 |
| java21-virtual-low | 2 | 21.0.11 | true | 12 | 79 | 171.1 | **21** | 30.8 | 3326.1 |
| java21-virtual-high | 2 | 21.0.11 | true | 12 | 78.5 | 365.8 | **22** | 48 | 5321.8 |
| java25-virtual-amd64-low | 2 | 25.0.3 | true | 12 | 77.5 | 334.4 | **20** | 38.7 | 354.1 |

All held 12 connections. Virtual rows stay ~20–23 OS threads; platform rows ~70–73.

### 6.3 One-variable reads (from this sweep)

| Comparison | What changes | Result |
| :-- | :-- | :-- |
| `java21-platform-low` vs `java21-virtual-low` | threading only | **421 vs 273 rps**; threads **22 vs 74**; p95 **170 vs 289** |
| `java21-platform-high` vs `java21-virtual-high` | threading only | **1923 vs 1854 rps** (smaller gap when CPU-rich); threads **23 vs 72** |
| `java21-virtual-low` vs `java25-virtual-amd64-low` | JDK 21→25 (cgroup also differs: 0.5/256m vs 1.0/512m) | 422 vs 1223 rps — **confounded by footprint** |
| low vs high within a JDK | cgroup / heap | Large RPS jumps (e.g. Java 11: 432 → 1429) |

An earlier Java 21-only capacity smoke (§6 in prior revisions) is superseded by these medians.

### 6.4 Skipped

| Target | Reason |
| :-- | :-- |
| `java25-virtual-arm-low` | `docker compose up` exit 1 on this host |
| `java25-virtual-arm-high` | same |

---

## 7. Next experiments, in value order

1. ~~Full amd64 capacity matrix~~ — done (§6).
2. **Scale SSE to 200–1000 connections** on the Java 21 pair (RSS / thread divergence).
3. Fix ARM compose start (QEMU/binfmt or image pull) and measure `java25-virtual-arm-*`.
4. **5+ reps on context-switch**, or windowed mean, so paced-sweep §5.2 resolves.
5. **Parse JFR properly** to replace line-count proxies.
6. Capacity at 100–200 VUs on the one-variable Java 21 pair.

---

## 8. Reproducing

```powershell
docker compose -f docker-compose.yml -f docker-compose.extra.yml up -d --build orchestrator
.\scripts\run-benchmarks.ps1 -Vus 50 -ThinkTime 0 -Reps 3 -SseReps 2   # full default matrix
node scripts\analyze-benchmarks.mjs
node scripts\analyze-benchmarks.mjs --json | node scripts\format-benchmark-md.mjs
# paced first sweep (§2–3): -ThinkTime 0.2 -Vus 10 and a narrower -Targets list
```

Per-run artifacts stay in `orchestrator/runs/{runId}/`: k6 `summary.json`, sampled
`stats-series.json`, and `bench.jfr`. Run records carry the matrix dimensions, so the dashboard's
historical comparison can select any of these cells directly.
