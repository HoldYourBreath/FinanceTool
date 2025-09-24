#!/usr/bin/env bash
# shellcheck shell=bash
set -euo pipefail

ROOT="${1:-frontend-dist}"
PORT="${2:-5173}"

echo "Serving ${ROOT} on port ${PORT}"
(npx --yes sirv-cli "${ROOT}" --single --host 127.0.0.1 --port "${PORT}" > vite.log 2>&1 &) || true

for attempt in $(seq 1 60); do
  if curl -fsS "http://127.0.0.1:${PORT}/" >/dev/null 2>&1; then
    echo "Frontend is up (attempt ${attempt}/60)"
    exit 0
  fi
  sleep 1
done

echo "---- vite.log ----"; cat vite.log || true
echo "---- node processes ----"; pgrep -a -f "sirv|serve" || true
exit 1
