#!/usr/bin/env bash
# Live integration test for bootstrap.ts (requires platform admin or human creds in env).
# Sources repo root .env when present. Does not print API keys.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
REPO_ROOT="$(cd "${ROOT}/../.." && pwd)"
API_URL="${ONECLAW_BASE_URL:-https://api.1claw.xyz}"
API_URL="${API_URL%/}"
STAMP="$(date +%s)"
OUT="${ROOT}/.env.elizaos.test-${STAMP}"
cleanup() { rm -f "${OUT}"; }
trap cleanup EXIT

if [[ -f "${REPO_ROOT}/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "${REPO_ROOT}/.env"
  set +a
fi

email="${ONECLAW_TEST_EMAIL:-${ADMIN_EMAIL:-}}"
pass="${ONECLAW_TEST_PASSWORD:-${ADMIN_PASSWORD:-}}"

mint_human_key() {
  [[ -n "${email}" && -n "${pass}" ]] || return 1
  local token key
  token=$(curl -s -X POST "${API_URL}/v1/auth/token" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"${email}\",\"password\":\"${pass}\"}" \
    --max-time 30 | python3 -c "import sys,json; print(json.load(sys.stdin).get('access_token',''))" 2>/dev/null || true)
  [[ -n "${token}" ]] || return 1
  key=$(curl -s -X POST "${API_URL}/v1/auth/api-keys" \
    -H "Authorization: Bearer ${token}" \
    -H "Content-Type: application/json" \
    -d "{\"name\":\"elizaos-bootstrap-test-${STAMP}\",\"scopes\":[]}" \
    --max-time 30 | python3 -c "import sys,json; print(json.load(sys.stdin).get('api_key',''))" 2>/dev/null || true)
  [[ "${key}" == 1ck_* ]] || return 1
  printf '%s' "${key}"
}

echo "==> elizaOS bootstrap integration test"

human_key="${ONECLAW_HUMAN_API_KEY:-}"
if [[ -z "${human_key}" ]]; then
  human_key="$(mint_human_key)" || true
fi
if [[ -z "${human_key}" ]]; then
  echo "SKIP: set ONECLAW_HUMAN_API_KEY or ADMIN_EMAIL+ADMIN_PASSWORD in ${REPO_ROOT}/.env" >&2
  exit 0
fi

cd "${ROOT}"
export ONECLAW_HUMAN_API_KEY="${human_key}"
export ONECLAW_AGENT_NAME="elizaos-bootstrap-test-${STAMP}"
export ONECLAW_VAULT_NAME="elizaos-vault-test-${STAMP}"
export ONECLAW_OUTPUT_FILE="${OUT}"

npm run bootstrap

[[ -f "${OUT}" ]] || { echo "FAIL: ${OUT} not created" >&2; exit 1; }
grep -q '^ONECLAW_AGENT_API_KEY=ocv_' "${OUT}" || { echo "FAIL: missing agent key in output" >&2; exit 1; }
grep -qE '^ONECLAW_HUMAN' "${OUT}" && { echo "FAIL: human key var in output file" >&2; exit 1; }
grep -qE '^1ck_' "${OUT}" && { echo "FAIL: human key prefix in output file" >&2; exit 1; }

set -a
# shellcheck disable=SC1090
source "${OUT}"
set +a
bash scripts/validate-setup.sh

echo "PASS: bootstrap + validate"
