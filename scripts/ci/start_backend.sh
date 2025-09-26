#!/usr/bin/env bash
# shellcheck shell=bash
set -euo pipefail

PORT="${1:-5000}"
HEALTH_URL="${2:-http://127.0.0.1:5000/api/health}"

# Env: FLASK_APP, SQLALCHEMY_DATABASE_URI expected (set in workflow step)
nohup flask run --host 127.0.0.1 --port "${PORT}" --no-reload > backend.log 2>&1 &

for attempt in $(seq 1 90); do
  if curl -fsS "${HEALTH_URL}" >/dev/null; then
    echo "Backend is up! (attempt ${attempt}/90)"
    exit 0
  fi
  sleep 1
done

echo "---- backend.log ----"
tail -n +1 backend.log || true
exit 1
