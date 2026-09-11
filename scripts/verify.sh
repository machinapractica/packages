#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
mkdir -p evidence
run() {
  label="$1"
  shift
  if "$@" > "evidence/$label.log" 2>&1; then cat "evidence/$label.log";
  else result=$?; cat "evidence/$label.log"; exit "$result"; fi
}
run dependencies npm ci --ignore-scripts
run browser npx --no-install playwright install chromium
run verification npm run verify
