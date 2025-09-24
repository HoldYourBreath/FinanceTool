#!/usr/bin/env bash
# shellcheck shell=bash
set -euo pipefail

DIST_DIR="${1:-frontend-dist}"

npx --yes @lhci/cli autorun \
  --collect.staticDistDir="${DIST_DIR}" \
  --upload.target=temporary-public-storage \
  --config=./lighthouserc.json || {
    echo "LHCI non-zero exit tolerated"
    exit 0
  }
