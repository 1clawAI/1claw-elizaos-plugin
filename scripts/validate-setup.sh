#!/usr/bin/env bash
# validate-setup.sh — Smoke-test 1Claw API and optional agent credentials for elizaOS.
# Usage:
#   ./scripts/validate-setup.sh
#   ONECLAW_AGENT_API_KEY=ocv_... ./scripts/validate-setup.sh
set -euo pipefail

BASE_URL="${ONECLAW_BASE_URL:-https://api.1claw.xyz}"
API_KEY="${ONECLAW_AGENT_API_KEY:-}"

pass() { printf 'OK   %s\n' "$1"; }
fail() { printf 'FAIL %s\n' "$1" >&2; exit 1; }
warn() { printf 'WARN %s\n' "$1"; }

if ! command -v curl >/dev/null 2>&1; then
  fail "curl is required"
fi

health_code=$(curl -s -o /tmp/1claw-health.json -w '%{http_code}' "${BASE_URL}/v1/health" || true)
if [[ "${health_code}" != "200" ]]; then
  fail "GET ${BASE_URL}/v1/health returned HTTP ${health_code}"
fi
pass "API health (${BASE_URL}/v1/health)"

if [[ -z "${API_KEY}" ]]; then
  warn "ONECLAW_AGENT_API_KEY not set — skipping agent-token test"
  pass "Smoke complete (health only). Use agent key from bootstrap (.env.elizaos)."
  exit 0
fi

if [[ "${API_KEY}" == 1ck_* ]]; then
  fail "Use agent key (ocv_...) here, not human key (1ck_...). Run npm run bootstrap first."
fi

token_body=$(curl -s -w '\n%{http_code}' -X POST "${BASE_URL}/v1/auth/agent-token" \
  -H "Content-Type: application/json" \
  -d "$(printf '{"api_key":"%s"}' "${API_KEY}")")
token_http=$(echo "${token_body}" | tail -n1)
token_json=$(echo "${token_body}" | sed '$d')

if [[ "${token_http}" != "200" ]]; then
  fail "agent-token returned HTTP ${token_http}"
fi
pass "agent-token exchange"

if command -v jq >/dev/null 2>&1; then
  agent_id=$(echo "${token_json}" | jq -r '.agent_id // empty')
  if [[ -n "${agent_id}" && "${agent_id}" != "null" ]]; then
    pass "agent_id=${agent_id}"
  fi
fi

pass "Validation complete"
