#!/usr/bin/env bash
# Build the custom k6 binary with xk6-sse (LOAD-02).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
docker compose --profile tools build k6-sse
echo "Built image: bench/k6-sse"
docker run --rm bench/k6-sse version
