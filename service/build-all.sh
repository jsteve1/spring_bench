#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

if command -v mvn >/dev/null 2>&1; then
  MVN="mvn"
elif [ -x "$ROOT/../.tools/apache-maven-3.9.9/bin/mvn" ]; then
  MVN="$ROOT/../.tools/apache-maven-3.9.9/bin/mvn"
else
  echo "Maven not found. Install Maven 3.9+ or bootstrap .tools/apache-maven." >&2
  exit 1
fi

echo "Building insurance service modules..."
"$MVN" -q clean package

APPS_DIR="$ROOT/../apps"
mkdir -p "$APPS_DIR"

cp "$ROOT/app-legacy/target/insurance-legacy.jar" "$APPS_DIR/insurance-legacy.jar"
cp "$ROOT/app-modern/target/insurance-modern.jar" "$APPS_DIR/insurance-modern.jar"
cp "$APPS_DIR/insurance-legacy.jar" "$APPS_DIR/insurance-j8.jar"
cp "$APPS_DIR/insurance-legacy.jar" "$APPS_DIR/insurance-j11.jar"
cp "$APPS_DIR/insurance-modern.jar" "$APPS_DIR/insurance-j17.jar"
cp "$APPS_DIR/insurance-modern.jar" "$APPS_DIR/insurance-j21.jar"

echo "Artifacts written to $APPS_DIR"
ls -la "$APPS_DIR"/*.jar
