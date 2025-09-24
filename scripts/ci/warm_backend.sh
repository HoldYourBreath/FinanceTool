#!/usr/bin/env bash
# shellcheck shell=bash
set -euo pipefail

BASE_URL="${1:-http://127.0.0.1:5000}"

# Set deterministic baseline
curl -fsS -X POST "${BASE_URL}/api/settings/prices" \
  -H 'content-type: application/json' \
  --data '{"data":{"interest_rate_pct":5,"downpayment_sek":0}}' >/dev/null

# Wait until the GET reflects the POST (eventual consistency guard)
for attempt in $(seq 1 50); do
  got="$(curl -fsS "${BASE_URL}/api/settings/prices" | tr -d '[:space:]')"
  echo "prices (attempt ${attempt}/50): ${got}"
  if echo "${got}" | grep -q '"interest_rate_pct":5' && echo "${got}" | grep -q '"downpayment_sek":0'; then
    break
  fi
  sleep 0.1
done

# Force recompute for car TCO then warm the endpoint (bust caches)
curl -fsS -X POST "${BASE_URL}/api/cars/update" || true
curl -fsS "${BASE_URL}/api/cars?ts=$(date +%s%N)" >/dev/null
