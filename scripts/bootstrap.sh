#!/usr/bin/env bash
# Wrapper for scripts/bootstrap.ts — provisions vault, agent, and policy using a human 1ck_ key.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "${ROOT}"

if ! command -v npx >/dev/null 2>&1; then
  echo "Error: npx is required" >&2
  exit 1
fi

exec npx tsx scripts/bootstrap.ts "$@"
