# @1claw/plugin-elizaos

HSM-backed secrets and multi-chain signing for [elizaOS](https://elizaos.ai) agents via [1Claw](https://1claw.xyz).

Your agent gets vault access and signing keys without ever seeing private keys or holding credentials in context.

## Install

```bash
npm install @1claw/plugin-elizaos
# or
bun add @1claw/plugin-elizaos
```

## Quick Start

Add to your character's plugins:

```json
{
  "name": "my-agent",
  "plugins": ["@1claw/plugin-elizaos"],
  "settings": {
    "secrets": {
      "ONECLAW_AGENT_API_KEY": "ocv_your_key_here"
    }
  }
}
```

That's it. The plugin will authenticate with 1Claw on boot, discover the agent's vault, and inject available secret paths and signing keys into the agent's context.

## Configuration

| Variable | Required | Default | Description |
|---|---|---|---|
| `ONECLAW_AGENT_API_KEY` | Yes | — | Agent API key from [1claw.xyz/dashboard](https://1claw.xyz/dashboard), format `ocv_...` |
| `ONECLAW_AGENT_ID` | No | auto | Override auto-discovery (rarely needed) |
| `ONECLAW_VAULT_ID` | No | auto | Pin a specific vault when agent has multiple |
| `ONECLAW_BASE_URL` | No | `https://api.1claw.xyz` | API endpoint |
| `ONECLAW_USE_SHROUD` | No | `false` | Route through Shroud TEE proxy at `shroud.1claw.xyz` |

## Actions

| Action | Description |
|---|---|
| `GET_SECRET` | Fetch a secret by path. Value goes to tool channel, never chat. |
| `LIST_SECRETS` | List available paths (no values). |
| `PUT_SECRET` | Store or update a secret. |
| `SIGN_MESSAGE` | EIP-191 personal sign (agent's signing key never leaves HSM). |
| `SIGN_TYPED_DATA` | EIP-712 structured data signing. |
| `SIMULATE_TRANSACTION` | Tenderly dry-run before broadcasting. |
| `SUBMIT_TRANSACTION` | Sign + broadcast EVM transactions with server-side guardrails. |
| `LIST_SIGNING_KEYS` | Show provisioned chains and public addresses. |

## Security Model

- **The agent only sees what the human's policies grant.** An `ocv_` API key has zero access by default — a human must create policies on the 1Claw dashboard.
- Secret values retrieved via `GET_SECRET` are returned in the action's data payload but marked `[REDACTED]` in the user-facing text.
- Private keys for signing never leave the HSM/TEE. The agent submits intents; 1Claw signs server-side.
- Per-agent guardrails (address allowlists, value caps, daily limits, chain restrictions) are enforced server-side before any signing occurs.

## Example Character

```json
{
  "name": "DeFi Agent",
  "plugins": ["@1claw/plugin-elizaos"],
  "bio": "I manage on-chain positions using 1Claw for secure signing.",
  "settings": {
    "secrets": {
      "ONECLAW_AGENT_API_KEY": "ocv_abcdef123456"
    }
  }
}
```

## Development

```bash
git clone https://github.com/1clawAI/1claw-elizaos-plugin.git
cd 1claw-elizaos-plugin
npm install
npm run build
npm test
```

## Roadmap (out of scope for v0.1)

- Treasury wallet actions (delegated-treasury flow)
- Platform API actions (multi-tenant provisioning)
- Shroud as model-provider plugin (`plugin-1claw-shroud`)
- CMEK / MPC client-share handling

## Links

- [1Claw Platform](https://1claw.xyz)
- [Integration Guide](https://1claw.xyz/for-ai)
- [Shroud TEE Proxy](https://1claw.xyz/shroud)
- [Intents API](https://1claw.xyz/intents)
- [Documentation](https://docs.1claw.xyz)
- [@1claw/sdk on npm](https://www.npmjs.com/package/@1claw/sdk)

## License

MIT
