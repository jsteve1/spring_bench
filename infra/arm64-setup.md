# ARM64 Emulation Setup

Java 25 matrix rows use `platform: linux/arm64/v8`. On an amd64 host, install QEMU binfmt handlers:

```bash
docker run --privileged --rm tonistiigi/binfmt --install arm64
```

Verify:

```bash
docker run --rm --platform linux/arm64/v8 eclipse-temurin:25-jdk-alpine java -version
```

**Interpretation:** emulated ARM throughput is for capability testing, not apples-to-apples speed
comparisons. Add native `java25-virtual-amd64-*` rows (`docs/01 §4.2`) to isolate emulation cost.

**Image digests:** pin the **arm64 platform manifest** digest on `java25-virtual-arm-*` services
(not the multi-arch index). On Docker Desktop, resolving the index to amd64 first then starting
`platform: linux/arm64/v8` fails with `cannot overwrite digest`. Health under QEMU often needs
4–6+ minutes; `scripts/run-benchmarks.ps1` waits up to 900s.
