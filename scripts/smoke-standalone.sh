#!/usr/bin/env bash
# Smoke standalone mode (DoD #8) without Docker.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
JAR="${JAR:-$ROOT/apps/insurance-modern.jar}"
PORT="${SERVER_PORT:-18080}"
DB="$ROOT/data/smoke-office.db"
USER_NAME="${APP_ADMIN_USER:-admin}"
PASS="${APP_ADMIN_PASSWORD:-changeme}"

if [[ ! -f "$JAR" ]]; then
  echo "Missing $JAR — run: cd service && ./build-all.sh" >&2
  exit 1
fi

mkdir -p "$ROOT/data"
rm -f "$DB"
SPRING_PROFILES_ACTIVE=standalone \
DB_PATH="$DB" \
SERVER_PORT="$PORT" \
APP_ADMIN_USER="$USER_NAME" \
APP_ADMIN_PASSWORD="$PASS" \
java -jar "$JAR" > /tmp/standalone-smoke.log 2>&1 &
PID=$!
cleanup() { kill "$PID" 2>/dev/null || true; }
trap cleanup EXIT

for i in $(seq 1 60); do
  if curl -sf "http://127.0.0.1:${PORT}/health" >/dev/null; then
    break
  fi
  sleep 1
done

curl -sf "http://127.0.0.1:${PORT}/health" | tee /tmp/standalone-health.json
echo

CODE=$(curl -s -o /tmp/standalone-unauth.json -w "%{http_code}" \
  -X POST "http://127.0.0.1:${PORT}/members" \
  -H 'Content-Type: application/json' \
  -d '{"demographics":{"fname":"Ada","lname":"Lovelace","email":"ada@example.com","phoneNumber":"+1-555-0100","status":"ALIVE"}}')
echo "unauth POST /members -> $CODE"
[[ "$CODE" == "401" ]] || { echo "expected 401"; exit 1; }

CODE=$(curl -s -o /tmp/standalone-auth.json -w "%{http_code}" \
  -u "${USER_NAME}:${PASS}" \
  -X POST "http://127.0.0.1:${PORT}/members" \
  -H 'Content-Type: application/json' \
  -d '{"demographics":{"fname":"Ada","lname":"Lovelace","email":"ada@example.com","phoneNumber":"+1-555-0100","status":"ALIVE"}}')
echo "auth POST /members -> $CODE"
[[ "$CODE" == "201" || "$CODE" == "200" ]] || { echo "expected 201"; cat /tmp/standalone-auth.json; exit 1; }

# updatedBy should be the authenticated principal
grep -q "\"updatedBy\":\"${USER_NAME}\"" /tmp/standalone-auth.json \
  || grep -q "\"updatedBy\": \"${USER_NAME}\"" /tmp/standalone-auth.json \
  || { echo "updatedBy missing"; cat /tmp/standalone-auth.json; exit 1; }

SEED=$(curl -s -o /tmp/standalone-seed.json -w "%{http_code}" \
  -u "${USER_NAME}:${PASS}" -X POST "http://127.0.0.1:${PORT}/seed?count=1")
echo "auth POST /seed -> $SEED"
[[ "$SEED" == "403" ]] || { echo "expected seed disabled (403)"; cat /tmp/standalone-seed.json; exit 1; }

echo "standalone smoke ok"
