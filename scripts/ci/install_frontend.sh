#!/usr/bin/env bash
# shellcheck shell=bash
set -euo pipefail

# Run from repo root, with working-directory=frontend
npm ci --no-audit --no-fund || {
  echo "Lockfile out of sync → regenerating…"
  rm -f package-lock.json
  npm install --package-lock-only --no-audit --no-fund
  npm ci --no-audit --no-fund || {
    echo "Fallback to npm install (non-strict)"
    rm -rf node_modules
    npm install --no-audit --no-fund
  }
}
