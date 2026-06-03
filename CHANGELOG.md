# Changelog

## 0.1.1 — 2026-06-03

- Bootstrap script (`npm run bootstrap`) — human `1ck_` key provisions vault, agent, and policy; writes agent-only `.env.elizaos`
- `npm run validate` — smoke test with `ocv_` agent key
- `npm run test:integration` — live end-to-end bootstrap + validate (CI-friendly skip without creds)

## 0.1.0 — 2026-06-03

Initial release.

- **Service**: `OneClawService` — singleton wrapping `@1claw/sdk` with automatic token exchange and refresh.
- **Provider**: `ONECLAW_VAULT` — injects vault paths, signing keys, and daily spend into agent context.
- **Actions**:
  - `GET_SECRET` — fetch a secret by path (redacted in chat output).
  - `LIST_SECRETS` — list available secret paths (never values).
  - `PUT_SECRET` — store or update a secret with path validation.
  - `SIGN_MESSAGE` — EIP-191 personal sign via Intents API.
  - `SIGN_TYPED_DATA` — EIP-712 typed data signing.
  - `SIMULATE_TRANSACTION` — Tenderly simulation before broadcast.
  - `SUBMIT_TRANSACTION` — sign and broadcast EVM transactions with guardrails.
  - `LIST_SIGNING_KEYS` — show provisioned chains and public addresses.
